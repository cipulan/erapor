# ---- builder ----
FROM node:24-alpine AS builder
WORKDIR /app

# Manifest dulu untuk layer caching
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN npm ci --no-audit --no-fund

# Source + generate Prisma client + build workspace deps + build
COPY . .
RUN npm run db:generate
RUN npm run build --workspace=@erapor/api-client
RUN npm run build --workspace=@erapor/api
RUN npm prune --omit=dev --no-audit --no-fund

# ---- runner ----
FROM node:24-alpine AS runner
WORKDIR /app

# Chromium untuk PDF (puppeteer-core), font untuk render yang rapi
RUN apk add --no-cache chromium ca-certificates ttf-freefont
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api

EXPOSE 3001
# Migrate dulu (idempotent), baru jalanin server
CMD ["sh", "-c", "npx prisma migrate deploy --config packages/database/prisma7.config.ts && node apps/api/dist/main.js"]
