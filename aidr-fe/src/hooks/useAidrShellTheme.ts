import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { selectThemeMode } from '../store/themeSlice';
import { applyThemeToDocument } from '../utils/themeStorage';

const ADMIN_STYLES = [
  { id: 'aidr-admin-vendor', href: '/admin-theme/css/vendor.min.css' },
  { id: 'aidr-admin-icons', href: '/admin-theme/css/icons.min.css' },
  { id: 'aidr-admin-app', href: '/admin-theme/css/app.min.css' },
  { id: 'aidr-admin-brand', href: '/admin-theme/css/aidr-brand.css' },
] as const;

const STOREFRONT_HREF_MARKERS = ['/theme/css/bootstrap.min.css', '/theme/css/custom.css', 'font-awesome'];

const ADMIN_HTML_ATTRS = ['data-topbar-color', 'data-menu-color', 'data-menu-size'] as const;

function isAdminPath(pathname: string) {
  return pathname.startsWith('/admin') || pathname.startsWith('/seller');
}

function setLinkDisabled(hrefPart: string, disabled: boolean) {
  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((link) => {
    if (link.href.includes(hrefPart) || link.getAttribute('href')?.includes(hrefPart)) {
      link.disabled = disabled;
    }
  });
}

function ensureAdminStyles() {
  for (const item of ADMIN_STYLES) {
    let el = document.getElementById(item.id) as HTMLLinkElement | null;
    if (!el) {
      el = document.createElement('link');
      el.id = item.id;
      el.rel = 'stylesheet';
      el.href = item.href;
      document.head.appendChild(el);
    }
    el.disabled = false;
  }
}

function disableAdminStyles() {
  for (const item of ADMIN_STYLES) {
    const el = document.getElementById(item.id) as HTMLLinkElement | null;
    if (el) el.disabled = true;
  }
}

function ensureIconify() {
  if (document.getElementById('aidr-iconify')) return;
  const script = document.createElement('script');
  script.id = 'aidr-iconify';
  script.src = 'https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js';
  document.head.appendChild(script);
}

export function useAidrShellTheme() {
  const { pathname } = useLocation();
  const mode = useAppSelector(selectThemeMode);
  const adminUi = isAdminPath(pathname);

  useLayoutEffect(() => {
    applyThemeToDocument(mode);
    const html = document.documentElement;

    if (adminUi) {
      html.setAttribute('data-aidr-shell', 'admin');
      html.setAttribute('data-topbar-color', 'light');
      html.setAttribute('data-menu-color', 'dark');
      if (!html.getAttribute('data-menu-size') || html.getAttribute('data-menu-size') === 'hidden') {
        html.setAttribute('data-menu-size', window.innerWidth <= 1140 ? 'hidden' : 'sm-hover-active');
      }
      document.body.classList.add('admin-theme-body');
      STOREFRONT_HREF_MARKERS.forEach((marker) => setLinkDisabled(marker, true));
      ensureAdminStyles();
      ensureIconify();
    } else {
      html.setAttribute('data-aidr-shell', 'storefront');
      ADMIN_HTML_ATTRS.forEach((attr) => html.removeAttribute(attr));
      document.body.classList.remove('admin-theme-body');
      disableAdminStyles();
      STOREFRONT_HREF_MARKERS.forEach((marker) => setLinkDisabled(marker, false));
    }

    return () => {
      document.body.classList.remove('admin-theme-body');
    };
  }, [adminUi, mode]);
}
