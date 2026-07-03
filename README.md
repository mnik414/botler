# Botler — AI Receptionist Platform

An intelligent AI receptionist platform for businesses. Manage conversations, leads, knowledge base, and more across multiple channels (website widget, Instagram, WhatsApp).

---

## 🐳 Docker Setup

### 1. Build and start the container

```bash
docker compose up -d --build
```

### 2. Push the schema and seed demo data

On a **fresh (empty) database**, first create the tables, then seed:

```bash
# Create database tables from schema (uses local Prisma v6 from node_modules)
docker compose exec botler npm run db:push

# Seed sample tenants, plans, and users
docker compose exec botler npm run db:seed
```

This creates:

- **4 plans:** Starter, Growth, Business, Enterprise
- **5 demo tenants:** Café Bamdad, Clinic Noor, ModernKala Shop, Parastoo Travel, Arman Academy
- **Super admin** and per-tenant owner/operator users

### Demo credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@email.com` | `admin` |
| Business Owner | `owner1@cafe-bamdad.com` | `demo123` |
| Operator | `op1@cafe-bamdad.com` | `demo123` |

(Other tenants follow the same pattern: `owner2@clinic-noor.com`, `op2@clinic-noor.com`, etc.)

### 4. Re-seed from scratch

To wipe all data and re-seed:

```bash
docker compose exec botler npm run db:push -- --force-reset
docker compose exec botler npm run db:seed
```

Or reset + seed in one shot:

```bash
docker compose exec botler npm run db:push -- --force-reset && docker compose exec botler npm run db:seed
```

---

## 🔧 Local Development (without Docker)

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to local SQLite
npx prisma db push

# Seed the database
npm run db:seed

# Start dev server
npm run dev
```

---

## 📁 Project Structure

| Directory | Purpose |
|---|---|
| `src/app/api/` | Next.js API routes (backend) |
| `src/components/` | React UI components |
| `src/lib/` | Shared utilities (db, auth, types) |
| `prisma/` | Database schema & seed script |
| `db/` | SQLite database file (gitignored) |

---

## 🔐 Change Password

Both business dashboard users and the super admin can change their password from the user dropdown menu in the sidebar → **تغییر رمز عبور**.