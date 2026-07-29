export const APP_VERSION = '1.54';
export function formatVersionBadge() {
const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
return `${dateLabel} - v${APP_VERSION}`;
}
