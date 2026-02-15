# Design Your Tesla

Monorepo with:

- `mobile/`: Expo React Native + TypeScript configurator app
- `backend/`: Go API

## What’s Implemented

### Mobile

- `Configurator` screen
  - Interactive 3D model viewer
  - Select parts/materials
  - Edit per-part:
    - `colorHex`
    - `finish` (`GLOSS` / `MATTE`)
    - `patternId` (`NONE`, `PATTERN_1`, `PATTERN_2`, `PATTERN_3`)
  - Real-time updates on the 3D model
  - Save named design
  - Reset to defaults
- `Saved Designs` screen
  - Lists local designs with name + timestamp
  - Tap to apply saved design
- Local persistence with AsyncStorage (survives app restarts)

### Backend

- `GET /health` returns:

```json
{ "ok": true }
```

## Project Structure

```text
.
├── backend
│   ├── go.mod
│   ├── main.go
│   └── Makefile
├── mobile
│   ├── App.tsx
│   ├── app.json
│   ├── assets/
│   ├── src/
│   └── package.json
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js 20 or 22 recommended
- npm
- Go 1.22+

## Run Mobile

```bash
cd mobile
npm install
npx expo start
```

## Run Backend

```bash
cd backend
go run .
```

Health check:

```bash
curl localhost:8080/health
```

Expected:

```json
{"ok": true}
```

## Mobile Tooling

```bash
cd mobile
npm run lint
npm run format:check
```

## Backend Tooling

```bash
cd backend
make fmt
```

## Git Push Checklist

```bash
git add .
git commit -m "feat: add Tesla configurator with saved local designs and typed material editing"
git branch -M main
git remote add origin <YOUR_REPO_URL>   # skip if already set
git push -u origin main
```

## Notes

- If Metro cache causes stale errors, run:

```bash
cd mobile
npx expo start -c
```

- On some Expo GL environments, texture logs like `gl.pixelStorei` may appear; they are usually non-fatal.

## 3D Model Credit

- Model: `Tesla cybertruk low poly`
- Author: [Igor Tretyakov](https://sketchfab.com/vdv77)
- Source: [Sketchfab model page](https://sketchfab.com/3d-models/tesla-cybertruk-low-poly-e3558b991e75418cb45624fab4d980e5)
- License: [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/)
