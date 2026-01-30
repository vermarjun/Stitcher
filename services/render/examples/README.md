# Examples

Minimal request bodies and scripts to exercise a running service.

Run the service first:

```bash
cp .env.example .env   # set RENDER_API_KEY
docker compose up --build
```

Then:

```bash
./examples/render.sh hello.json
./examples/render.sh equation.json
```

Every JSON here is ready to POST to `/render` as-is.
