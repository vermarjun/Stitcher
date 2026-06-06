import React, { useState } from 'react';
import { Eye, EyeOff, Activity, Mic, Film, Key } from 'lucide-react';
import type { SignupStep } from '@/Pages/Auth.page';

// --- HELPER COMPONENTS (ICONS) ---

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
    </svg>
);

// --- TYPE DEFINITIONS ---

export interface AuthFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface SignInPageProps {
  /** Controlled auth mode. */
  mode: 'login' | 'signup';
  onModeChange: (mode: 'login' | 'signup') => void;
  formData: AuthFormData;
  onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Fired on form submit (login or signup). The parent owns the API call. */
  onSubmit: () => void;
  onGoogleSignIn: () => void;
  onResetPassword?: () => void;
  /** Disables the form and shows a spinner on the primary button. */
  isLoading?: boolean;
  /** Replaces the entire form with a "banned" notice. */
  isBanned?: boolean;
  /** "google" | "password" — drives the "Last used" hint badge. */
  lastMethod?: string | null;

  // --- OTP signup flow ---
  signupStep?: SignupStep;
  /** Called when user confirms their email — triggers /signup/start */
  onConfirmEmail?: () => void;
  /** Return to the form step to edit details */
  onBackToForm?: () => void;
  /** Controlled OTP code value */
  otpCode?: string;
  /** Called on every OTP input change */
  onOtpChange?: (code: string) => void;
  /** Called when user presses Verify — triggers /signup/verify */
  onVerifyOtp?: () => void;
  /** Called when user presses Resend — triggers /signup/resend */
  onResendOtp?: () => void;
  /** Whether the resend request is in-flight */
  isResending?: boolean;
}

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-blue-400/70 focus-within:bg-blue-500/10">
    {children}
  </div>
);

const LastUsedPill = ({ label = 'Last used' }: { label?: string }) => (
  <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-300 shadow-sm shadow-black/30">
    {label}
  </span>
);

// --- AUTH HERO PANEL ---

const FEATURES = [
  {
    icon: Activity,
    title: 'Watch it build, live',
    desc: 'Real per-phase progress — find examples → write code → add voiceover → render → auto-fix.',
  },
  {
    icon: Film,
    title: 'You always get a video',
    desc: 'Up to 3× auto-debug loop: if rendering fails, the AI reads the error and rewrites the code.',
  },
  {
    icon: Mic,
    title: 'Narrated automatically',
    desc: 'Every video ships with a synced voiceover that stays in sync through edits.',
  },
  {
    icon: Key,
    title: 'Bring your own key',
    desc: 'Add your OpenAI or Anthropic key and generate free — no credits charged on BYOK runs.',
  },
] as const;

const AuthHeroPanel: React.FC = () => (
  <div
    className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-cover bg-center"
    style={{ backgroundImage: "url('/hue-flow-01.png')" }}
  >
    {/* Dot-grid overlay — magicui style */}
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          'radial-gradient(circle, rgba(0,0,0,0.22) 1.5px, transparent 1.5px)',
        backgroundSize: '22px 22px',
      }}
    />
    {/* Subtle dark vignette so text stays legible */}
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/40" />

    {/* Content */}
    <div className="relative flex h-full flex-col justify-between p-10">
      {/* Headline block */}
      <div className="max-w-xs">
        <p className="mb-7 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-white/60">
          Stitcher
        </p>
        <h2 className="text-[2.25rem] font-bold leading-[1.15] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
          Turn any concept into an&nbsp;animated video.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-white/75">
          AI writes Manim code, adds a synced voiceover, renders it, and auto-fixes errors — from
          prompt to video in under&nbsp;3&nbsp;minutes.
        </p>
      </div>

      {/* Feature rows */}
      <div className="flex flex-col gap-[1.1rem]">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/30 ring-1 ring-white/20 backdrop-blur-sm">
              <Icon className="h-[1.05rem] w-[1.05rem] text-white/90" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/65">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// --- OTP INPUT: individual digit boxes ---

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, disabled }) => {
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number
  ) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      const inputs = (e.currentTarget.parentElement?.parentElement as HTMLElement)
        ?.querySelectorAll<HTMLInputElement>('input');
      inputs?.[idx - 1]?.focus();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      // Deletion
      const next = digits.slice();
      next[idx] = '';
      onChange(next.join(''));
      return;
    }
    // Accept paste of up to 6 digits
    if (raw.length > 1) {
      onChange(raw.slice(0, 6));
      // Focus last filled or the 6th box
      const inputs = (e.currentTarget.parentElement?.parentElement as HTMLElement)
        ?.querySelectorAll<HTMLInputElement>('input');
      const focusIdx = Math.min(raw.length, 5);
      inputs?.[focusIdx]?.focus();
      return;
    }
    const next = digits.slice();
    next[idx] = raw;
    onChange(next.join(''));
    // Auto-advance
    if (idx < 5) {
      const inputs = (e.currentTarget.parentElement?.parentElement as HTMLElement)
        ?.querySelectorAll<HTMLInputElement>('input');
      inputs?.[idx + 1]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-blue-400/70 focus-within:bg-blue-500/10"
        >
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={d}
            disabled={disabled}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className="h-12 w-10 rounded-2xl bg-transparent text-center text-lg font-semibold focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-12"
          />
        </div>
      ))}
    </div>
  );
};

