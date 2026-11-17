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
  // Logotipo institucional: tamaño mostrado y derivados 2x sin cambiar la relación de aspecto.
  const BRAND_LOGO = {
    width: 78,
    height: 34,
    sources: [
      { type: 'image/avif', srcset: '/assets/unicartagena@2x.avif' },
      { type: 'image/webp', srcset: '/assets/unicartagena@2x.webp' }
    ]
  };
  function isInstitutionalLogo(url) {
    return typeof url === 'string' && /\/media\/branding\/unicartagena\.png(?:[?#]|$)/.test(url);
  }
  function createBrandLogo(url, alt) {
    const institutional = isInstitutionalLogo(url);
    const width = institutional ? BRAND_LOGO.width : 34;
    const height = institutional ? BRAND_LOGO.height : 34;
    const image = document.createElement('img');
    image.className = 'organization-brand-logo';
    image.src = url;
    image.alt = alt;
    image.width = width;
    image.height = height;
    image.loading = 'eager';
    image.decoding = 'async';
    image.style.cssText = 'width:' + width + 'px;height:' + height +
      'px;object-fit:contain;margin-right:9px;vertical-align:middle;border-radius:6px;background:#fff;padding:2px';
    if (!institutional) return image;
    // El PNG original se conserva como fallback; los derivados ligeros solo aplican a este logotipo.
    const picture = document.createElement('picture');
    BRAND_LOGO.sources.forEach(source => {
      const element = document.createElement('source');
      element.type = source.type;
      element.srcset = source.srcset;
      picture.appendChild(element);
    });
    picture.appendChild(image);
    return picture;
  }
  // En login se conserva el tema que el HTML aplicó antes de cargar los estilos.
  // En el resto del sitio, si no hay preferencia guardada, se respeta el sistema.
  applyTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : (isLogin ? root.dataset.theme : systemTheme));
  async function applyOrganizationBranding() {
    if (isLogin) return;
    try {
      const response = await fetch('/api/organization/branding', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      const branding = payload?.data?.branding;
      if (!branding) return;
      const primary = /^#[0-9a-f]{6}$/i.test(branding.primaryColor || '') ? branding.primaryColor : '#6d4bd1';
      const secondary = /^#[0-9a-f]{6}$/i.test(branding.secondaryColor || '') ? branding.secondaryColor : '#8b75dc';
      const accent = /^#[0-9a-f]{6}$/i.test(branding.accentColor || '') ? branding.accentColor : '#26a69a';
      root.style.setProperty('--primario', primary);
      root.style.setProperty('--primario-oscuro', secondary);
      root.style.setProperty('--primario-tenue', 'color-mix(in srgb, ' + primary + ' 12%, transparent)');
      root.style.setProperty('--primario-borde', 'color-mix(in srgb, ' + primary + ' 34%, transparent)');
      root.style.setProperty('--acento', accent);
      root.style.setProperty('--primario-oscuro', secondary);
      root.dataset.organizationBranding = branding.organization || 'active';
      const brandLink = document.querySelector('.header-container .logo');
      if (brandLink && branding.logoUrl) {
        const logo = createBrandLogo(branding.logoUrl, branding.displayName || 'Logotipo institucional');
        const image = logo.tagName === 'PICTURE' ? logo.querySelector('img') : logo;
        image.onerror = () => logo.remove();
        const label = document.createElement('span');
        label.textContent = branding.displayName || brandLink.textContent.trim() || 'TaskFlow';
        brandLink.replaceChildren(logo, label);
        brandLink.style.display = 'inline-flex';
        brandLink.style.alignItems = 'center';
      }
    } catch (_) {
      // La identidad institucional no debe impedir que cargue el resto de la aplicación.
    }
  }
  applyOrganizationBranding();

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