FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/vendor-portal/package.json apps/vendor-portal/
RUN pnpm install --frozen-lockfile --filter vendor-portal...
COPY packages/shared/ packages/shared/
COPY apps/vendor-portal/ apps/vendor-portal/
RUN pnpm --filter vendor-portal build

FROM nginx:1.27-alpine
COPY --from=builder /app/apps/vendor-portal/dist/vendor-portal/browser /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