// --- CONFIRM EMAIL STEP ---

interface ConfirmEmailStepProps {
  email: string;
  isLoading: boolean;
  onConfirm: () => void;
  onGoBack: () => void;
  onGoogleSignIn: () => void;
}

const ConfirmEmailStep: React.FC<ConfirmEmailStepProps> = ({
  email,
  isLoading,
  onConfirm,
  onGoBack,
  onGoogleSignIn,
}) => (
  <div className="flex flex-col gap-6">
    <div>
      <h1 className="animate-element animate-delay-100 text-4xl font-semibold leading-tight tracking-tighter md:text-5xl">
        Confirm your email
      </h1>
      <p className="animate-element animate-delay-200 mt-3 text-muted-foreground">
        We'll send a verification code to this address.
      </p>
    </div>

    {/* Email display */}
    <div className="animate-element animate-delay-300 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-widest text-blue-400/80">
        Sending code to
      </p>
      <p className="mt-1 break-all text-lg font-semibold text-foreground">
        {email}
      </p>
    </div>

    {/* Google shortcut */}
    <p className="animate-element animate-delay-300 text-center text-sm text-muted-foreground">
      or{' '}
      <button
        type="button"
        onClick={onGoogleSignIn}
        className="text-blue-400 transition-colors hover:underline"
      >
        continue with Google
      </button>{' '}
      to skip this
    </p>

    {/* Actions */}
    <div className="animate-element animate-delay-400 flex flex-col gap-3">
      <button
        type="button"
        onClick={onConfirm}
        disabled={isLoading}
        className="flex w-full items-center justify-center rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary-foreground" />
        ) : (
          'Confirm & Send Code'
        )}
      </button>
      <button
        type="button"
        onClick={onGoBack}
        disabled={isLoading}
        className="flex w-full items-center justify-center rounded-2xl border border-border py-4 font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
      >
        Go back and edit
      </button>
    </div>
  </div>
);

// --- OTP VERIFY STEP ---

interface OtpStepProps {
  email: string;
  otpCode: string;
  onOtpChange: (code: string) => void;
  isLoading: boolean;
  isResending: boolean;
  onVerify: () => void;
  onResend: () => void;
  onGoBack: () => void;
}

const OtpStep: React.FC<OtpStepProps> = ({
  email,
  otpCode,
  onOtpChange,
  isLoading,
  isResending,
  onVerify,
  onResend,
  onGoBack,
}) => (
  <div className="flex flex-col gap-6">
    <div>
      <h1 className="animate-element animate-delay-100 text-4xl font-semibold leading-tight tracking-tighter md:text-5xl">
        Check your email
      </h1>
      <p className="animate-element animate-delay-200 mt-3 text-sm text-muted-foreground">
        Enter the 6-digit code we sent to{' '}
        <span className="font-medium text-foreground">{email}</span>
      </p>
    </div>

    {/* OTP boxes */}
    <div className="animate-element animate-delay-300">
      <OtpInput value={otpCode} onChange={onOtpChange} disabled={isLoading} />
    </div>

    {/* Verify button */}
    <div className="animate-element animate-delay-400 flex flex-col gap-3">
      <button
        type="button"
        onClick={onVerify}
        disabled={isLoading || otpCode.length !== 6}
        className="flex w-full items-center justify-center rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary-foreground" />
        ) : (
          'Verify'
        )}
      </button>

      {/* Secondary actions */}
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onGoBack}
          disabled={isLoading || isResending}
          className="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Go back
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={isLoading || isResending}
          className="text-blue-400 transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isResending ? 'Sending…' : 'Resend code'}
        </button>
      </div>
    </div>
  </div>
);

// --- MAIN COMPONENT ---

