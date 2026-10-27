const wrap = (body, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  // Lingkaran setengah terisi: simbol "topeng" untuk identitas anonim.
  mask: (size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor"/></svg>`,
  heart: (filled = false) =>
    wrap(`<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.7 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.4 3.2 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z" ${filled ? 'fill="currentColor"' : ''}/>`),
  flag: () => wrap('<path d="M5 21V4"/><path d="M5 4h11l-1.8 3.5L16 11H5"/>'),
  sun: () => wrap('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 20),
  moon: () => wrap('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>', 20),
  refresh: () => wrap('<path d="M20 11a8 8 0 0 0-14.5-4.2L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.5 4.2L20 15.5"/><path d="M20 20v-4.5h-4.5"/>'),
};
