import { Github, MessageSquarePlus, Code2, Star } from "lucide-react";
import { LINKS } from "@/config/links";
import { NoiseTexture } from "@/Components/ui/noise-texture";
import { SocialTooltip } from "@/Components/ui/social-media";

// Discord isn't part of lucide's icon set, so we inline its logo.
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
  </svg>
);

// Monochrome brand logos (use currentColor) for the SocialTooltip in the
// "Meet the Developer" stripe — they invert to white on the colored hover fill.
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
  </svg>
);

const GmailIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-1.819V7.73L12 14.025 3.455 7.73v13.272H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-.404.121-.764.348-1.04l.06-.061C.706 3.952 1.097 3.818 1.5 3.818h.272L12 11.73l10.228-7.912h.272c.403 0 .794.134 1.092.397l.06.06c.227.277.348.637.348 1.182z" />
  </svg>
);

interface Props {
  // Kept for caller compatibility; this section no longer navigates internally.
  onNavigate?: (key: string) => void;
}

const GettingStarted = ({}: Props) => {
  // Social links for the "Meet the Developer" stripe (SocialTooltip).
  const socialItems = [
    {
      href: LINKS.developer.linkedin || "#",
      ariaLabel: "LinkedIn",
      tooltip: "LinkedIn",
      color: "#0A66C2",
      icon: <LinkedInIcon className="w-[18px] h-[18px]" />,
    },
    {
      href: LINKS.developer.x || "#",
      ariaLabel: "X",
      tooltip: "X",
      color: "#000000",
      icon: <XIcon className="w-[18px] h-[18px]" />,
    },
    {
      href: `mailto:${LINKS.feedbackEmail}`,
      ariaLabel: "Gmail",
      tooltip: "Gmail",
      color: "#EA4335",
      icon: <GmailIcon className="w-[18px] h-[18px]" />,
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-700 delay-400">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-white">Get Involved</h2>
        <p className="text-zinc-400 text-sm">
          Learn the basics and explore resources
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-5 xl:h-[260px]">
        {/* Two full-height feature cards (left 2/3) */}
        <div className="w-full xl:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Tutorial video */}
          <div className="relative rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-colors bg-black h-full min-h-[180px]">
            <iframe
              src={LINKS.tutorialEmbed}
              title="Tutorial"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            ></iframe>
          </div>

          {/* We're Open Source */}
          <a
            href={LINKS.githubRepo}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-black p-5 hover:border-zinc-700 transition-all duration-200 h-full min-h-[180px] overflow-hidden"
          >
            <NoiseTexture
              className="absolute inset-0 opacity-60"
              style={{
                maskImage:
                  "radial-gradient(420px circle at center, white, transparent)",
                WebkitMaskImage:
                  "radial-gradient(420px circle at center, white, transparent)",
              }}
            />
            <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-white ring-1 ring-white/10">
              <Github size={22} />
            </div>
            <div className="relative z-10 space-y-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">
                  We&apos;re Open Source
                </h3>
                <p className="text-xs text-zinc-400">
                  Explore the code, open an issue, or star the repo to follow
                  along.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white group-hover:border-zinc-600 transition-colors">
                <Star className="h-3.5 w-3.5" />
                Star on GitHub
              </span>
            </div>
          </a>
        </div>

        {/* Three horizontal stripes (right 1/3) */}
        <div className="w-full xl:w-1/3 xl:min-w-[300px] flex flex-col gap-3">
          {/* Give Feedback */}
          <a
            href={`mailto:${LINKS.feedbackEmail}?subject=Stitcher%20Feedback`}
            className="group flex items-center justify-between w-full rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200 flex-1"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 ring-1 ring-white/10">
                <MessageSquarePlus size={18} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">Give Feedback</h3>
                <p className="text-xs text-zinc-400">Share a bug or an idea</p>
              </div>
            </div>
            <span className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white group-hover:bg-zinc-700 transition-colors">
              Send
            </span>
          </a>

          {/* Join Community */}
          <a
            href={LINKS.discord || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between w-full rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200 flex-1"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 ring-1 ring-white/10">
                <DiscordIcon className="h-[18px] w-[18px]" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">Join Community</h3>
                <p className="text-xs text-zinc-400">Connect with other creators</p>
              </div>
            </div>
            <span className="rounded-md bg-[#5865F2] px-3 py-1.5 text-xs font-medium text-white group-hover:bg-[#4752c4] transition-colors">
              Join
            </span>
          </a>

          {/* Meet the Developer */}
          <div className="flex items-center justify-between w-full rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 ring-1 ring-white/10">
                <Code2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">
                  Meet the Developer
                </h3>
                <p className="text-xs text-zinc-400">Built solo, say hi</p>
              </div>
            </div>
            <SocialTooltip items={socialItems} className="gap-2 flex-shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GettingStarted;
