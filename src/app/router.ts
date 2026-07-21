import { useEffect, useState } from 'react';

/**
 * Roteador mínimo por hash. Hash é preferido a caminhos porque o GitHub Pages
 * não reescreve rotas, e porque nenhum dado secreto trafega pela URL.
 */
export type Route =
  | { name: 'inicio' }
  | { name: 'regras' }
  | { name: 'privacidade' }
  | { name: 'um-aparelho' }
  | { name: 'criar' }
  | { name: 'entrar'; code: string }
  | { name: 'sala'; code: string };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const [first, second] = clean.split('/');

  switch (first) {
    case 'regras':
      return { name: 'regras' };
    case 'privacidade':
      return { name: 'privacidade' };
    case 'um-aparelho':
      return { name: 'um-aparelho' };
    case 'criar':
      return { name: 'criar' };
    case 'entrar':
      return { name: 'entrar', code: (second ?? '').toUpperCase() };
    case 'sala':
      return { name: 'sala', code: (second ?? '').toUpperCase() };
    default:
      return { name: 'inicio' };
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'inicio':
      return '#/';
    case 'entrar':
      return `#/entrar/${route.code}`;
    case 'sala':
      return `#/sala/${route.code}`;
    default:
      return `#/${route.name}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = routeToHash(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return route;
}

/** URL absoluta de entrada, usada no QR Code. */
export function joinUrl(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/entrar/${code}`;
}
