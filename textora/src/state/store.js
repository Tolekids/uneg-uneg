const listeners = new Set();

const state = {
  tab: 'latest', // 'latest' (Terbaru) | 'foryou' (Untukmu)
  posts: [],
  status: 'idle', // idle | loading | loading-more | ready | error
  error: '',
  hasMore: true,
  likedIds: new Set(),
  theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
};

export const getState = () => state;

export function setState(patch) {
  Object.assign(state, patch);
  for (const listener of listeners) listener(state, patch);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
