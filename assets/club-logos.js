/* Shared crest loader: verified direct image -> football-data crest -> Wikipedia article image.
 * No name-only guessed image URLs; failures keep a readable text fallback. */
(function(root){
"use strict";
const verifiedCrests=Object.freeze({
 "R. Racing Club":"https://assets.footylogos.com/logos/racing-santander/racing-santander-logo-footylogos.svg",
 "Racing Santander":"https://assets.footylogos.com/logos/racing-santander/racing-santander-logo-footylogos.svg",
 "Real Racing Club":"https://assets.footylogos.com/logos/racing-santander/racing-santander-logo-footylogos.svg",
 "Le Mans FC":"https://assets.footylogos.com/logos/le-mans-fc/le-mans-fc-logo-footylogos.svg",
 "Le Mans":"https://assets.footylogos.com/logos/le-mans-fc/le-mans-fc-logo-footylogos.svg",
 "Málaga CF":"https://assets.footylogos.com/logos/malaga-cf/malaga-cf-logo-footylogos.svg",
 "Málaga":"https://assets.footylogos.com/logos/malaga-cf/malaga-cf-logo-footylogos.svg",
 "Monza":"https://assets.footylogos.com/logos/ac-monza/ac-monza-logo-footylogos.svg",
 "AC Monza":"https://assets.footylogos.com/logos/ac-monza/ac-monza-logo-footylogos.svg",
 "Paris FC":"https://assets.footylogos.com/logos/paris-fc/paris-fc-logo-footylogos.svg"
});
const cache=new Map();
function norm(s){return String(s||"").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g,"");}
function safe(url){return typeof url==="string"&&/^https:\/\//i.test(url)?url:null;}
function badge(container,opts){
 if(!container)return;
 opts=opts||{};
 const title=opts.searchName||opts.wikiTitle||opts.name||"";
 const fallback=container.textContent;
 const urls=[];
 const verified=verifiedCrests[opts.name]||verifiedCrests[opts.searchName];
 if(safe(verified))urls.push(verified);
 if(safe(opts.badgeUrl)&&opts.badgeUrl!==verified)urls.push(opts.badgeUrl);
 if(opts.crestId&&/^\d+$/.test(String(opts.crestId)))urls.push("https://crests.football-data.org/"+encodeURIComponent(String(opts.crestId))+".png");
 let index=0;let external=false;
 const insert=url=>{
   const img=document.createElement("img");
   img.alt="";img.loading="eager";img.decoding="async";
   img.style.visibility="hidden";
   img.onload=()=>{container.replaceChildren(img);img.style.visibility="visible"};
   img.onerror=()=>{img.remove();next()};
   container.append(img);
   img.src=url;
 };
 async function wiki(){
   const article=opts.wikiTitle||opts.searchName||opts.name;
   if(!article)return null;
   const key="w:"+article;
   if(!cache.has(key))cache.set(key,(async()=>{
     const base="https://en.wikipedia.org/w/api.php?";
     const query=async params=>{
       const response=await fetch(base+new URLSearchParams(Object.assign({action:"query",format:"json",origin:"*"},params)));
       if(!response.ok)throw new Error("Wikipedia image lookup failed");
       return response.json();
     };
     const info=await query({redirects:"1",prop:"pageimages|images",pithumbsize:"180",imlimit:"max",titles:article});
     const page=Object.values(info?.query?.pages||{}).find(x=>!x.missing);
     if(!page)return null;
     const looksLikeLogo=name=>/logo|crest|badge|emblem|escudo|wappen|herb/i.test(String(name||""));
     const imageName=page.pageimage||"";
     if(looksLikeLogo(imageName)&&safe(page.thumbnail?.source))return page.thumbnail.source;
     const options=(page.images||[]).map(x=>x.title).filter(looksLikeLogo);
     if(!options.length)return null;
     const tokens=[opts.name,opts.searchName,article].join(" ").normalize("NFKD").toLowerCase()
       .split(/[^a-z0-9]+/).filter(t=>t.length>3&&!["club","football","united","sporting","athletic","logo"].includes(t));
     options.sort((x,y)=>{
       const score=str=>(/logo/i.test(str)?4:0)+(/crest|badge|wappen/i.test(str)?3:0)+
         (tokens.some(t=>norm(str).includes(t))?4:0)-(/old|former|historic|2009|2010|away|shirt/i.test(str)?3:0);
       return score(y)-score(x);
     });
     const top=options[0];
     if(!tokens.some(t=>norm(top).includes(t)))return null;
     const image=await query({titles:top,prop:"imageinfo",iiprop:"url",iiurlwidth:"180"});
     const item=Object.values(image?.query?.pages||{}).find(x=>x.imageinfo?.[0]);
     const url=safe(item?.imageinfo?.[0]?.thumburl||item?.imageinfo?.[0]?.url);
     return url&&/upload\.wikimedia\.org\//i.test(url)?url:null;
   })().catch(()=>null));
   return cache.get(key);
 }
 async function sports(){
   const query=opts.searchName||opts.name;
   if(!query)return null;
   const key="sports:"+query;
   if(!cache.has(key))cache.set(key,(async()=>{
     const response=await fetch("https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t="+encodeURIComponent(query));
     if(!response.ok)return null;
     const data=await response.json(),wanted=norm(query);
     const options=(data.teams||[]).filter(x=>x.strSport==="Soccer"&&safe(x.strBadge));
     const matched=options.find(x=>norm(x.strTeam)===wanted||String(x.strTeamAlternate||"").split(";").some(a=>norm(a)===wanted));
     return matched?safe(matched.strBadge):null;
   })().catch(()=>null));
   return cache.get(key);
 }
 function next(){
   if(index<urls.length){insert(urls[index++]);return}
   if(external)return;external=true;
   sports().then(url=>url||wiki()).then(url=>{if(url)insert(url)}).catch(()=>{});
 }
 next();
}
root.ClubLogos=Object.freeze({badge});
})(window);
