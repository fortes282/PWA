# UX/UI Audit — Přístav Radosti PWA
**Datum:** 2026-03-19  
**Scope:** /tmp/PWA/apps/web/src (Next.js 15 + Tailwind CSS)  
**Verze:** v2.0 (aktuální kód)  
**Autor:** THINKER brainstorm subagent

---

## Executive Summary

Aplikace má solidní technický základ (SWR, dark mode, skeleton loading, offline banner, ARIA labels na kritických místech), ale trpí několika systémovými UX problémy:

1. **Navigace není mobile-first** — chevron hamburger místo bottom tabů, 12+ položek pro klienta
2. **Booking flow** používá nativní `<select>` a `<input type="date">` — na mobilu nepříjemné
3. **Design systém je tenký** — 2 CSS custom properties, brand barva teal (`#0d9488`) definována ale nevyužita
4. **Chybí onboarding** — první přihlášení je identické jako opakované
5. **Informační hierarchie dashboardů** — místy zmatená, příliš dat najednou

---

## 1. NAVIGACE — Sidebar vs Mobile

### Současný stav
- Desktop: pevný levý sidebar 256px, plně funkční
- Mobil: hamburger (ChevronDown) → dropdown menu pod headerem
- 12 nav items pro CLIENT roli v jednom scrollovatelném seznamu
- Icons: `FileText` použit pro Zprávy i Faktury (nedistinktivní)

### Problémy
- **Hamburger = ChevronDown** — neintuitivní, uživatelé čekají ≡ ikonku
- **Dropdown nav na mobilu** — přebírá viewport, uživatel scroll nav místo obsahu
- **12 CLIENT položek** — rodiče potřebují max 4-5 věcí: Rezervovat, Termíny, Kredit, Zprávy
- **Sdílené položky (Zprávy, Notifikace) na konci** — pohřbené pod role-specific položkami
- **Notifikace** jsou v sidebar + NotificationBell v sidebar footer — duplicita
- **Admin/Recepce/Employee** mají do 18 položek — potřebují skupiny/sekce

### Návrhy

**P1 — Bottom Tab Bar pro CLIENT (mobil)**
```
[🏠 Přehled] [📅 Rezervovat] [⏰ Termíny] [💬 Zprávy] [•••]
```
- Pět karet: Dashboard | Booking | Termíny | Zprávy | Více
- "Více" otevře sheet s Kredity, Pokrok, Faktury, Nastavení
- Eliminuje hamburger problém úplně
- **Náročnost:** M (3-5 dní)

**P1 — Skupiny v sidebar pro RECEPTION/ADMIN/EMPLOYEE**
```
── Přehled ──────────────
Kalendář · Termíny
── Klienti ──────────────
Klienti · Zdravotní záznamy · Waitlist
── Finance ──────────────
Billing · Faktury · Kredit
```
- Collapsible sekce nebo vizuální separátory
- **Náročnost:** S (1-2 dny)

**P2 — Hamburger → ≡ ikona**
- Změnit `ChevronDown` na `Menu` z lucide-react
- aria-label zůstane OK
- **Náročnost:** XS (30 min)

**P2 — Mobile slide-in drawer místo dropdown**
- Overlay z leva místo dropdown pod headerem
- Backdrop blur + swipe-to-close
- **Náročnost:** M (2-3 dny)

**P3 — "Přejdi na obsah" skip link**
```html
<a href="#main-content" class="sr-only focus:not-sr-only">Přejít na obsah</a>
```
- Accessibility requirement
- **Náročnost:** XS (1 hod)

---

## 2. BOOKING FLOW

### Současný stav
3-step linear flow: Výběr služby → Datum → Slot → Potvrzení  
Technicky funkční, ale UX tření v každém kroku.

### Problémy
- **Krok 1 — `<select>` se `<optgroup>`**: Na mobilu otevírá nativní picker (iOS wheel, Android bottom sheet) — funkční ale nelze přizpůsobit, nezobrazuje popis/cenu vizuálně
- **Krok 2 — `<input type="date">`**: Nativní date picker je na iOS nestabilní (locale problémy), neumožňuje zakázat nedostupné dny
- **Krok 3 — Sloty v grid**: OK, ale chybí vizuální feedback "žádný terapeut preference"
- **Chybí progress indikátor** — uživatel neví kde je v procesu (krok 2 ze 4)
- **Souhrn reservace** se zobrazí až po výběru slotu — pozdě
- **Po odeslání**: 2s redirect bez možnosti "přidat do kalendáře"
- **Poznámka**: textarea s max 500 znaky — bez jasného upozornění co tam napsat
- **Credit check chybí**: uživatel nevidí zůstatek kreditu během bookingu

### Návrhy

**P1 — Stepper/Progress bar**
```
●━━━━○━━━━○━━━━○
Služba  Datum  Čas  Potvrzení
```
- Zobrazit krok a celkový počet
- Tlačítko "Zpět" mezi kroky
- **Náročnost:** S (1-2 dny)

