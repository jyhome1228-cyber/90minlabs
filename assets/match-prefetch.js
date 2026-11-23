/* Prefetch match analysis data only after a deliberate hover/focus on its link. */
(function(root){
"use strict";
if(!root.NinetyMinData||navigator.connection?.saveData)return;
let started=false,job=null,hovered=null;
const files=["data/match-calendar.json","data/team-results.json","data/team-profiles.json","data/league-data.json","data/uefa-standings.json"];
function isMatchLink(target){
 const a=target?.closest?.('a[href*="match.html?id="]');
 if(!a)return null;
 try{const u=new URL(a.href,location.href);return u.origin===location.origin&&u.pathname.endsWith("/match.html")?a:null;}
 catch(e){return null;}
}
function prefetch(){
 if(started)return;started=true;
 // Prefetch never blocks navigation, and rejection leaves normal page loading in place.
 Promise.allSettled(files.map(file=>root.NinetyMinData.get(file))).catch(()=>{});
}
document.addEventListener("pointerover",event=>{
 if(event.pointerType==="touch")return;
 const a=isMatchLink(event.target);if(!a||started||a===hovered)return;
 hovered=a;clearTimeout(job);job=setTimeout(()=>{if(hovered===a)prefetch();},180);
});
document.addEventListener("pointerout",event=>{
 if(!hovered||!hovered.contains(event.target))return;
 if(event.relatedTarget&&hovered.contains(event.relatedTarget))return;
 hovered=null;clearTimeout(job);
});
document.addEventListener("focusin",event=>{if(isMatchLink(event.target))prefetch();});
})(window);
