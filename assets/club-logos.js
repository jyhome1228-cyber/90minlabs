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
// Compact verified crest URLs are generated from already-recorded club profile sources.
// Never invent a club ID or use a fuzzy match for a crest.
const staticCrests=Object.freeze({"acmilan":"https://crests.football-data.org/98.png","arsenal":"https://crests.football-data.org/57.png","asroma":"https://crests.football-data.org/100.png","astonvilla":"https://crests.football-data.org/58.png","atalanta":"https://crests.football-data.org/102.png","athleticclub":"https://crests.football-data.org/77.png","atleticodemadrid":"https://crests.football-data.org/78.png","atleticomadrid":"https://crests.football-data.org/78.png","augsburg":"https://crests.football-data.org/16.png","barcelona":"https://crests.football-data.org/81.png","bayerleverkusen":"https://crests.football-data.org/3.png","bayernmunchen":"https://crests.football-data.org/5.png","bayernmunich":"https://crests.football-data.org/5.png","benfica":"https://assets.footylogos.com/logos/sl-benfica/sl-benfica-logo-footylogos.svg","bologna":"https://crests.football-data.org/103.png","borussiadortmund":"https://crests.football-data.org/4.png","borussiamonchengladbach":"https://crests.football-data.org/18.png","bournemouth":"https://crests.football-data.org/1044.png","brentford":"https://crests.football-data.org/402.png","brest":"https://crests.football-data.org/512.png","brighton":"https://crests.football-data.org/397.png","brightonandhovealbion":"https://crests.football-data.org/397.png","cagliari":"https://crests.football-data.org/104.png","caosasuna":"https://crests.football-data.org/79.png","celta":"https://crests.football-data.org/558.png","celtavigo":"https://crests.football-data.org/558.png","chelsea":"https://crests.football-data.org/61.png","como":"https://crests.football-data.org/7397.png","crystalpalace":"https://crests.football-data.org/354.png","deportivoalaves":"https://crests.football-data.org/263.png","eintrachtfrankfurt":"https://crests.football-data.org/19.png","elche":"https://crests.football-data.org/285.png","elchecf":"https://crests.football-data.org/285.png","espanyol":"https://crests.football-data.org/80.png","everton":"https://crests.football-data.org/62.png","fcbarcelona":"https://crests.football-data.org/81.png","fckoln":"https://crests.football-data.org/1.png","fiorentina":"https://crests.football-data.org/99.png","freiburg":"https://crests.football-data.org/17.png","fulham":"https://crests.football-data.org/63.png","genoa":"https://crests.football-data.org/107.png","getafe":"https://crests.football-data.org/82.png","getafecf":"https://crests.football-data.org/82.png","hamburg":"https://crests.football-data.org/7.png","hoffenheim":"https://crests.football-data.org/2.png","inter":"https://crests.football-data.org/108.png","intermilan":"https://crests.football-data.org/108.png","ipswichtown":"https://crests.football-data.org/349.png","juventus":"https://crests.football-data.org/109.png","koln":"https://crests.football-data.org/1.png","lazio":"https://crests.football-data.org/110.png","lecce":"https://crests.football-data.org/5890.png","leedsunited":"https://crests.football-data.org/341.png","lemans":"https://assets.footylogos.com/logos/le-mans-fc/le-mans-fc-logo-footylogos.svg","lens":"https://crests.football-data.org/546.png","levante":"https://crests.football-data.org/88.png","levanteud":"https://crests.football-data.org/88.png","lille":"https://crests.football-data.org/521.png","liverpool":"https://crests.football-data.org/64.png","lorient":"https://crests.football-data.org/525.png","lyon":"https://crests.football-data.org/523.png","mainz":"https://crests.football-data.org/15.png","mainz05":"https://crests.football-data.org/15.png","malaga":"https://assets.footylogos.com/logos/malaga-cf/malaga-cf-logo-footylogos.svg","malagacf":"https://assets.footylogos.com/logos/malaga-cf/malaga-cf-logo-footylogos.svg","manchestercity":"https://crests.football-data.org/65.png","manchesterunited":"https://crests.football-data.org/66.png","marseille":"https://crests.football-data.org/516.png","milan":"https://crests.football-data.org/98.png","monaco":"https://crests.football-data.org/548.png","monchengladbach":"https://crests.football-data.org/18.png","monza":"https://assets.footylogos.com/logos/ac-monza/ac-monza-logo-footylogos.svg","napoli":"https://crests.football-data.org/113.png","newcastle":"https://crests.football-data.org/67.png","newcastleunited":"https://crests.football-data.org/67.png","nice":"https://crests.football-data.org/522.png","nottinghamforest":"https://crests.football-data.org/351.png","osasuna":"https://crests.football-data.org/79.png","parisfc":"https://assets.footylogos.com/logos/paris-fc/paris-fc-logo-footylogos.svg","parissaintgermain":"https://crests.football-data.org/524.png","parma":"https://crests.football-data.org/112.png","racingsantander":"https://assets.footylogos.com/logos/racing-santander/racing-santander-logo-footylogos.svg","rayovallecano":"https://crests.football-data.org/87.png","rbleipzig":"https://crests.football-data.org/721.png","rcdespanyoldebarcelona":"https://crests.football-data.org/80.png","realbetis":"https://crests.football-data.org/90.png","realmadrid":"https://crests.football-data.org/86.png","realsociedad":"https://crests.football-data.org/92.png","rennes":"https://crests.football-data.org/529.png","roma":"https://crests.football-data.org/100.png","rracingclub":"https://assets.footylogos.com/logos/racing-santander/racing-santander-logo-footylogos.svg","sassuolo":"https://crests.football-data.org/471.png","schalke":"https://crests.football-data.org/6.png","sevilla":"https://crests.football-data.org/559.png","sevillafc":"https://crests.football-data.org/559.png","slbenfica":"https://assets.footylogos.com/logos/sl-benfica/sl-benfica-logo-footylogos.svg","stuttgart":"https://crests.football-data.org/10.png","sunderland":"https://crests.football-data.org/71.png","torino":"https://crests.football-data.org/586.png","tottenham":"https://crests.football-data.org/73.png","tottenhamhotspur":"https://crests.football-data.org/73.png","toulouse":"https://crests.football-data.org/511.png","udinese":"https://crests.football-data.org/115.png","unionberlin":"https://crests.football-data.org/28.png","valencia":"https://crests.football-data.org/95.png","valenciacf":"https://crests.football-data.org/95.png","villarreal":"https://crests.football-data.org/94.png","villarrealcf":"https://crests.football-data.org/94.png","werderbremen":"https://crests.football-data.org/12.png"});
const cache=new Map(),pending=new Map(),queue=[];let active=0;
const KEY="90minlabs.crest-cache.v3";
try{const raw=sessionStorage.getItem(KEY);if(raw){const x=JSON.parse(raw);if(x&&typeof x==="object")Object.entries(x).slice(0,250).forEach(([k,v])=>{if(v===null||safe(v))cache.set(k,v);});}}catch(e){}
function persist(){try{sessionStorage.setItem(KEY,JSON.stringify(Object.fromEntries(Array.from(cache.entries()).slice(-250))));}catch(e){}}
function limited(task){return new Promise(resolve=>{queue.push({task,resolve});pump()});}
function pump(){while(active<5&&queue.length){const next=queue.shift();active++;Promise.resolve().then(next.task).catch(()=>null).then(next.resolve).finally(()=>{active--;pump()});}}
async function fetchJson(url){const control=new AbortController(),timer=setTimeout(()=>control.abort(),1800);try{const r=await fetch(url,{signal:control.signal,cache:"default"});return r.ok?r.json():null;}catch(e){return null;}finally{clearTimeout(timer);}}
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
 const known=[verified[opts.name]||verified[opts.searchName],opts.badgeUrl,staticCrests[norm(opts.name)]||staticCrests[norm(opts.searchName)],
   opts.crestId&&/^\d+$/.test(String(opts.crestId))?"https://crests.football-data.org/"+encodeURIComponent(String(opts.crestId))+".png":null]
   .map(safe).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
 // Each node can be recreated on filtering; resolved URLs survive in the cache.
 const query=opts.searchName||opts.name||"",key=norm(query)||query;
 let started=false,step=0;
 function insert(url){
   const img=new Image();img.alt="";img.decoding="async";img.loading="eager";
   const rect=container.getBoundingClientRect();
   img.fetchPriority=opts.eager||(rect.bottom>=-80&&rect.top<window.innerHeight+120)?"high":"low";
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
 // The above-fold scoreboard and today's cards should not wait for an
 // IntersectionObserver paint before requesting an already verified crest.
 if(opts.eager&&known.length){begin();return;}
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
},{rootMargin:"850px 0px",threshold:0});
function release(parent){
 if(!visibility||!parent)return;
 const nodes=[parent,...parent.querySelectorAll("[data-crest-pending]")];
 for(const node of nodes){visibility.unobserve(node);triggers.delete(node);}
}
root.ClubLogos=Object.freeze({badge,release});
})(window);
