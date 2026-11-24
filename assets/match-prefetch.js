/* 90MIN LABS: preload the selected match, not the full season data index.
 * Prefetch is opportunistic, bounded and disabled on Save-Data connections. */
(function(root){
"use strict";
if(!root.NinetyMinData||navigator.connection?.saveData)return;
const loader=root.NinetyMinData,seen=new Set();
const largeFiles=["data/match-calendar.json","data/team-results.json",
 "data/team-profiles.json","data/league-data.json","data/uefa-standings.json"];
let legacyStarted=false,hovered=null,timer=null,requested=0;
function targetLink(element){
 const a=element?.closest?.('a[href*="match.html?id="]');
 if(!a)return null;
 try{
  const u=new URL(a.href,location.href);
  return u.origin===location.origin&&u.pathname.endsWith("/match.html")?a:null;
 }catch(error){return null;}
}
async function prefetch(link){
 const u=new URL(link.href,location.href),id=u.searchParams.get("id");
 if(!id||seen.has(id)||requested>=4)return;
 seen.add(id);requested++;
 try{
  const date=id.split("~")[1];
  const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const distance=(Date.parse(date+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"))/86400000;
  if(distance>=-8&&distance<=15){
   const manifest=await loader.get("data/match-packs/manifest.json");
   const file=manifest?.version===1&&Object.hasOwn(manifest.files||{},id)&&manifest.files[id];
   if(typeof file==="string"&&/^[a-f0-9]{24}\.json$/.test(file)){
    await loader.get("data/match-packs/"+file);
    return;
   }
  }
  if(!legacyStarted){
   legacyStarted=true;
   await Promise.allSettled(largeFiles.map(p=>loader.get(p)));
  }
 }catch(error){
  // An unavailable cache never blocks clicking the real match URL.
 }
}
document.addEventListener("pointerover",event=>{
 if(event.pointerType==="touch")return;
 const link=targetLink(event.target);
 if(!link||link===hovered)return;
 hovered=link;clearTimeout(timer);
 timer=setTimeout(()=>{if(hovered===link)prefetch(link);},210);
});
document.addEventListener("pointerout",event=>{
 if(!hovered||!hovered.contains(event.target))return;
 if(event.relatedTarget&&hovered.contains(event.relatedTarget))return;
 hovered=null;clearTimeout(timer);
});
document.addEventListener("focusin",event=>{
 const link=targetLink(event.target);
 if(link)prefetch(link);
});
})(window);
