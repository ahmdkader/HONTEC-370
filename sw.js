/* Flexo 370 v3.1.14. Keep this file alongside index.html. */
'use strict';
const CACHE_PREFIX = 'flexo370-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE_NAME = CACHE_PREFIX + 'v3.1.14';
const ROOT = new URL('./',self.location.href).href;
const INDEX = new URL('index.html',ROOT).href;
const ASSETS = ['index.html','manifest.json','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'].map(name=>new URL(name,ROOT).href);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try {await cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})));}
    catch(error){await caches.delete(CACHE_NAME);throw error;}
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    // Remove the old app's cache only when it actually contains THIS scope's index.
    if(keys.includes('cyl-calc-v1')) {
      const legacy=await caches.open('cyl-calc-v1');
      if(await legacy.match(INDEX)) {
        const entries=await legacy.keys();
        await Promise.all(entries.filter(req=>ASSETS.includes(req.url)||req.url===ROOT).map(req=>legacy.delete(req)));
        if((await legacy.keys()).length===0) await caches.delete('cyl-calc-v1');
      }
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin || !url.href.startsWith(ROOT))return;
  const isAppPage=request.mode==='navigate' && (url.pathname===new URL(ROOT).pathname || url.pathname===new URL(INDEX).pathname);
  if(isAppPage) {
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),3500);
      try {
        const response=await fetch(request,{signal:controller.signal,cache:'no-cache'});
        if(response.ok && response.headers.get('content-type')?.includes('text/html')) {
          await cache.put(INDEX,response.clone());
          return response;
        }
        return (await cache.match(INDEX)) || response;
      } catch(_) {return (await cache.match(INDEX)) || new Response('App unavailable offline. Open online once.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}
      finally {clearTimeout(timer);}
    })());
    return;
  }
  // Do not cache arbitrary same-origin pages, other apps, or third-party requests.
  const asset=ASSETS.find(a=>new URL(a).pathname===url.pathname);
  if(asset) event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME), cached=await cache.match(asset);
    return cached || fetch(request);
  })());
});