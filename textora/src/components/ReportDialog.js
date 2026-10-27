import { reportPost } from '../services/postService.js';
import { showToast } from './Toast.js';

const REASONS = [
  ['spam', 'Spam atau iklan'],
  ['harassment', 'Pelecehan atau ujaran kebencian'],
  ['violence', 'Ancaman atau kekerasan'],
  ['personal_info', 'Membocorkan data pribadi'],
  ['other', 'Alasan lain'],
];

export function mountReportDialog(dialog) {
  dialog.innerHTML = `
    <form class="dialog__form" method="dialog" novalidate>
      <h2 id="report-title" class="dialog__title">Laporkan postingan</h2>
      <p class="dialog__excerpt" data-excerpt></p>
      <fieldset class="dialog__fieldset">
        <legend class="sr-only">Alasan laporan</legend>
        ${REASONS.map(([value, label], i) => `
          <label class="radio"><input type="radio" name="reason" value="${value}" ${i === 0 ? 'checked' : ''}/><span>${label}</span></label>`).join('')}
      </fieldset>
      <label class="field">
        <span>Detail tambahan (opsional)</span>
        <textarea name="details" rows="3" maxlength="500"></textarea>
      </label>
      <p class="dialog__error" data-error role="alert" hidden></p>
      <div class="dialog__actions">
        <button class="button" type="button" data-cancel>Batal</button>
        <button class="button button--primary" type="submit" data-send>Kirim laporan</button>
      </div>
    </form>`;

  const form = dialog.querySelector('form');
  const excerpt = dialog.querySelector('[data-excerpt]');
  const errorBox = dialog.querySelector('[data-error]');
  const sendButton = dialog.querySelector('[data-send]');
  let postId = null;

  dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!postId) return;
    const data = new FormData(form);
    sendButton.disabled = true;
    sendButton.textContent = 'Mengirim…';
    errorBox.hidden = true;
    try {
      await reportPost(postId, data.get('reason'), String(data.get('details') ?? '').trim());
      dialog.close();
      showToast('Laporan terkirim. Terima kasih sudah membantu menjaga Textora.', 'success');
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = 'Kirim laporan';
    }
  });

  return {
    open(post) {
      postId = post.id;
      excerpt.textContent = post.content.length > 140 ? `${post.content.slice(0, 140)}…` : post.content;
      form.reset();
      errorBox.hidden = true;
      dialog.showModal();
    },
  };
}
