# UX Audit animací — Přístav Radosti PWA
**Datum:** 2026-03-21
**Scope:** `apps/web/src/app/` + `apps/web/src/components/`

---

## SOUHRNNÉ HODNOCENÍ

Aplikace má **solidní základ Framer Motion animací** se správnou podporou `prefers-reduced-motion`. Nicméně existují zásadní **UX mezery** v nejčastěji používaných komponentách. Přibližně **21 % interaktivních elementů a přechodů stránek** má animace — dobré tam, kde jsou implementovány, ale chybějící právě tam, kde je potřeba je nejvíce.

| Kategorie | Hodnocení |
|-----------|-----------|
| Celková kvalita animací | **6.5 / 10** |
| Dostupnost (prefers-reduced-motion) | **9 / 10** ✅ |
| Konzistence | **5 / 10** |
| Pokrytí interakcí | **4 / 10** |
| Potenciál po opravách | **8.5 / 10** |

---

## ČÁST 1: ANALÝZA PER-SOUBOR

### KOMPONENTY (`/src/components/`)

#### ✅ `PageTransition.tsx`
- **Animace:** ANO — Framer Motion fade-in + slide-up při vstupu na stránku
- **Detail:** `opacity: 0 → 1`, `y: 8 → 0`, duration 0.3s, easeOut
- **Přístupnost:** ✅ Respektuje `useReducedMotion()`
- **Problém:** Chybí exit animace — stránka mizí naráz

---

#### ✅ `AnimatedLogo.tsx` (ui/)
- **Animace:** ANO — komplexní SVG draw animace + pulse
- **Detail:** Staggered path animations (1.5s draw), pak infinite pulse scale (2.5s)
- **Přístupnost:** ✅ Plná podpora reduced motion
- **Kvalita:** Vynikající — propracované SVG path animace, silný branding
- **Problém:** Použito jen v headeru/loginu, ne celosystémově

---

#### ⚠️ `SOSButton.tsx`
- **Animace:** ČÁSTEČNĚ — pouze Tailwind `animate-pulse` na tlačítku
- **Chybí:** Animace vstupu dialogu, žádný fade backdrop
- **Problém:** Kritická bezpečnostní funkce potřebuje silnější vizuální důraz — dialog se otevírá okamžitě (trhá)

---

#### ✅ `ConfirmDialog.tsx`
- **Animace:** ANO — backdrop fade + dialog scale-in s `AnimatePresence`
- **Detail:** Dialog: `opacity: 0, scale: 0.95 → 1`, backdrop: `opacity: 0 → 1`
- **Kvalita:** Dobrá, profesionální

---

#### ⚠️ `DataTable.tsx`
- **Animace:** ŽÁDNÉ
- **Chybí:**
  - Přechod ikony řazení (rotace šipky)
  - Hover efekty na řádcích (jen `transition-colors`)
  - Feedback kliknutí na stránkování
  - Animace při změně řazení
- **Dopad:** Datové tabulky jsou jednou z nejpoužívanějších komponent — statické chování snižuje vnímání kvality

---

#### ❌ `EmptyState.tsx`
- **Animace:** ŽÁDNÉ — čistě statická komponenta
- **Chybí:** Fade vstupu, bounce nebo scale ikony
- **Dopad:** Zobrazuje se uživatelům relativně často, mělo by být přátelské

---

#### ❌ `GdprConsentDialog.tsx`
- **Animace:** ŽÁDNÉ — dialog se otevírá okamžitě
- **Chybí:** Entrance/exit animace, fade backdrop
- **Problém:** Důležitý consent dialog potřebuje vizuální váhu

---

#### ❌ `GlobalSearch.tsx`
- **Animace:** ŽÁDNÉ — dropdown se otevírá okamžitě
- **Chybí:** Fade-in výsledků, animace vyhledávacího spinneru
- **Dopad:** Vysokofrekvenční interakce vyžaduje plynulou vizuální odezvu

---

#### ⚠️ `Layout.tsx` (KRITICKÁ KOMPONENTA)
- **Animace:** ČÁSTEČNĚ
  - ✅ Mobilní nav: Framer Motion slide-up s `AnimatePresence` (`y: -8`)
  - ✅ "Více" bottom sheet: slide from bottom + backdrop fade
  - ✅ Sidebar collapse: rotace `ChevronDown` (CSS `transition-transform`)
  - ❌ Sidebar nav items: jen color transition při hover, žádná animace aktivního stavu
  - ❌ Desktop menu hover: statické, bez hover efektů
