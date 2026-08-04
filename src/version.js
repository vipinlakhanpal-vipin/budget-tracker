// Single source of truth for the app's build/version badge -- shown on the
// splash screen (below the tagline) and pinned to the top-right corner of
// the main dashboard, so the two never drift out of sync.
// APP_VERSION itself must stay a PLAIN "MAJOR.MINOR" string (e.g. "1.99"),
// matching the same value stored in public/version.json -- the two MUST
// always be updated together and use the exact same string, since the
// in-app update checker compares them for equality to decide whether to
// show the "new update available" badge. Do NOT fold a date into this
// constant (v1.86 tried that and the badge got permanently stuck showing
// an update was available, since version.json never matched the
// date-suffixed value).
// The visible BADGE, on the other hand, is free to show more than just
// the version -- formatVersionBadge() below adds today's date for display
// purposes only, restoring the "Jul 30, 2026 - v1.87" style badge from
// before v1.86, without reintroducing the comparison bug.
export const APP_VERSION = '2.74';

export function formatVersionBadge() {
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${dateLabel} \u00b7 v${APP_VERSION}`;
}
