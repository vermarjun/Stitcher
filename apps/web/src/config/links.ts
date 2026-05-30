// Central place for outbound links used across the dashboard (Getting Started
// cards, Quick Actions, etc.). Edit these once and they update everywhere.
//
// TODO(@vermarjun): swap the placeholders below for your real URLs before relaunch.
export const LINKS = {
  // Public repo for the "We're Open Source" card.
  githubRepo: "https://github.com/vermarjun/stitcher",
  // Discord invite for the "Join the Community" card. Leave "" to disable.
  discord: "", // e.g. "https://discord.gg/your-invite"
  // Docs site for the "Documentation" card.
  docs: "https://docs.stitcher.com",
  // Developer profile / socials for the "Meet the Developer" stripe.
  developer: {
    linkedin: "", // e.g. "https://linkedin.com/in/vermarjun"
    x: "", // e.g. "https://x.com/vermarjun"
    // Email uses feedbackEmail below.
  },
  // Where the "Give Feedback" card sends people.
  feedbackEmail: "vermarjun.work@gmail.com",
  // YouTube EMBED url (not the watch url) — rendered inside an <iframe> in the
  // Quick Actions tutorial card. Set the video's thumbnail/title on YouTube.
  tutorialEmbed: "https://www.youtube.com/embed/u6DUz9Mm-oM",
} as const;
