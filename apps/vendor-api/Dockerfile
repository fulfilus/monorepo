FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/vendor-api/package.json apps/vendor-api/
RUN pnpm install --frozen-lockfile --filter vendor-api...

FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app ./
COPY packages/shared/ packages/shared/
COPY apps/vendor-api/ apps/vendor-api/
RUN pnpm --filter vendor-api build
RUN pnpm --filter vendor-api exec prisma generate

FROM node:22-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/vendor-api/dist ./dist
COPY --from=builder /app/apps/vendor-api/node_modules ./node_modules
COPY --from=builder /app/apps/vendor-api/prisma ./prisma
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
