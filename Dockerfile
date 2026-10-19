# Imagem da aplicação (staging/produção). Construir: docker build -t lamanus .
# A configuração (URLs da base de dados, palavra-passe, etc.) vem SEMPRE do ambiente em tempo de execução — nada de segredos na imagem.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN for i in 1 2 3; do npm ci && exit 0; echo "npm ci falhou (tentativa $i)"; sleep $((i*10)); done; exit 1

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# URL só para o `prisma generate` (não liga a nada): o valor real vem do ambiente em execução.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate && npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 --no-create-home lamanus
COPY --from=build --chown=lamanus /app/.next/standalone ./
COPY --from=build --chown=lamanus /app/.next/static ./.next/static
COPY --from=build --chown=lamanus /app/public ./public
USER lamanus
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
