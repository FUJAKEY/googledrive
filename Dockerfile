# --- build stage ---
FROM node:18-alpine AS builder
WORKDIR /app

# Копируем package.json для кэширования зависимостей
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
COPY scripts ./scripts

RUN npm install

COPY . .

# Генерация Prisma client и сборка
RUN npm --prefix server run prisma:generate
RUN npm run build

# Удаляем dev-зависимости
RUN npm prune --omit=dev

# --- production image ---
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8000

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/package.json ./client/package.json

EXPOSE 8000
CMD ["node", "server/dist/index.js"]
