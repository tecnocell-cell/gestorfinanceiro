# ─────────────────────────────────────────────────────────────
#  Stage 1: Build React (Vite)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências (inclui devDependencies para o build)
COPY package*.json ./
RUN npm ci

# Copia código-fonte e gera o build
COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────
#  Stage 2: Servidor de produção (Node.js + Express)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Instala apenas dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia o build do React e o código do servidor
COPY --from=builder /app/dist ./dist
COPY server ./server

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "server/index.js"]
