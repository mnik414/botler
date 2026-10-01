FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS prod-deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Non-root runtime user with a fixed uid/gid so the SQLite volume can be
# chowned predictably (chown -R 1001:1001 ./db on the host).
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs && mkdir -p /app/db && chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh
# Runtime deps (prisma CLI for migrate deploy, tsx for db:seed) — dev deps excluded.
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000
CMD ["sh", "docker-entrypoint.sh"]
