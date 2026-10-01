# Botler — AI Receptionist Platform

An intelligent AI receptionist platform for businesses. Manage conversations, leads, knowledge base, and more across multiple channels (website widget, Instagram, WhatsApp, Telegram, Bale).

---

## ⚠️ Security notes (read first)

- **Never commit `.env` or any `*.db` file.** They are gitignored and must stay that way.
- `JWT_SECRET` is **required** in production (min 32 chars). The app refuses to sign/verify tokens without it. Generate one with:
  ```bash
  openssl rand -base64 48
  ```
- Rotate any provider keys / bot tokens that were ever committed to this repository.
- All tenant APIs require authentication and derive the tenant from the session.
- Channel webhooks require the platform signature/secret (`appSecret` for Meta, secret token for Telegram/Bale).

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
docker compose up -d --build
```

The container runs `prisma migrate deploy` automatically on start (see `docker-entrypoint.sh`), then starts the Next.js server. A health check is exposed at `/api/health`.

> Upgrading an **existing** database that was created with `prisma db push`?
> Apply the new schema and align the migration history once:
> ```bash
> npx prisma db push
> npx prisma migrate resolve --applied 0001_init
> ```
> After that, `prisma migrate deploy` can be used for future releases.

### 3. Seed demo data (optional, empty database only)

```bash
docker compose exec botler npm run db:seed
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
npm run db:seed              # optional demo data
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

Plan checkout creates a **pending invoice**; payment is confirmed manually by the platform admin (there is no online gateway wired yet). `payment_instructions` can be configured via the `PlatformConfig` key `payment_instructions` (`{"text": "..."}`).

---

## 💬 Widget & request tracking

Embed code is available from the dashboard. After a conversation, the widget shows a **tracking code**. End users can view their conversations/leads/bookings from the tracking page using their phone number + tracking code.

---

## 🔑 Change Password

Both business dashboard users and the super admin can change their password from the user dropdown menu in the sidebar → **تغییر رمز عبور**.
