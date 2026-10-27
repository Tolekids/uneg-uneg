const rtf = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' });
const sameYear = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
const otherYear = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatTime(iso, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((then - now) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 45) return 'baru saja';
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(seconds / 86400), 'day');

  const date = new Date(then);
  return (date.getFullYear() === new Date(now).getFullYear() ? sameYear : otherYear).format(date);
}

export function formatAbsolute(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : absolute.format(date);
}
