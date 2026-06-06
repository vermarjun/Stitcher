import { renderLayout, renderButton, esc } from "./layout";
import type { EmailMessage } from "../types";

type RenderedEmail = Omit<EmailMessage, "to">;

export function welcomeTemplate(params: { username: string; appUrl: string }): RenderedEmail {
  const { username, appUrl } = params;
  const name = esc(username);
  const url = esc(appUrl);

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:18px;font-weight:700;">you're in, ${name}</p>
    <p style="margin:0 0 12px;color:#374151;">Stitcher turns a prompt into an actual animated video. You describe the scene, it writes the code and renders it, and you tweak the rest on the timeline.</p>
    <p style="margin:0 0 4px;color:#374151;">Easiest way to get it is to just make something. Open a project and generate your first clip. Way more fun than reading this email anyway.</p>
    ${renderButton("Make something", url)}
    <p style="margin:0;color:#6b7280;font-size:13px;">If something breaks or you get stuck, just reply here. A real person reads these.</p>`;

  const text = [
    `you're in, ${username}.`,
    ``,
    `Stitcher turns a prompt into an actual animated video. You describe the scene, it writes the code and renders it, and you tweak the rest on the timeline.`,
    ``,
    `Easiest way to get it is to just make something: ${appUrl}`,
    ``,
    `If something breaks or you get stuck, just reply here. A real person reads these.`,
  ].join("\n");

  return {
    subject: "you're in",
    html: renderLayout({ bodyHtml, preheader: "Make your first video whenever you're ready." }),
    text,
  };
}

export function signupOtpTemplate(params: { username: string; code: string }): RenderedEmail {
  const name = esc(params.username);
  const code = esc(params.code);

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:18px;font-weight:700;">Confirm your email</p>
    <p style="margin:0 0 16px;color:#374151;">Hey ${name}, enter this code on the signup screen to confirm your email and finish creating your account.</p>
    <p style="margin:0 0 16px;font-size:30px;font-weight:800;letter-spacing:8px;color:#111827;">${code}</p>
    <p style="margin:0;color:#6b7280;font-size:13px;">It expires in 10 minutes. If you didn't try to sign up, just ignore this.</p>`;

  const text = [
    `Your Stitcher code is ${params.code}.`,
    ``,
    `Enter it on the signup screen to confirm your email. It expires in 10 minutes.`,
    `If you didn't try to sign up, ignore this.`,
  ].join("\n");

  return {
    subject: `${params.code} is your Stitcher code`,
    html: renderLayout({ bodyHtml, preheader: "Your Stitcher verification code." }),
    text,
  };
}

export function verifyEmailTemplate(params: { username: string; verifyUrl: string }): RenderedEmail {
  const { username, verifyUrl } = params;
  const name = esc(username);
  const url = esc(verifyUrl);

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:18px;font-weight:700;">Confirm your email</p>
    <p style="margin:0 0 12px;color:#374151;">Hi ${name}, please confirm this is your email address to finish setting up your Stitcher account.</p>
    ${renderButton("Verify email", url)}
    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">This link expires in 24 hours. If you didn't create a Stitcher account, you can safely ignore this email.</p>
    <p style="margin:0;color:#9ca3af;font-size:12px;word-break:break-all;">Or copy this link: ${url}</p>`;

  const text = [
    `Hi ${username},`,
    ``,
    `Confirm your email to finish setting up your Stitcher account:`,
    verifyUrl,
    ``,
    `This link expires in 24 hours. If you didn't sign up, ignore this email.`,
  ].join("\n");

  return {
    subject: "Verify your Stitcher email",
    html: renderLayout({ bodyHtml, preheader: "Confirm your email to finish setting up Stitcher." }),
    text,
  };
}

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

  const ctaLabel = hasAccount ? "View invitation" : "Sign up and join";
  const accountLine = hasAccount
    ? `Sign in to accept the invitation.`
    : `Sign up with this email address to accept the invitation.`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:18px;font-weight:700;">You've been invited to collaborate</p>
    <p style="margin:0 0 12px;color:#374151;"><strong>${inviter}</strong> invited you to <strong>${roleLabel}</strong> the project <strong>"${project}"</strong> on Stitcher.</p>
    <p style="margin:0 0 4px;color:#374151;">${accountLine}</p>
    ${renderButton(ctaLabel, url)}
    <p style="margin:0;color:#6b7280;font-size:13px;">If you weren't expecting this, you can ignore this email. Nothing will be shared until you accept.</p>`;

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

export function passwordResetTemplate(params: { resetUrl: string }): RenderedEmail {
  const url = esc(params.resetUrl);

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:18px;font-weight:700;">Reset your password</p>
    <p style="margin:0 0 12px;color:#374151;">We received a request to reset your Stitcher password. Click below to choose a new one.</p>
    ${renderButton("Reset password", url)}
    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">This link expires in 30 minutes. If you didn't request a reset, you can safely ignore this email — your password won't change.</p>
    <p style="margin:0;color:#9ca3af;font-size:12px;word-break:break-all;">Or copy this link: ${url}</p>`;

  const text = [
    `We received a request to reset your Stitcher password.`,
    ``,
    `Reset it here (expires in 30 minutes):`,
    params.resetUrl,
    ``,
    `If you didn't request this, ignore this email.`,
  ].join("\n");

  return {
    subject: "Reset your Stitcher password",
    html: renderLayout({ bodyHtml, preheader: "Reset your Stitcher password." }),
    text,
  };
}