**P1 — Card-based výběr služby místo `<select>`**
```
┌─────────────────┐  ┌─────────────────┐
│ 🏊 Vodoléčba    │  │ 🧠 Neurorehabil.│
│ 45 min · 800 Kč │  │ 60 min · 1200 Kč│
│ [Vybrat]        │  │ [Vybrat]        │
└─────────────────┘  └─────────────────┘
```
- Kategorie jako horizontální pill tabs
- Každá služba jako kliknutelná karta s ikonou, popisem, cenou
- Vybraná: border-primary + checkmark
- **Náročnost:** M (2-3 dny)

**P1 — Mini-kalendář místo `<input type="date">`**
- Jednoduchý custom monthly calendar
- Šedé dny = žádné sloty (fetch available dates for month)
- Dnešek zvýraznit, minulost zakázat
- Horizontální week picker jako alternativa
- **Náročnost:** L (3-5 dní)

**P2 — Credit balance reminder v booking flow**
```
💳 Váš zůstatek: 2 400 Kč
   Tato služba: 800 Kč
   Po rezervaci zbyde: 1 600 Kč
```
- Zobrazit pod summary kartou
- Varování pokud kredit nestačí
- **Náročnost:** S (1 den)

**P2 — Success screen s akcemi**
```
✅ Rezervace potvrzena!
📅 Čt 20. března · 10:00–11:00
👩‍⚕️ Mgr. Jana Nováková

[Přidat do kalendáře]  [Zpět na přehled]
```
- "Přidat do kalendáře" = generovat .ics link
- Zobrazit po 3s místo okamžitého redirectu
- **Náročnost:** S (1-2 dny)

**P3 — "Nejbližší volný termín" CTA**
- Tlačítko "Ukáž mi první volný termín" které auto-vybere nejbližší slot
- Pro rodiče kteří nemají preferenci
- **Náročnost:** M (2 dny)

**P3 — Terapeut preference v kroku 1**
- Filtr "Preferovaný terapeut" (volitelný) ještě před výběrem data
- Zobrazí foto + jméno dostupných terapeutů pro danou službu
- **Náročnost:** M (3 dny)

---

## 3. DASHBOARD — CLIENT (`/client`)

### Současný stav
3 stat karty (Kredit, Notifikace, Termíny) + seznam Nadcházejících + Quick Actions grid

### Problémy
- **"Notifikace" jako stat karta** — nepřirozené, neposkytuje hodnotu (jen počet)
- **Stat karta Termíny** = count všech CONFIRMED, ne přehled
- **Quick Actions duplicují** navigaci — klient vidí stejné položky v nav i v akcích
- **Prázdný stav** — pokud žádné termíny, CTA rezervovat je malé a ztracené
- **Jméno**: `user?.name?.split(" ")[0]` — funguje, ale pro oslovení "Dobrý den, Petr" je lepší přidat salutation pole
- **Datum** nikde nezobrazeno — klient nevidí "dnes je středa"
- **Žádný kontakt na centrum** — v nouzi klient neví jak zavolat
- **Behavior score** není na dashboardu — klient ho nevidí proaktivně (ale je na /progress)

### Návrhy

**P1 — Hero "Příští termín" karta**
```
┌──────────────────────────────────┐
│ 🗓️ Váš příští termín             │
│                                  │
│  Čtvrtek 20. března              │
│  10:00 – 11:00                   │
│  Mgr. Jana Nováková              │
│  Vodoléčba                       │
│                                  │
│  [Přidat do kalendáře] [Zrušit] │
└──────────────────────────────────┘
```
- Největší element na stránce
- Pokud žádný termín → velký CTA "Rezervovat termín"
- **Náročnost:** S (1-2 dny)

**P1 — Stat karty redesign**
```
Kredit: 2 400 Kč  →  zachovat
Termíny celkem: 14  →  zachovat
Notifikace  →  ODSTRANIT, přesunout do bell/tab
```
- Přidat: "Sezení tento měsíc: 3" nebo "Absolvováno celkem: 24"
- **Náročnost:** XS (2 hod)

**P2 — Welcome banner pro první přihlášení**
```
👋 Vítejte, Petro!
Pojďme dokončit váš profil...
[Doplnit zdravotní kartu] [Nastavit notifikace]
```
- Zobrazit pouze pokud `healthRecord === null` nebo notifs nejsou nastaveny
- **Náročnost:** S (1 den)

**P2 — Denní greeting s datem**
```
Dobré ráno, Petro! ☀️     Středa 19. března
```
- Časový pozdrav: ráno/odpoledne/večer
- Malé datum vpravo
- **Náročnost:** XS (1 hod)

**P3 — Kontaktní info centra v footer dashboardu**
```
📞 +420 123 456 789  |  📍 Praha 6 - Bubeneč
```
- **Náročnost:** XS (1 hod)

---

## 4. DASHBOARD — EMPLOYEE (`/employee`)

### Současný stav
Timeline s "now" indikátorem (červená linka) + next appointment highlight. Velmi dobré!

