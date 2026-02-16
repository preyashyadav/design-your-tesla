# Design Your Tesla

Monorepo with:

- `mobile/`: Expo React Native + TypeScript configurator app
- `backend/`: Go API with JWT auth + SQLite design storage

## Implemented Features

### Backend (`backend/`)

- `GET /health` -> `{ "ok": true }`
- Auth:
  - `POST /auth/register` `{ email, password }`
  - `POST /auth/login` `{ email, password }` -> `{ token }`
  - `GET /me` (Bearer token required)
- Catalog:
  - `GET /catalog/model` (public)
- Designs (Bearer token required):
  - `POST /designs`
  - `GET /designs`
  - `GET /designs/:id`
  - `PUT /designs/:id`
  - `POST /designs/:id/submit`
- Admin workflow (protected by admin secret):
  - `GET /admin/submissions`
  - `POST /admin/designs/:id/approve`
  - `POST /admin/designs/:id/reject` with `{ "reason": "..." }`
- Design lifecycle status:
  - `DRAFT`
  - `SUBMITTED`
  - `APPROVED`
  - `REJECTED` (stores rejection reason)
- Submission validation:
  - Must include Body_Paint and Glass selections
  - Glass selection must use `patternId: "NONE"`
- Per-user data isolation enforced at query/update time.
- SQLite schema auto-creates tables on startup:
  - `users`
  - `designs`

### Mobile (`mobile/`)

- Login/Register screen
- Secure JWT persistence with `expo-secure-store` (fallback cache in AsyncStorage)
- Configurator screen with live 3D editing
- Saved Designs screen sourced from backend
- Catalog-driven materials/options:
  - material list comes from `GET /catalog/model`
  - finish/pattern options come from catalog
- Save Design now writes to backend (`POST /designs`)
- Submit for approval from Saved Designs summary (`POST /designs/:id/submit`)
- Status badge shown on configurator and saved design cards
- Rejection reason shown for rejected designs
- Local cache of fetched designs retained with AsyncStorage

## Project Structure

```text
.
├── backend
│   ├── go.mod
│   ├── go.sum
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

- Node.js 20 or 22 recommended (`>=18 <25` supported by this app)
- npm
- Go 1.22+

## Run Backend

```bash
cd backend
go run .
```

By default:

- server runs on `http://localhost:8080`
- SQLite DB file is `backend/design_your_tesla.db`

Optional env vars:

- `JWT_SECRET` (recommended in non-dev use)
- `DB_PATH` (custom SQLite file path)
- `PORT` (default: `8080`)
- `ADMIN_SECRET` (used by `/admin/*`, default: `admin-dev-secret`)

Health check:

```bash
curl localhost:8080/health
```

Expected:

```json
{"ok":true}
```

## Run Mobile

```bash
cd mobile
npm install
npx expo start
```

## Configure Mobile -> Backend Base URL

The mobile app reads API base URL from `EXPO_PUBLIC_API_BASE_URL`.

Examples:

```bash
# iOS simulator / web
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080 npx expo start

# Android emulator
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080 npx expo start
```

If not set, the app defaults to:

- Android: `http://10.0.2.2:8080`
- Others: `http://localhost:8080`

## Acceptance Flow (Manual)

1. Register user:

```bash
curl -X POST localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@example.com","password":"password123"}'
```

2. Login:

```bash
curl -X POST localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@example.com","password":"password123"}'
```

3. Use returned token:

```bash
curl localhost:8080/me -H "Authorization: Bearer <TOKEN>"
```

4. Save and list designs from app or with API:

```bash
curl -X GET localhost:8080/designs -H "Authorization: Bearer <TOKEN>"
```

5. Submit a design:

```bash
curl -X POST localhost:8080/designs/<DESIGN_ID>/submit \
  -H "Authorization: Bearer <TOKEN>"
```

6. Admin approve/reject:

```bash
curl localhost:8080/admin/submissions -H "X-Admin-Secret: <ADMIN_SECRET>"

curl -X POST localhost:8080/admin/designs/<DESIGN_ID>/approve \
  -H "X-Admin-Secret: <ADMIN_SECRET>"

curl -X POST localhost:8080/admin/designs/<DESIGN_ID>/reject \
  -H "X-Admin-Secret: <ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Needs glass pattern fix"}'
```

## Tooling

### Mobile

```bash
cd mobile
npm run lint
npx tsc --noEmit
```

### Backend

```bash
cd backend
gofmt -w .
go test ./...
```

## 3D Model Credit

- Model: `Tesla cybertruk low poly`
- Author: [Igor Tretyakov](https://sketchfab.com/vdv77)
- Source: [Sketchfab model page](https://sketchfab.com/3d-models/tesla-cybertruk-low-poly-e3558b991e75418cb45624fab4d980e5)
- License: [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/)