export const SignInPage: React.FC<SignInPageProps> = ({
  mode,
  onModeChange,
  formData,
  onInputChange,
  onSubmit,
  onGoogleSignIn,
  onResetPassword,
  isLoading = false,
  isBanned = false,
  lastMethod = null,
  signupStep = 'form',
  onConfirmEmail,
  onBackToForm,
  otpCode = '',
  onOtpChange,
  onVerifyOtp,
  onResendOtp,
  isResending = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isLogin = mode === 'login';

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;
    onSubmit();
  };

  // Decide which content to render inside the left panel
  const renderContent = () => {
    if (isBanned) {
      return (
        <div className="animate-element flex flex-col items-center justify-center gap-4 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <h2 className="mb-1 text-xl font-semibold text-foreground">You've been banned</h2>
            <p className="text-sm font-light text-muted-foreground">
              Your account has been suspended. If you believe this is a mistake, please contact support.
            </p>
          </div>
        </div>
      );
    }

    // OTP flow steps (signup only)
    if (!isLogin && signupStep === 'confirm') {
      return (
        <ConfirmEmailStep
          email={formData.email}
          isLoading={isLoading}
          onConfirm={onConfirmEmail ?? (() => {})}
          onGoBack={onBackToForm ?? (() => {})}
          onGoogleSignIn={onGoogleSignIn}
        />
      );
    }

    if (!isLogin && signupStep === 'otp') {
      return (
        <OtpStep
          email={formData.email}
          otpCode={otpCode}
          onOtpChange={onOtpChange ?? (() => {})}
          isLoading={isLoading}
          isResending={isResending}
          onVerify={onVerifyOtp ?? (() => {})}
          onResend={onResendOtp ?? (() => {})}
          onGoBack={onBackToForm ?? (() => {})}
        />
      );
    }

    // Default: login form or signup form (step "form")
    return (
      <div className="flex flex-col gap-6">
        <h1 className="animate-element animate-delay-100 text-4xl font-semibold leading-tight tracking-tighter md:text-5xl">
          {isLogin ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="animate-element animate-delay-200 text-muted-foreground">
          {isLogin
            ? 'Sign in to continue to your account'
            : 'Get started with your free Stitcher account'}
        </p>

        {/* Google — primary path, carries the "Last used" hint */}
        <div className="animate-element animate-delay-300 relative">
          {lastMethod === 'google' && (
            <span className="absolute -top-3 left-3 z-10">
              <LastUsedPill />
            </span>
          )}
          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border py-4 transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <div className="animate-element animate-delay-400 relative flex items-center justify-center">
          <span className="w-full border-t border-border"></span>
          <span className="absolute bg-background px-4 text-sm text-muted-foreground">Or continue with email</span>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Name — sign-up only */}
          <div
            className={`overflow-hidden transition-all duration-400 ease-in-out ${
              isLogin ? 'max-h-0 -translate-y-2 opacity-0' : 'max-h-24 translate-y-0 opacity-100'
            }`}
          >
            <label className="text-sm font-medium text-muted-foreground">Full name</label>
            <GlassInputWrapper>
              <input
                name="name"
                type="text"
                value={formData.name}
                onChange={onInputChange}
                placeholder="Enter your name"
                className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
              />
            </GlassInputWrapper>
          </div>

          <div className="animate-element animate-delay-500">
            <label className="text-sm font-medium text-muted-foreground">Email address</label>
            <GlassInputWrapper>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={onInputChange}
                placeholder="Enter your email address"
                required
                className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
              />
            </GlassInputWrapper>
          </div>

          <div className="animate-element animate-delay-600">
            <label className="text-sm font-medium text-muted-foreground">Password</label>
            <GlassInputWrapper>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={onInputChange}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-2xl bg-transparent p-4 pr-12 text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
                  )}
                </button>
              </div>
            </GlassInputWrapper>
          </div>

          {/* Confirm password — sign-up only */}
          <div
            className={`overflow-hidden transition-all duration-400 ease-in-out ${
              isLogin ? 'max-h-0 -translate-y-2 opacity-0' : 'max-h-24 translate-y-0 opacity-100'
            }`}
          >
            <label className="text-sm font-medium text-muted-foreground">Confirm password</label>
            <GlassInputWrapper>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={onInputChange}
                  placeholder="Re-enter your password"
                  className="w-full rounded-2xl bg-transparent p-4 pr-12 text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
                  )}
                </button>
              </div>
            </GlassInputWrapper>
          </div>

          {/* Remember me / reset — sign-in only */}
          <div
            className={`overflow-hidden transition-all duration-400 ease-in-out ${
              isLogin ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  name="rememberMe"
                  className="h-4 w-4 rounded border-border bg-foreground/5 text-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-foreground/90">Keep me signed in</span>
              </label>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onResetPassword?.();
                }}
                className="text-blue-400 transition-colors hover:underline"
              >
                Reset password
              </a>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="animate-element animate-delay-700 flex w-full items-center justify-center rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary-foreground" />
            ) : isLogin ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p className="animate-element animate-delay-800 text-center text-sm text-muted-foreground">
          {isLogin ? 'New to Stitcher? ' : 'Already have an account? '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onModeChange(isLogin ? 'signup' : 'login');
            }}
            className="text-blue-400 transition-colors hover:underline"
          >
            {isLogin ? 'Create Account' : 'Sign In'}
          </a>
        </p>
      </div>
    );
  };

  return (
    <div className="dark h-[100dvh] w-[100dvw] flex flex-col md:flex-row bg-background text-foreground">
      {/* Left column: auth form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {renderContent()}
        </div>
      </section>

      {/* Right column: on-brand hero */}
      <section className="relative hidden flex-1 p-4 md:block">
        <div className="animate-slide-right animate-delay-300 absolute inset-4">
          <AuthHeroPanel />
        </div>
      </section>
    </div>
  );
};
