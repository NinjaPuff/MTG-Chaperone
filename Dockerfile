FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/

RUN npm ci

FROM deps AS builder
COPY . .

RUN npm run db:generate --workspace=server
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/client/package.json ./client/
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/prisma ./server/prisma

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

WORKDIR /app/server
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
