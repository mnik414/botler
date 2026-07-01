FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json ./
RUN npm install -g bun && bun install

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm install -g bun && bun run build

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create db directory (running as root so we can write to mounted volumes)
RUN mkdir -p /app/db

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

# Copy all node_modules so CLI tools (prisma, tsx, bcryptjs, esbuild) work
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]