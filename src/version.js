export const APP_VERSION = '1.64';
export function formatVersionBadge() {
const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
return `${dateLabel} - v${APP_VERSION}`;
}
