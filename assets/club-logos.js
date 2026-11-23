/* 90MIN LABS: visible-only club crests, bounded fallback requests, shared session cache.
 * Direct IDs and verified sources take priority. Never guess a logo for a different club. */
(function(root){"use strict";
const verified=Object.freeze({
 "R. Racing Club":"https://assets.footylogos.com/logos/racing-santander/racing-santander-logo-footylogos.svg",
 "Racing Santander":"https://assets.footylogos.com/logos/racing-santander/racing-santander-logo-footylogos.svg",
 "Le Mans FC":"https://assets.footylogos.com/logos/le-mans-fc/le-mans-fc-logo-footylogos.svg",
 "Le Mans":"https://assets.footylogos.com/logos/le-mans-fc/le-mans-fc-logo-footylogos.svg",
 "Málaga CF":"https://assets.footylogos.com/logos/malaga-cf/malaga-cf-logo-footylogos.svg",
 "Málaga":"https://assets.footylogos.com/logos/malaga-cf/malaga-cf-logo-footylogos.svg",
 "Monza":"https://assets.footylogos.com/logos/ac-monza/ac-monza-logo-footylogos.svg",
 "AC Monza":"https://assets.footylogos.com/logos/ac-monza/ac-monza-logo-footylogos.svg",
 "Paris FC":"https://assets.footylogos.com/logos/paris-fc/paris-fc-logo-footylogos.svg"
});
const norm=s=>String(s||"").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g,"");
const safe=url=>typeof url==="string"&&/^https:\/\//i.test(url)?url:null;
const cache=new Map(),pending=new Map(),queue=[];let active=0;
const KEY="90minlabs.crest-cache.v2";
try{const raw=sessionStorage.getItem(KEY);if(raw){const x=JSON.parse(raw);if(x&&typeof x==="object")Object.entries(x).slice(0,250).forEach(([k,v])=>{if(v===null||safe(v))cache.set(k,v);});}}catch(e){}
function persist(){try{sessionStorage.setItem(KEY,JSON.stringify(Object.fromEntries(Array.from(cache.entries()).slice(-250))));}catch(e){}}
function limited(task){return new Promise(resolve=>{queue.push({task,resolve});pump()});}
function pump(){while(active<2&&queue.length){const next=queue.shift();active++;Promise.resolve().then(next.task).catch(()=>null).then(next.resolve).finally(()=>{active--;pump()});}}
async function fetchJson(url){const control=new AbortController(),timer=setTimeout(()=>control.abort(),2800);try{const r=await fetch(url,{signal:control.signal,cache:"default"});return r.ok?r.json():null;}catch(e){return null;}finally{clearTimeout(timer);}}
function lookup(opts){
 const query=opts.searchName||opts.name||"";if(!query)return Promise.resolve(null);
 const key=norm(query)||query;
 if(cache.has(key))return Promise.resolve(cache.get(key));
 if(pending.has(key))return pending.get(key);
 const work=limited(async()=>{
   const db=await fetchJson("https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t="+encodeURIComponent(query));
   const wanted=norm(query);
   const row=(db?.teams||[]).find(x=>x.strSport==="Soccer"&&safe(x.strBadge)&&(
     norm(x.strTeam)===wanted||String(x.strTeamAlternate||"").split(";").some(alias=>norm(alias)===wanted)));
   if(row)return safe(row.strBadge);
   const article=opts.wikiTitle||query;
   const api="https://en.wikipedia.org/w/api.php?";
   const data=await fetchJson(api+new URLSearchParams({action:"query",format:"json",origin:"*",redirects:"1",prop:"pageimages|images",pithumbsize:"144",imlimit:"30",titles:article}));
   const page=Object.values(data?.query?.pages||{}).find(p=>!p.missing);if(!page)return null;
   const logoName=s=>/logo|crest|badge|emblem|escudo|wappen|herb/i.test(String(s||""));
   if(logoName(page.pageimage)&&safe(page.thumbnail?.source))return page.thumbnail.source;
   const names=(page.images||[]).map(x=>x.title).filter(logoName);
   const words=[opts.name,query,article].join(" ").normalize("NFKD").toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>3&&!["football","united","club","athletic","logo"].includes(w));
   const file=names.find(name=>words.some(word=>norm(name).includes(word)));
   if(!file)return null;
   const details=await fetchJson(api+new URLSearchParams({action:"query",format:"json",origin:"*",prop:"imageinfo",iiprop:"url",iiurlwidth:"144",titles:file}));
   const item=Object.values(details?.query?.pages||{}).find(p=>p.imageinfo?.[0]);
   const image=safe(item?.imageinfo?.[0]?.thumburl||item?.imageinfo?.[0]?.url);
   return image&&/upload\.wikimedia\.org\//i.test(image)?image:null;
 });
 pending.set(key,work);
 work.then(url=>{cache.set(key,url||null);persist();pending.delete(key);});
 return work;
}
function badge(container,opts){
 if(!container)return;opts=opts||{};
 const known=[verified[opts.name]||verified[opts.searchName],opts.badgeUrl,
   opts.crestId&&/^\d+$/.test(String(opts.crestId))?"https://crests.football-data.org/"+encodeURIComponent(String(opts.crestId))+".png":null]
   .map(safe).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
 // Each node can be recreated on filtering; resolved URLs survive in the cache.
 const query=opts.searchName||opts.name||"",key=norm(query)||query;
 let started=false,step=0;
 function insert(url){
   const img=new Image();img.alt="";img.decoding="async";img.loading="eager";
   img.onload=()=>{if(container.isConnected){container.replaceChildren(img);}else{container.replaceChildren(img);}};
   img.onerror=()=>{img.remove();next()};
   img.src=url;
 }
 function next(){
   if(step<known.length){insert(known[step++]);return;}
   if(!query)return;
   lookup(opts).then(url=>{if(url)insert(url);}).catch(()=>{});
 }
 function begin(){if(started)return;started=true;delete container.dataset.crestPending;next();}
 if(typeof IntersectionObserver!=="undefined"){
   const observer=visibility;
   triggers.set(container,begin);
   container.dataset.crestPending="1";
   observer.observe(container);
 }else begin();
}
const triggers=new WeakMap();
const visibility=typeof IntersectionObserver==="undefined"?null:new IntersectionObserver(entries=>{
 for(const entry of entries){if(!entry.isIntersecting)continue;visibility.unobserve(entry.target);const go=triggers.get(entry.target);if(go)go();}
},{rootMargin:"300px 0px",threshold:0});
function release(parent){
 if(!visibility||!parent)return;
 const nodes=[parent,...parent.querySelectorAll("[data-crest-pending]")];
 for(const node of nodes){visibility.unobserve(node);triggers.delete(node);}
}
root.ClubLogos=Object.freeze({badge,release});
})(window);
