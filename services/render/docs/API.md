# API Reference

All endpoints return JSON. All request bodies are validated strictly — unknown fields are rejected.

Authentication: every non-observability endpoint requires `X-Api-Key: <RENDER_API_KEY>`.
`/health`, `/capabilities`, `/metrics`, `/`, `/docs`, `/openapi.json` are public.

---

## `POST /render`

Submit Manim code; get back a rendered video URL or a structured failure.

### Request

```jsonc
{
  "code": "from manim import *\n\nclass Hello(Scene):\n    def construct(self):\n        self.play(Write(Text('hi')))",
  "sceneClass": "Hello",

  "render": {
    "quality": "low",            // low | medium | high | production | fourk
    "fps": null,                 // 1..120; null = quality default
    "resolution": null,          // [w, h]; null = quality default
    "format": "mp4",             // mp4 | webm | mov | gif | png | svg
    "backend": "cairo",          // cairo | opengl
    "transparent": false,
    "background": null,          // "#1a1a2e"
    "frameRange": null           // [a, b]
  },

  "audio": {                     // optional
    "base64": "<base64 mp3 or wav>",
    "filename": "voice.mp3",
    "offset": 0.0,
    "gain": 0
  },

  "storage": {
    "backend": "local",          // local | cloudinary | s3 | gcs | azure
    "folder": "renders",
    "public": true,
    "generateThumbnail": true,
    "thumbnailAt": 0.5           // 0..1 fraction of duration
  },

  "limits": {                    // all optional; clamped against server caps
    "timeoutSec": 120,
    "memoryMb": 2048,
    "cpuCount": 1.5
  },

  "meta": {                      // optional, echoed back
    "traceId": "req-abc123"
  }
}
```

### Response — success

HTTP 200.

```jsonc
{
  "success": true,
  "render": {
    "url": "https://res.cloudinary.com/.../hello.mp4",
    "thumbnailUrl": "https://.../hello.jpg",
    "format": "mp4",
    "durationSec": 2.5,
    "width": 854, "height": 480, "fps": 15,
    "bytes": 124532,
    "codec": "h264",
    "hasAudio": false
  },
  "execution": {
    "sandboxSetupMs": 40,
    "renderMs": 3812,
    "uploadMs": 287,
    "totalMs": 4181,
    "manimVersion": "Manim Community v0.18.1",
    "sandbox": "bubblewrap"
  },
  "meta": { "traceId": "req-abc123", "serviceVersion": "0.1.0" }
}
```

### Response — failure (HTTP 200, `success: false`)

The user's code was bad. Still a 200 so callers don't conflate "their code broke" with "my service broke".

```jsonc
{
  "success": false,
  "error": {
    "phase": "manim_execution",     // validation | sandbox_setup | manim_execution | upload | timeout | oom | internal
    "category": "NameError",        // SyntaxError | NameError | TypeError | LaTeXError | ...
    "summary": "name 'Writ' is not defined",
    "line": 7,
    "stderr": "<tail of stderr, truncated>",
    "stdout": "",
    "exitCode": 1,
    "killedBy": null
  },
  "echo": { "code": "<echoed, truncated>", "sceneClass": "Hello" },
  "execution": { "totalMs": 900, "sandboxSetupMs": 40, "renderMs": 860, "uploadMs": 0 },
  "meta": { "traceId": "req-abc123", "serviceVersion": "0.1.0" }
}
```

### Saturation — HTTP 503

When all render slots are busy:

```
HTTP/1.1 503 Service Unavailable
Retry-After: 5
Content-Type: application/json

{"error": "service saturated", "active": 4, "max": 4, "retryAfterSec": 5}
```

Treat as a signal to back off, not a user-level error.

### Other status codes

| Code | Meaning |
|------|---------|
| 400  | Malformed JSON |
| 401  | Missing / invalid `X-Api-Key` |
| 422  | Schema violation (wrong type, unknown field, bad `sceneClass` pattern) |
| 500  | Bug in the service — alert, don't retry |
| 503  | Saturation (above) or dependency down (see `/health`) |

---

## `GET /health`

Probe of every dependency the service needs. Returns `status: "ok" | "degraded" | "down"`.

- `"ok"` — all checks pass, HTTP 200.
- `"degraded"` — only advisory checks fail (e.g. no LaTeX), HTTP 200. `MathTex` scenes won't render.
- `"down"` — at least one critical check fails, HTTP 503.

Suitable for Kubernetes liveness AND readiness probes.

---

## `GET /capabilities`

What this particular deployment can actually do. Use before sending unusual work:

```json
{
  "manimVersion": "Manim Community v0.18.1",
  "ffmpegVersion": "ffmpeg version 5.1.6",
  "latexAvailable": true,
  "backends": ["cairo", "opengl"],
  "qualities": ["low", "medium", "high", "production", "fourk"],
  "formats": ["mp4", "webm", "mov", "gif", "png", "svg"],
  "storage": ["local", "cloudinary"],
  "sandbox": "bubblewrap",
  "maxConcurrent": 4,
  "limits": { "maxCodeBytes": 524288, "maxAudioBytes": 10485760, "maxTimeoutSec": 600 }
}
```

`storage` reflects which backends actually have their SDKs installed in this image — not the full list the code supports.

---

## `GET /metrics`

Prometheus exposition. Four series:

- `mrs_renders_total{status, category}` — completed renders
- `mrs_render_seconds{phase}` — per-phase duration histogram
- `mrs_active_renders` — current in-flight count (matches `/health.checks.semaphore.active`)
- `mrs_saturated_rejections_total` — 503s due to full slots

Disabled entirely when `METRICS_ENABLED=false`.

---

## Tracing

Every response includes the request's `x-trace-id` (generated if absent). Pass your own via `X-Trace-Id: <id>` to thread traces through the caller.
