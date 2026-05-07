# Contributing to Stitcher

Thank you for your interest in contributing! Please read these guidelines before opening issues or pull requests.

## Reporting Issues

- Search existing issues before opening a new one.
- Include steps to reproduce, expected behaviour, actual behaviour, and your environment (OS, Node version, etc.).
- Tag bug reports with `bug`, feature requests with `enhancement`.

## Pull Requests

1. Fork the repository and create your branch from `main`.
2. Follow the branch naming convention below.
3. Keep PRs focused — one logical change per PR.
4. Ensure `npm run build` (in `API/`) passes before submitting.
5. Add or update tests where applicable.
6. Fill out the PR template and link any related issues.

## Branch Naming

```
<type>/<short-description>
```

Examples:
- `feat/health-endpoint`
- `fix/redis-reconnect`
- `chore/update-tsconfig`
- `docs/api-readme`

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`.

Examples:
- `feat(api): add structured Winston logging`
- `fix(config): remove dead MICROSERVICE_URL check`
- `docs(readme): add service architecture table`

## Code Style

- TypeScript strict mode is enforced — no `any` casts without a comment explaining why.
- Run `npx tsc -b` to verify types before pushing.
- Use the existing Winston logger (`src/util/logger.util.ts`) — no raw `console.log` in new code.

## License

By contributing you agree your contributions will be licensed under the MIT License.
