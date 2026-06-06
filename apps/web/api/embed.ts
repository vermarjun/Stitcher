// Serverless function behind /embed/:shareId (see vercel.json rewrite).
//
// A minimal, dependency-free HTML5 video player meant to be loaded inside an <iframe>
// — it's what twitter:player points at so the video plays inline on X, and it can be
// embedded on any blog/site. Intentionally NOT the React app: iframes should be light.

import { fetchShare, escapeHtml, escapeAttr, posterFor } from "./_shared.js";

export default async function handler(req: any, res: any) {
  const shareId = String(req.query?.shareId || "");
  const data = await fetchShare(shareId);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  // Allow this player to be framed anywhere (X, Discord, embeds). Do NOT send
  // X-Frame-Options; an explicit permissive CSP keeps the intent clear.
  res.setHeader("Content-Security-Policy", "frame-ancestors *");

  if (!data?.videoUrl) {
    res
      .status(404)
      .send(
        '<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#888;font-family:system-ui,sans-serif">Video unavailable</body>'
      );
    return;
  }

  const src = escapeAttr(data.videoUrl);
  const poster = posterFor(data);
  const posterAttr = poster ? ` poster="${escapeAttr(poster)}"` : "";
  const title = escapeHtml(data.projectName?.trim() || "Stitcher video");

  // autoplay must be muted to satisfy browser autoplay policies inside iframes.
  res.status(200).send(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>html,body{margin:0;height:100%;background:#000}video{display:block;width:100%;height:100%;object-fit:contain;background:#000}</style>
</head>
<body>
<video src="${src}"${posterAttr} controls autoplay muted playsinline></video>
</body>
</html>`
  );
}
