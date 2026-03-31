# Delivery Gateway Challenge

Ez a repository a próba feladat megoldását tartalmazza.

## Tartalom

- `1. feladat`: nagy adatmennyiségű pickup point szinkronizáció tervezés  
  Dokumentáció: [`docs/task-1-sync-architecture.md`](docs/task-1-sync-architecture.md)
- `2. feladat`: React + TypeScript alapú csomagpont-kereső és kiválasztó komponens  
  Kód: `web/`

## Használt technológiák és rövid indoklás

- `React + TypeScript`: gyors komponensfejlesztés, erős típusosság.
- `Vite`: gyors lokális fejlesztői környezet és egyszerű build.
- `Leaflet + react-leaflet`: stabil, jól ismert térképes megjelenítés.
- `Nominatim geocoding`: egyszerű cím/város keresési integráció.
- Saját viewport-alapú clustering: 10k+ pont esetén is kezelhető renderelés.

## Főbb funkciók (2. feladat)

- Pickup pontok betöltése GraphQL endpointból.
- Loading / error / retry állapotkezelés.
- Térkép marker megjelenítéssel.
- Viewport-alapú clustering nagy elemszámhoz.
- Cím/város kereső, ami térképet a találatra navigálja.
- Marker kattintásra részletező panel.
- Explicit `Kiválasztás` gomb, a kiválasztott pickup point ID komponens állapotban tárolva.
- Hibakezelés térkép tile betöltési hibára.

## Indítás

Előfeltétel:
- Node.js `>=20`
- npm

Lépések:

1. `cd web`
2. `npm install`
3. `.env` fájl létrehozása:
   - Linux/macOS: `cp .env.example .env`
   - PowerShell: `Copy-Item .env.example .env`
4. `npm run dev`
5. Böngészőben: `http://localhost:3000` vagy a Vite által kiírt URL

Megjegyzés:
- A beta GraphQL környezet első kérése lassabb lehet (cold start).

## Scriptek

- `npm run dev` - fejlesztői szerver
- `npm run build` - production build
- `npm run preview` - build preview

## Projekt struktúra (röviden)

- `docs/` - tervezési dokumentáció
- `web/src/config` - környezeti konfiguráció
- `web/src/lib` - közös kliensréteg (GraphQL)
- `web/src/features/location` - geocoding logika
- `web/src/features/pickup-points` - domain modell, adatlekérés, hook, map és kiválasztási UI
