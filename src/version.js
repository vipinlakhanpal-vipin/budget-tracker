// Single source of truth for the app's build/version badge -- shown on the
// splash screen (below the tagline) and pinned to the top-right corner of
// the main dashboard, so the two never drift out of sync.
// Format: plain "MAJOR.MINOR" (e.g. "1.86"), matching the same value stored
// in public/version.json -- the two MUST always be updated together and use
// the exact same string, since the in-app update checker compares them for
// equality to decide whether to show the "new update available" badge.
export const APP_VERSION = '1.86';

export function formatVersionBadge() {
  return `v${APP_VERSION}`;
}
