# Shortcuts for the common Docker Compose commands. Run `make help`.

.PHONY: help setup up down logs ps test reset-index

help:
	@echo "make setup        create .env (asks for provider and key)"
	@echo "make up           build if needed and start everything"
	@echo "make down         stop everything, keep data"
	@echo "make logs         follow all logs (make logs s=api for one service)"
	@echo "make ps           show service status"
	@echo "make test         run the unit tests of every service (needs Node 20 and Python 3.11)"
	@echo "make reset-index  rebuild the RAG index (after changing EMBEDDER_*)"

setup:
	./scripts/setup.sh

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100 $(s)

ps:
	docker compose ps

test:
	cd apps/api && npm ci && npx tsc --noEmit && npm test && npm run lint
	cd apps/web && npm ci && npx tsc -b && npx vite build
	cd services/agent && npm ci && npm run typecheck && npm test
	cd services/rag && npm ci && npx tsc --noEmit && npm test
	cd services/render && pip install -e ".[dev]" && ruff check app tests && pytest -m "not contract and not security" -q

reset-index:
	docker compose run --rm rag-seed node dist/seed.cjs --reset