### Problémy
- **Hodiny 7:00–20:00 jsou vždy celé** — i když zaměstnanec má jen 2 termíny, scrolluje prázdné hodiny
- **Kliknutí na termín** — nic se nestane, žádný detail
- **Rychlé akce (✓ / ✗)** — malé, bez labelu, snadno omylem kliknout
- **Chybí týdenní přehled** — "kde budu příští týden?"
- **Poznámka klienta k termínu** nezobrazena v timeline
- **Employee dashboard** == jen dnešek, žádné weekly stats
- **Kolegové** stránka: zobrazuje seznam, ale nelze vidět jejich kalendář
- **Terapeutické zprávy**: psaní zpráv chybí (jen list), nebo je to na jiné stránce?

### Návrhy

**P1 — Kliknutelný termín v timeline → slide-over panel**
```
[Termín 10:00 – Jana Nováčková]
  ↓ click
┌─────────────────────────────┐
│ Jana Nováčková              │
│ Vodoléčba · 10:00 – 11:00  │
│                             │
│ 📝 Poznámka klienta:        │
│ "Bolí záda při ohybu..."   │
│                             │
│ [✅ Hotovo] [❌ No-show]    │
│ [📝 Napsat zprávu]          │
└─────────────────────────────┘
```
- Slide-over nebo modal
- **Náročnost:** M (2-3 dny)

**P1 — Confirm dialog pro Hotovo/No-show**
- Současné akce jsou bez potvrzení, snadno omylem kliknout
- Přidat jednoduché confirm sheet
- **Náročnost:** XS (2 hod)

**P2 — "Zkomprimovaná" timeline**
- Defaultně zobrazit jen hodiny kde jsou termíny ± 1 hod buffer
- "Zobrazit celý den" button pro full view
- **Náročnost:** M (1-2 dny)

**P2 — Týdenní miniaturní přehled**
```
Po Út St Čt Pá
 3  4  2  5  1  (termíny)
```
- Nad timeline, malé čísla s počtem termínů
- Klik → přejde na daný den (future: plná weekly view)
- **Náročnost:** M (2 dny)

**P3 — Statistiky na konci stránky**
- Tento týden: X termínů, Y dokončeno, Z no-show
- **Náročnost:** S (1 den)

---

## 5. DASHBOARD — RECEPTION (`/reception`)

### Současný stav
Velmi komplexní: stats grid 6 karet, pending activation, no-show riziko, rebooking doporučení, at-risk klienti, dnešní rozvrh.

### Problémy
- **5+ sekcí na jedné stránce** — informační přetížení při ranním otevření
- **"Čeká na aktivaci bookingu"** — co to přesně znamená? Terminologie nejasná pro zaměstnance recepce
- **Stats grid: `xl:grid-cols-5`** ale 6 karet — jedna přetéká
- **"Systém OK" badge** na recepčním dashboardu — tech info, kterou recepce nepotřebuje (patří do Admin)
- **Uptime zobrazení** na recepci — zbytečné
- **Waitlist stat**: zobrazuje počet WAITING, ale klik jde na `/reception/waitlist` kde je mix stavů
- **Dnešní rozvrh** je na konci stránky — nejdůležitější věc je nejníže
- **"Aktivovat" button** bez kontextu — proč to musím aktivovat? (chybí tooltip/vysvětlení)

### Návrhy

**P1 — Pořadí sekcí přepracovat (information hierarchy)**
```
1. Dnešní rozvrh (tabulka termíny s checkiny) — NAHOŘE
2. Akce vyžadující pozornost (aktivace, kredit žádosti)
3. Statistiky dne
4. Smart doporučení (rebooking, at-risk) — DOLE nebo na záložce
```
- **Náročnost:** XS (refactor pořadí, 2 hod)

**P1 — Rename "Čeká na aktivaci bookingu"**
- Lepší: "Nové rezervace k potvrzení" nebo "Neschválené termíny"
- Přidat tooltip vysvětlující workflow
- **Náročnost:** XS (1 hod)

**P1 — Odstranit Systém OK / Uptime z reception dashboardu**
- Přesunout do Admin panelu
- **Náročnost:** XS (30 min)

**P2 — "Dnešní rozvrh" jako interaktivní checkin list**
```
⏰ 09:00 Jana N. → Mgr. Novák  [Dorazila ✓] [No-show] [Odložit]
⏰ 10:00 Petr K. → Mgr. Nováková  [Přijmout na recepci]
```
- Tlačítka pro rychlé check-in přímo v listu
- Barevné odlišení: zelená = přišel, šedá = no-show, oranžová = čeká
- **Náročnost:** L (3-5 dní)

**P2 — Tabs nebo accordion pro sekce dashboardu**
- Záložky: "Dnes" | "Upozornění" | "Doporučení"
- Sníží cognitive load
- **Náročnost:** M (1-2 dny)

**P3 — Rychlé vyhledání klienta přímo v dashboardu**
- Search bar prominent nahoře: "Vyhledat klienta…"
- Pro recepci je nejčastější akce: najít klienta → zkontrolovat termín
- **Náročnost:** S (1 den)

---

