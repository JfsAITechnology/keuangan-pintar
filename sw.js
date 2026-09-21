const CACHE="keuangan-pintar-v5";
const ASSETS=["./","./index.html","./manifest.webmanifest","./assets/jfs-ai-robot.svg.png?v=2"];
const SUPABASE_HOST="evtkeyfjgqwarsmlzrkh.supabase.co";

self.addEventListener("install",e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())
));

self.addEventListener("activate",e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim())
));

self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;

  const url=new URL(e.request.url);

  // Never cache Supabase/API reads: financial data must always be fresh.
  if(url.hostname===SUPABASE_HOST) {
    e.respondWith(fetch(e.request,{cache:"no-store"}));
    return;
  }

  // Only cache this GitHub Pages origin. Leave CDN/external requests to the network.
  if(url.origin!==self.location.origin) return;

  if(e.request.mode==="navigate") {
    e.respondWith(
      fetch(e.request,{cache:"no-store"})
        .then(r=>{
          const copy=r.clone();
          caches.open(CACHE).then(c=>c.put("./index.html",copy));
          return r;
        })
        .catch(()=>caches.match("./index.html"))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{
      if(r.ok){
        const copy=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
      }
      return r;
    }))
  );
});