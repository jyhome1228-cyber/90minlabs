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
   if(!cache.has(key))cache.set(key,fetch("https://en.wikipedia.org/w/api.php?"+new URLSearchParams({
      action:"query",format:"json",origin:"*",redirects:"1",prop:"pageimages",
      pithumbsize:"180",titles:article
    }).toString()).then(r=>r.ok?r.json():null).then(data=>{
      const page=Object.values(data?.query?.pages||{})[0];
      const url=safe(page?.thumbnail?.source);
      return url&&/upload\.wikimedia\.org\//i.test(url)?url:null;
    }).catch(()=>null));
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
