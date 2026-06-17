# Task 3 — Agent Work Record: full-stack-developer (admin + operator)

## Scope
Built the Super Admin platform panel and Operator console for the Multi-Tenant AI Receptionist SaaS.
Persian RTL, Next.js 16 App Router, Tailwind v4, shadcn/ui, recharts, framer-motion, emerald theme.

## Files Created

### Admin panel (`src/components/admin/`)
- `index.tsx` — `AdminView()` named export. Full-height app shell with right-side RTL sidebar
  (branding + 5 nav tabs + user dropdown/logout) that collapses to a Sheet on mobile. Top bar with
  dynamic per-tab title and dark-mode toggle. Internal guard: if `session.role !== "super_admin"`
  renders a "دسترسی غیرمجاز" page with logout. Tabs controlled by `useApp`'s `adminTab`/`setAdminTab`.
- `overview.tsx` — `<AdminOverview/>` fetches `/api/admin/stats`. Renders 8 KPI cards
  (totalTenants, activeTenants, totalUsers, totalConversations, totalLeads, totalInternalLeads,
  mrr, totalRevenue, totalTokens via formatToman/formatCompact). 30-day revenue AreaChart, plan
  distribution PieChart (with Cell color palette), token-usage-by-tenant horizontal BarChart, and a
  top-tenants table (name, plan badge, status badge, mrr, tokens, createdAt).
- `tenants.tsx` — `<AdminTenants/>` fetches `/api/tenants`. Search + status filter + plan filter.
  Table with name(+slug + accent dot), businessType label, plan badge, inline status `Select` that
  PATCHes `/api/tenants/[id] {status}`, conversation/lead/knowledge/user counts, mrr, createdAt.
  Row click opens a Dialog with full tenant details + contact info + suspend/activate button +
  "ورود به عنوان" impersonate button (calls `setActiveTenant` + `setView('widget-demo')`).
- `plans.tsx` — `<AdminPlans/>` fetches `/api/plans` + `/api/admin/stats`. Header card explaining
  per-message/per-lead/per-token billing model. 3 summary KPIs. 4 plan cards showing limits
  (conversation/message/voice/token), features, count and revenue per plan (cross-ref with stats).
  Revenue-by-plan bar visualization.
- `revenue.tsx` — `<AdminRevenue/>` fetches `/api/admin/stats`. Revenue KPIs (mrr, totalRevenue,
  invoice count, ARPU). 30-day revenue AreaChart. Revenue-by-plan BarChart with colored Cells.
  8-factor billing-model explainer card (subscription, extra message, lead, extra token, voice
  minute, extra conversation, knowledge storage, referral commission). Top tenants by MRR table
  with share-of-total percentages.
- `tokens.tsx` — `<AdminTokens/>` fetches `/api/admin/stats`. Token KPIs (total, avg per tenant,
  top consumer, est. cost). Horizontal BarChart of token usage by tenant. AI model management card
  listing 3 available models (glm-4.6, glm-4.5, glm-4-flash) with tier and description. Top-tenants
  by tokens table with progress bars showing share of total.
- `shared.tsx` — internal helpers:
  - `useAsync<T>(fn, deps)` → `{data, loading, error, reload, setData}` hook with auto-cleanup.
  - `StatCard({label, value, icon, hint, accent})` — KPI card with 6 accent variants.
  - `CardSkeletons({count})` — loading skeleton grid.
  - `ErrorState({message, onReload})` — Alert with retry button.
  - `SectionCard({title, description, action, children})` — titled card wrapper.
  - `statusBadgeClass(status)` / `statusLabel(status)` — tenant status helpers.
  - `CHART_COLORS` — exported palette `[#10b981, #f59e0b, #ec4899, #14b8a6, #8b5cf6, #0ea5e9]`.

### Operator console (`src/components/operator/`)
- `index.tsx` — `OperatorView()` named export. Full-height layout: conversation queue on the left,
  active conversation on the right. Top bar with tenant name, operator avatar dropdown, online/offline
  toggle, and 3 quick-stat chips (queued handoffs, handled today, avg confidence).
  - Reads `session.tenant.id` and fetches `/api/conversations?tenantId=`.
  - Queue: search (name/phone), filter (all/handoff/ai/closed), auto-sorts handoff first then recent.
    Each item shows avatar, name, phone/channel, status badge, "نیاز به پاسخ" amber badge for
    unanswered handoffs, "پاسخ داده شد" green badge, leadCaptured icon (UserPlus), messageCount, timeAgo.
  - Conversation pane: header with end-user info + handoff banner ("این گفتگو به شما ارجاع داده شده است").
    Messages as bubbles: user (right, sky bg), assistant (left, primary bg) with confidence + sources,
    operator (left, amber bg). Auto-scroll. Empty state when no conversation selected.
  - Reply: Textarea + Send button → POST `/api/conversations {conversationId, content, operatorName}`.
    Optimistic message insert, Ctrl+Enter shortcut, refresh list after send. Mark-as-answered visual
    toggle (local state, with note that conversation.status is managed by the chat endpoint).
  - Mobile: queue collapses when a conversation is selected (back button reveals queue again).

## Key Decisions
- Used `useAsync` hook (in shared.tsx) for all data fetching with auto-cleanup + reload capability,
  avoiding cascading render lint errors by not calling setState synchronously in effects.
- All numbers Persian via `toFa/formatToman/formatNumber/formatCompact`.
- Charts use the exact palette from spec (emerald, amber, pink, teal, violet, sky) as `Cell fill`.
- Status changes on tenants use inline `<Select>` that PATCHes immediately + shows toast + updates
  local state for snappy UX (no full reload needed).
- Impersonation: `setActiveTenant(id, slug)` + `setView("widget-demo")` so super-admin can preview
  any tenant's agent (FloatingWidget will use the active tenant id).
- Operator messages bubble distinguish user/assistant/operator with different colors + icons and
  show confidence + RAG sources + handoff marker on assistant messages.
- Internal guards in both views: admin requires `super_admin`, operator requires any logged-in
  session with a tenant.

## Import Contract Compliance
- `useApp` from `@/store/app-store` → `{ session, adminTab, setAdminTab, setActiveTenant, setView, logout }` ✓
- `api`, `type AdminStats`, `type Conversation` from `@/lib/api-client` ✓
- Format helpers from `@/lib/format` ✓ (only used the exports the worklog listed)
- shadcn/ui from `@/components/ui/*` ✓
- recharts components ✓
- lucide-react icons ✓
- `motion` from `framer-motion` for subtle transitions ✓
- `toast` from `sonner` ✓

## Lint Status
Files in `src/components/admin/**` and `src/components/operator/**` are lint-clean.
The remaining `bun run lint` error is in `src/components/public/public-shell.tsx` (Task 0/owner) and
the warning in `src/components/dashboard/shared.tsx` (Task 2) — both outside this task's scope.
TypeScript `tsc --noEmit` reports no errors in any admin/operator file (all errors are in
examples/, skills/, api/, or dashboard/ — none in this task's files).
