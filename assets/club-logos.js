/* Shared crest loader: verified direct image -> football-data crest -> Wikipedia article image.
 * No name-only guessed image URLs; failures keep a readable text fallback. */
(function(root){
"use strict";
const cache=new Map();
function norm(s){return String(s||"").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g,"");}
function safe(url){return typeof url==="string"&&/^https:\/\//i.test(url)?url:null;}
function badge(container,opts){
 if(!container)return;
 opts=opts||{};
 const title=opts.searchName||opts.wikiTitle||opts.name||"";
 const fallback=container.textContent;
 const urls=[];
 if(safe(opts.badgeUrl))urls.push(opts.badgeUrl);
 if(opts.crestId&&/^\d+$/.test(String(opts.crestId)))urls.push("https://crests.football-data.org/"+encodeURIComponent(String(opts.crestId))+".png");
 let index=0;let external=false;
 const insert=url=>{
   if(!container.isConnected)return;
   const img=document.createElement("img");
   img.alt="";img.loading="lazy";img.decoding="async";
   img.onload=()=>{if(container.isConnected)container.replaceChildren(img)};
   img.onerror=()=>{if(img.parentNode)img.remove();next()};
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
 function next(){
   if(index<urls.length){insert(urls[index++]);return}
   if(external)return;external=true;
   wiki().then(url=>{if(url&&container.isConnected)insert(url)});
 }
 next();
}
root.ClubLogos=Object.freeze({badge});
})(window);
