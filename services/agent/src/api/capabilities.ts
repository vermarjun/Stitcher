import { FastifyInstance } from "fastify";
import { SUPPORTED_PROVIDERS } from "../models/factory.js";
import { config } from "../config.js";

export function registerCapabilities(app: FastifyInstance): void {
  app.get("/capabilities", async (_req, reply) => {
    reply.send({
      supportedProviders: SUPPORTED_PROVIDERS,
      supportedRoles: ["planner", "coder", "debugger", "validator"],
      validationTools: ["ast", "apiSurface", "pyflakes", "ruff", "compile", "manimLint", "sceneClass"],
      plannerTools: config.enableWebSearch
        ? ["webSearch", "manimApiCheck"]
        : ["manimApiCheck"],
      codegenTools: ["manimApiCheck", "astPreview"],
      debuggerTools: ["manimApiCheck", "astPreview", "diff"],
      webSearchEnabled: config.enableWebSearch,
      webSearchProvider: config.enableWebSearch ? config.webSearchProvider : null,
      maxScenes: 8,
      maxParallelScenes: config.maxParallelScenes,
      manimTargetVersion: "0.19.x",
      defaultTimeoutSec: config.defaultTimeoutSec,
      version: "0.1.0",
    });
  });
}
