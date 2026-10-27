export function showToast(message, type = 'info', duration = 5000) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  host.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}