- **Chybí:**
  - Spring animace pro aktivní nav item
  - Animace collapse/expand skupin menu
- **Dopad:** ZÁSADNÍ — sidebar vidí uživatelé neustále

---

#### ❌ `MiniCalendar.tsx`
- **Animace:** ŽÁDNÉ
- **Chybí:** Animace kliknutí na den, přechody při navigaci měsíce
- **Problém:** Kalendář je součástí kritického booking flow — chybí polish

---

#### ⚠️ `NotificationBell.tsx`
- **Animace:** ŽÁDNÉ — dropdown se otevírá okamžitě
- **Chybí:** Badge pulse/bounce při nepřečtených notifikacích, fade-in listu
- **Dopad:** Střední — důležitý UI prvek

---

#### ⚠️ `OfflineBanner.tsx`
- **Animace:** CSS `transition-all` při změně barvy pozadí
- **Chybí:** Lepší entrance/exit animace
- **Kvalita:** Funkční, ale mohl by být výraznější

---

#### ⚠️ `OnboardingChecklist.tsx`
- **Animace:** ČÁSTEČNĚ — progress bar má CSS `transition-all duration-500`
- **Chybí:** Animace zaškrtnutí položky, oslava dokončení
- **Problém:** Mělo by odměňovat uživatele vizuálně

---

#### ⚠️ `PWAInstallBanner.tsx`
- **Animace:** ČÁSTEČNĚ — vlastní CSS `animate-slide-in` (slide from right, 0.3s)
- **Problém:** Zobrazí se po 1s timeoutu — zpožděné vnímání

---

#### ❌ `SOSAlertBanner.tsx`
- **Animace:** ŽÁDNÉ — banner se zobrazuje okamžitě
- **Chybí:** Slide-in, pulse na aktivní alert
- **Problém:** KRITICKÉ — emergency alerty musí být vizuálně dominantní

---

#### ✅ `Skeleton.tsx`
- **Animace:** ANO — shimmer keyframe 1.5s infinite linear
- **Kvalita:** Dobrá, standardní skeleton loading pattern

---

#### ❌ `ThemeToggle.tsx`
- **Animace:** ŽÁDNÉ — přepíná okamžitě
- **Chybí:** Rotace ikony při přepnutí tématu (200ms)

---

#### ❌ `ClientTimeline.tsx`
- **Animace:** ŽÁDNÉ — položky timeline se zobrazují staticky
- **Chybí:** Staggered animace vstupu, draw animace vertikální linky
- **Problém:** Timeline je ideální kandidát pro sekvenční animace

---

#### ❌ `ClientQuestionnairesPanel.tsx`
- **Animace:** ŽÁDNÉ — modal okamžitý, trend chart bez přechodu
- **Chybí:** Dialog entrance, count-up animace čísel v trend chartu

---

### STRÁNKY (`/src/app/`)

#### ✅ `page.tsx` (Root/Landing)
- **Animace:** ANO — rozsáhlý Framer Motion
  - Header: `fadeIn` variant
  - Hero logo: `slideUp` se stagger
  - Feature cards: `staggerContainer` + `listItem` + `whileHover` scale
- **Kvalita:** Vynikající — profesionální landing page
- **Přístupnost:** ✅ Plná podpora reduced motion

---

#### ✅ `login/page.tsx`
- **Animace:** ANO — dobrá pokrytí
  - Dialog, form steps, logo: fade/slide
  - Error state: **`shakeVariant`** — výborná UX pro validaci
- **Kvalita:** Velmi dobrá — shake feedback při neúspěšném přihlášení

---

#### ❌ `layout.tsx` (root)
- **Animace:** ŽÁDNÉ
- **Chybí:** Fade přechod tématu, entrance animace layoutu

---

#### ❌ `error.tsx`
- **Animace:** ŽÁDNÉ — statická stránka
- **Dopad:** Nízký (chyby jsou vzácné)

---

