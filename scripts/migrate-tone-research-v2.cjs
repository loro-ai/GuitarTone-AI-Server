/**
 * Migración toneResearch v1 → v2
 * Genera ampReference, songStructure y baseTone desde datos legacy
 * Para canciones que ya tienen toneResearch pero faltan campos v2
 *
 * Usage: node scripts/migrate-tone-research-v2.cjs [--artist "Red Hot Chili Peppers"] [--dry-run]
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const artistIdx = args.indexOf('--artist');
const ARTIST_FILTER = artistIdx >= 0 ? args[artistIdx + 1] : null;

// ── Texture mapping ──
const DISTORTION_TO_TEXTURE = {
  'clean': 'clean',
  'light-crunch': 'crunch',
  'crunch': 'crunch',
  'high-gain': 'heavy',
  'heavy': 'heavy',
};

// ── Character inference from amp name ──
function inferAmpCharacter(marca, modelo) {
  const name = `${marca} ${modelo}`.toLowerCase();
  if (name.includes('fender') || name.includes('twin') || name.includes('deluxe') || name.includes('princeton')) return 'bright';
  if (name.includes('marshall') || name.includes('jcm') || name.includes('plexi') || name.includes('800')) return 'neutral';
  if (name.includes('mesa') || name.includes('boogie') || name.includes('rectifier') || name.includes('dual')) return 'dark';
  if (name.includes('vox') || name.includes('ac30') || name.includes('ac15')) return 'bright';
  if (name.includes('orange')) return 'dark';
  if (name.includes('soldano') || name.includes('diezel') || name.includes('friedman')) return 'dark';
  return 'neutral';
}

// ── Gain base inference from distortion level ──
function inferGainBase(nivelDistorsion) {
  const map = { 'clean': 20, 'light-crunch': 35, 'crunch': 50, 'high-gain': 70, 'heavy': 85 };
  return map[nivelDistorsion] ?? 50;
}

// ── EQ inference from amp character ──
function inferEqBase(caracter, nivelDistorsion) {
  const base = { bright: { bass: 40, mid: 55, treble: 70 }, dark: { bass: 65, mid: 50, treble: 45 }, neutral: { bass: 50, mid: 55, treble: 55 } };
  const eq = { ...(base[caracter] || base.neutral) };
  // Adjust for distortion — more gain usually means scooped mids
  if (nivelDistorsion === 'heavy' || nivelDistorsion === 'high-gain') {
    eq.mid = Math.max(eq.mid - 10, 30);
    eq.bass = Math.min(eq.bass + 5, 80);
  }
  if (nivelDistorsion === 'clean') {
    eq.mid = Math.min(eq.mid + 5, 70);
    eq.treble = Math.min(eq.treble + 5, 80);
  }
  return eq;
}

// ── Section intensity ──
function inferIntensity(dinamica, nivel_distorsion) {
  const dMap = { 'pp': 1, 'p': 2, 'mp': 4, 'mf': 5, 'f': 7, 'ff': 9 };
  const gMap = { 'clean': 2, 'light-crunch': 4, 'crunch': 5, 'high-gain': 7, 'heavy': 9 };
  const d = dMap[dinamica] ?? 5;
  const g = gMap[nivel_distorsion] ?? 5;
  return Math.round((d + g) / 2);
}

// ── EQ adjust per section ──
function inferEqAdjust(baseEq, texture, section) {
  const eq = { ...baseEq };
  // Solo sections: boost mids and treble
  if (section === 'solo' || section === 'bridge' || section === 'puente') {
    eq.mid = Math.min(eq.mid + 10, 80);
    eq.treble = Math.min(eq.treble + 5, 85);
  }
  // Coro: slightly boost everything
  if (section === 'coro' || section === 'estribillo' || section === 'chorus') {
    eq.bass = Math.min(eq.bass + 5, 75);
    eq.treble = Math.min(eq.treble + 5, 80);
  }
  // Clean sections: cut bass, boost treble
  if (texture === 'clean') {
    eq.bass = Math.max(eq.bass - 5, 30);
    eq.treble = Math.min(eq.treble + 5, 85);
  }
  // Heavy sections: boost bass
  if (texture === 'heavy') {
    eq.bass = Math.min(eq.bass + 10, 80);
    eq.mid = Math.max(eq.mid - 5, 35);
  }
  return eq;
}

// ── Gain delta ──
function inferGainDelta(baseGain, sectionTexture, globalTexture) {
  if (sectionTexture === globalTexture) return 0;
  const levels = ['clean', 'crunch', 'heavy'];
  const sIdx = levels.indexOf(sectionTexture);
  const gIdx = levels.indexOf(globalTexture);
  return (sIdx - gIdx) * 15;
}

// ── Normalize section name ──
function normalizeSection(seccion) {
  const map = {
    'intro': 'intro', 'verso': 'verso', 'verse': 'verso',
    'coro': 'coro', 'chorus': 'coro', 'estribillo': 'coro',
    'pre-coro': 'pre-coro', 'precoro': 'pre-coro', 'pre chorus': 'pre-coro',
    'solo': 'solo',
    'puente': 'bridge', 'bridge': 'bridge',
    'outro': 'outro', 'ending': 'outro',
    'riff': 'riff',
    'breakdown': 'breakdown',
    'interludio': 'bridge', 'interlude': 'bridge',
    'hook': 'coro', 'refrain': 'coro', 'climax': 'solo',
  };
  return map[(seccion || '').toLowerCase()] || 'verso';
}

async function main() {
  console.log(`\n🎸 Migración toneResearch v1 → v2`);
  console.log(`   Artist: ${ARTIST_FILTER || 'TODOS'}`);
  console.log(`   Dry run: ${DRY_RUN}\n`);

  await mongoose.connect(MONGO_URI);
  const Song = mongoose.model('Song', new mongoose.Schema({}, { strict: false, collection: 'songs' }));

  const filter = { 'toneResearch.researchedAt': { $exists: true } };
  if (ARTIST_FILTER) filter.artist = new RegExp(ARTIST_FILTER, 'i');

  const songs = await Song.find(filter).lean();
  console.log(`Found ${songs.length} songs with toneResearch\n`);

  let migrated = 0, skipped = 0, errors = 0;

  for (const song of songs) {
    const tr = song.toneResearch;
    if (!tr) { skipped++; continue; }

    // Skip if already has v2 fields
    if (tr.ampReference && tr.songStructure?.length > 0 && tr.baseTone) {
      skipped++;
      continue;
    }

    try {
      const updates = {};
      const amp = tr.amplificador || {};
      const nivelDistorsion = tr.nivelDistorsion || 'crunch';

      // 1. ampReference
      if (!tr.ampReference) {
        const caracter = inferAmpCharacter(amp.marca || '', amp.modelo || '');
        const gainBase = inferGainBase(nivelDistorsion);
        const eqBase = inferEqBase(caracter, nivelDistorsion);

        updates['toneResearch.ampReference'] = {
          marca: amp.marca || 'Unknown',
          modelo: amp.modelo || 'Unknown',
          caracter,
          gainBase,
          eqBase,
          notes: amp.configuracion || tr.notes || '',
        };
      }

      // 2. baseTone
      if (!tr.baseTone) {
        updates['toneResearch.baseTone'] = {
          nivelDistorsion,
          esTocadoLimpio: tr.esTocadoLimpio ?? false,
        };
      }

      // 3. songStructure from estructura
      if (!tr.songStructure || tr.songStructure.length === 0) {
        const estructura = tr.estructura || [];
        const caracter = (tr.ampReference?.caracter) || inferAmpCharacter(amp.marca || '', amp.modelo || '');
        const baseEq = (tr.ampReference?.eqBase) || inferEqBase(caracter, nivelDistorsion);
        const baseGain = (tr.ampReference?.gainBase) || inferGainBase(nivelDistorsion);
        const globalTexture = DISTORTION_TO_TEXTURE[nivelDistorsion] || 'crunch';

        if (estructura.length > 0) {
          updates['toneResearch.songStructure'] = estructura.map(sec => {
            const texture = DISTORTION_TO_TEXTURE[sec.nivel_distorsion] || globalTexture;
            const section = normalizeSection(sec.seccion);
            return {
              section,
              intensity: inferIntensity(sec.dinamica, sec.nivel_distorsion),
              texture,
              keyEffects: sec.efectos_clave || [],
              eqAdjust: inferEqAdjust(baseEq, texture, section),
              gainDelta: inferGainDelta(baseGain, texture, globalTexture),
              technique: sec.tecnica || undefined,
            };
          });
        } else {
          // Generate minimal structure: verso + coro
          updates['toneResearch.songStructure'] = [
            { section: 'verso', intensity: 4, texture: globalTexture, keyEffects: [], eqAdjust: baseEq, gainDelta: 0 },
            { section: 'coro', intensity: 6, texture: globalTexture === 'clean' ? 'crunch' : globalTexture, keyEffects: [], eqAdjust: inferEqAdjust(baseEq, globalTexture, 'coro'), gainDelta: 10 },
          ];
        }
      }

      if (Object.keys(updates).length === 0) {
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`[DRY] ${song.title} — ${song.artist}`);
        console.log(`  Updates: ${Object.keys(updates).join(', ')}`);
      } else {
        await Song.updateOne({ _id: song._id }, { $set: updates });
      }
      migrated++;

    } catch (err) {
      console.error(`ERROR: ${song.title} — ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Migración completada`);
  console.log(`   Migrados: ${migrated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
