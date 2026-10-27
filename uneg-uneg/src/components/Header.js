import { getState, subscribe } from '../state/store.js';
import { icons } from '../utils/icons.js';

const TABS = [
  { id: 'foryou', label: 'Untukmu' },
  { id: 'latest', label: 'Terbaru' },
];

export function mountHeader(root, { onTabChange, onThemeToggle }) {
  root.innerHTML = `
    <div class="site-header__inner">
      <a class="logo logo--3d" href="/" aria-label="Uneg-Uneg, beranda">
        <span class="logo__mark-3d" aria-hidden="true">
          <img class="logo__img" src="/logo.png" alt="Logo Uneg-Uneg" />
        </span>
        <div class="logo__text-group">
          <span class="logo__word" data-text="uneg-uneg">uneg-uneg</span>
        </div>
      </a>
      <nav class="tabs" aria-label="Urutan feed"></nav>
      <button class="icon-button" type="button" data-theme-toggle></button>
    </div>`;

  const nav = root.querySelector('.tabs');
  const themeButton = root.querySelector('[data-theme-toggle]');
  const logo = root.querySelector('.logo--3d');

  // Interactive 3D tilt tracking for cursor
  if (logo) {
    let bounds;
    const handleMouseEnter = () => {
      bounds = logo.getBoundingClientRect();
    };
    const handleMouseMove = (e) => {
      if (!bounds) bounds = logo.getBoundingClientRect();
      const mouseX = e.clientX - bounds.left;
      const mouseY = e.clientY - bounds.top;
      const xPct = (mouseX / bounds.width - 0.5) * 2;
      const yPct = (mouseY / bounds.height - 0.5) * 2;
      
      const rotX = -yPct * 12;
      const rotY = xPct * 16;
      logo.style.setProperty('--rot-x', `${rotX.toFixed(2)}deg`);
      logo.style.setProperty('--rot-y', `${rotY.toFixed(2)}deg`);
    };
    const handleMouseLeave = () => {
      logo.style.removeProperty('--rot-x');
      logo.style.removeProperty('--rot-y');
      bounds = null;
    };

    logo.addEventListener('mouseenter', handleMouseEnter);
    logo.addEventListener('mousemove', handleMouseMove);
    logo.addEventListener('mouseleave', handleMouseLeave);
  }

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
