# Comparadise — Agent Guidelines

Comparadise is a visual regression testing tool consisting of three main packages plus a shared library:

- **`app/`** — Bun + React web app (tRPC backend, React Query frontend, Tailwind CSS)
- **`action/`** — GitHub Action that runs visual tests and uploads screenshots to S3
- **`comparadise-utils/`** — Cypress utilities for writing visual tests
- **`shared/`** — Constants shared across packages

## Package Manager & Monorepo

Use **`bun`** exclusively. Never use `npm` or `yarn`.

This is an **Nx monorepo**. Run cross-package tasks with `nx` or `bunx nx`.

```bash
bun install           # install all dependencies
bunx nx affected --target=build,test   # build and test affected packages
```

## Development

```bash
nx dev app            # run the app locally at http://localhost:8080 (hot reload)
```

The app requires AWS credentials for the S3 bucket. Log in to the appropriate AWS account before running locally.

## Testing

- **Unit tests (action):** `bun test` inside `action/`
- **Component + E2E tests (frontend):** Cypress — `nx test frontend` / `nx test:e2e frontend`
- **Full app E2E:** `npm run test` in `app/` — this builds a Docker image first via `nx docker comparadise`

Run only the tests relevant to your changes. Do not run E2E tests unless necessary, as they require Docker.

## CI Checks (must pass before merging)

All of the following run on PRs targeting `main`:

```bash
bun lint              # ESLint (TypeScript + React rules)
bun format-check      # Prettier
bun tsc               # TypeScript type check
bunx nx affected --target=build,test   # build + test affected packages
```

Fix lint and format issues before committing. After building, the CI also checks that no generated files are uncommitted — run `bun run build` in `action/` if you modify action source, and commit the `dist/` output.

## Code Conventions

- TypeScript everywhere; strict mode is on via `typescript-eslint`
- React components live in `app/frontend/components/`
- Backend tRPC routes live in `app/backend/src/`
- Shared constants (S3 directory names, image names, etc.) go in `shared/index.ts`
- Tailwind for all styling — class ordering is enforced by `prettier-plugin-tailwindcss`

## Action Build

The GitHub Action runs from compiled output. After changing files in `action/src/`, rebuild:

```bash
cd action && bun run build
```

Commit the updated `action/dist/` files — CI will fail if they are out of sync with source.

## Key Architectural Notes

- S3 stores images under `base-images/`, `new-images/`, and `original-new-images/` directories (constants in `shared/`)
- The app uses tRPC with a Bun HTTP server (`app/server.ts`) serving both the API and the React SPA
- The GitHub Action has a `main` phase (runs tests, uploads images) and a `post` phase (uploads base images after approval)
- `diff-id` input disables GitHub integration; `commit-hash` is the default identifier
