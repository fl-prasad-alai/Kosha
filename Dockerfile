# Kosha: React web app + Node API in one image for Cloud Run (port 8080).
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-slim
ENV NODE_ENV=production PORT=8080 KOSHA_DATA_DIR=/tmp/kosha/passports KOSHA_CACHE_DIR=/tmp/kosha/cache
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY cache ./cache
USER node
EXPOSE 8080
CMD ["npx", "tsx", "server/index.ts"]
