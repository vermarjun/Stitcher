/**
 * Shared HTML shell for all transactional emails.
 * Plain white card, inline styles, no gradients.
 */

export function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:6px;background:#111827;">
          <a href="${url}" target="_blank"
             style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

interface LayoutOptions {
  bodyHtml: string;
  preheader?: string;
}

export function renderLayout({ bodyHtml, preheader = "" }: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>Stitcher</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${esc(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:520px;">
          <tr>
            <td style="padding:0 0 20px 0;">
              <span style="font-size:18px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Stitcher</span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;padding:36px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#9ca3af;">
              You're receiving this because of activity on your Stitcher account.
              &copy; 2026 Stitcher.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
