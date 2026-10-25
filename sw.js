// Fluxo de Caixa — service worker
// Para publicar uma atualização: aumentar o número da VERSAO e voltar a carregar os ficheiros.
const VERSAO = 'fluxo-caixa-v1';
const PREFIXO = 'fluxo-caixa-';           // só mexe nas caches desta app (Pedidos e Stock têm as suas)
const LOCAIS = ['./', './index.html', './firebase-config.js', './manifest.json', './icon-192.png', './icon-512.png'];
const EXTERNOS = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(async c => {
    await c.addAll(LOCAIS);
    await Promise.all(EXTERNOS.map(u => c.add(u).catch(() => {})));
  }));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith(PREFIXO) && k !== VERSAO).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // dados do Firebase nunca passam pela cache (o próprio Firestore trata do modo offline)
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('firebaseapp.com')) return;
  const local = url.origin === self.location.origin;
  if (local) {
    // ficheiros da app: rede primeiro (para apanhar atualizações), cache se estiver offline
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  } else if (EXTERNOS.includes(req.url)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => {
      const cp = n.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); return n;
    })));
  }
});
