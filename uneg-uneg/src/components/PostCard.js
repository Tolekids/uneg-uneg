import { formatAbsolute, formatTime } from '../utils/formatTime.js';
import { icons } from '../utils/icons.js';

export function createPostCard({ onLike, onReport }) {
  const el = document.createElement('article');
  el.className = 'post';
  el.innerHTML = `
    <header class="post__meta">
      <span class="post__author"><span class="post__mask">${icons.mask(16)}</span><span data-author></span></span>
      <time class="post__time" data-time></time>
    </header>
    <p class="post__text" data-text></p>
    <footer class="post__actions">
      <button class="action action--like" type="button" data-like></button>
      <button class="action action--report" type="button" data-report>${icons.flag()}<span>Laporkan</span></button>
    </footer>`;

  const author = el.querySelector('[data-author]');
  const time = el.querySelector('[data-time]');
  const text = el.querySelector('[data-text]');
  const like = el.querySelector('[data-like]');
  const report = el.querySelector('[data-report]');
  let current = null;

  like.addEventListener('click', () => current && onLike(current));
  report.addEventListener('click', () => current && onReport(current));

  function update(post, liked, pending) {
    current = post;
    author.textContent = post.author_label;
    if (text.textContent !== post.content) text.textContent = post.content;
    time.textContent = formatTime(post.created_at);
    time.dateTime = post.created_at;
    time.title = formatAbsolute(post.created_at);

    like.setAttribute('aria-pressed', String(liked));
    like.setAttribute('aria-label', `${liked ? 'Batalkan suka' : 'Suka'}. ${post.like_count} suka`);
    like.disabled = pending;
    like.classList.toggle('is-pending', pending);
    like.innerHTML = `${icons.heart(liked)}<span class="action__count">${post.like_count}</span>`;
  }

  return { el, update };
}
