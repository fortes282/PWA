# HANDOFF — UX/UI Animation & Dark Mode Pass
> Session ended 2026-03-22. New session should write all 4 immediate files in parallel, then continue with remaining files.

## Goal
Three systematic fixes across all pages:
1. Remove all `@/lib/motion` variant imports (`staggerContainer`, `listItem`, `slideOverRight`, `backdropVariants`) → inline Framer Motion spring physics
2. Add dark mode via Tailwind `dark:*` classes throughout
3. Fix accessibility: `useReducedMotion()` guards on ALL gesture props

## Inline Spring Pattern (reference)

### Replacing `staggerContainer` + `listItem`
```tsx
// BEFORE
<motion.div variants={staggerContainer} initial={shouldReduce ? "visible" : "hidden"} animate="visible">
  {items.map((item) => (
    <motion.div key={item.id} variants={listItem}>

// AFTER
<div>
  {items.map((item, i) => (
    <motion.div
      key={item.id}
      initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 28, delay: BASE + i * STEP }}
    >
```

### Replacing `backdropVariants`
```tsx
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
transition={{ duration: 0.2 }}
```

### Replacing `slideOverRight`
```tsx
initial={{ x: "100%" }}
animate={{ x: 0 }}
exit={{ x: "100%" }}
transition={{ type: "spring", stiffness: 340, damping: 30 }}
```

### `whileTap` accessibility guard
```tsx
// WRONG
whileTap={{ scale: 0.97 }}

// CORRECT
whileTap={shouldReduce ? undefined : { scale: 0.97 }}
```

---

## IMMEDIATE — 4 Files Ready to Write (no reads needed)

### 1. `apps/web/src/app/employee/clients/page.tsx`
- **Remove line 11**: `import { staggerContainer, listItem } from "@/lib/motion"`
- **StatCard line 20**: `text-xs text-gray-500` → add `dark:text-gray-400`
- **h1 line 43**: `text-gray-900` → add `dark:text-gray-100`
- **Search input line 79**: add `bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100`
- **Stats grid (lines 49–68)**: outer `motion.div variants={staggerContainer}` → plain `div`; 4 hardcoded `motion.div variants={listItem}` → inline springs with delays `0.04, 0.08, 0.12, 0.16`
- **Client list (lines 110–149)**: outer `motion.div variants={staggerContainer}` → plain `div`; `(c: any)` → `(c: any, i)` with `delay: 0.06 + i * 0.04`; existing `whileTap={shouldReduce ? undefined : { scale: 0.985 }}` already correct — keep

### 2. `apps/web/src/app/admin/page.tsx`
- **Remove line 12**: `import { staggerContainer, listItem } from "@/lib/motion"`
- `ActivityFeed` and `QuickSummary` already use inline springs — NO CHANGES needed there
- **Stats grid (lines 219–239)**: outer `motion.div variants={staggerContainer}` → plain `div`; `(s)` → `(s, i)` with `delay: 0.06 + i * 0.04`
- **Quick links (lines 320–342)**: outer `motion.div variants={staggerContainer}` → plain `div`; `(item)` → `(item, i)` with `delay: 0.22 + i * 0.04`; keep existing `whileTap={shouldReduce ? undefined : { scale: 0.97 }}`

### 3. `apps/web/src/app/reception/page.tsx`
- **Remove line 13**: `import { staggerContainer, listItem } from "@/lib/motion"`
- **Dark mode additions**:
  - Line 66 h1: add `dark:text-gray-100`
  - Line 82 h2: add `dark:text-gray-100`
  - Line 167 h2: add `dark:text-gray-100`
  - Line 206 h2: add `dark:text-gray-100`
  - Line 242 h2: add `dark:text-gray-100`
  - Line 280 h2: add `dark:text-gray-100`
  - Line 329 stat value p: add `dark:text-gray-100`
- **6 stagger sections**:
  1. Lines 94–151 today's schedule: outer → plain `div className="space-y-2"`; `(a: any)` → `(a: any, i)` delay `0.02 + i * 0.03`; **KEEP `layout` prop on items**
  2. Lines 168–190 pending activation: outer → plain `div className="space-y-3"`; add `i`, delay `0.04 + i * 0.04`; **KEEP `layout` prop on items**
  3. Lines 210–225 risk today: outer → plain `div className="space-y-2"`; add `i`, delay `0.03 + i * 0.04`
  4. Lines 246–263 rebooking: outer → plain `div className="space-y-2"`; add `i`, delay `0.03 + i * 0.04`
  5. Lines 284–303 at-risk: outer → plain `div className="space-y-2"`; add `i`, delay `0.03 + i * 0.04`
  6. Lines 309–333 stats grid: outer → plain `div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8"`; `(stat)` → `(stat, i)` delay `0.1 + i * 0.04`

### 4. `apps/web/src/app/employee/appointments/page.tsx`
- **Line 12**: `import { AnimatePresence, motion } from "framer-motion"` → add `useReducedMotion`
- **Line 13**: `import { slideOverRight, backdropVariants } from "@/lib/motion"` → **DELETE entirely**
- **After `const { user } = useAuth();` (~line 180)**: add `const shouldReduce = useReducedMotion();`
- **Line 297**: `whileTap={{ scale: 0.98 }}` → `whileTap={shouldReduce ? undefined : { scale: 0.98 }}`
- **Lines 341–344 slide-over backdrop**: replace `variants={backdropVariants} initial="hidden" animate="visible" exit="hidden"` with opacity fade inline
- **Lines 351–354 slide panel**: replace `variants={slideOverRight} initial="hidden" animate="visible" exit="exit"` with x-spring inline
- **Line 418**: `whileTap={{ scale: 0.97 }}` (Hotovo) → guarded
- **Line 425**: `whileTap={{ scale: 0.97 }}` (No-show) → guarded
- **Lines 451–456 confirm dialog backdrop**: same `backdropVariants` → opacity fade
- **Line 489**: `whileTap={{ scale: 0.97 }}` (confirm action) → guarded

---

## REMAINING FILES (19+) — Need read + write

All have `import { ... } from "@/lib/motion"` — apply same 3 fixes:

```
reception/clients/[id]/page.tsx
reception/health-records/[clientId]/page.tsx
reception/invoices/[id]/page.tsx
reception/health-records/page.tsx
reception/working-hours/page.tsx
reception/credit-requests/page.tsx
reception/billing/page.tsx
reception/appointments/page.tsx
reception/clients/page.tsx
employee/therapy-reports/[id]/page.tsx
employee/therapy-reports/new/page.tsx
employee/groups/page.tsx
employee/reports/page.tsx
employee/colleagues/page.tsx
employee/homework/page.tsx
employee/wellbeing/page.tsx
employee/therapy-reports/page.tsx
unauthorized/page.tsx
admin/* subpages
```

Find all remaining with:
```bash
grep -rl "@/lib/motion" /tmp/PWA/apps/web/src/
```

## Already Completed ✓
- `app/page.tsx`
- `app/reset-password/page.tsx`
- `app/offline/page.tsx`
- `app/forgot-password/page.tsx`
- `app/login/page.tsx`
