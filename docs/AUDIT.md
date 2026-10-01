# Botler — Security / QA / Production-Readiness Audit

Audit date: 1405 (2026). Scope: full repository (`src/`, `prisma/`, infra, CI).
Status legend: ✅ fixed · ⚠️ partially fixed / accepted with rationale · ⏳ deferred (tracked).

## P0 / critical

| # | Finding | Status |
|---|---|---|
| 1 | Production SQLite DBs (bcrypt hashes, emails) and a `.env` blob are recoverable from git history (`db/custom.db`, `prisma/prisma/dev.db`). | ⏳ Repo-side ignore rules fixed and CI now guards route tracking; **history rewrite + credential rotation is an operational action** (see README security notes). |
| 2 | Billing dead end: no code path could mark an invoice paid or apply a plan; trials auto-converted to `active` forever. | ✅ `PATCH /api/admin/invoices/:id` (mark_paid applies plan atomically); `checkQuota` no longer auto-activates trials and blocks expired trials/`past_due`. |
| 3 | `src/app/api/knowledge/upload/route.ts` was untracked and excluded from Docker by over-broad `upload/` ignore patterns. | ✅ Patterns scoped to `/upload/` + `/download/`; route now trackable; CI fails if any API route is untracked. |
| 4 | Public `/api/chat` returned RAG `sources[].snippet` from every knowledge type (PDF/DOCX internal documents). | ✅ Public responses return titles only; retrieval still grounds the answer. |
| 5 | Webhook idempotency: `ProcessedEvent` unique key not tenant-scoped, marker written before processing, deleted only on send failure → cross-tenant message loss, permanent loss on transient errors, and double LLM billing on retries. | ✅ New unique `(tenantId, platform, eventKey)`, stored `replyText` re-sent on retry without re-running the model, marker deleted when processing fails before a reply exists. |

## P1 / high

