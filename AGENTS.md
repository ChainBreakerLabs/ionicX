# Repository Guidelines

## Project Structure & Module Organization
- `ionic-x/` is the React + TypeScript + Vite frontend. Main code lives in `ionic-x/src/` (components, routes, screens, contexts, services, utils). Static assets go in `ionic-x/public/`, with `ionic-x/index.html` as the entry HTML.
- `ionic-x-ms/` is the Go service. The entrypoint is `ionic-x-ms/cmd/main.go`, with core logic in `ionic-x-ms/internal/` (handlers, actions, infrastructure, manager), domain types in `ionic-x-ms/domain/`, DB migrations in `ionic-x-ms/migrations/`, and helpers in `ionic-x-ms/testutils/`.
- The repo is Docker-free; installers and the local runner handle runtime. Build/run commands live inside each module.

## Build, Test, and Development Commands
Frontend (run from `ionic-x/`):
```bash
npm install
npm run dev      # Vite dev server
npm run build    # TypeScript compile + production build
npm run lint     # ESLint
npm run preview  # Serve the production build locally
```
Backend (run from `ionic-x-ms/`):
```bash
go run ./cmd          # Run the service

go build ./cmd        # Build a binary

go test ./...         # Run all Go tests
```

## Coding Style & Naming Conventions
- Frontend: follow ESLint rules in `ionic-x/eslint.config.js`. Use PascalCase for components, camelCase for hooks/utilities, and keep feature UI in `src/components/`, `src/routes/`, and `src/screens/`. Tailwind classes are used directly in JSX.
- Backend: format with `gofmt`, keep package names lowercase, and place request handlers under `internal/handlers` with business logic in `internal/actions`/`internal/manager`.

## Testing Guidelines
- Go tests use the standard `testing` package (with `testify` available). Keep tests next to packages or in `ionic-x-ms/testutils/`. Run `go test ./...` before opening a PR.
- The frontend currently has no configured test runner; add one before introducing UI tests and document the new command in this file.

## Commit & Pull Request Guidelines
- This checkout has no git history, so commit conventions aren’t visible. Use your team standard (Conventional Commits like `feat:`, `fix:` are a good default).
- PRs should include: a clear summary, testing steps, linked issue or context, and screenshots for UI changes in `ionic-x`. Call out migration changes in `ionic-x-ms/migrations/` explicitly.

## Security & Configuration Tips
- Use `ionic-x-ms/env-example.yml` as a template for local config; never commit secrets.
- Avoid editing `node_modules/` and only commit `uploads/` when explicitly required.
