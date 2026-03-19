# GuitarTone AI — Backend (API)

Servidor Express + tRPC + MongoDB. Se despliega en **Railway**.

## Stack
- Node.js + TypeScript
- Express.js
- tRPC v11
- MongoDB + Mongoose
- Anthropic Claude API (claude-sonnet-4-5 + web_search)
- JWT / OAuth (Manus)

---

## Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env
# → Editar .env con tus credenciales reales

# 3. Arrancar en modo desarrollo
npm run dev
# → http://localhost:3000
```

---

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `MONGODB_URI` | Connection string de MongoDB Atlas |
| `JWT_SECRET` | Secreto para firmar JWT (mínimo 32 chars) |
| `ANTHROPIC_API_KEY` | API key de Anthropic |
| `FRONTEND_URL` | URL del frontend en Vercel (ej: `https://guitartone.vercel.app`) |
| `VITE_APP_ID` | App ID de Manus |
| `OAUTH_SERVER_URL` | URL del servidor OAuth de Manus |

---

## Deploy en Railway

1. Crear proyecto en [railway.app](https://railway.app)
2. **New Service → GitHub Repo** → seleccionar este repo
3. Railway detecta automáticamente el `railway.toml`
4. Ir a **Variables** y agregar todas las variables de la tabla de arriba
5. Railway asigna automáticamente `PORT` — no lo agregues manualmente
6. Deploy automático en cada push a `main`

**URL del backend** (la necesitas para el frontend):
`https://<nombre>.up.railway.app`

---

## Endpoints

| Endpoint | Descripción |
|---|---|
| `GET /health` | Health check para Railway |
| `GET /api/oauth/callback` | Callback de OAuth |
| `POST /api/trpc/*` | Todas las rutas tRPC |

---

## Asignar rol admin

Para acceder a rutas de administrador:
```bash
# En MongoDB Atlas → Collections → users
db.users.updateOne(
  { email: "tu@email.com" },
  { $set: { role: "admin" } }
)
```

---

## Build

```bash
npm run build   # Compila a /dist
npm run start   # Ejecuta producción
```
