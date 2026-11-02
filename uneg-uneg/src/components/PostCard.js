import { formatAbsolute, formatTime } from '../utils/formatTime.js';
import { icons } from '../utils/icons.js';
import { fetchComments, createComment } from '../services/postService.js';
import { showToast } from './Toast.js';

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
      <button class="action action--comment" type="button" data-comment aria-expanded="false">
        ${icons.comment(16)}<span>Komentar</span><span class="action__count" data-comment-count></span>
      </button>
      <button class="action action--report" type="button" data-report>${icons.flag()}<span>Laporkan</span></button>
    </footer>
    <div class="post__comments" data-comments-section hidden>
      <div class="comments__list" data-comments-list></div>
      <form class="comments__form" data-comments-form>
        <input
          type="text"
          class="comments__input"
          placeholder="Tulis balasan anonim..."
          maxlength="280"
          required
          autocomplete="off"
          data-comment-input
        />
        <button type="submit" class="button button--primary comments__submit" data-comment-submit>
          ${icons.send(15)}<span>Kirim</span>
        </button>
      </form>
    </div>`;

  const author = el.querySelector('[data-author]');
  const time = el.querySelector('[data-time]');
  const text = el.querySelector('[data-text]');
  const like = el.querySelector('[data-like]');
  const report = el.querySelector('[data-report]');
  const commentBtn = el.querySelector('[data-comment]');
  const commentCountEl = el.querySelector('[data-comment-count]');
  const commentsSection = el.querySelector('[data-comments-section]');
  const commentsList = el.querySelector('[data-comments-list]');
  const commentsForm = el.querySelector('[data-comments-form]');
  const commentInput = el.querySelector('[data-comment-input]');
  const commentSubmit = el.querySelector('[data-comment-submit]');

  let current = null;
  let commentsLoaded = false;
  let commentsLoading = false;
  let comments = [];

  like.addEventListener('click', () => current && onLike(current));
  report.addEventListener('click', () => current && onReport(current));

  function renderComments() {
    if (commentsLoading) {
      commentsList.innerHTML = `<p class="comments__loading">Memuat komentar...</p>`;
      return;
    }
    if (comments.length === 0) {
      commentsList.innerHTML = `<p class="comments__empty">Belum ada komentar. Jadilah yang pertama!</p>`;
      commentCountEl.textContent = '';
      return;
    }
    commentCountEl.textContent = comments.length > 0 ? comments.length : '';
    commentsList.innerHTML = '';
    for (const c of comments) {
      const item = document.createElement('div');
      item.className = 'comment';
      const cTime = formatTime(c.created_at);
      const cTimeAbs = formatAbsolute(c.created_at);
      item.innerHTML = `
        <div class="comment__meta">
          <span class="comment__author"><span class="post__mask">${icons.mask(13)}</span>Anonim</span>
          <span class="comment__sep">•</span>
          <time class="comment__time" title="${cTimeAbs}">${cTime}</time>
        </div>
        <div class="comment__text"></div>
      `;
      item.querySelector('.comment__text').textContent = c.content;
      commentsList.appendChild(item);
    }
  }

  async function loadComments() {
    if (!current) return;
    commentsLoading = true;
    renderComments();
    try {
      comments = await fetchComments(current.id);
      commentsLoaded = true;
    } catch {
      comments = [];
    } finally {
      commentsLoading = false;
      renderComments();
    }
  }

  commentBtn.addEventListener('click', () => {
    const isHidden = commentsSection.hidden;
    commentsSection.hidden = !isHidden;
    commentBtn.setAttribute('aria-expanded', String(isHidden));
    commentBtn.classList.toggle('is-active', isHidden);
    if (isHidden) {
      if (!commentsLoaded) {
        loadComments();
      }
      setTimeout(() => commentInput.focus(), 120);
    }
  });

  commentsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!current) return;
    const content = commentInput.value.trim();
    if (!content) return;

    commentSubmit.disabled = true;
    commentSubmit.innerHTML = `<span>Mengirim...</span>`;
    try {
      const newComment = await createComment(current.id, content);
      comments.push(newComment);
      commentsLoaded = true;
      renderComments();
      commentInput.value = '';
      showToast('Komentar berhasil dikirim!', 'success');
      commentsList.scrollTop = commentsList.scrollHeight;
    } catch (err) {
      showToast(err.message || 'Gagal mengirim komentar.', 'error');
    } finally {
      commentSubmit.disabled = false;
      commentSubmit.innerHTML = `${icons.send(15)}<span>Kirim</span>`;
    }
  });

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
