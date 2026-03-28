# Brand Assets — Pristav Radosti

## Asset Registry

### Static Custom Graphics (SVG)

| asset_id | file | screen_use_case | states | triggers | reduced_motion_fallback | size_budget | owner_version |
|----------|------|-----------------|--------|----------|------------------------|-------------|---------------|
| brand.logo | `/public/brand/logo-animated.svg` | Login, Splash, About | static | page load | static render | <5KB | Design v1.0 |
| brand.mascot.happy | `/public/brand/mascot-happy.svg` | Dashboard greeting, Settings, Empty states | static | page load | static render | <5KB | Design v1.0 |
| brand.mascot.celebrate | `/public/brand/mascot-celebrate.svg` | Achievements (earned), Milestones | static | badge earned, milestone reached | static render | <6KB | Design v1.0 |
| brand.empty.appointments | `/public/brand/empty-appointments.svg` | Client appointments empty | static | no data | static render | <5KB | Design v1.0 |
| brand.empty.achievements | `/public/brand/empty-achievements.svg` | Achievements empty | static | no badges | static render | <5KB | Design v1.0 |
| brand.empty.credits | `/public/brand/empty-credits.svg` | Credits empty state (zero transactions) | static | no transactions | static render | <5KB | Design v1.0 |
| brand.empty.messages | `/public/brand/empty-messages.svg` | Messages empty (inbox/sent) | static | no messages | static render | <5KB | Design v1.0 |
| brand.empty.homework | `/public/brand/empty-homework.svg` | Homework empty (no active exercises) | static | no tasks | static render | <5KB | Design v1.0 |
| brand.success.booking | `/public/brand/success-booking.svg` | Booking confirmed screen | static | booking POST success | static render | <5KB | Design v1.0 |
| brand.error.generic | `/public/brand/error-generic.svg` | Error boundary (all role sections) | static | runtime error | static render | <5KB | Design v1.0 |
| brand.wave.divider | `/public/brand/wave-divider.svg` | Section breaks | static | decorative | hidden | <1KB | Design v1.0 |
| brand.splash.bg | `/public/brand/splash-bg.svg` | Splash screen background | static | page load | static render | <8KB | Design v1.0 |
| brand.login.hero | `/public/brand/login-hero.svg` | Login page background behind form card | static | page load | static render | <8KB | Design v1.0 |
| brand.onboarding.1 | `/public/brand/onboarding-step1.svg` | Onboarding step 1 | static | step navigation | static render | <6KB | Design v1.0 |
| brand.onboarding.2 | `/public/brand/onboarding-step2.svg` | Onboarding step 2 | static | step navigation | static render | <6KB | Design v1.0 |
| brand.onboarding.3 | `/public/brand/onboarding-step3.svg` | Onboarding step 3 | static | step navigation | static render | <6KB | Design v1.0 |
| brand.maintenance | `/public/brand/maintenance.svg` | Maintenance / offline mode page | static | server unavailable | static render | <6KB | Design v1.0 |

### Animated Assets (Lottie)

| asset_id | file | screen_use_case | duration | loop | triggers | reduced_motion_fallback |
|----------|------|-----------------|----------|------|----------|------------------------|
| anim.success.checkmark | `/public/lottie/success-checkmark.json` | Booking confirm, Payment success | 220ms | no | action complete | static checkmark SVG |
| anim.loading.lighthouse | `/public/lottie/loading-lighthouse.json` | Loading states, API calls | 2s | yes | data fetching | skeleton shimmer |
| anim.celebration.burst | `/public/lottie/celebration-burst.json` | Achievement earned, Milestone | 800ms | no | badge awarded | static mascot-celebrate SVG |
| anim.empty.wave | `/public/lottie/empty-wave.json` | Empty states background | 3s | yes | no data state | static wave-divider SVG |

### Motion Tokens

| token | duration | use_case | easing |
|-------|----------|----------|--------|
| micro | 140ms | tap, toggle, icon | standard |
| short | 200ms | tab, chip, inline swap | standard |
| medium | 280ms | modal, screen transition | spring (`stiffness: 400, damping: 28`) |
| long | 400ms | brand moment (max 1 per screen) | spring-bouncy (`stiffness: 360, damping: 22`) |

## Integration Checklist

- [x] Logo: Login, Splash, About
- [x] Mascot happy: Dashboard greeting
- [x] Mascot celebrate: Achievements earned
- [x] Empty appointments: Client appointments
- [x] Empty achievements: Achievements tab
- [x] Empty credits: Client credits page
- [x] Empty messages: Messages page
- [x] Empty homework: Client homework page
- [x] Success booking: Booking confirmation
- [x] Error generic: All error boundaries (app, admin, reception, employee, client)
- [x] Wave divider: Section breaks
- [x] Login hero: Login page background
- [x] Onboarding 1-3: Onboarding flow
- [x] Maintenance: Offline/maintenance page
- [ ] Lottie: success-checkmark (requires `lottie-react` package)
- [ ] Lottie: loading-lighthouse (requires `lottie-react` package)
- [ ] Lottie: celebration-burst (requires `lottie-react` package)
- [ ] Lottie: empty-wave (requires `lottie-react` package)

## File Naming Convention

- Static SVGs: `/public/brand/<kebab-case-name>.svg`
- Lottie JSON: `/public/lottie/<kebab-case-name>.json`
- Component: `@/components/ui/LottiePlayer.tsx` (conditional import, safe without package)

## Accessibility

All brand illustrations use `aria-hidden="true"` and empty `alt=""` attributes.
They are purely decorative and do not convey information that is not already
available in the surrounding text content.

Animated assets respect `prefers-reduced-motion`:
- Lottie animations render their static fallback (SVG) when reduced motion is preferred.
- CSS/framer-motion transitions are already gated via `useReducedMotion()` across the codebase.

## Size Budgets

| Category | Per-asset budget | Total budget (all SVGs) |
|----------|-----------------|------------------------|
| SVG illustrations | 5-8 KB | <80 KB |
| Lottie JSON | 10-20 KB | <60 KB |
| Wave divider | <1 KB | 1 KB |
