import { MAX_LENGTH, validatePost } from '../utils/validatePost.js';
import { isCaptchaConfigured, mountCaptcha, resetCaptcha } from '../services/captchaService.js';
import { createPost } from '../services/postService.js';
import { getState, setState, subscribe } from '../state/store.js';
import { showToast } from './Toast.js';
import { icons } from '../utils/icons.js';

const RING_RADIUS = 11;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const WARN_AT = 20;

export function mountComposer(root, { disabled = false } = {}) {
  root.classList.add('composer');
  root.innerHTML = `
    <div class="composer__who">
      <span class="composer__mask">${icons.mask(20)}</span>
      <span>Posting sebagai <strong>Anonim</strong></span>
    </div>
    <label class="sr-only" for="post-input">Isi postingan</label>
    <textarea id="post-input" class="composer__input" rows="3" placeholder="Apa yang ingin kamu tulis?" autocomplete="off" spellcheck="true"></textarea>
    <div class="composer__captcha" data-captcha></div>
    <p class="composer__hint" data-hint role="status"></p>
    <div class="composer__bar">
      <p class="composer__note">Postingan terlihat publik dan tidak bisa diedit.</p>
      <div class="counter" data-counter aria-hidden="true">
        <svg viewBox="0 0 28 28" width="28" height="28">
          <circle class="counter__track" cx="14" cy="14" r="${RING_RADIUS}" fill="none" stroke-width="3"/>
          <circle class="counter__fill" cx="14" cy="14" r="${RING_RADIUS}" fill="none" stroke-width="3" stroke-linecap="round"
            stroke-dasharray="${RING_LENGTH.toFixed(2)}" stroke-dashoffset="${RING_LENGTH.toFixed(2)}" transform="rotate(-90 14 14)"/>
        </svg>
        <span class="counter__num"></span>
      </div>
      <span class="sr-only" data-counter-live aria-live="polite"></span>
      <button class="button button--primary" type="button" data-submit>Post</button>
    </div>`;

  const input = root.querySelector('#post-input');
  const captchaBox = root.querySelector('[data-captcha]');
  const hint = root.querySelector('[data-hint]');
  const counter = root.querySelector('[data-counter]');
  const counterFill = root.querySelector('.counter__fill');
  const counterNum = root.querySelector('.counter__num');
  const counterLive = root.querySelector('[data-counter-live]');
  const submitButton = root.querySelector('[data-submit]');

  let token = null;
  let captchaFailed = false;
  let submitting = false;

  function refresh() {
    const check = validatePost(input.value);
    const remaining = MAX_LENGTH - check.length;
    const ratio = Math.min(check.length / MAX_LENGTH, 1);

    counterFill.setAttribute('stroke-dashoffset', (RING_LENGTH * (1 - ratio)).toFixed(2));
    counter.dataset.state = remaining < 0 ? 'over' : remaining <= WARN_AT ? 'warn' : 'ok';
    counterNum.textContent = remaining <= WARN_AT ? String(remaining) : '';
    counterLive.textContent = remaining < 0 ? `Kelebihan ${-remaining} karakter` : remaining <= WARN_AT ? `Sisa ${remaining} karakter` : '';

    const ready = check.ok && Boolean(token) && !submitting && !disabled;
    submitButton.disabled = !ready;
    submitButton.textContent = submitting ? 'Mengirim…' : 'Post';
    input.disabled = submitting;

    if (disabled) hint.textContent = 'Posting dinonaktifkan sampai konfigurasi selesai.';
    else if (captchaFailed) hint.textContent = 'Verifikasi gagal dimuat. Muat ulang halaman, lalu coba lagi.';
    else if (check.length > 0 && !check.ok && check.length > MAX_LENGTH) hint.textContent = check.error;
    else if (check.ok && !token && !submitting) hint.textContent = 'Menunggu verifikasi singkat…';
    else hint.textContent = '';
  }

  async function submit() {
    const check = validatePost(input.value);
    if (!check.ok || !token || submitting) return;

    submitting = true;
    refresh();
    try {
      const post = await createPost(check.value, token);
      input.value = '';
      const state = getState();
      if (state.tab === 'latest') {
        setState({ posts: [post, ...state.posts.filter((p) => p.id !== post.id)] });
        showToast('Postinganmu terbit. Semua orang bisa membacanya.', 'success');
      } else {
        showToast('Postinganmu terbit. Lihat di tab Terbaru.', 'success');
      }
    } catch (err) {
      // Teks tetap ada di form supaya bisa dikirim ulang.
      showToast(err.message, 'error', 7000);
    } finally {
      token = null;
      submitting = false;
      resetCaptcha();
      refresh();
      if (!input.value) input.focus();
    }
  }

  async function renderCaptcha() {
    token = null;
    captchaFailed = false;
    refresh();
    try {
      await mountCaptcha(captchaBox, {
        theme: getState().theme,
        onToken: (t) => { token = t; captchaFailed = false; refresh(); },
        onExpire: () => { token = null; refresh(); },
        onError: () => { token = null; captchaFailed = true; refresh(); },
      });
    } catch {
      captchaFailed = true;
      refresh();
    }
  }

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submit();
  });
  submitButton.addEventListener('click', submit);

  if (isCaptchaConfigured && !disabled) {
    renderCaptcha();
    let lastTheme = getState().theme;
    subscribe((state) => {
      if (state.theme !== lastTheme) {
        lastTheme = state.theme;
        if (!submitting) renderCaptcha();
      }
    });
  } else {
    captchaFailed = false;
    disabled = true;
    refresh();
  }

  refresh();
}
