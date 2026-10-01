# Botler — AI Receptionist Platform

An intelligent AI receptionist platform for businesses. Manage conversations, leads, knowledge base, and more across multiple channels (website widget, Instagram, WhatsApp, Telegram, Bale).

---

## ⚠️ Security notes (read first)

- **Never commit `.env` or any `*.db` file.** They are gitignored and must stay that way.
- `JWT_SECRET` is **required** in production (min 32 chars). The app refuses to sign/verify tokens without it. Generate one with:
  ```bash
  openssl rand -base64 48
  ```
- `SECRETS_ENCRYPTION_KEY` (optional but recommended) is used to encrypt provider keys / channel credentials at rest. When unset it falls back to `JWT_SECRET` — set a dedicated key so rotating the JWT secret does not lock encrypted secrets.
- **Git history incident**: older commits contain local SQLite databases with bcrypt password hashes and user emails, plus a `.env` blob. Rotate every credential/password that ever touched those databases and scrub history (`git filter-repo`/BFG) before making the repository public. See `docs/AUDIT.md`.
- All tenant APIs require authentication and derive the tenant from the session; suspended tenants are blocked.
- Channel webhooks require the platform signature/secret (`appSecret` for Meta, secret token for Telegram/Bale). Webhook processing is idempotent per tenant and retries never re-run (or re-bill) the model.
- Rate limiting trusts `X-Real-IP` (or the last hop of `X-Forwarded-For`) — make sure the reverse proxy sets these (the bundled Caddyfile does).
- Logout revokes the session server-side (`tokenVersion` bump).

---

## 🐳 Docker Setup

### 1. Configure the environment

```bash
export JWT_SECRET="$(openssl rand -base64 48)"
export NEXT_PUBLIC_BASE_URL="https://botler.help"
```

`docker compose` refuses to start without `JWT_SECRET`.

### 2. Build and start

```bash
mkdir -p db
# The container runs as uid/gid 1001 (non-root) — make the SQLite volume writable:
sudo chown -R 1001:1001 db
docker compose up -d --build
```

The container runs `prisma migrate deploy` automatically on start (see `docker-entrypoint.sh`), then starts the Next.js server. A health check is exposed at `/api/health` (DB reachability + applied migrations). The entrypoint refuses to start without a valid `JWT_SECRET`/`DATABASE_URL`.

> Upgrading an **existing** database that was created with `prisma db push`?
> Apply the new schema and align the migration history once:
> ```bash
> npx prisma db push
> npx prisma migrate resolve --applied 0001_init
> ```
> After that, `prisma migrate deploy` can be used for future releases.

### 3. Seed demo data (optional, empty database only)

Demo data contains public default credentials, so seeding is blocked when
`NODE_ENV=production`. Opt in explicitly on a throwaway/demo database:

```bash
docker compose exec -e ALLOW_PROD_SEED=1 botler npm run db:seed
```

Demo credentials (development only — change them before any real use):

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@email.com` | `admin` |
| Business Owner | `owner1@cafe-bamdad.com` | `demo123` |
| Operator | `op1@cafe-bamdad.com` | `demo123` |

---

## 🔧 Local Development (without Docker)

```bash
cp .env.example .env
# set DATABASE_URL and JWT_SECRET in .env

npm install
npx prisma generate
npx prisma migrate deploy    # applies prisma/migrations
npm run db:seed              # optional demo data (refuses to run with NODE_ENV=production unless ALLOW_PROD_SEED=1)
npm run dev
```

Quality gates:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # node:test unit tests (tsx)
npm run build       # production build
```

---

## 📁 Project Structure

| Directory | Purpose |
|---|---|
| `src/app/api/` | Next.js API routes (backend) |
| `src/components/` | React UI components |
| `src/lib/` | Shared utilities (db, auth, quota, rate limit, AI) |
| `prisma/` | Database schema, migrations & seed script |
| `tests/` | Unit tests (node:test) |

---

## 🔐 Authentication & Authorization

- Login sets an `httpOnly` JWT cookie (7 days). Tokens embed a `tokenVersion`; changing the password invalidates all other sessions.
- `super_admin` manages the platform; `business_owner`/`operator` are scoped to their tenant.
- Public endpoints: marketplace, pricing, public business profile (projected fields), the chat widget, and signed channel webhooks.
- Password policy: minimum 8 characters.

---

## 💳 Billing

Plan checkout creates a **pending invoice** (idempotent within a 30-minute window); payment is confirmed manually by the platform admin through:

```
PATCH /api/admin/invoices/:id   { "action": "mark_paid" | "mark_failed" | "mark_pending", "paymentRef": "..." }
```

`mark_paid` atomically marks the invoice paid, applies the plan to the subscription (`active`, usage reset, `renewsAt` extended with month-end clamping) and updates the tenant. There is still no online gateway. `payment_instructions` can be configured via the `PlatformConfig` key `payment_instructions` (`{"text": "..."}`). Trials never auto-convert to paid — an expired trial is blocked until a paid invoice is applied.

## 🗄️ Scaling / PostgreSQL

The app currently runs on SQLite (single instance, `connection_limit=1`, WAL + busy timeout). Before running multiple replicas or moving to serverless:

1. Change `datasource.provider` to `postgresql` and `DATABASE_URL` accordingly.
2. `npx prisma migrate dev --name init_pg` on a fresh database (migrations are SQLite-specific; regenerate for Postgres).
3. Replace the in-memory rate limiter (`src/lib/rate-limit.ts`) with Redis.
4. Revisit the SQLite-only `_prisma_migrations` health check (`/api/health`) and backup script.

---

## 💬 Widget & request tracking

Embed code is available from the dashboard. After a conversation, the widget shows a **tracking code**. End users can view their conversations/leads/bookings from the tracking page using their phone number + tracking code.

---

## 🔑 Change Password

Both business dashboard users and the super admin can change their password from the user dropdown menu in the sidebar → **تغییر رمز عبور**.
