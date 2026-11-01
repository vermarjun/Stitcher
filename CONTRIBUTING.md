# Contributing

Thanks for looking. The most useful contributions right now are the boring ones: a prompt that produced a broken video, a provider that doesn't work, a setup step that failed on your machine.

## Reporting a bad video

Open an issue with:

- the exact prompt
- provider and model (`LLM_PROVIDER`, `LLM_MODEL`, and `CODER_MODEL` if you set it)
- whether you got a real video, a title-card fallback, or an error
- the API log for that job: `docker compose logs api | grep <jobId>`

The generated code for every LLM call is stored in the `generationllmios` collection, which usually shows exactly where it went wrong.

## Running one service on its own

You don't need the whole stack to work on one part. Start the dependencies with compose and run the service you're changing on your host:

```bash
docker compose up -d mongo redis
```

Node 20 or newer for the TypeScript services. Python 3.11 or newer for the renderer.

| Part | Install | Run | Test |
|---|---|---|---|
| `apps/api` | `npm ci` | `npm run dev` | `npx tsc --noEmit && npm test && npm run lint` |
| `apps/web` | `npm ci` | `npm run dev` | `npx tsc -b --noEmit && npx vite build && npm run lint` |
| `services/agent` | `npm ci` | `npm run dev` | `npm run typecheck && npm test` |
| `services/rag` | `npm ci` | `npm run seed`, then `npm run dev` | `npm run typecheck && npm test` |
| `services/render` | see `services/render/README.md` | see its README | see its README |

Each service has a `.env.example` that lists what it reads. [docs/CONFIGURATION.md](docs/CONFIGURATION.md) has all of them in one place.

Unit and contract tests mock every LLM provider, so they run without keys. Please keep it that way.

## Pull requests

- One change per PR. A prompt tweak and a refactor are two PRs.
- If you change a prompt in `services/agent/src/prompts/`, add a new version file next to the old one instead of editing it in place, and say in the PR which prompts you tried it on.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), for example `fix(render): stage voiceover files before bwrap starts`.
- CI runs type checks, tests and lint for whatever you touched. Run the same commands locally first.

## Adding a Manim plugin

1. Vendor it under `services/render/vendor/<name>/` with its LICENSE, and add a row to `services/render/vendor/README.md`.
2. Install it in `services/render/Dockerfile`.
3. Write a skill file in `services/agent/src/prompts/skills/` that shows the model the plugin's API with short, working examples.
4. Add a few example scenes that render to `services/rag/seed_corpus/` and reseed.

## Security

Please don't open public issues for security problems. See [SECURITY.md](SECURITY.md).
