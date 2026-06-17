# Task 1 — Public Pages (full-stack-developer)

## What I built
Five public-facing page components for the Multi-Tenant AI Receptionist SaaS platform, all Persian/RTL with the emerald theme. All exports match the imports already wired in `src/app/page.tsx`.

## Files
1. `src/components/public/landing.tsx` → `export function LandingPage()`
   - Hero with floating mini chat-preview (emerald, typing dots)
   - Stats bar (۴ numbers in Persian)
   - Business types grid (icons mapped from lucide-react)
   - 8-card features grid
   - 4-step How It Works
   - Emerald gradient live-demo CTA band
   - Marketplace preview (3-4 items from /api/marketplace)
   - Final CTA section
   - Framer-motion subtle entrance animations
2. `src/components/public/marketplace.tsx` → `export function MarketplacePage()`
   - Debounced search + category chips from MARKETPLACE_CATEGORIES
   - Refetches /api/marketplace?category=&q=
   - Card grid with accent swatch + "گفتگو با منشی" button → setActiveTenant + setView('widget-demo')
   - Skeleton loading + empty state
3. `src/components/public/pricing.tsx` → `export function PricingPage()`
   - Fetches /api/plans, 4 cards, popular badge + emerald ring
   - Monthly/annual Switch toggle (annual = ×10)
   - formatToman price, limits as small badges (formatCompact+toFa)
   - Feature checklist with scroll-area
   - FAQ Accordion (4 Q&A) + bottom CTA
4. `src/components/public/login.tsx` → `export function LoginPage()`
   - Centered split-layout card
   - POST /api/auth/login → setSession(res)
   - Demo credentials quick-fill (admin / owner / operator)
   - Link to signup
5. `src/components/public/signup.tsx` → `export function SignupPage()`
   - 4-step wizard with Stepper (business type → info → plan → account)
   - Validates name/phone/email
   - POST /api/tenants → auto-login (demo123) → setSession
   - Emerald confetti success state via framer-motion

## Key decisions
- Lucide icons mapped via explicit `BUSINESS_ICON_MAP`/`BIZ_ICONS` records (no dynamic imports).
- Signup password field locked to `demo123` (the API hard-codes this) with informational Alert; auto-login uses same password.
- Pricing annual toggle = monthly × 10 (2 months free), purely visual.
- Marketplace "گفتگو" calls setActiveTenant(item.id, item.slug) then setView('widget-demo') so FloatingWidget picks up tenant.
- All numbers in Persian via toFa/formatToman/formatCompact.
- No header/footer (PublicShell provides them).
- Lint clean for all 5 files (only lint error in repo is in public-shell.tsx, owned by orchestrator).
