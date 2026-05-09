# ──────────────────────────────────────────────
# Stage 1: Build the Vite frontend
# ──────────────────────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ──────────────────────────────────────────────
# Stage 2: Build the TypeScript server
# ──────────────────────────────────────────────
FROM node:22-alpine AS server-build

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY server ./server
COPY schema.sql ./schema.sql
COPY tsconfig.json ./tsconfig.json
RUN npx tsc --project server/tsconfig.json

# ──────────────────────────────────────────────
# Stage 3: Production image
# ──────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Only install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built frontend (Vite output)
COPY --from=frontend-build /app/dist ./dist

# Copy compiled server + schema
COPY --from=server-build /app/dist/server ./dist/server
COPY --from=server-build /app/schema.sql ./schema.sql

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
