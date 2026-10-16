FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

EXPOSE 8081

CMD ["bun", "src/index.ts"]
