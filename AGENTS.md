# Přístav Radosti — Project Instructions for Kilo

## A — Projekt

**Neurorehabilitační centrum "Přístav Radosti"** — klientský portál pro správu terapeutických sezení, zdravotních záznamů, fakturace a provozu kliniky.

**Monorepo (pnpm workspaces):**
```
apps/api        — Fastify 5 REST API (TypeScript ESM)
apps/web        — Next.js 15 App Router frontend (TypeScript, React 19)
packages/shared — Sdílené Zod schémata (API ↔ web)
```

**Databáze:** SQLite (dev, `:memory:` v testech) ↔ PostgreSQL (produkce). Přepíná se přes `DATABASE_URL`. Drizzle ORM je abstrakční vrstva — abstraktní `db` klient funguje pro obě DB.

**Role:** `CLIENT | RECEPTION | EMPLOYEE | ADMIN`

**Spuštění:**
- `pnpm dev` — API + web paralelně
- `pnpm test` — všechny unit testy
- `pnpm build` — build všech packages
- `pnpm lint` — ESLint přes monorepo

---

## B — Coding Conventions

### Obecně
- **UI texty vždy česky** — tlačítka, labely, chybové hlášky, notifikace, vše.
- TypeScript strict mode — **žádné `any`**, vždy typované interfacy.
- Nové Zod schémata sdílená mezi API a webem patří do `packages/shared/src/schemas/`.

### Backend (apps/api)
- **Nová route:** vytvoř `apps/api/src/routes/{name}.ts` (viz vzor níže) + přidej import a `await fastify.register(...)` do `apps/api/src/server.ts`.
- **Route pattern:** Zod validace → RBAC check (`request.auth!.role`) → DB operace → `logAudit()` → response.
- `request.auth!` obsahuje `{ id, email, name, role }` — dostupné ve všech chráněných handlerech.
- **Password hashing:** výhradně `hashPassword()` / `verifyPassword()` z `apps/api/src/utils/hash.ts` (scrypt). Nikdy raw SHA-256, nikdy `createHash("sha256")` pro hesla.
- **Zdravotní data:** AES-256-GCM šifrování přes `apps/api/src/utils/crypto.ts`.
- **Dual-DB:** vždy abstraktní Drizzle `db` klient. `rawSqlite` jen v testech a výslovně označených místech.
- Email/SMS/push notifikace přes existující services v `apps/api/src/services/`.
- Pro reply s rozšířenými HTTP metodami používej `widenReply(reply)` z `utils/widen-reply.ts`.

**Vzor nového route souboru:**
```typescript
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { tableName } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "./audit.js";
import { widenReply } from "../utils/widen-reply.js";

const myRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/resource", async (request, reply) => {
    const { id, role } = request.auth!;
    // ... logika
  });
};

export default myRoutes;
```

### Frontend (apps/web)
- **Nová stránka:** `apps/web/src/app/{role}/{name}/page.tsx` s `"use client"`, `RouteGuard`, `Layout`.
- Role v `RouteGuard`: `admin` → `["ADMIN"]`, `client` → `["CLIENT"]`, `employee` → `["EMPLOYEE"]`, `reception` → `["RECEPTION"]`.
- **Data fetching:** SWR + `api.get<TypovanýInterface>(url)` — **nikdy `api.get<any>()`**. Vždy definuj interface pro response.
- **Design systém:** používej Tailwind třídy z `tailwind.config.ts`. Nikdy inline hex barvy — místo toho CSS proměnné nebo Tailwind tokeny (`bg-primary`, `text-secondary`, atd.).
  - Primary: `#242B61` (deep blue) → `bg-[#242B61]` nebo `text-primary`
  - Secondary: `#E86A24` (orange) → použij tailwind config tokeny
- **Animace:** Framer Motion vždy s `const shouldReduce = useReducedMotion()` a podmíněné `initial={shouldReduce ? {} : { ... }}`.
- **Čísla/měny:** přes `formatCurrency()` z `@/lib/utils`.
- **Komponenty:** využívej existující z `apps/web/src/components/` (DataTable, GlobalSearch, NotificationBell, ui/*, atd.).

**Vzor nové stránky:**
```tsx
"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useReducedMotion, motion } from "framer-motion";

interface MyData {
  // ... typovaný interface
}

const fetcher = (url: string) => api.get<MyData>(url);

export default function MyPage() {
  const shouldReduce = useReducedMotion();
  const { data, isLoading } = useSWR<MyData>("/api/endpoint", fetcher);

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        {/* obsah česky */}
      </Layout>
    </RouteGuard>
  );
}
```

### Drizzle / databázové změny
Při jakékoliv změně schématu:
1. Uprav `apps/api/src/db/schema.ts`
2. Spusť `pnpm --filter @pristav/api db:generate` pro vygenerování migrace
3. Zkontroluj, které routes jsou dotčeny a updatuj je
4. Zkontroluj `apps/api/src/db/seed.ts` — NOT NULL sloupce bez defaultu potřebují seed hodnotu
5. Zkontroluj Zod schémata v `packages/shared/src/schemas/`

---

## C — Povinný post-implementační workflow

**Po každé změně kódu, bez výjimky, spusť v tomto pořadí:**

```bash
# 1. TypeScript — v závislostním pořadí
pnpm --filter @pristav/shared tsc --noEmit
pnpm --filter @pristav/api   tsc --noEmit
pnpm --filter @pristav/web   tsc --noEmit

# 2. Testy
pnpm --filter @pristav/api test
pnpm --filter @pristav/web test

# 3. Lint
pnpm lint
```

**Pravidla:**
- Pokud jakýkoliv krok selže → **oprav chyby a zopakuj celou sekvenci od začátku**.
- Úkol je **dokončen teprve po zeleném průchodu všech kroků**.
- Výjimka — čistě frontendová změna (bez dotyku `apps/api`): přeskoč kroky 1a + 4.
- Výjimka — čistě backendová změna (bez dotyku `apps/web`): přeskoč kroky 1c + 5.
- Výjimka — změna pouze v `packages/shared`: spusť všechny tsc kroky, ale testy jen pro dotčené packages.

---

## D — Rychlá reference klíčových souborů

| Soubor | Účel |
|---|---|
| `apps/api/src/db/schema.ts` | Drizzle ORM schéma (48+ tabulek) |
| `apps/api/src/server.ts` | Fastify app factory + registrace všech routes |
| `apps/api/src/plugins/auth.ts` | JWT + API key auth middleware |
| `apps/api/src/utils/hash.ts` | scrypt hashování hesel |
| `apps/api/src/utils/crypto.ts` | AES-256-GCM šifrování zdravotních dat |
| `apps/api/src/utils/authz.ts` | RBAC helper `requireRole()` |
| `apps/api/src/scheduler.ts` | 10 background jobů (node-schedule) |
| `apps/api/src/services/` | email, sms, push, slot-recovery, cancellation-risk |
| `apps/web/src/lib/api.ts` | Centrální fetch client (auto-refresh na 401) |
| `apps/web/src/lib/offlineQueue.ts` | IndexedDB offline queue + Background Sync |
| `apps/web/src/contexts/AuthContext.tsx` | Globální auth stav (login, logout, 2FA, token refresh) |
| `apps/web/src/components/RouteGuard.tsx` | RBAC ochrana stránek |
| `apps/web/src/components/Layout.tsx` | Wrapper layout pro všechny portály |
| `packages/shared/src/schemas/` | Sdílené Zod schémata |
