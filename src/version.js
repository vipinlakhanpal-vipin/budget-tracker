// Single source of truth for the app's build/version badge -- shown on the
// splash screen (below the tagline) and pinned to the top-right corner of
// the main dashboard, so the two never drift out of sync.
// Format: YYYY-MM-DD.vN, where N resets to 1 on a new day and increments
// for same-day updates. Bump this on every pushed batch of changes.
export const APP_VERSION = '2026-07-20.v16';

export function formatVersionBadge() {
  const [datePart, verPart] = APP_VERSION.split('.');
  const d = new Date(datePart + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${dateLabel} · ${verPart}`;
}
