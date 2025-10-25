# Repository Guidelines

This repository is a Next.js 15 + TypeScript app with Prisma-backed storage. Use this guide to develop, test, and contribute efficiently.

## Project Structure & Module Organization
- `src/app`: Next App Router (routes, layouts, API in `src/app/api/**`).
- `src/components`: Reusable UI (Tailwind CSS v4).
- `src/lib`: Server/client utilities (Prisma, auth, caching, helpers).
- `src/types`: Shared TypeScript types.
- `prisma/`: `schema.prisma` (SQLite local), provider variants (`schema.mysql.prisma`, `schema.postgresql.prisma`), `migrations/`.
- `public/`: Static assets. `uploads/`: runtime file storage (gitignored).
- `scripts/`: Maintenance scripts (e.g., `setup-db.js`). `docs/`: Additional documentation.

## Build, Test, and Development Commands
- `npm run dev` — Start local dev server (http://localhost:3000).
- `npm run build` / `npm run start` — Production build/serve.
- `npm run lint` — ESLint with `next/core-web-vitals` + TypeScript rules.
- `npm run db:setup` — Pick DB provider via `.env`, materialize `schema.prisma`, generate Prisma client.
- `npm run db:migrate` / `db:migrate:deploy` / `db:push` / `db:studio` — Apply migrations, deploy, push schema, open Prisma Studio.
- `npm run build:vercel` — Prisma generate + migrate deploy + Next build (for CI/Vercel).

## Coding Style & Naming Conventions
- TypeScript strict mode; import with alias `@/*` (see `tsconfig.json`).
- Components: PascalCase; files under `app/` follow Next naming: `page.tsx`, `layout.tsx`, `route.ts`.
- Prefer functional components; style with Tailwind classes; avoid inline styles. Run `npm run lint` before pushing.

## Testing Guidelines
- No test runner is configured yet. If adding tests: name files `*.test.ts(x)` and colocate near source or under `src/__tests__`.
- Include an `npm test` script in PRs that add tests; target meaningful coverage for critical modules.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat`, `fix`, `chore`, `refactor`, `docs`, `perf` (e.g., `feat: add project version editor`).
- PRs should: describe scope and motivation, link issues, include screenshots for UI changes, note DB migration impact, and steps to verify. Ensure `npm run lint` and relevant `db:*` commands pass.
- Do not commit secrets (`.env*`), local DBs (`prisma/dev.db`), or runtime uploads (`uploads/*`).

## Security & Configuration Tips
- Store secrets in `.env.local`. Run `npm run db:setup` to bootstrap DB config and Prisma client.
- Rotate tokens/SMTP creds via environment; never log sensitive values.
