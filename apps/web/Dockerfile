# ---- builder ----
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build --workspace=@erapor/web
RUN npm prune --omit=dev --no-audit --no-fund

# ---- runner ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web ./apps/web

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@erapor/web"]
