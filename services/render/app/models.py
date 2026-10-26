"""Request and response schemas.

Every field is typed and validated by pydantic. Unknown fields in requests are rejected —
callers shouldn't be silently ignoring typos that were meant to change behavior.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Quality = Literal["low", "medium", "high", "production", "fourk"]
VideoFormat = Literal["mp4", "webm", "mov", "gif", "png", "svg"]
RenderBackend = Literal["cairo", "opengl"]
StorageBackend = Literal["local", "cloudinary", "s3", "gcs", "azure"]
SandboxTool = Literal["bubblewrap", "disabled"]
FailurePhase = Literal[
    "validation",
    "sandbox_setup",
    "manim_execution",
    "upload",
    "timeout",
    "oom",
    "internal",
]


# ---------- request sub-models ----------


class RenderSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quality: Quality = "low"
    fps: int | None = Field(default=None, ge=1, le=120)
    resolution: tuple[int, int] | None = None
    format: VideoFormat = "mp4"
    backend: RenderBackend = "cairo"
    transparent: bool = False
    background: str | None = Field(default=None, description="CSS-style color like '#1a1a2e'")
    frame_range: tuple[int, int] | None = Field(default=None, alias="frameRange")


class AudioSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    base64: str
    filename: str = "audio.mp3"
    offset: float = 0.0
    gain: int = 0


class VoiceoverEntry(BaseModel):
    """One pre-generated narration clip. `key` is sha256(normalize_text(beat)) hex;
    `base64` is the raw mp3 bytes base64-encoded. Staged to
    `<workdir>/media/voiceovers/<key>.mp3` before manim runs."""

    model_config = ConfigDict(extra="forbid")

    key: str = Field(..., pattern=r"^[0-9a-f]{64}$", description="sha256 hex of normalized beat")
    base64: str = Field(..., min_length=1)


class VoiceoverSpec(BaseModel):
    """Native voiceover bundle. Separate from the top-level `audio` post-mux field —
    these clips are baked into the video by manim via add_sound, not muxed after."""

    model_config = ConfigDict(extra="forbid")

    audio: list[VoiceoverEntry] = Field(default_factory=list)


class StorageSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    backend: StorageBackend = "local"
    folder: str = "renders"
    public: bool = True
    generate_thumbnail: bool = Field(default=True, alias="generateThumbnail")
    thumbnail_at: float = Field(default=0.5, ge=0.0, alias="thumbnailAt")


class LimitSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timeout_sec: int | None = Field(default=None, ge=1, le=600, alias="timeoutSec")
    memory_mb: int | None = Field(default=None, ge=128, le=16384, alias="memoryMb")
    cpu_count: float | None = Field(default=None, ge=0.25, le=16, alias="cpuCount")


class MetaSpec(BaseModel):
    model_config = ConfigDict(extra="allow")

    trace_id: str | None = Field(default=None, alias="traceId")


# ---------- request ----------


class RenderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    code: str = Field(..., min_length=1)
    scene_class: str = Field(..., alias="sceneClass", pattern=r"^[A-Za-z_][A-Za-z0-9_]*$")
    render: RenderSpec = Field(default_factory=RenderSpec)
    audio: AudioSpec | None = None
    voiceover: VoiceoverSpec | None = None
    storage: StorageSpec = Field(default_factory=StorageSpec)
    limits: LimitSpec = Field(default_factory=LimitSpec)
    meta: MetaSpec = Field(default_factory=MetaSpec)


# ---------- success response ----------


class RenderOutput(BaseModel):
    url: str
    thumbnail_url: str | None = Field(default=None, alias="thumbnailUrl")
    format: VideoFormat
    duration_sec: float = Field(alias="durationSec")
    width: int
    height: int
    fps: int
    bytes: int
    codec: str | None = None
    has_audio: bool = Field(default=False, alias="hasAudio")

    model_config = ConfigDict(populate_by_name=True)


class ExecutionInfo(BaseModel):
    sandbox_setup_ms: int = Field(default=0, alias="sandboxSetupMs")
    render_ms: int = Field(default=0, alias="renderMs")
    upload_ms: int = Field(default=0, alias="uploadMs")
    total_ms: int = Field(default=0, alias="totalMs")
    manim_version: str | None = Field(default=None, alias="manimVersion")
    sandbox: SandboxTool = "bubblewrap"

    model_config = ConfigDict(populate_by_name=True)


class RenderSuccessResponse(BaseModel):
    success: Literal[True] = True
    render: RenderOutput
    execution: ExecutionInfo
    meta: dict[str, Any] = Field(default_factory=dict)


# ---------- failure response ----------


class ErrorInfo(BaseModel):
    phase: FailurePhase
    category: str = "Unknown"
    summary: str
    stderr: str = ""
    stdout: str = ""
    traceback: str | None = None
    line: int | None = None
    exit_code: int | None = Field(default=None, alias="exitCode")
    killed_by: str | None = Field(default=None, alias="killedBy")

    model_config = ConfigDict(populate_by_name=True)


class EchoedInput(BaseModel):
    code: str
    scene_class: str = Field(alias="sceneClass")

    model_config = ConfigDict(populate_by_name=True)


class RenderFailureResponse(BaseModel):
    success: Literal[False] = False
    error: ErrorInfo
    echo: EchoedInput
    execution: ExecutionInfo
    meta: dict[str, Any] = Field(default_factory=dict)


# ---------- health + capabilities ----------


class CheckResult(BaseModel):
    ok: bool
    version: str | None = None
    latency_ms: int | None = Field(default=None, alias="latencyMs")
    free_mb: int | None = Field(default=None, alias="freeMb")
    tool: str | None = None
    backend: str | None = None
    active: int | None = None
    max: int | None = None
    detail: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "down"]
    checks: dict[str, CheckResult]


class Limits(BaseModel):
    max_code_bytes: int = Field(alias="maxCodeBytes")
    max_audio_bytes: int = Field(alias="maxAudioBytes")
    max_timeout_sec: int = Field(alias="maxTimeoutSec")

    model_config = ConfigDict(populate_by_name=True)


class CapabilitiesResponse(BaseModel):
    manim_version: str | None = Field(default=None, alias="manimVersion")
    ffmpeg_version: str | None = Field(default=None, alias="ffmpegVersion")
    latex_available: bool = Field(default=False, alias="latexAvailable")
    backends: list[RenderBackend]
    qualities: list[Quality]
    formats: list[VideoFormat]
    storage: list[StorageBackend]
    sandbox: SandboxTool
    max_concurrent: int = Field(alias="maxConcurrent")
    limits: Limits

    model_config = ConfigDict(populate_by_name=True)
