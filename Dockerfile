FROM node:20-bookworm-slim AS deps

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder

ENV DB_PROVIDER=sqlite
ENV DATABASE_URL=file:./dev.db
ENV SQLITE_URL=file:./dev.db
ENV NEXTAUTH_SECRET=docker-build-secret
ENV AUTH_SECRET=docker-build-secret
ENV NEXTAUTH_URL=http://localhost:3000
ENV UPLOAD_SESSION_SECRET=docker-build-upload-secret

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /app/uploads /app/data

EXPOSE 3000

CMD ["npm", "run", "start"]