#### ✅ `client/page.tsx` (Dashboard — HOJNĚ POUŽÍVÁNO)
- **Animace:** ANO — dobrá pokrytí
  - Stats grid: `staggerContainer` + `listItem`
  - Quick actions: `whileHover` + `whileTap`
- **Chybí:**
  - Hero "next appointment" card bez animace vstupu
  - Appointment cards bez staggeru
- **Přístupnost:** ✅ Respektuje reduced motion

---

#### ✅ `client/appointments/page.tsx`
- **Animace:** ČÁSTEČNĚ — `staggerContainer` + `listItem` na sekce
- **Chybí:**
  - Animace stránkování
  - Hvězdičkový rating bez hover/select feedbacku
- **Přístupnost:** ✅ Respektuje reduced motion

---

#### ⚠️ `admin/page.tsx`
- **Animace:** ČÁSTEČNĚ — stats grid animovaný, activity feed statický
- **Chybí:**
  - Staggered vstup položek activity feed
  - Pulse při real-time aktualizacích

---

#### ⚠️ `reception/page.tsx`
- **Animace:** ČÁSTEČNĚ — schedule se stagger, action buttons statické
- **Chybí:**
  - Feedback při check-in/aktivaci
  - Animace změny statusu

---

## ČÁST 2: AUDIT `motion.ts` A CSS

### Existující motion konfigurace (`/lib/motion.ts`)
Soubor je dobře strukturován:
- ✅ `fadeIn`, `slideUp`, `slideInRight` — standardní vstupy
- ✅ `staggerContainer` + `listItem` — stagger 0.08s
- ✅ `scaleIn`, `scaleOut`
- ✅ `shakeVariant` — validace (výborné)
- ✅ `pageTransition`, `backdropVariants`

**Chybí v motion.ts:**
- `whileTap`/`whileHover` varianty pro tlačítka
- Spring-based varianty (vše je easeOut)
- `pulseGlow` varianta pro alerty
- `rotateIcon` pro spinners a ikonky přepínání
- `bounce`/`wiggle` pro emphasis

### CSS animace (`globals.css`)
- ✅ `confetti-pop`, `confetti-fade`
- ✅ `slide-in` (0.3s z prava)
- ✅ `fade-in-up` (0.25s s delay variantami)
- ✅ `shimmer` / `skeleton-shimmer`
- ✅ Tlačítka: `translateY(-1px)` hover + `scale(0.97)` active

**Chybí CSS animace:**
- Badge pulse při notifikaci
- Input error shake (jen na login stránce)
- Tooltip fade-in/out
- Loading spinner rotate

---

## ČÁST 3: TOP 5 PRIORITNÍCH ZLEPŠENÍ

---

### #1 — Animace DataTable
**Dopad:** KRITICKÝ | **Effort:** Střední | **ROI:** Vysoké

DataTable je použita ve většině administrátorských a klientských stránek (appointments, users, clients, invoices). Žádná z interakcí nemá vizuální odezvu.

**Co chybí:**
- Rotace ikony při změně řazení sloupce
- `whileHover` scale (1.01) + shadow na řádky
- `whileTap` scale (0.95) na tlačítka stránkování
- Fade přechod při změně dat

**Příklad:**
```tsx
// Řazení — rotace šipky
<motion.span animate={{ rotate: sortDir === "asc" ? 0 : 180 }} transition={{ duration: 0.2 }} />

// Řádek — hover efekt
<motion.tr whileHover={{ scale: 1.005 }} transition={{ duration: 0.15 }}>

// Stránkování — klik feedback
<motion.button whileTap={{ scale: 0.95 }} transition={{ duration: 0.1 }}>
```

---

### #2 — Sidebar navigace — aktivní stav
**Dopad:** KRITICKÝ | **Effort:** Nízký | **ROI:** Velmi vysoké

Sidebar je viditelný neustále. Aktivní nav item pouze mění barvu — žádná pohybová odezva.

**Co chybí:**
- Pohybový indikátor aktivního stavu (levý border nebo background pill)
- `whileHover={{ x: 2 }}` na nav items
- Rotace `ChevronDown` při collapse/expand skupiny

**Příklad:**
```tsx
<motion.div
  animate={isActive ? { paddingLeft: 16, backgroundColor: "rgba(13,148,136,0.1)" } : { paddingLeft: 12 }}
  transition={{ duration: 0.2 }}
  whileHover={{ x: 2 }}
/>
```

