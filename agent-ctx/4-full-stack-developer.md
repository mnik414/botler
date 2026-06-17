# Task 4 — Operators Management Tab + End-User Request Tracking Page

Agent: full-stack-developer (operators + track)
Task ID: 4
Date: 2024 (session)

## What I built

### Feature 1 — Business Owner "Operators" tab
- Created `src/components/dashboard/operators.tsx` exporting `OperatorsTab({ tenantId })`.
- Fetches `GET /api/tenants/[id]/operators` → list of users.
- Stats KPI cards: total users, operators count, business owners count, last member joined.
- Table of users: avatar/initial, name (+ crown for owner), email, role badge (uses `ROLE_LABELS`), createdAt (via `formatDate`), delete button.
- Delete calls `DELETE /api/tenants/[id]/operators?userId=USER_ID`. Button is disabled for business_owner unless there are 2+ owners (matches backend guard).
- "افزودن اپراتور" Dialog with form (name, email, password) → `POST /api/tenants/[id]/operators` body `{name,email,password,role:"operator"}` → toast + reload + close.
- Uses shared primitives from `./shared` (SectionCard, LoadingBlock, ErrorBlock, EmptyState, useAsync, KpiCard).
- Uses `ROLE_LABELS`, `toFa`, `formatDate` from `@/lib/format`, `toast` from `sonner`.

### Feature 1 wiring — dashboard/index.tsx
- Added `Users` to the lucide-react import.
- Added `import { OperatorsTab } from "./operators"`.
- Added nav item `{ key: "operators", label: "اپراتورها", icon: Users, group: "team" }` (placed after "leads" so it groups with the operational tools).
- Added title metadata: `operators: { title: "اپراتورها", subtitle: "مدیریت کاربران دسترسی‌دار به پنل" }`.
- Added render case: `{tab === "operators" && <OperatorsTab tenantId={tenant.id} />}`.

### Feature 2 — End-User "Track Request" page
- Created `src/components/public/track-request.tsx` exporting `TrackRequestPage()`.
- Centered layout with header badge + title + description.
- Search form Card: phone input (`dir="ltr"`, `inputMode="tel"`, placeholder `0912...`) + tenant selector.
  - If `activeTenantId` is set in the store → pre-selects it and shows it as a locked branded chip (no select).
  - Otherwise fetches `/api/marketplace` and populates a `<Select>` (defaults to first item).
- On submit: `GET /api/track?phone=PHONE&tenantId=TENANT_ID`.
- If `found === true`: renders three result sections (only those with items > 0):
  - **گفتگوها** — each item shows channel label, time-ago, message count, status badge via `CONVO_STATUS`.
  - **لیدها** — name, intent label, value (formatToman), date (formatDate), status badge via `LEAD_STATUS`.
  - **رزرو و سفارش‌ها** — payload label + booking type label, dates, scheduledAt, endUserName, details, status badge (pending/confirmed/cancelled, local label map).
  - Each list wrapped in `max-h-96 overflow-y-auto scroll-area`.
- If `found === false`: dashed-border empty state card "درخواستی با این شماره یافت نشد".
- Loading: results skeleton (3 cards).
- Toast on success (counts) and info on no-results.
- Uses `api` from `@/lib/api-client`, `useApp` from `@/store/app-store`, `toFa`, `formatDate`, `timeAgo`, `formatToman`, `CONVO_STATUS`, `LEAD_STATUS` from `@/lib/format`, `toast` from `sonner`.
- shadcn/ui: Card, Button, Input, Label, Badge, Skeleton, Select. Icons from `lucide-react`: Search, Phone, MessageSquare, UserPlus, CalendarCheck, Package, Clock, Loader2, Inbox.

### Feature 2 wiring
- `src/components/public/public-shell.tsx`: added `{ key: "track", label: "پیگیری درخواست" }` to the `NAV` array (after pricing).
- `src/store/app-store.ts`: added `"track"` to the `View` union type.
- `src/app/page.tsx`:
  - Added `import { TrackRequestPage } from "@/components/public/track-request"`.
  - Added `"track"` to the `isPublic` array.
  - Excluded `"track"` from `showFloating` (so the floating chat widget doesn't appear on the tracking page — keep focus on the form).
  - Added render case `{view === "track" && <TrackRequestPage />}` inside the PublicShell block.

## Files
- Created:
  - `src/components/dashboard/operators.tsx` — `export function OperatorsTab({ tenantId })`
  - `src/components/public/track-request.tsx` — `export function TrackRequestPage()`
- Modified:
  - `src/components/dashboard/index.tsx` — import + NAV entry + TITLES entry + render case + Users icon import
  - `src/components/public/public-shell.tsx` — added "track" NAV entry
  - `src/store/app-store.ts` — added `"track"` to View union
  - `src/app/page.tsx` — import + isPublic array + render case + showFloating exclusion

## Lint & type-check
- `bun run lint` → exit 0 (clean).
- `npx tsc --noEmit` → no errors in any file I authored or modified (existing pre-existing errors in other files are out of scope).

## Notes for next agents
- The track API returns `bookings` with `payload` already JSON-parsed by the backend (route maps `payloadJson` → `payload`). No client-side parsing needed.
- The `payload` object fields: `{ details, label, endUserName, endUserPhone, capturedAt }` — all optional.
- Booking types: `order | reservation | appointment | callback`. Booking statuses: `pending | confirmed | cancelled`.
- Conversation channels (from prisma): `website | widget | instagram | whatsapp | voice`.
- The `OperatorsTab` reuses the dashboard's `useAsync` hook for consistent loading/error/reload UX with the other 9 tabs.
