FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime

RUN corepack enable && npm install -g serve@14 \
    && addgroup -S socialtrace && adduser -S socialtrace -G socialtrace

WORKDIR /app
COPY --from=builder --chown=socialtrace:socialtrace /app/dist ./dist

USER socialtrace

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
