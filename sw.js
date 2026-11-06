/* Fio-Mar Gestor — service worker
   Sempre busca a versão mais nova no servidor (GitHub Pages).
   Só usa a cópia guardada no celular quando estiver sem internet.
   Ao publicar uma versão nova, mude o número abaixo junto com o index.html. */
const VERSAO = '1.8.4';
const CACHE = 'fiomar-' + VERSAO;
const BASE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // a versão nova assume na hora, sem esperar fechar o app
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(BASE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); // apaga as cópias antigas
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return; // Supabase, bibliotecas e fontes vão direto para a internet
  e.respondWith((async () => {
    try {
      const res = await fetch(r, { cache: 'no-store' }); // rede primeiro, ignorando o cache do navegador
      if (res.ok) { const c = await caches.open(CACHE); c.put(r, res.clone()).catch(() => {}); }
      return res;
    } catch (err) { // sem internet: usa a cópia guardada
      const m = (await caches.match(r)) || (r.mode === 'navigate' ? (await caches.match('./index.html')) || (await caches.match('./')) : null);
      if (m) return m;
      throw err;
    }
  })());
});
