(function () {
  'use strict';
  const KEY = 'taskflow-theme';
  const root = document.documentElement;
  function readTheme() {
    try { return localStorage.getItem(KEY); } catch (_) { return null; }
  }
  function applyTheme(theme) {
    const selected = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = selected;
    const button = document.getElementById('theme-toggle');
    if (button) {
      const dark = selected === 'dark';
      button.textContent = dark ? '☀️ Modo claro' : '🌙 Modo oscuro';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    }
  }
  const path = window.location.pathname;
  const isLogin = /(?:^|\/)login\.html$/.test(path);
  const urlTheme = new URLSearchParams(window.location.search).get('theme');
  const savedTheme = urlTheme === 'dark' || urlTheme === 'light' ? urlTheme : readTheme();
  const systemTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  // En login se conserva el tema que el HTML aplicó antes de cargar los estilos.
  // En el resto del sitio, si no hay preferencia guardada, se respeta el sistema.
  applyTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : (isLogin ? root.dataset.theme : systemTheme));
  function init() {
    const header = document.querySelector('.header-container');
    if (!header || isLogin || document.getElementById('theme-toggle')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'theme-toggle';
    button.className = 'theme-toggle';
    button.addEventListener('click', function () {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (_) {}
      applyTheme(next);
    });
    const nav = header.querySelector('.nav-main');
    if (nav) {
      const actions = nav.querySelector('.nav-acciones');
      if (actions) actions.insertBefore(button, actions.firstChild);
      else nav.appendChild(button);
    } else header.appendChild(button);
    applyTheme(root.dataset.theme);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();