---

### #3 — Dialog/Modal vstupní animace
**Dopad:** VYSOKÝ | **Effort:** Nízký | **ROI:** Vysoké

`GdprConsentDialog`, `GlobalSearch` dropdown, `NotificationBell` dropdown — vše se otevírá okamžitě bez přechodu.

**Šablona pro rychlou opravu:**
```tsx
<AnimatePresence>
  {open && (
    <>
      <motion.div
        className="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {/* obsah dialogu */}
      </motion.div>
    </>
  )}
</AnimatePresence>
```

---

### #4 — Interaktivní feedback formulářů
**Dopad:** VYSOKÝ | **Effort:** Střední | **ROI:** Střední-Vysoké

**Co chybí:**
- MiniCalendar — klik/hover animace dnů
- Rating hvězdičky v appointments — hover scale
- Všechna tlačítka formulářů — `whileTap` feedback
- Animace focus stavu u input polí

**Příklad:**
```tsx
// Hvězdičkový rating
<motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} transition={{ duration: 0.1 }}>

// Kalendář — den
<motion.button whileHover={{ scale: 1.05, backgroundColor: "..." }} whileTap={{ scale: 0.95 }}>
```

---

### #5 — Emergency alerty — vizuální hierarchie
**Dopad:** VYSOKÝ (bezpečnost) | **Effort:** Nízký | **ROI:** Vysoké

SOS tlačítko a emergency alerty mají minimální vizuální důraz — nedostatečný pro krizové situace.

**Co chybí:**
- SOS tlačítko: pulsující glow aura (ne jen pulse scale)
- SOS dialog: dramatický entrance (spring + scale)
- SOSAlertBanner: slide-in z hora + shake při aktivaci
- Staggered animace emergency kontaktů

**Příklad:**
```tsx
// SOS pulsující glow
<motion.div
  animate={{
    boxShadow: [
      "0 0 0 0 rgba(239,68,68,0.7)",
      "0 0 0 15px rgba(239,68,68,0)"
    ]
  }}
  transition={{ duration: 1.5, repeat: Infinity }}
/>

// SOS dialog — dramatický vstup
<motion.div
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ type: "spring", stiffness: 100, damping: 12 }}
/>
```

---

## ČÁST 4: ROADMAPA IMPLEMENTACE

### Fáze 1 — Quick wins (1–2 dny)
- [ ] GdprConsentDialog — přidat AnimatePresence entrance
- [ ] GlobalSearch dropdown — fade-in výsledků
- [ ] NotificationBell dropdown — fade-in
- [ ] Sidebar group toggle — rotace ChevronDown
- [ ] `whileTap` feedback na všechna tlačítka formulářů

### Fáze 2 — Vysoký dopad (2–3 dny)
- [ ] DataTable — sort, row hover, pagination animace
- [ ] Sidebar nav — aktivní stav s motion
- [ ] MiniCalendar — date selection animace
- [ ] SOSButton + SOSAlertBanner — vizuální urgence

### Fáze 3 — Polish (1–2 dny)
- [ ] EmptyState — entrance animace
- [ ] ClientTimeline — staggered items + draw linka
- [ ] ThemeToggle — rotace ikony
- [ ] Statistické countery — CountUpNumber rozšíření
- [ ] OnboardingChecklist — check animace + oslava

### Fáze 4 — Pokročilé (volitelné)
- [ ] Page transition exit animace
- [ ] Scroll-triggered animace pro dlouhé stránky
- [ ] Gesture-based animace (swipe na mobilu)
- [ ] Přidat chybějící varianty do `motion.ts` (pulseGlow, buttonTap, rotateIcon)

---

## ZÁVĚR

Aplikace má **dobrý animační základ** — Framer Motion je správně integrován, přístupnost je výborná, landing page a login mají profesionální animace.

Hlavní slabiny jsou v **nejpoužívanějších UI prvcích**: datové tabulky jsou zcela statické, sidebar navigace postrádá pohybovou odezvu, dialogy se otevírají okamžitě a emergency alerty nemají dostatečný vizuální důraz.

**Implementace 5 prioritních zlepšení by dramaticky zvedla vnímanou kvalitu** celé aplikace s relativně nízkým úsilím — přibližně 5–7 dní práce.
