// Community surface (feed, posts, follows, leaderboard, backpack, notifications,
// public profiles) is dormant for the v1 relaunch. Set VITE_FEATURE_COMMUNITY=true
// to bring it all back.
export const FEATURES = {
  community: import.meta.env.VITE_FEATURE_COMMUNITY === "true",
} as const;