## 6. DASHBOARD — ADMIN (`/admin`)

### Současný stav
Dobrý základ: QuickSummary, stats, pending items, ActivityFeed, quick links. Activity feed refreshuje každých 30s.

### Problémy
- **Quick links bez ikon** — 7 textových karet, vizuálně nudné
- **Stats grid (celkem termínů, klientů, výnosy)** — kumulativní čísla bez kontextu ("vs minulý měsíc")
- **"Background"** jako položka — co to je? Terminologie interní pro vývojáře
- **ActivityFeed**: emoji ikony z backendu (string) — může být libovolné, nekontrolovatelné
- **Secondary stats (Potvrzeno/Zrušeno/No-show)** — absolutní čísla bez procentuálního vyjádření
- **Chybí graf trendů** — revenue over time, appointment volume
- **"FIO Matching"** — úplně nejasný název pro admina bez tech background
- **Admin dashboard** nerozlišuje urgentní vs. informativní — vše stejnou důležitostí

### Návrhy

**P1 — Ikony ke quick links**
```
👥 Uživatelé  |  🏥 Služby  |  🚪 Místnosti
📊 Statistiky  |  💰 FIO platby  |  ⚙️ Nastavení
```
- nebo Lucide ikony konzistentní se zbytkem
- **Náročnost:** XS (1 hod)

**P1 — Rename "Background" a "FIO Matching"**
- Background → "Naplánované úlohy" nebo "Automatizace"
- FIO Matching → "Platby a párování"
- **Náročnost:** XS (30 min)

**P2 — Trend arrows u hlavních stats**
```
Klientů: 847  ↑ +12 tento měsíc
Výnosy: 124 000 Kč  ↑ +8% vs. minulý měsíc
```
- Needs backend delta endpoint nebo frontend calculation
- **Náročnost:** M (2-3 dny)

**P2 — Mini spark-line grafy v stat kartách**
- Malý SVG line graph posledních 7/30 dní
- Bez závislosti na chart library
- **Náročnost:** M (2-3 dny)

**P3 — Customizable dashboard pro admina**
- "Pinned sections" — admin si vybere co chce vidět
- **Náročnost:** XL (5+ dní)

---

## 7. DESIGN SYSTÉM

### Současný stav
`globals.css`: 2 CSS custom properties, Tailwind utility classes. `btn-primary`, `btn-secondary`, `btn-danger`, `card`, `input`, `label`, `badge-*`.

### Problémy

