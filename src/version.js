// Single source of truth for the app's build/version badge -- shown on the
// splash screen (below the tagline) and pinned to the top-right corner of
// the main dashboard, so the two never drift out of sync.
// Version is now a plain incrementing number (1.01, 1.02, 1.03, ...) instead
// of a date-based tag -- per explicit request, it should NOT change/reset on
// its own just because the calendar day changed; it only moves forward when
// this file is deliberately bumped for a pushed batch of changes. Starts at
// 1.01. The date shown next to it in the badge is computed live (always
// "today"), completely separate from this number.
export const APP_VERSION = '1.13';
export function formatVersionBadge() {
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${dateLabel} - v${APP_VERSION}`;
}
