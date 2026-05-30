/**
 * Shared HTML shell for all transactional emails.
 *
 * Email clients are notoriously inconsistent, so everything is inline-styled,
 * table-free where possible, and degrades to a readable plain layout. Each
 * template provides its inner body and (optionally) a single call-to-action
 * button via `renderButton`.
 */

const BRAND = {
  name: "Stitcher",
  // Indigo→violet gradient used in the header band.
  gradientFrom: "#6366f1",
  gradientTo: "#8b5cf6",
  text: "#1f2937",
  muted: "#6b7280",
  bg: "#f3f4f6",
  card: "#ffffff",
};

/** Escape user-supplied strings before interpolating into HTML. */
export function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A primary call-to-action button. `label` and `url` must already be safe. */
export function renderButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
      <tr>
        <td align="center" style="border-radius:10px;background:linear-gradient(135deg,${BRAND.gradientFrom},${BRAND.gradientTo});">
          <a href="${url}" target="_blank"
             style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

interface LayoutOptions {
  /** Inner HTML (already escaped where needed). */
  bodyHtml: string;
  /** Hidden preview line shown in inbox list before opening. */
  preheader?: string;
}

export function renderLayout({ bodyHtml, preheader = "" }: LayoutOptions): string {
  const year = "2026";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${BRAND.name}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${esc(
    preheader
  )}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:520px;background:${BRAND.card};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.gradientFrom},${BRAND.gradientTo});padding:28px 32px;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${BRAND.name}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${BRAND.text};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #eef0f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${BRAND.muted};">
              You're receiving this because of activity on your ${BRAND.name} account.<br/>
              © ${year} ${BRAND.name}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
