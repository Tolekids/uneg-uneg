import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/admin.css';

import { createSupabase, isConfigured } from './services/supabaseClient.js';
import { formatAbsolute } from './utils/formatTime.js';
import { h } from './utils/dom.js';
import { showToast } from './components/Toast.js';

const root = document.getElementById('admin-root');
const supabase = createSupabase({ persistSession: true });

const REASON_LABELS = {
  spam: 'Spam atau iklan',
  harassment: 'Pelecehan atau ujaran kebencian',
  violence: 'Ancaman atau kekerasan',
  personal_info: 'Membocorkan data pribadi',
  other: 'Alasan lain',
};

function fail(message) {
  showToast(message, 'error', 7000);
}

// ---------------------------------------------------------------- login
function renderLogin(message = '') {
  const email = h('input', { type: 'email', name: 'email', required: true, autocomplete: 'username' });
  const password = h('input', { type: 'password', name: 'password', required: true, autocomplete: 'current-password' });
  const error = h('p', { class: 'dialog__error', role: 'alert', hidden: !message }, message);
  const submit = h('button', { class: 'button button--primary', type: 'submit' }, 'Masuk');

  const form = h('form', { class: 'login', novalidate: true },
    h('h1', {}, 'Moderasi Textora'),
    h('p', {}, 'Khusus moderator. Akun dibuat oleh pemilik proyek di Supabase Auth.'),
    h('label', { class: 'field' }, h('span', {}, 'Email'), email),
    h('label', { class: 'field' }, h('span', {}, 'Kata sandi'), password),
    error,
    submit,
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = 'Masuk…';
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    });
    if (authError) {
      error.textContent = 'Email atau kata sandi salah.';
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Masuk';
      return;
    }
    init();
  });

  root.replaceChildren(form);
}

// ----------------------------------------------------------- dashboard
async function isModerator(userId) {
  const { data, error } = await supabase.from('moderators').select('user_id').eq('user_id', userId).maybeSingle();
  return !error && Boolean(data);
}

function renderDashboard(user) {
  const content = h('div', { class: 'mod-list' });
  const tabs = {
    reports: h('button', { class: 'tab', type: 'button' }, 'Laporan'),
    posts: h('button', { class: 'tab', type: 'button' }, 'Semua postingan'),
  };
  let current = 'reports';

  const signOut = h('button', { class: 'button button--small', type: 'button' }, 'Keluar');
  signOut.addEventListener('click', async () => {
    await supabase.auth.signOut();
    renderLogin();
  });

  async function load() {
    for (const [key, button] of Object.entries(tabs)) {
      if (key === current) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    content.replaceChildren(h('p', { class: 'mod-empty' }, 'Memuat…'));
    try {
      content.replaceChildren(...(current === 'reports' ? await reportItems() : await postItems()));
    } catch (err) {
      console.error(err);
      content.replaceChildren(h('p', { class: 'mod-empty' }, 'Gagal memuat data. Muat ulang halaman.'));
    }
  }

  async function reportItems() {
    const { data, error } = await supabase
      .from('reports')
      .select('id, reason, details, created_at, post_id, post:posts(id, content, status, created_at)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    if (!data.length) return [h('p', { class: 'mod-empty' }, 'Tidak ada laporan yang menunggu.')];

    return data.map((report) => {
      const post = report.post;
      const actions = h('div', { class: 'mod-item__actions' });

      const hide = h('button', { class: 'button button--small', type: 'button' }, 'Sembunyikan postingan');
      hide.addEventListener('click', async () => {
        const { error: e1 } = await supabase.from('posts').update({ status: 'hidden' }).eq('id', report.post_id);
        if (e1) return fail('Gagal menyembunyikan postingan.');
        const { error: e2 } = await supabase.from('reports').update({ status: 'reviewed' }).eq('post_id', report.post_id).eq('status', 'pending');
        if (e2) return fail('Postingan disembunyikan, tetapi status laporan gagal diperbarui.');
        showToast('Postingan disembunyikan.', 'success');
        load();
      });

      const dismiss = h('button', { class: 'button button--small', type: 'button' }, 'Tolak laporan');
      dismiss.addEventListener('click', async () => {
        const { error: e } = await supabase.from('reports').update({ status: 'dismissed' }).eq('id', report.id);
        if (e) return fail('Gagal memperbarui laporan.');
        load();
      });

      const remove = deleteButton(report.post_id);
      actions.append(hide, dismiss, remove);

      return h('article', { class: 'mod-item' },
        h('p', { class: 'mod-item__text' }, post?.content ?? '(postingan tidak ditemukan)'),
        h('div', { class: 'mod-item__meta' },
          h('span', { class: 'badge' }, REASON_LABELS[report.reason] ?? report.reason),
          post?.status === 'hidden' ? h('span', { class: 'badge badge--hidden' }, 'Tersembunyi') : null,
          h('span', {}, formatAbsolute(report.created_at)),
        ),
        report.details ? h('p', {}, `Detail pelapor: ${report.details}`) : null,
        actions,
      );
    });
  }

  function deleteButton(postId) {
    const button = h('button', { class: 'button button--small button--danger', type: 'button' }, 'Hapus permanen');
    button.addEventListener('click', async () => {
      if (!window.confirm('Hapus postingan ini secara permanen? Tindakan ini tidak bisa dibatalkan.')) return;
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) return fail('Gagal menghapus postingan.');
      showToast('Postingan dihapus.', 'success');
      load();
    });
    return button;
  }

  async function postItems() {
    const { data, error } = await supabase
      .from('posts')
      .select('id, content, status, created_at, like_count')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    if (!data.length) return [h('p', { class: 'mod-empty' }, 'Belum ada postingan.')];

    return data.map((post) => {
      const hidden = post.status === 'hidden';
      const toggle = h('button', { class: 'button button--small', type: 'button' }, hidden ? 'Tampilkan lagi' : 'Sembunyikan');
      toggle.addEventListener('click', async () => {
        const { error: e } = await supabase.from('posts').update({ status: hidden ? 'published' : 'hidden' }).eq('id', post.id);
        if (e) return fail('Gagal mengubah status postingan.');
        load();
      });
      return h('article', { class: 'mod-item' },
        h('p', { class: 'mod-item__text' }, post.content),
        h('div', { class: 'mod-item__meta' },
          h('span', { class: hidden ? 'badge badge--hidden' : 'badge' }, hidden ? 'Tersembunyi' : 'Terbit'),
          h('span', {}, formatAbsolute(post.created_at)),
          h('span', {}, `${post.like_count} suka`),
        ),
        h('div', { class: 'mod-item__actions' }, toggle, deleteButton(post.id)),
      );
    });
  }

  for (const [key, button] of Object.entries(tabs)) {
    button.addEventListener('click', () => { current = key; load(); });
  }

  root.replaceChildren(
    h('div', { class: 'admin-bar' },
      h('h1', {}, 'Moderasi Textora'),
      h('small', {}, user.email),
      signOut,
    ),
    h('nav', { class: 'tabs', 'aria-label': 'Bagian moderasi' }, tabs.reports, tabs.posts),
    content,
  );
  load();
}

// ----------------------------------------------------------------- init
async function init() {
  if (!isConfigured) {
    root.replaceChildren(h('p', { class: 'notice' }, 'Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY di file .env terlebih dahulu.'));
    return;
  }
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return renderLogin();

  if (!(await isModerator(user.id))) {
    await supabase.auth.signOut();
    return renderLogin('Akun ini tidak memiliki akses moderator.');
  }
  renderDashboard(user);
}

init();
