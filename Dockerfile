# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci


# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for the Linux/musl target
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build


# ── Stage 3: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Static assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

# Standalone output (includes server.js + traced node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Full production dependencies for maintenance scripts and Prisma CLI.
# Copying node_modules wholesale avoids missing transitive runtime deps like
# `effect` required by @prisma/config when running `npx prisma migrate deploy`.
COPY --from=builder /app/node_modules ./node_modules

# Prisma schema and generated client/runtime assets used by migrate/client.
COPY --from=builder /app/prisma ./prisma

# PDFKit: font metrics (.afm) loaded at runtime via __dirname — not traced by nft
COPY --from=builder /app/node_modules/pdfkit/js/data ./node_modules/pdfkit/js/data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