**Barvy**
- `--color-pristav-teal: #0d9488` je definována ale NIKDE nepoužita v UI
- Primary je generic blue (#1d4ed8) — neodpovídá brand identitě rehabilitačního centra pro děti
- Chybí: warning/success/info tokeny jako CSS vars
- Dark mode definován v body ale přes class `html.dark` — OK, ale nekonzistentně aplikován na některých stránkách

**Typografie**
- Žádná custom font — systémový font stack
- Heading scale není definován — `text-2xl font-bold` ručně na každé stránce
- Chybí: display font pro hero sekce

**Spacing**
- `p-6` v `.card` — fixní, nikde není `card-sm` nebo `card-compact`
- Content width: `max-w-4xl`, `max-w-5xl`, `max-w-2xl`, `max-w-3xl`, `max-w-lg`, `max-w-md` — 6 různých hodnot, žádná konzistence

**Komponenty**
- `btn-primary` má `py-2 px-4` — na mobilu příliš malý touch target (min 44px)
- Chybí: `btn-lg` varianta pro primary CTA
- Rating hvězdičky (`★` emoji) — custom styling mimo design systém
- Inline styly (`style={{ height: ... }}`) v progress bar grafu — není tokené

### Návrhy

**P1 — Zvětšit touch targets**
- `btn-primary`: min `py-3 px-6` na mobilu (`py-2 px-4` zůstane pro desktop)
- Responsive: `py-2 px-4 md:py-2 md:px-4`
- Apple HIG: min 44×44pt, Google: min 48×48dp
- **Náročnost:** XS (2 hod)

**P1 — Použít teal barvu jako primary**
```css
--color-primary: #0d9488; /* teal — přátelský, klidný, rehabilitační */
```
- Modrá je generická bankovní/tech barva, teal = zdraví, klid, příroda
- Vhodné pro centrum neurorehabilitace dětí
- **Náročnost:** S (1 den — změna + vizuální ověření)

**P1 — CSS design tokens**
```css
:root {
  --color-primary: #0d9488;
  --color-primary-light: #ccfbf1;
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger: #dc2626;
  --color-text-base: #111827;
  --color-text-muted: #6b7280;
  --radius-card: 12px;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.08);
  --font-sans: 'Inter', system-ui, sans-serif;
}
```
- **Náročnost:** S (1 den)

**P2 — Inter font přidat**
- `next/font/google` s Inter — zlepší readability (humanistická grotesk)
- Nebo Nunito/Poppins pro přátelštější feel (rehab centrum pro děti)
- **Náročnost:** XS (2 hod)

**P2 — Konzistentní max-width**
```
Klient pages: max-w-2xl (672px)
Reception/Admin wide pages: max-w-5xl (1024px)
Formuláře: max-w-md (448px)
```
- Definovat jako Tailwind config extension
- **Náročnost:** S (1 den)

**P2 — `card-compact` varianta**
```css
.card-compact { @apply bg-white rounded-xl shadow-sm border border-gray-100 p-3; }
```
- Pro dashboardové stat tiles
- **Náročnost:** XS (1 hod)

**P3 — Micro-animations rozšíření**
```css
@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-up { animation: fade-up 0.25s ease-out; }
```
- Přidat na: page load, modal open, success states
- **Náročnost:** S (1 den)

---

## 8. EMPTY STATES

### Současný stav
`EmptyState` komponenta existuje: `icon?`, `title`, `description?`, `action?`

### Problémy
- Ne všude používána — některé stránky mají inline `text-gray-400` texty
- Většina použití bez `icon` prop — vizuálně slabé
- `py-16` padding — na malém mobilu způsobí scroll pro prázdný stav
- Chybí empty state ilustrace (SVG) — bílý text na bílém pozadí
- Employee page: `"Dnes nemáte žádné termíny 🎉"` — emoji v přímém textu, ne jako EmptyState

### Návrhy

**P1 — Přidat ikony k EmptyState všude**
- Booking/Waitlist: 🗓️ Calendar ikona
- Termíny: ☕ nebo clock
- Zprávy: 💬
- **Náročnost:** XS (2 hod)

**P1 — Akce v EmptyState pro booking**
```tsx
<EmptyState
  icon={<Calendar size={48} />}
  title="Žádné nadcházející termíny"
  description="Zarezervujte si první termín v pár krocích"
  action={<Link href="/client/booking" className="btn-primary">Rezervovat termín</Link>}
/>
```
- Klíčové CTA musí být viditelné v prázdném stavu
- **Náročnost:** XS (2 hod)

**P2 — Menší padding na mobilu**
- `py-16` → `py-8 md:py-16`
- **Náročnost:** XS (30 min)

---

## 9. LOADING STATES

### Současný stav
`Skeleton` komponenta, `SkeletonStats`, `SkeletonList`. Použito na reception dashboardu. Jiná místa: `"Načítám…"` inline text.

### Problémy
- Booking form: `"Načítání volných termínů…"` jako plain text — bez skeleton
- Client dashboard: stats karty zobrazí `"—"` místo skeletonu → layout shift
- Employee timeline: při načítání nic nevykreslí (`appointments === undefined`)
- Notifikace dropdown: žádný loading state při prvním otevření
- Chybí loading state pro `mutate()` operace (Cancel appointment, activate booking)

### Návrhy

**P1 — Skeleton pro booking sloty**
```tsx
{slotsLoading && (
  <div className="grid grid-cols-3 gap-2">
    {[1,2,3,4,5,6].map(i => (
      <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
    ))}
  </div>
)}
```
- **Náročnost:** XS (1 hod)

**P1 — Optimistic updates pro rychlé akce**
- Cancel appointment: ihned zmizí z listu, toast "Termín zrušen"
- Activate booking: ihned zmizí ze sekce, toast "Aktivováno"
- **Náročnost:** M (1-2 dny)

**P2 — Loading spinner na `btn-primary` při submitu**
- `submitting` state → button text + spinner ikona
- Booking form to dělá správně, ale ostatní formuláře ne
- **Náročnost:** S (1 den — unifikace)

---

## 10. ERROR HANDLING

### Současný stav
`ErrorBoundary.tsx` existuje. Inline error divy `bg-red-50`. `global-error.tsx` definován.

### Problémy
- **ErrorBoundary není použit** na individual page level — jen na root layout
- **Error message**: `err instanceof Error ? err.message : "Chyba"` — raw API error messages mohou být anglicky nebo technické
- **Network errors**: pokud API nedostupné, SWR tiše selže a stránka zůstane v loading state navždy
- **Form validation**: jen server-side errors, žádná client-side validace v booking (prázdný slot selection)
- **Booking error** se zobrazí pod formulářem — na mobilu mimo viewport po scrollu

### Návrhy

**P1 — Toast notifikace pro akce místo inline errors**
- `Toast` komponenta existuje v `/app/components/Toast.tsx`
- Unifikovat: úspěch = zelený toast, chyba = červený toast
- Eliminovat inline `bg-red-50` divy tam kde jsou akce
- **Náročnost:** M (2-3 dny)

**P1 — SWR onError handler globálně**
```tsx
<SWRConfig value={{
  onError: (error) => {
    if (error.status === 401) router.push('/login');
    if (error.status >= 500) toast.error('Serverová chyba, zkuste za chvíli');
  }
}}>
```
- **Náročnost:** S (1 den)

**P2 — Friendly error messages česky**
```tsx
const ERROR_MESSAGES: Record<string, string> = {
  'Network Error': 'Nepodařilo se připojit k serveru. Zkontrolujte připojení.',
  'Unauthorized': 'Vaše přihlášení vypršelo. Přihlaste se znovu.',
  'Not Found': 'Požadovaná data nebyla nalezena.',
};
```
- **Náročnost:** S (1 den)

**P3 — Retry mechanismus pro failed SWR fetches**
- `onErrorRetry` s exponential backoff
- **Náročnost:** S (1 den)

---

## 11. ACCESSIBILITY

### Současný stav
- `aria-label` na sidebar, hamburger button, password toggle, notification bell — ✅
- `id="main-content"` s `tabIndex={-1}` — ✅
- `role="alert"` na OfflineBanner — ✅
- Form inputs mají `id` + `htmlFor` — ✅

### Problémy
- **Chybí skip-to-content link** (viditelný při focusu)
- **Kontrast**: `text-gray-400` na bílém pozadí = ~3.5:1 (WCAG AA vyžaduje 4.5:1 pro normální text)
- **Focus ring**: Tailwind default `focus:ring-2 focus:ring-primary-500` — OK, ale `focus:outline-none` na inputech bez ring = problém
- **Booking sloty**: `<button>` s `type="button"` — OK, ale focus order při grid layoutu není lineární
- **Modaly/Dropdowns**: NotificationBell dropdown nemá `role="dialog"`, `aria-modal`, focus trap
- **DataTable**: `<table>` bez `role`, bez `aria-sort` na sortable columns
- **Rating hvězdičky**: `★` jako text button, bez `aria-label="Hodnotit X hvězd"`
- **Color-only information**: status badges používají jen barvu (PENDING = žlutá) bez jiného rozlišení
- **Keyboard navigation v booking**: slot selection funguje myší, klávesnicí?

### Návrhy

**P1 — Focus trap v dropdown/modal komponentách**
```tsx
// NotificationBell
<div role="dialog" aria-modal="true" aria-label="Notifikace">
```
- Použít `focus-trap-react` nebo vlastní implementaci
- **Náročnost:** M (2 dny)

**P1 — aria-sort na DataTable**
```tsx
<th aria-sort={sortKey === col.key ? sortDir : 'none'}>
```
- **Náročnost:** XS (1 hod)

**P1 — Rating: aria-label pro hvězdičky**
```tsx
<button aria-label={`Hodnotit ${star} hvězd`} aria-pressed={ratingValue >= star}>
```
- **Náročnost:** XS (30 min)

**P2 — Kontrast fix pro muted texty**
- `text-gray-400` → `text-gray-500` (kontrast ~4.6:1)
- Nebo zvýšit font-weight
- **Náročnost:** S (1 den — globální find-replace)

**P2 — Status badges: přidat textový prefix**
- `● Potvrzeno` místo jen barevného badge
- Icon + text vedle sebe
- **Náročnost:** S (1 den)

**P3 — Keyboard shortcut pro booking**
- `Enter` na service card = select
- `Arrow keys` navigace mezi sloty
- **Náročnost:** M (2 dny)

---

## 12. MICROINTERAKCE A ANIMACE

### Současný stav
- `animate-slide-in` pro Toast — ✅
- `transition-colors` na buttonech a nav items — ✅
- `animate-pulse` na NOTIFIED waitlist badge — ✅
- `transition-all` na booking slot cards — ✅
- Spinner na loading states — ✅

### Co chybí
- **Page transitions** — okamžité přepnutí stránek (Next.js default)
- **Card hover**: `hover:shadow-md transition-shadow` — OK, ale bez transform
- **Success animace** v booking — jen zelený div, žádná celebrace
- **Čísla v stat kartách** — statická, bez count-up animace
- **Booking slot selection** — bez spring animation při výběru
- **Timeline scroll** na employee page — žádný smooth scroll k aktuálnímu čase
- **Sidebar active item** — žádná animace přechodu, jen barva

### Návrhy

**P2 — Success konfety/animace po bookingu**
- Malá `@keyframes` animace (scale + opacity) bez knihovny
- 3 secondy, pak fade out
- **Náročnost:** S (1 den)

**P2 — Smooth scroll k "now" v employee timeline**
```tsx
useEffect(() => {
  const nowEl = document.querySelector('[data-current-hour]');
  nowEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}, []);
```
- **Náročnost:** XS (30 min)

**P2 — Card hover s micro-lift**
```css
.card:hover { transform: translateY(-1px); }
```
- Přidat `transition-transform` do `.card` utility
- **Náročnost:** XS (30 min)

**P3 — Count-up animace pro stat čísla**
- Při prvním renderu, číslo "načítá" od 0 do finální hodnoty
- Použít custom hook `useCountUp`
- **Náročnost:** M (2 dny)

**P3 — Stagger animace pro listy**
- Každý item v `space-y-3` se animuje s malým zpožděním po sobě
- `animation-delay: calc(var(--index) * 0.05s)`
- **Náročnost:** S (1 den)

---

## 13. ONBOARDING — FIRST-TIME EXPERIENCE

### Současný stav
Žádný onboarding. Nový klient vidí prázdný dashboard s "—" kreditem a "0" termínů. Přihlášení == opakované přihlášení.

### Problémy
- Nový klient neví co dělat jako první
- Zdravotní karta: schovaná v bočním menu, nikde není propagována
- GDPR consent pro zdravotní data: uživatel narazí až když klikne na "Zdravotní karta"
- Kredit: jak nabít? Postup není popsán na dashboardu
- Notifikace: user musí sám najít /client/settings

### Návrhy

**P1 — Onboarding checklist na dashboardu (pro nového klienta)**
```
🎉 Vítejte v Přístavu Radosti!
Dokončete nastavení pro lepší zážitek:

☐ Vyplňte zdravotní kartu
☐ Povolte notifikace o termínech
☐ Rezervujte první termín
```
- Zobrazit dokud nejsou všechny kroky splněny
- Každý krok = kliknutelný link
- Progress: "1 ze 3 dokončeno"
- **Náročnost:** M (2-3 dny)

**P1 — Welcome modal při prvním přihlášení**
- Detekce: `user.createdAt === today` nebo custom flag
- Jednoduchý modal: "Vítejte! Toto je vaše centrum..."
- Jeden krok, ne wizard
- **Náročnost:** S (1-2 dny)

**P2 — Průvodce bookingem (tooltips)**
- Při prvním otevření `/client/booking`: highlight na krok 1 s tooltipem
- Použít `data-intro` atributy + lightweight tour knihovna (nebo custom)
- **Náročnost:** L (3-5 dní)

**P2 — "Co dělat dál" po první úspěšné rezervaci**
```
✅ Rezervace potvrzena!

Doporučujeme také:
→ Vyplňte zdravotní kartu pro lepší péči
→ Zapněte SMS připomínky termínů
```
- Po success screen
- **Náročnost:** S (1 den)

---

## 14. CHYBĚJÍCÍ FUNKCE S VELKÝM UX DOPADEM

**P1 — Push Notifications permission request**
- PWA má service worker, ale žádný prompt pro push notifications
- Klient by měl dostat notifikaci 24h a 1h před termínem
- **Náročnost:** M (3-5 dní vč. backend)

**P1 — Install to Homescreen prompt (PWA Install)**
- Chybí `beforeinstallprompt` handler
- Pro rodiče klíčové: app na ploše = snadný přístup
- Zobrazit banner po 2. návštěvě
- **Náročnost:** S (1-2 dny)

**P1 — Možnost zrušení/přesunu termínu přímo z notifikace/emailu**
- Deep link: `https://app.pristav.cz/appointments/123/cancel?token=xxx`
- Rodiče přesněji neklikají do app, chtějí jedním klikem
- **Náročnost:** L (3-5 dní)

**P2 — Kalendář export (.ics)**
- "Přidat do Google/Apple kalendáře" po rezervaci
- Generovat ICS soubor na klientovi nebo endpoint
- **Náročnost:** S (1-2 dny)

**P2 — Fotky terapeutů v booking flow**
- Rodiče chtějí vidět kdo to bude s jejich dítětem
- Avatary terapeutů při výběru slotu
- Backend: `employee.avatarUrl` existuje
- **Náročnost:** S (1 den — UI change, avatar již existuje)

**P2 — SMS/WhatsApp share termínu**
- "Sdílet termín s partnerem/babičkou"
- Web Share API (`navigator.share`)
- **Náročnost:** S (1 den)

**P3 — Offline booking queue**
- Pokud uživatel vyplní booking formulář offline, uložit do IndexedDB a odeslat po reconnect
- Service Worker + Background Sync API
- **Náročnost:** XL (5+ dní)

**P3 — Zpětná vazba terapeuta na hodnocení**
- Klient ohodnotí termín, terapeut vidí rating a může odpovědět
- Komunikace kvalita/spokojenost
- **Náročnost:** L (3-5 dní)

---

## 15. SPECIFICKY PRO CÍLOVOU SKUPINU (Rodiče dětí, neurorehabilitace)

### Kontext
Rodiče jsou ve stresu, mají málo času, často přistupují na cestě nebo v čekárně na mobilu. Dítě má specifické zdravotní potřeby. Důvěra k centru je klíčová.

### Návrhy

**P1 — Jméno dítěte místo rodiče v bookingu**
- Aktuálně: "Rezervace pro Petra Nováka" (rodič)
- Lepší: "Rezervace pro Jakuba (vaše dítě)"
- Přidat `childName` pole do user/health record
- **Náročnost:** M (2-3 dny vč. backend)

**P1 — Vizuální přátelskost — barvy a ilustrace**
- Přidat drobné SVG ilustrace/ikony (ne fotky) — kotva (přístav), vlna, loďka
- Odpovídá brandu "Přístav" — klidný, přátelský, bezpečný přístav
- Teal + coral/orange jako akcentní barva (teplá)
- **Náročnost:** M (2-3 dny)

**P2 — "Pokrok dítěte" sekce přejmenovat a vylepšit**
- Aktuálně: "Behavior skóre" — interní koncept, matoucí pro rodiče
- Přejmenovat: "Skóre dochvilnosti" nebo schovat úplně z client view
- Přidat: "Pokrok v terapii" od terapeuta (kvalitativní)
- **Náročnost:** S (1 den)

**P2 — Urgentní kontakt v health kartě**
- "Nouzový kontakt" sekce je v health-record — OK
- Přidat: rychlý přístup z dashboardu v nouzové situaci
- **Náročnost:** XS (2 hod)

**P3 — "Domácí cvičení" sekce**
- Terapeut přiřadí domácí cvičení s popisem/videem
- Klient vidí na dashboardu co má dnes udělat
- Velký engagement a terapeutický benefit
- **Náročnost:** XL (5+ dní vč. backend)

---

## PRIORITIZOVANÝ ROADMAP

### 🔴 P1 — Kritické (do 1-2 sprintů)

| # | Návrh | Náročnost | Dopad |
|---|-------|-----------|-------|
| 1 | Bottom Tab Bar pro CLIENT (mobil) | M | ★★★★★ |
| 2 | Touch targets zvětšit na min 44px | XS | ★★★★☆ |
| 3 | Card-based výběr služby v booking | M | ★★★★★ |
| 4 | Progress stepper v booking flow | S | ★★★★☆ |
| 5 | Push Notifications permission | M | ★★★★★ |
| 6 | PWA Install prompt | S | ★★★★☆ |
| 7 | Hero "Příští termín" karta na dashboardu | S | ★★★★★ |
| 8 | Onboarding checklist pro nového klienta | M | ★★★★☆ |
| 9 | Přejmenovat interní terminologii (Background, FIO, aktivace) | XS | ★★★☆☆ |
| 10 | Pořadí sekcí na reception dashboardu | XS | ★★★★☆ |

### 🟡 P2 — Důležité (3-4 sprinty)

| # | Návrh | Náročnost | Dopad |
|---|-------|-----------|-------|
| 11 | Mini-kalendář místo `<input type="date">` | L | ★★★★☆ |
| 12 | Primary color → teal (#0d9488) | S | ★★★☆☆ |
| 13 | CSS design tokens systém | S | ★★★☆☆ |
| 14 | Sidebar skupiny pro RECEPTION/ADMIN | S | ★★★☆☆ |
| 15 | Toast notifikace unifikace | M | ★★★☆☆ |
| 16 | Fotky terapeutů v booking | S | ★★★★☆ |
| 17 | Kalendář export (.ics) | S | ★★★☆☆ |
| 18 | Kontrast fix (text-gray-400 → text-gray-500) | S | ★★★☆☆ |
| 19 | Success screen s akcemi po bookingu | S | ★★★★☆ |
| 20 | Credit balance v booking flow | S | ★★★☆☆ |
| 21 | "Behavior skóre" přejmenovat/přepracovat | S | ★★★☆☆ |
| 22 | Receptive "Dnešní rozvrh" jako checkin list | L | ★★★★☆ |
| 23 | Inter font | XS | ★★☆☆☆ |
| 24 | Slide-over panel pro termín v employee timeline | M | ★★★★☆ |

### 🟢 P3 — Nice-to-have (backlog)

| # | Návrh | Náročnost | Dopad |
|---|-------|-----------|-------|
| 25 | Průvodce bookingem (tooltips) | L | ★★★☆☆ |
| 26 | Count-up animace pro stats | M | ★★☆☆☆ |
| 27 | Domácí cvičení sekce | XL | ★★★★★ |
| 28 | Offline booking queue | XL | ★★★☆☆ |
| 29 | Terapeut photo gallery | M | ★★★☆☆ |
| 30 | Web Share API pro sdílení termínu | S | ★★☆☆☆ |
| 31 | Customizable admin dashboard | XL | ★★☆☆☆ |
| 32 | Mini spark-line grafy v stat kartách | M | ★★★☆☆ |
| 33 | Keyboard shortcut navigace v booking | M | ★★☆☆☆ |
| 34 | Skip-to-content link | XS | ★★★☆☆ |

---

## SHRNUTÍ KLÍČOVÝCH NÁLEZŮ

```
Silné stránky (zachovat a rozvíjet):
✅ Employee timeline s "now" indikátorem — výborná UX
✅ Dark mode podpora
✅ SWR pattern konzistentní
✅ Skeleton loading na kritických místech
✅ OfflineBanner
✅ Rating systém pro dokončené termíny
✅ ClientTimeline komponenta
✅ GlobalSearch pro reception/admin
✅ Keyboard shortcuts (Cmd+K)

Největší UX dluhy:
❌ Navigace není mobile-first (hamburger → bottom tabs)
❌ Booking form používá nativní selects/date — na mobilu tření
❌ Žádný onboarding pro nového klienta
❌ Žádný PWA install prompt
❌ Žádné push notifications permission flow
❌ Brand color teal definována ale nepoužita
❌ "Behavior skóre" matoucí pro rodiče
❌ Touch targets příliš malé pro mobilní použití
```

---

*Audit provedl: THINKER brainstorm agent | Přístav Radosti UX Review 2026-03-19*
