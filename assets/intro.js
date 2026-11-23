(function(){
"use strict";
const root=document.getElementById("kickoffIntro");
const page=document.documentElement;
if(!root||!page.classList.contains("intro-pending"))return;
const counter=document.getElementById("kickoffCounter");
const skip=document.getElementById("kickoffSkip");
const duration=1750,hold=160;
let frame=0,finished=false,started=0,finishTimer=0;
root.setAttribute("aria-hidden","false");
function done(){
 if(finished)return;finished=true;
 cancelAnimationFrame(frame);clearTimeout(finishTimer);
 try{sessionStorage.setItem("90minlabs.intro.played.v1","1")}catch(e){}
 root.classList.add("is-exiting");page.classList.remove("intro-pending");
 window.setTimeout(()=>{root.remove()},390);
}
function animate(time){
 if(finished)return;
 if(!started)started=time;
 const t=Math.min(1,(time-started)/duration);
 const progress=1-Math.pow(1-t,2.4);
 const minutes=Math.min(90,Math.floor(progress*90));
 const seconds=t>=1?0:Math.min(59,Math.floor((progress*90-minutes)*60));
 counter.textContent=String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");
 if(t<1)frame=requestAnimationFrame(animate);
 else{counter.textContent="90:00";finishTimer=setTimeout(done,hold);}
}
skip.addEventListener("click",done);
document.addEventListener("keydown",event=>{if(event.key==="Escape")done()},{once:true});
frame=requestAnimationFrame(animate);
})();
