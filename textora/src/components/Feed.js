import { getState, setState, subscribe } from '../state/store.js';
import { PAGE_SIZE, fetchMyLikes, fetchPosts, toggleLike } from '../services/postService.js';
import { createPostCard } from './PostCard.js';
import { showToast } from './Toast.js';
import { icons } from '../utils/icons.js';

let requestSeq = 0;
const pendingLikes = new Set();

function mergeUnique(...lists) {
  const seen = new Set();
  const out = [];
  for (const post of lists.flat()) {
    if (!seen.has(post.id)) { seen.add(post.id); out.push(post); }
  }
  return out;
}

async function syncLikes(ids) {
  try {
    const liked = new Set(await fetchMyLikes(ids));
    const next = new Set(getState().likedIds);
    for (const id of ids) {
      if (liked.has(id)) next.add(id);
      else next.delete(id);
    }
    setState({ likedIds: next });
  } catch { /* status Like gagal dimuat: tidak fatal */ }
}

export async function reloadFeed() {
  const seq = ++requestSeq;
  setState({ status: 'loading', error: '' });
  try {
    const posts = await fetchPosts({ tab: getState().tab, offset: 0 });
    if (seq !== requestSeq) return;
    setState({ posts, hasMore: posts.length === PAGE_SIZE, status: 'ready' });
    syncLikes(posts.map((p) => p.id));
  } catch (err) {
    if (seq !== requestSeq) return;
    setState({ status: 'error', error: err.message });
  }
}

export async function loadMore() {
  const state = getState();
  if (!state.hasMore || state.status === 'loading' || state.status === 'loading-more') return;
  const seq = requestSeq;
  setState({ status: 'loading-more', error: '' });
  try {
    const more = await fetchPosts({ tab: state.tab, offset: state.posts.length });
    if (seq !== requestSeq) return;
    setState({
      posts: mergeUnique(getState().posts, more),
      hasMore: more.length === PAGE_SIZE,
      status: 'ready',
    });
    syncLikes(more.map((p) => p.id));
  } catch (err) {
    if (seq !== requestSeq) return;
    setState({ status: 'error', error: err.message });
  }
}

export function mountFeed(root, { onReport }) {
  root.classList.add('feed');
  root.innerHTML = `
    <div class="feed__toolbar">
      <h2 class="feed__title" data-title></h2>
      <button class="button button--quiet" type="button" data-refresh>${icons.refresh()}<span>Muat ulang</span></button>
    </div>
    <div class="feed__panel">
      <div class="skeletons" data-skeleton aria-hidden="true">
        <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
      </div>
      <div class="feed__list" data-list></div>
      <div class="feed__empty" data-empty hidden>
        <p class="feed__empty-title">Belum ada postingan.</p>
        <p>Jadilah yang pertama menulis sesuatu di atas.</p>
      </div>
      <div class="feed__error" data-error hidden role="alert">
        <p data-error-text></p>
        <button class="button" type="button" data-retry>Coba lagi</button>
      </div>
    </div>
    <div class="feed__more"><button class="button" type="button" data-more hidden>Muat lebih banyak</button></div>`;

  const title = root.querySelector('[data-title]');
  const refreshButton = root.querySelector('[data-refresh]');
  const skeleton = root.querySelector('[data-skeleton]');
  const list = root.querySelector('[data-list]');
  const empty = root.querySelector('[data-empty]');
  const errorBox = root.querySelector('[data-error]');
  const errorText = root.querySelector('[data-error-text]');
  const retryButton = root.querySelector('[data-retry]');
  const moreButton = root.querySelector('[data-more]');

  const cards = new Map();
  let lastOrder = '';

  async function handleLike(post) {
    if (pendingLikes.has(post.id)) return;
    pendingLikes.add(post.id);
    render(getState());
    try {
      // Tampilan baru berubah setelah server mengonfirmasi.
      const result = await toggleLike(post.id);
      const state = getState();
      const likedIds = new Set(state.likedIds);
      if (result.liked) likedIds.add(post.id);
      else likedIds.delete(post.id);
      setState({
        likedIds,
        posts: state.posts.map((p) => (p.id === post.id ? { ...p, like_count: result.like_count } : p)),
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      pendingLikes.delete(post.id);
      render(getState());
    }
  }

  function render(state) {
    const hasPosts = state.posts.length > 0;
    const loading = state.status === 'loading';

    title.textContent = state.tab === 'foryou' ? 'Paling disukai' : 'Postingan terbaru';
    root.setAttribute('aria-busy', String(loading || state.status === 'loading-more'));
    refreshButton.disabled = loading;
    refreshButton.classList.toggle('is-spinning', loading);

    skeleton.hidden = !(loading && !hasPosts);
    empty.hidden = !(state.status === 'ready' && !hasPosts);
    errorBox.hidden = state.status !== 'error';
    if (state.status === 'error') errorText.textContent = state.error;

    moreButton.hidden = !(hasPosts && state.hasMore && state.status !== 'error');
    moreButton.disabled = state.status === 'loading-more';
    moreButton.textContent = state.status === 'loading-more' ? 'Memuat…' : 'Muat lebih banyak';

    const ids = state.posts.map((p) => p.id);
    for (const post of state.posts) {
      let card = cards.get(post.id);
      if (!card) {
        card = createPostCard({ onLike: handleLike, onReport });
        cards.set(post.id, card);
      }
      card.update(post, state.likedIds.has(post.id), pendingLikes.has(post.id));
    }
    for (const [id, card] of cards) {
      if (!ids.includes(id)) { card.el.remove(); cards.delete(id); }
    }
    const order = ids.join('|');
    if (order !== lastOrder) {
      list.replaceChildren(...ids.map((id) => cards.get(id).el));
      lastOrder = order;
    }
  }

  refreshButton.addEventListener('click', reloadFeed);
  moreButton.addEventListener('click', loadMore);
  retryButton.addEventListener('click', () => (getState().posts.length ? loadMore() : reloadFeed()));

  subscribe(render);
  render(getState());
  setInterval(() => render(getState()), 60_000); // perbarui waktu relatif
}
