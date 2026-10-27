// Pembungkus Cloudflare Turnstile. Token hanya BUKTI awal — server wajib memverifikasinya ulang.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export const isCaptchaConfigured = Boolean(SITE_KEY);

let scriptPromise = null;
let widgetId = null;

function loadScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('turnstile-load-failed'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function unmountCaptcha() {
  if (widgetId !== null && window.turnstile) {
    try { window.turnstile.remove(widgetId); } catch { /* widget sudah hilang */ }
  }
  widgetId = null;
}

export async function mountCaptcha(container, { theme, onToken, onExpire, onError }) {
  const turnstile = await loadScript();
  unmountCaptcha();
  widgetId = turnstile.render(container, {
    sitekey: SITE_KEY,
    theme,
    size: 'flexible',
    callback: onToken,
    'expired-callback': onExpire,
    'timeout-callback': onExpire,
    'error-callback': () => { onError(); return true; },
  });
}

// Token Turnstile hanya berlaku sekali, jadi reset setelah setiap percobaan kirim.
export function resetCaptcha() {
  if (widgetId !== null && window.turnstile) {
    try { window.turnstile.reset(widgetId); } catch { /* abaikan */ }
  }
}
