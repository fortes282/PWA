# CONTEXT.md — PWA Přístav Radosti — stav pro předání

Datum: 2026-03-21 20:50

## Repo & Deploy
- **GitHub:** https://github.com/fortes282/PWA
- **Lokálně:** /tmp/PWA (monorepo: apps/api, apps/web, packages/shared)
- **Stack:** Next.js 15 + Fastify + SQLite (Drizzle ORM) + Docker Compose
- **VPS (testování):** 109.123.243.52
- **SSH:** `sshpass -p "RjuWeY39ZveUuV5vxWJw" ssh -o StrictHostKeyChecking=no root@109.123.243.52`
- **Deploy:** `cd /opt/pristav && git pull && docker compose up -d --build`

## CI stav
- CI je ZELENÁ (lint + unit testy procházejí)
- E2E Playwright testy byly odstraněny z CI (způsobovaly problémy, mají běžet lokálně)
- CI workflow: `.github/workflows/ci.yml`

## Co bylo hotovo dnes (2026-03-21)

### Nasazeno na VPS ✅
1. **Fáze 4 animací** — page transitions, skeleton loaders, toast animace, swipe-to-dismiss, form micro-interakce
2. **Mobile fix** — opravena data na mobilu (NEXT_PUBLIC_API_URL bug), responsivní layout, PWA feel
3. **PWAInstallButton** na login stránce — Android nativní dialog, iOS step-by-step modal

### Čeká na implementaci ⏳
4. **Native mobile feel** — toto je priorita číslo 1, zatím NEimplementováno:

## TASK: Native Mobile Feel (implementuj toto)

### 1. Permanentní přihlášení (30 dní, bez checkboxu)
- **API** `apps/api/src/routes/auth.ts`: refresh token platnost 30d
- Najdi kde se nastavuje `JWT_REFRESH_EXPIRES_IN` nebo ekvivalent
- **Frontend** `apps/web/src/contexts/AuthContext.tsx`:
  - Refresh token ukládat do `localStorage` (přetrvá zavření prohlížeče)
  - Při startu appky automaticky zkus refresh pokud existuje uložený token

### 2. Adresní řádek pryč + fullscreen
- `apps/web/public/manifest.json`:
  - `"display_override": ["window-controls-overlay", "standalone", "minimal-ui"]`
  - `"theme_color": "#0ea5e9"`, `"background_color": "#0ea5e9"`
  - `"orientation": "portrait"`, `"scope": "/"`
- `apps/web/src/app/layout.tsx` metadata: themeColor light/dark aware

### 3. Scrollování — native feel
`apps/web/src/app/globals.css`:
```css
* { scrollbar-width: none; -ms-overflow-style: none; }
*::-webkit-scrollbar { display: none; }
button, nav, [role="button"] {
  -webkit-user-select: none; user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
}
```

### 4. Haptic feedback
Vytvoř `apps/web/src/lib/haptics.ts`:
```ts
export const haptics = {
  light: () => navigator.vibrate?.(10),
  medium: () => navigator.vibrate?.(25),
  heavy: () => navigator.vibrate?.(50),
  success: () => navigator.vibrate?.([10, 30, 10]),
  error: () => navigator.vibrate?.([50, 30, 50]),
}
```
Přidej na: SOS FAB (heavy), rezervovat termín (success), submit (medium), chyby (error)

### 5. Status bar barva
`apps/web/src/app/layout.tsx`:
```ts
themeColor: [
  { media: '(prefers-color-scheme: light)', color: '#0ea5e9' },
  { media: '(prefers-color-scheme: dark)', color: '#0c4a6e' }
]
```

### 6. Pull-to-refresh na client dashboard
- Vytvoř `apps/web/src/components/ui/PullToRefresh.tsx`
- Touch events: při přetažení dolů >60px → spinner + zavolá `onRefresh()`
- Přidej na `apps/web/src/app/client/page.tsx`

### 7. Safe area (iPhone notch / Dynamic Island)
- Bottom nav, FAB: `padding-bottom: env(safe-area-inset-bottom)`
- V Tailwind: `pb-[env(safe-area-inset-bottom)]`

## Po implementaci
```bash
pnpm -C packages/shared build && pnpm -C apps/web build
git add -A && git commit -m "feat: native mobile feel — haptics, pull-to-refresh, safe areas, permanent auth 30d"
git push origin main
sshpass -p "RjuWeY39ZveUuV5vxWJw" ssh -o StrictHostKeyChecking=no root@109.123.243.52 "cd /opt/pristav && git pull && docker compose up -d --build"
```

## Klíčové soubory
- `apps/web/src/contexts/AuthContext.tsx` — autentizace, JWT, refresh token
- `apps/web/src/app/globals.css` — globální styly
- `apps/web/public/manifest.json` — PWA manifest
- `apps/web/src/app/layout.tsx` — Next.js root layout + metadata
- `apps/api/src/routes/auth.ts` — API auth endpointy
- `apps/api/src/db/index.ts` — initDatabase() + NOC migrace
- `apps/api/src/db/migrate.ts` — schema migrace pro CI

## Důležité varování
- `NEXT_PUBLIC_API_URL` fallback NESMÍ být `/api` — způsobí rewrite loop
- Správný fallback: `http://127.0.0.1:3001` (pro lokál/CI) nebo `https://pristav-radosti.cz/api` (produkce)
- Docker interní hostname `http://api:3001` nefunguje v mobilním prohlížeči

## Credentials
- GitHub token: `cat ~/.openclaw/secrets/github-pat.txt`
- VPS heslo: `RjuWeY39ZveUuV5vxWJw`
