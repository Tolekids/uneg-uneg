import { getState, subscribe } from '../state/store.js';
import { icons } from '../utils/icons.js';

const TABS = [
  { id: 'foryou', label: 'Untukmu' },
  { id: 'latest', label: 'Terbaru' },
];

export function mountHeader(root, { onTabChange, onThemeToggle }) {
  root.innerHTML = `
    <div class="site-header__inner">
      <a class="logo" href="/" aria-label="Textora, beranda">
        <span class="logo__mark">${icons.mask(22)}</span>
        <span class="logo__word">Textora</span>
      </a>
      <nav class="tabs" aria-label="Urutan feed"></nav>
      <button class="icon-button" type="button" data-theme-toggle></button>
    </div>`;

  const nav = root.querySelector('.tabs');
  const themeButton = root.querySelector('[data-theme-toggle]');

  for (const tab of TABS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab';
    button.dataset.tab = tab.id;
    button.textContent = tab.label;
    button.addEventListener('click', () => onTabChange(tab.id));
    nav.appendChild(button);
  }
  themeButton.addEventListener('click', onThemeToggle);

  function render(state) {
    for (const button of nav.children) {
      const active = button.dataset.tab === state.tab;
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    const dark = state.theme === 'dark';
    themeButton.innerHTML = dark ? icons.sun() : icons.moon();
    themeButton.setAttribute('aria-label', dark ? 'Pakai tema terang' : 'Pakai tema gelap');
  }

  subscribe(render);
  render(getState());
}
