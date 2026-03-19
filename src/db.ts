import { connectDB } from "./mongodb";
import { User, Gear, Song, Preset, SearchHistory } from "./models";
import type { IUser, IGear, ISong, IPreset, ISearchHistory, PresetConfig } from "./models";

// Conectar a MongoDB al iniciar
connectDB().catch(console.error);

// ============ USER HELPERS ============

export async function upsertUser(
  user: Partial<IUser> & { openId: string }
): Promise<void> {
  if (!user.openId) throw new Error("openId requerido");

  try {
    const existing = await User.findOne({ openId: user.openId });
    if (existing) {
      Object.assign(existing, {
        name: user.name ?? existing.name,
        email: user.email ?? existing.email,
        passwordHash: user.passwordHash ?? existing.passwordHash,
        loginMethod: user.loginMethod ?? existing.loginMethod,
        role: user.role ?? existing.role,
        lastSignedIn: user.lastSignedIn ?? new Date(),
      });
      await existing.save();
    } else {
      await User.create({
        openId: user.openId,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        loginMethod: user.loginMethod,
        role: user.role || "user",
        lastSignedIn: new Date(),
      });
    }
  } catch (error) {
    console.error("[DB] upsertUser error:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string): Promise<IUser | null> {
  try {
    const user = await User.findOne({ openId });
    return user ? user.toObject() : null;
  } catch (error) {
    console.error("[DB] getUserByOpenId error:", error);
    return null;
  }
}

export async function getUserByEmail(email: string): Promise<IUser | null> {
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    return user ? user.toObject() : null;
  } catch (error) {
    console.error("[DB] getUserByEmail error:", error);
    return null;
  }
}

// ============ GEAR HELPERS ============

export async function createGear(
  userId: string,
  gear: Omit<IGear, "_id" | "userId" | "createdAt" | "updatedAt">
): Promise<IGear> {
  const newGear = await Gear.create({ userId, ...gear });
  return newGear.toObject();
}

export async function getUserGear(userId: string): Promise<IGear[]> {
  const gear = await Gear.find({ userId });
  return gear.map((g) => g.toObject());
}

export async function getGearById(id: string): Promise<IGear | null> {
  try {
    const gear = await Gear.findById(id);
    return gear ? gear.toObject() : null;
  } catch {
    return null;
  }
}

export async function updateGear(
  id: string,
  updates: Partial<IGear>
): Promise<IGear | null> {
  try {
    const gear = await Gear.findByIdAndUpdate(id, updates, { new: true });
    return gear ? gear.toObject() : null;
  } catch {
    return null;
  }
}

export async function deleteGear(id: string): Promise<boolean> {
  try {
    const result = await Gear.findByIdAndDelete(id);
    return !!result;
  } catch {
    return false;
  }
}

export async function updateGearManual(
  id: string,
  manualData: NonNullable<IGear["manualData"]>
): Promise<IGear | null> {
  try {
    const gear = await Gear.findByIdAndUpdate(
      id,
      { manualData },
      { new: true }
    );
    return gear ? gear.toObject() : null;
  } catch {
    return null;
  }
}

// ============ SONG HELPERS ============

export async function createOrGetSong(
  song: Omit<ISong, "_id" | "createdAt" | "updatedAt">
): Promise<ISong> {
  try {
    let existing = await Song.findOne({ musicBrainzId: song.musicBrainzId });
    if (existing) return existing.toObject();
    const newSong = await Song.create(song);
    return newSong.toObject();
  } catch (error) {
    console.error("[DB] createOrGetSong error:", error);
    throw error;
  }
}

export async function getSongById(id: string): Promise<ISong | null> {
  try {
    const song = await Song.findById(id);
    return song ? song.toObject() : null;
  } catch {
    return null;
  }
}

export async function updateSongToneResearch(
  id: string,
  toneResearch: ISong["toneResearch"]
): Promise<ISong | null> {
  try {
    const song = await Song.findByIdAndUpdate(
      id,
      { toneResearch },
      { new: true }
    );
    return song ? song.toObject() : null;
  } catch {
    return null;
  }
}

// ============ PRESET HELPERS ============

export async function createPreset(
  preset: Omit<IPreset, "_id" | "createdAt" | "updatedAt">
): Promise<IPreset> {
  const newPreset = await Preset.create(preset);
  return newPreset.toObject();
}

export async function getUserPresets(userId: string): Promise<IPreset[]> {
  const presets = await Preset.find({ userId }).sort({ createdAt: -1 });
  return presets.map((p) => p.toObject());
}

export async function getUserFavoritePresets(userId: string): Promise<IPreset[]> {
  const presets = await Preset.find({ userId, isFavorite: true }).sort({
    createdAt: -1,
  });
  return presets.map((p) => p.toObject());
}

export async function getPresetById(id: string): Promise<IPreset | null> {
  try {
    const preset = await Preset.findById(id);
    return preset ? preset.toObject() : null;
  } catch {
    return null;
  }
}

export async function updatePreset(
  id: string,
  updates: Partial<IPreset>
): Promise<IPreset | null> {
  try {
    const preset = await Preset.findByIdAndUpdate(id, updates, { new: true });
    return preset ? preset.toObject() : null;
  } catch {
    return null;
  }
}

export async function deletePreset(id: string): Promise<boolean> {
  try {
    const result = await Preset.findByIdAndDelete(id);
    return !!result;
  } catch {
    return false;
  }
}

// ============ SEARCH HISTORY HELPERS ============

export async function addSearchHistory(
  history: Omit<ISearchHistory, "_id" | "createdAt">
): Promise<ISearchHistory> {
  const newHistory = await SearchHistory.create(history);
  return newHistory.toObject();
}

export async function getUserSearchHistory(
  userId: string
): Promise<ISearchHistory[]> {
  const history = await SearchHistory.find({ userId })
    .sort({ createdAt: -1 })
    .limit(50);
  return history.map((h) => h.toObject());
}

export async function clearUserSearchHistory(userId: string): Promise<boolean> {
  const result = await SearchHistory.deleteMany({ userId });
  return result.deletedCount > 0;
}
