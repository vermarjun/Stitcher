// Downloads the local embedding model into MODELS_DIR so the container needs no
// network at runtime. Run at image build: `node prefetch-model.mjs`.
import { pipeline, env } from "@huggingface/transformers";

const model = process.env.EMBEDDER_MODEL || "Xenova/bge-small-en-v1.5";
const dtype = process.env.LOCAL_EMBED_DTYPE || "q8";
if (process.env.MODELS_DIR) env.cacheDir = process.env.MODELS_DIR;

// The download is the only network step in the build, so retry transient failures.
let extract;
for (let attempt = 1; ; attempt++) {
  try {
    extract = await pipeline("feature-extraction", model, { dtype });
    break;
  } catch (err) {
    if (attempt >= 5) throw err;
    console.warn(`download failed (attempt ${attempt}): ${err}; retrying`);
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
}
const out = await extract(["warmup"], { pooling: "cls", normalize: true });
console.log(`cached ${model} (${dtype}) in ${env.cacheDir}, dim ${out.dims[1]}`);
