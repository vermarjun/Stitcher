// Serverless function behind /v/:shareId (see vercel.json rewrite).
//
// Why this exists: link-preview crawlers (Slack, Discord, X/Twitter, WhatsApp,
// iMessage, Facebook, LinkedIn) fetch the raw HTML and read <head> meta tags — they
// do NOT run JavaScript. The Vite SPA serves an empty <head> for every route, so a
// shared /v/:id link would have no preview. This function fetches the built SPA shell,
// injects per-video Open Graph + Twitter Card tags into <head>, and returns it. Real
// browsers still boot React from the same HTML and render the normal Watch page — one
// response works for both bots and humans, no user-agent sniffing.

import { fetchShare, escapeHtml, escapeAttr, posterFor } from "./_shared.js";

// Nominal player dimensions (videos render 16:9). Used for og:video / twitter:player.
const VIDEO_W = 1280;
const VIDEO_H = 720;

export default async function handler(req: any, res: any) {
  const shareId = String(req.query?.shareId || "");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const proto = String(req.headers["x-forwarded-proto"] || "https");
  const base = host ? `${proto}://${host}` : "";

  // 1) Pull the built SPA shell. /index.html is a real static file, so Vercel serves
  //    it directly without routing back through this function (no loop).
  let html = "";
  try {
    const shell = await fetch(`${base}/index.html`);
    html = await shell.text();
  } catch {
    html =
      '<!doctype html><html lang="en"><head><title>Stitcher</title></head><body><div id="root"></div></body></html>';
  }

  // 2) Resolve the share metadata (best-effort — a miss just yields generic branding).
  const data = await fetchShare(shareId);

  // 3) Build the per-video <head> tags.
  const title = data?.projectName?.trim() || "Stitcher video";
  const desc = data
    ? "Watch this animation, made with Stitcher."
    : "Create animated explainer videos from a single prompt with Stitcher.";
  const pageUrl = base ? `${base}/v/${encodeURIComponent(shareId)}` : "";
  const embedUrl = base ? `${base}/embed/${encodeURIComponent(shareId)}` : "";
  const poster = data ? posterFor(data) : "";

  const tags: string[] = [
    `<meta property="og:site_name" content="Stitcher" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(desc)}" />`,
  ];
  if (pageUrl) tags.push(`<meta property="og:url" content="${escapeAttr(pageUrl)}" />`);

  if (data) {
    tags.push(`<meta property="og:type" content="video.other" />`);
    if (poster) {
      tags.push(
        `<meta property="og:image" content="${escapeAttr(poster)}" />`,
        `<meta property="og:image:width" content="640" />`,
        `<meta property="og:image:height" content="360" />`
      );
    }
    // Inline-playable mp4 — Discord, Slack, Facebook and iMessage play this directly.
    tags.push(
      `<meta property="og:video" content="${escapeAttr(data.videoUrl)}" />`,
      `<meta property="og:video:secure_url" content="${escapeAttr(data.videoUrl)}" />`,
      `<meta property="og:video:type" content="video/mp4" />`,
      `<meta property="og:video:width" content="${VIDEO_W}" />`,
      `<meta property="og:video:height" content="${VIDEO_H}" />`
    );
    // X/Twitter player card — plays inline on X via the embed iframe + direct stream.
    tags.push(
      `<meta name="twitter:card" content="player" />`,
      `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(desc)}" />`,
      `<meta name="twitter:player" content="${escapeAttr(embedUrl)}" />`,
      `<meta name="twitter:player:width" content="${VIDEO_W}" />`,
      `<meta name="twitter:player:height" content="${VIDEO_H}" />`,
      `<meta name="twitter:player:stream" content="${escapeAttr(data.videoUrl)}" />`,
      `<meta name="twitter:player:stream:content_type" content="video/mp4" />`
    );
    if (poster) tags.push(`<meta name="twitter:image" content="${escapeAttr(poster)}" />`);
  } else {
    // No data (bad/expired id): a plain large-image summary card.
    tags.push(
      `<meta property="og:type" content="website" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(desc)}" />`
    );
  }

  // 4) Strip any default og:/twitter: tags from the shell (so we never emit duplicates),
  //    set a per-video <title>, then inject our tags just before </head>.
  html = html
    .replace(/\s*<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)} · Stitcher</title>`)
    .replace("</head>", `  ${tags.join("\n  ")}\n  </head>`);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cache at Vercel's edge so repeat crawler hits are cheap; serve stale while revalidating.
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).send(html);
}
