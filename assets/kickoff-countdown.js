/* Shared KST kick-off countdown. All countdown values derive from fixture date/time, never from display labels. */
(function(){
"use strict";
const selector="[data-kickoff-kst]";
const language=()=>window.NinetyMinI18n?.language==="en"?"en":"ko";
const validDateTime=(date,time)=>/^\d{4}-\d{2}-\d{2}$/.test(date||"")&&/^([01]\d|2[0-3]):[0-5]\d$/.test(time||"");
function kickoffMs(date,time){
 if(!validDateTime(date,time))return null;
 const ms=Date.parse(date+"T"+time+":00+09:00");
 return Number.isFinite(ms)?ms:null;
}
function label(ms,state,now=Date.now(),compact=false){
 const en=language()==="en";
 if(state==="finished")return en?"Full time":"종료";
 if(state==="postponed")return en?"Postponed":"연기";
 if(state==="cancelled"||state==="canceled")return en?"Cancelled":"취소";
 if(!Number.isFinite(ms))return en?"Time unconfirmed":"시간 미정";
 const remaining=ms-now;
 if(remaining<=0)return en?"Kick-off passed · Result pending":"경기 시작 · 결과 확인 중";
 const totalMinutes=Math.ceil(remaining/60000);
 const days=Math.floor(totalMinutes/1440),hours=Math.floor(totalMinutes%1440/60),mins=totalMinutes%60;
 return en?((compact?"":"Starts in ")+days+"d "+hours+"h "+mins+"m"):((compact?"":"남은 시간 ")+days+"일 "+hours+"시간 "+mins+"분");
}
function update(){
 const now=Date.now();
 document.querySelectorAll(selector).forEach(node=>{
  const value=kickoffMs(node.dataset.kickoffDate,node.dataset.kickoffTime);
  const next=label(value,node.dataset.kickoffStatus,now,node.dataset.kickoffCompact==="1");
  if(node.textContent!==next)node.textContent=next;
 });
}
function set(node,fixture,status,options){
 if(!node||!fixture)return node;
 node.dataset.kickoffKst="1";
 node.dataset.kickoffDate=fixture.date||"";
 node.dataset.kickoffTime=fixture.time||"";
 node.dataset.kickoffStatus=status||fixture.status||"scheduled";
 node.dataset.kickoffCompact=options?.compact?"1":"0";
 node.setAttribute("data-no-translate","");
 node.setAttribute("aria-live","off");
 updateNode(node);
 return node;
}
function updateNode(node){
 if(!node)return;
 node.textContent=label(kickoffMs(node.dataset.kickoffDate,node.dataset.kickoffTime),node.dataset.kickoffStatus,Date.now(),node.dataset.kickoffCompact==="1");
}
let scheduled=false;
const observer=new MutationObserver(records=>{
 if(!records.some(rec=>rec.addedNodes.length))return;
 if(scheduled)return;scheduled=true;
 queueMicrotask(()=>{scheduled=false;update()});
});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{
 observer.observe(document.body,{childList:true,subtree:true});update();
});else{observer.observe(document.body,{childList:true,subtree:true});update();}
window.addEventListener("ninetymin:languagechange",update);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)update();});
setInterval(()=>{if(!document.hidden)update();},15000);
window.NinetyMinCountdown=Object.freeze({set,update,label,kickoffMs});
})();