# Telun — imagem do app Next.js (build + runtime com Prisma CLI p/ migrações).
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
# --ignore-scripts: evita rodar o postinstall (prisma generate) aqui, onde a
# pasta prisma/ ainda não foi copiada. O generate roda no estágio de build.
RUN npm ci --no-audit --no-fund --ignore-scripts || npm install --no-audit --no-fund --ignore-scripts

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL placeholder só para o build (páginas são dinâmicas; não conecta).
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?sslmode=disable"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS run
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
