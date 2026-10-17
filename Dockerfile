FROM oven/bun:1-alpine AS ui-build

RUN apk add --no-cache git

WORKDIR /ui

ARG UI_REPO=https://github.com/Oluwatunmise-olat/subgrid-ui.git
ARG UI_REF=main
RUN git clone --depth 1 --branch ${UI_REF} ${UI_REPO} .

RUN bun install --frozen-lockfile

ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN bun run build

FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .
COPY --from=ui-build /ui/dist ./public

EXPOSE 8081

CMD ["bun", "src/index.ts"]