| # | Finding | Status |
|---|---|---|
| 6 | `requireTenant` had no role allowlist; operators could delete knowledge, read invoices/referrals/analytics; dashboard view had no role guard. | ✅ Default tenant roles allowlist + suspended-tenant gate; knowledge mutations, billing invoices, referrals, analytics, channels and full agent config are owner-level; dashboard UI guarded to owners. |
| 7 | Quota TOCTOU: concurrent requests all passed the read-only limit check. | ✅ `reserveMessages()` performs a conditional atomic increment before LLM spend. |
| 8 | `conversationLimit` / `voiceMinutes` were never counted or enforced; satisfaction never written. | ✅ Conversation usage counted and enforced; voice fields enforced (no voice pipeline exists yet). ⚠️ Satisfaction remains uncollected — UI shows 0; collecting ratings is a product follow-up. |
| 9 | Month-end date overflow (`setMonth`) in trial, checkout periods and rollover. | ✅ `addMonthsClamped` used everywhere; covered by unit tests. |
| 10 | `X-Forwarded-For` first entry trusted → all rate limits bypassable. | ✅ `clientIp()` prefers `X-Real-IP`, then the **last** XFF hop. |
| 11 | Telegram/Bale treated HTTP 200 `{ok:false}` as delivered. | ✅ Adapters require `data.ok === true`. |
| 12 | Referral: invitee reward never granted; broken simulator (405); farmable self-referrals; GET click counter side effect. | ✅ Welcome credit granted on signup, self-referral guard, simulator removed, click moved to a rate-limited POST, constants centralized in `src/lib/referral.ts`. |
| 13 | Login/change-password 401s triggered the global logout event; public deep links bounced to landing after the boot `/api/auth/me` 401. | ✅ `api(..., { skipAuthEvent: true })` for auth endpoints; `clearSession` preserves public views; `marketplace` added to the view whitelist. |
| 14 | Phone regex extracted digits from card/order numbers and merged unrelated leads. | ✅ `normalizePhone()` (Persian digits, boundaries, E.164) used by chat/webhook/leads; unit-tested. |
| 15 | Placeholder booking detection (`"وقت"`, `"خرید"`) created bogus bookings; not run on webhooks. | ✅ Phrase-level patterns; webhook path now creates bookings with the widget's dedupe key. |
| 16 | Admin/analytics endpoints loaded entire tables into memory; admin/stats filtered all token logs per tenant. | ✅ `groupBy`/`aggregate`, 30/90-day windows and row caps; bounded pagination on list endpoints. |
| 17 | WAL/busy_timeout pragmas were fire-and-forget and per-connection. | ✅ `connection_limit=1` on the SQLite URL + `initSqlite()` awaited from `instrumentation.ts`. |
| 18 | Backup script could silently omit WAL contents. | ✅ Requires `sqlite3 .backup`, runs `integrity_check`, gzips; no silent `cp` fallback. |
| 19 | Seed could run in production with public demo credentials; force-wipe missed tables. | ✅ Production guard (`ALLOW_PROD_SEED=1` required), wipe includes omitted tables. |
| 20 | Trial-to-paid and upgrade path (see #2). | ✅ same as #2. |

## P2 / medium

| # | Finding | Status |
|---|---|---|
| 21 | Embed snippet interpolated tenant-controlled name into HTML/JS (stored injection). | ✅ JSON-encoded config + sanitized comments in widget demo, dashboard widget and channels. |
| 22 | Widget kept previous tenant's `conversationId`/`trackToken`/banners when switching businesses. | ✅ State reset on `tenantId` change; callers pass `key={tenantId}`. |
| 23 | Public chat could be used as a phone-existence oracle (`leadCreated` differed for existing leads). | ✅ `leadCreated` now reflects first capture in the conversation; upsert no longer steals the lead's original conversation. |
| 24 | Chat `conversationId` had no capability binding; `trackToken` returned to any caller. | ✅ Resuming a conversation requires the secret `trackToken`; first response still issues it. |
| 25 | Client-supplied chat `history` trusted verbatim (forged operator/assistant turns). | ✅ `operator` dropped from client history; retrieval history for channels comes from the DB. ⚠️ For an existing widget conversation history still comes from the client — follow-up: load from DB. |
| 26 | Knowledge injected into the system prompt as trusted instructions (indirect prompt injection). | ✅ Delimited `<knowledge>` envelope + explicit "untrusted data" instruction; role=system preserved for Z.ai (was demoted to assistant). |
| 27 | RAG used 240-char previews for grounding; FAQ chunks double-indexed. | ✅ Full chunk text (capped) used for context; snippet retained only for scores. |
| 28 | Provider lookups not tenant-scoped; bulk route skipped `validateBaseUrl`; SSRF gaps (IPv6-mapped, CGNAT, redirects, credentials). | ✅ Tenant/global scoping in engine, bulk validation, expanded denylist, `redirect:"error"`, normalized base URLs. |
| 29 | Z.ai token accounting ignored prompt tokens (quota bypass). | ✅ Uses provider usage when available, otherwise input+output estimate. |
| 30 | Anthropic/Gemini rejected histories starting with the assistant greeting. | ✅ Leading assistant turns dropped before provider calls. |
| 31 | Meta adapters processed only the first batched message; access tokens in query strings; TikTok signature scheme. | ✅ Adapter API parses all batched messages, tokens moved to `Authorization`, TikTok structured `t=…,s=…` scheme with replay window (legacy fallback kept). |
| 32 | Booking/InternalLead dedup race; no FK/index for dangling `conversationId`. | ✅ `dedupeKey` unique, `(tenantId, conversationId)` unique for internal leads, FKs with `SetNull` + indexes (migration `0002_hardening`). |
| 33 | Chat retries double-charged and duplicated messages. | ✅ `clientMessageId` + unique `(conversationId, clientKey)` returns the stored reply. |
| 34 | Admin KPI math: payments/leads KPIs shrank with filters; token chart wasn't ordered by tokens; MRR included trials/suspended; two conflicting token prices. | ✅ Unfiltered KPI source, token ranking from grouped usage, MRR = active non-suspended subscriptions, single `src/lib/pricing.ts` constant. |
| 35 | Track page selector broke when `activeTenantId` was persisted; widget-demo ignored `tenantId`; channels "live preview" link 404'd. | ✅ Tenant list always loads, deep link honored, link fixed to `/?view=widget-demo&tenantId=…`. |
| 36 | Fake/placeholder states presented as real (operator online/answered, admin impersonation, agent prompt regeneration, landing stats). | ✅ Relabeled as local-only / reset / widget preview. ⚠️ Real operator presence is a product follow-up. |
| 37 | Embed mode polluted the visitor's persisted `activeTenantId`; referral code lost on refresh. | ✅ Embed no longer persists; referral code survives via `sessionStorage`. |
| 38 | Destructive actions without confirmation (knowledge, operators, channel disconnect). | ✅ Confirmation dialogs added. |
| 39 | Security headers lacked CSP. | ✅ CSP added; `frame-ancestors` intentionally omitted because the widget is iframed by customer sites. |
| 40 | Docker ran as root with ~1.2 GB of dev dependencies; CI had no drift/tracking checks. | ✅ Multi-stage build with pruned prod deps, non-root uid 1001, single lockfile (npm), CI checks migration drift + untracked routes. |

## Accepted / deferred (with rationale)

- **SQLite single-writer**: fine for the current single-instance deployment; see README "Scaling / PostgreSQL" for the migration checklist.
- **Signup email enumeration (409)**: kept for UX; would require an email-verification flow to remove. Rate limit now uses trusted IPs.
- **Customer satisfaction**: column and UI exist but no collection flow; displayed as 0.
- **Voice channel**: metadata-only; no voice pipeline/usage metering.
- **Airbnb/widget/voice webhook verification** intentionally rejects (fail closed).
- **`Lead @@unique([tenantId, phone])`**: one lead per phone is a product decision; the upsert no longer rebinds the original conversation.
- **History rewrite for the leaked databases** (finding #1) is a destructive, coordinated operation left to the operator.
- **Prompt-injection defense** is best-effort (delimiters + instructions); no model-level guarantee.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — 0 errors.
- `npm run test` — 15/15 unit tests.
- `npm run build` — production build passes.
- Runtime smoke tests: health, login, widget chat, quota, webhook (see commit history).
