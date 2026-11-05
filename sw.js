// Service worker do Fio-Mar Gestor
// - Os dados (Supabase) SEMPRE vão pela rede, nunca ficam em cache.
// - A página principal tenta a rede primeiro (pega atualizações) e usa o cache se estiver sem internet.
// - Ícones e bibliotecas (PDF, Supabase, fontes) ficam em cache para abrir mais rápido.
// Ao publicar uma versão nova, troque o número em VERSAO.
const VERSAO = 'fiomar-v7';
const BASE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname.endsWith('supabase.co') || u.hostname.endsWith('supabase.in')) return;

  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then(res => {
        const copia = res.clone();
        caches.open(VERSAO).then(c => c.put('index.html', copia));
        return res;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(r).then(achou => {
      const rede = fetch(r).then(res => {
        if (res.status === 200 || res.type === 'opaque') {
          const copia = res.clone();
          caches.open(VERSAO).then(c => c.put(r, copia));
        }
        return res;
      }).catch(() => achou);
      return achou || rede;
    })
  );
});
