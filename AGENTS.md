# Repository Guidelines

## Project Structure & Module Organization
- `apps/web/` is the React + TypeScript + Vite frontend. Main code lives in `apps/web/src/` (components, routes, screens, contexts, services, utils). Static assets go in `apps/web/public/`, with `apps/web/index.html` as the entry HTML.
- `services/api/` is the Go service. The entrypoint is `services/api/cmd/main.go`, with core logic in `services/api/internal/` (handlers, actions, infrastructure, manager), domain types in `services/api/domain/`, DB migrations in `services/api/migrations/`, and helpers in `services/api/testutils/`.
- The repo is Docker-free; installers and the local runner handle runtime. Build/run commands live inside each module.

## Build, Test, and Development Commands
Frontend (run from `apps/web/`):
```bash
npm install
npm run dev      # Vite dev server
npm run build    # TypeScript compile + production build
npm run lint     # ESLint
npm run preview  # Serve the production build locally
```
Backend (run from `services/api/`):
```bash
go run ./cmd          # Run the service

go build ./cmd        # Build a binary

go test ./...         # Run all Go tests
```

## Coding Style & Naming Conventions
- Frontend: follow ESLint rules in `apps/web/eslint.config.js`. Use PascalCase for components, camelCase for hooks/utilities, and keep feature UI in `src/components/`, `src/routes/`, and `src/screens/`. Tailwind classes are used directly in JSX.
- Backend: format with `gofmt`, keep package names lowercase, and place request handlers under `internal/handlers` with business logic in `internal/actions`/`internal/manager`.

## Testing Guidelines
- Go tests use the standard `testing` package (with `testify` available). Keep tests next to packages or in `services/api/testutils/`. Run `go test ./...` before opening a PR.
- The frontend currently has no configured test runner; add one before introducing UI tests and document the new command in this file.

## Commit & Pull Request Guidelines
- This checkout has no git history, so commit conventions aren’t visible. Use your team standard (Conventional Commits like `feat:`, `fix:` are a good default).
- PRs should include: a clear summary, testing steps, linked issue or context, and screenshots for UI changes in `apps/web`. Call out migration changes in `services/api/migrations/` explicitly.

## Security & Configuration Tips
- Use `services/api/env-example.yml` as a template for local config; never commit secrets.
- Avoid editing `node_modules/` and only commit `uploads/` when explicitly required.
