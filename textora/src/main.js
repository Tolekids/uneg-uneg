import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { isConfigured } from './services/supabaseClient.js';
import { isCaptchaConfigured } from './services/captchaService.js';
import { getState, setState } from './state/store.js';
import { mountHeader } from './components/Header.js';
import { mountComposer } from './components/Composer.js';
import { mountFeed, reloadFeed } from './components/Feed.js';
import { mountReportDialog } from './components/ReportDialog.js';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('textora.theme', theme); } catch { /* penyimpanan tidak tersedia */ }
  setState({ theme });
}

function showSetupNotice(missing) {
  const box = document.getElementById('setup-notice');
  const notice = document.createElement('div');
  notice.className = 'notice';
  notice.setAttribute('role', 'alert');
  notice.append('Textora belum selesai dikonfigurasi. Isi ');
  missing.forEach((name, i) => {
    const code = document.createElement('code');
    code.textContent = name;
    notice.append(code, i < missing.length - 1 ? ', ' : '');
  });
  notice.append(' di file .env (lihat .env.example), lalu jalankan ulang aplikasi.');
  box.appendChild(notice);
}

mountHeader(document.getElementById('app-header'), {
  onTabChange(tab) {
    if (tab === getState().tab) return;
    setState({ tab, posts: [], hasMore: true });
    reloadFeed();
  },
  onThemeToggle() {
    applyTheme(getState().theme === 'dark' ? 'light' : 'dark');
  },
});

const missing = [];
if (!isConfigured) missing.push('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY');
if (!isCaptchaConfigured) missing.push('VITE_TURNSTILE_SITE_KEY');
if (missing.length) showSetupNotice(missing);

const reportDialog = mountReportDialog(document.getElementById('report-dialog'));

mountComposer(document.getElementById('composer'), { disabled: !isConfigured || !isCaptchaConfigured });
mountFeed(document.getElementById('feed'), { onReport: (post) => reportDialog.open(post) });

if (isConfigured) reloadFeed();
else setState({ status: 'ready' });
