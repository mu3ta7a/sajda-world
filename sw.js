const C='sw-v4';
let MK=null;
const MEM=new Map();
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./icon-192.png','./face.webp'])).catch(()=>{}))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{const d=e.data||{};
  if(d.type==='mk'&&typeof d.k==='string'&&/^[0-9a-fA-F]{64}$/.test(d.k)){MK=d.k;try{e.source&&e.source.postMessage({type:'mk-ok'})}catch(_){}}});

function hex2b(h){const a=new Uint8Array(h.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(h.substr(i*2,2),16);return a}
function ctype(n){const s=(n.split('.').pop()||'').toLowerCase();
  return s==='mp4'?'video/mp4':s==='mp3'?'audio/mpeg':s==='gif'?'image/gif':s==='png'?'image/png':
  s==='webp'?'image/webp':s==='avif'?'image/avif':s==='m4a'?'audio/mp4':'image/jpeg'}

async function decryptRoute(req,u){
  const name=decodeURIComponent(u.pathname.split('/mm/')[1]||'');
  const fb=u.searchParams.get('fb');
  try{
    if(!MK) throw new Error('nokey');
    let buf=MEM.get(name);
    if(!buf){
      const res=await fetch('/m/'+encodeURIComponent(name)+'.enc.enc',{cache:'force-cache'});
      if(!res.ok) throw new Error('fetch '+res.status);
      const raw=await res.arrayBuffer();
      const key=await crypto.subtle.importKey('raw',hex2b(MK),{name:'AES-GCM'},false,['decrypt']);
      buf=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(raw,0,12)},key,new Uint8Array(raw,12));
      if(buf.byteLength<4194304) MEM.set(name,buf);
    }
    const type=ctype(name), total=buf.byteLength, range=req.headers.get('range');
    if(range){
      const m=/bytes=(\d*)-(\d*)/.exec(range)||[];
      let start=m[1]?parseInt(m[1],10):0, end=m[2]?parseInt(m[2],10):total-1;
      if(start>=total){return new Response('',{status:416,headers:{'Content-Range':'bytes */'+total}})}
      end=Math.min(end,total-1);
      const chunk=buf.slice(start,end+1);
      return new Response(chunk,{status:206,headers:{'Content-Type':type,'Content-Range':'bytes '+start+'-'+end+'/'+total,'Accept-Ranges':'bytes','Content-Length':String(chunk.byteLength)}});
    }
    return new Response(buf,{status:200,headers:{'Content-Type':type,'Accept-Ranges':'bytes','Content-Length':String(total),'Cache-Control':'private, max-age=86400'}});
  }catch(err){
    if(fb){try{const r2=await fetch(fb);if(r2.ok)return r2}catch(_){}}
    return new Response('',{status:404});
  }
}

self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
 if(u.pathname.includes('/mm/')){e.respondWith(decryptRoute(r,u));return}
 if(u.pathname.includes('/m/')&&u.pathname.endsWith('.enc.enc')){e.respondWith(fetch(r));return}
 e.respondWith(fetch(r).then(x=>{const cp=x.clone();caches.open(C).then(c=>c.put(r,cp));return x}).catch(()=>caches.match(r).then(m=>m||caches.match('./'))))});
self.addEventListener('push',e=>{e.waitUntil((async()=>{let t='';try{const r=await (await caches.open('sg-meta')).match('who');if(r)t=await r.text()}catch(_){}await self.registration.showNotification(t||"Sagda's WORLD",{icon:'icon-192.png',badge:'icon-192.png',tag:'chat',renotify:true})})())});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window'}).then(l=>l.length?l[0].focus():clients.openWindow('./')))});
