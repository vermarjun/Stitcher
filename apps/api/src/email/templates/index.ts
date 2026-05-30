/**
 * Transactional email templates. Each returns a { subject, html, text } triple
 * built from the shared layout. Callers pass already-validated data; templates
 * escape anything user-supplied before interpolation.
 */

import { renderLayout, renderButton, esc } from "./layout";
import type { EmailMessage } from "../types";

type RenderedEmail = Omit<EmailMessage, "to">;

// ─── Welcome ───────────────────────────────────────────────────────────────
export function welcomeTemplate(params: { username: string; appUrl: string }): RenderedEmail {
  const { username, appUrl } = params;
  const name = esc(username);
  const url = esc(appUrl);

  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">Welcome to Stitcher, ${name} 👋</h1>
    <p style="margin:0 0 12px;">You're all set. Stitcher turns a prompt into animated, code-driven videos — describe a scene and let it generate, then refine on the timeline.</p>
    <p style="margin:0 0 4px;">A good first step: open a new project and try generating your first clip.</p>
    ${renderButton("Open Stitcher", url)}
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">Glad to have you here. Reply to this email if you get stuck — a real person reads it.</p>`;

  const text = [
    `Welcome to Stitcher, ${username}!`,
    ``,
    `You're all set. Stitcher turns a prompt into animated, code-driven videos.`,
    `Get started: ${appUrl}`,
  ].join("\n");

  return { subject: "Welcome to Stitcher 🎬", html: renderLayout({ bodyHtml, preheader: "You're all set — let's make your first video." }), text };
}

// ─── Email verification ──────────────────────────────────────────────────────
export function verifyEmailTemplate(params: { username: string; verifyUrl: string }): RenderedEmail {
  const { username, verifyUrl } = params;
  const name = esc(username);
  const url = esc(verifyUrl);

  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">Confirm your email</h1>
    <p style="margin:0 0 12px;">Hi ${name}, please confirm this is your email address to finish setting up your Stitcher account.</p>
    ${renderButton("Verify email", url)}
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">This link expires in 24 hours. If you didn't create a Stitcher account, you can safely ignore this email.</p>
    <p style="margin:12px 0 0;color:#6b7280;font-size:12px;word-break:break-all;">Or paste this link into your browser:<br/>${url}</p>`;

  const text = [
    `Hi ${username},`,
    ``,
    `Confirm your email to finish setting up your Stitcher account:`,
    verifyUrl,
    ``,
    `This link expires in 24 hours. If you didn't sign up, ignore this email.`,
  ].join("\n");

  return { subject: "Verify your Stitcher email", html: renderLayout({ bodyHtml, preheader: "Confirm your email to finish setting up Stitcher." }), text };
}

// ─── Collaboration invite ────────────────────────────────────────────────────
export function collabInviteTemplate(params: {
  inviterName: string;
  projectName: string;
  role: "editor" | "viewer";
  acceptUrl: string;
  hasAccount: boolean;
}): RenderedEmail {
  const { inviterName, projectName, role, acceptUrl, hasAccount } = params;
  const inviter = esc(inviterName);
  const project = esc(projectName);
  const roleLabel = role === "editor" ? "edit" : "view";
  const url = esc(acceptUrl);

  const ctaLabel = hasAccount ? "View invitation" : "Sign up & join";
  const accountLine = hasAccount
    ? `Sign in to accept the invitation.`
    : `Sign up with this email address to accept the invitation.`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">You've been invited to collaborate</h1>
    <p style="margin:0 0 12px;"><strong>${inviter}</strong> invited you to <strong>${roleLabel}</strong> the project <strong>"${project}"</strong> on Stitcher.</p>
    <p style="margin:0 0 4px;">${accountLine}</p>
    ${renderButton(ctaLabel, url)}
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">If you weren't expecting this, you can ignore this email — nothing will be shared until you accept.</p>`;

  const text = [
    `${inviterName} invited you to ${roleLabel} the project "${projectName}" on Stitcher.`,
    ``,
    accountLine,
    url,
  ].join("\n");

  return {
    subject: `${inviterName} invited you to "${projectName}" on Stitcher`,
    html: renderLayout({ bodyHtml, preheader: `${inviterName} wants to collaborate with you on Stitcher.` }),
    text,
  };
}

// ─── Password reset ──────────────────────────────────────────────────────────
export function passwordResetTemplate(params: { resetUrl: string }): RenderedEmail {
  const url = esc(params.resetUrl);

  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">Reset your password</h1>
    <p style="margin:0 0 12px;">We received a request to reset your Stitcher password. Click below to choose a new one.</p>
    ${renderButton("Reset password", url)}
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">This link expires in 30 minutes. If you didn't request a reset, you can safely ignore this email — your password won't change.</p>
    <p style="margin:12px 0 0;color:#6b7280;font-size:12px;word-break:break-all;">Or paste this link into your browser:<br/>${url}</p>`;

  const text = [
    `We received a request to reset your Stitcher password.`,
    ``,
    `Reset it here (expires in 30 minutes):`,
    params.resetUrl,
    ``,
    `If you didn't request this, ignore this email.`,
  ].join("\n");

  return { subject: "Reset your Stitcher password", html: renderLayout({ bodyHtml, preheader: "Reset your Stitcher password." }), text };
}
