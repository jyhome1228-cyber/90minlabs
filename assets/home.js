(function(){
"use strict";
const $=id=>document.getElementById(id);
const root=$("home");if(!root)return;
const DAY=86400000,KST=9*3600000;
const locale=()=>window.NinetyMinI18n?.language==="en"?"en":"ko";
const today=()=>new Date(Date.now()+KST).toISOString().slice(0,10);
const fullDate=iso=>new Intl.DateTimeFormat(locale()==="en"?"en-US":"ko-KR",{timeZone:"UTC",month:"long",day:"numeric",weekday:"long"}).format(new Date(iso+"T12:00:00Z"));
const labels={ko:{finished:"종료",scheduled:"예정",pending:"결과 확인 중",none:"오늘 등록된 경기가 없습니다.",review:"경기 분석",more:"전체 일정 보기",tomorrow:"다음 날짜 경기 보기",count:"경기",today:"오늘의 경기",caption:"경기 시작 시각은 한국시간 기준입니다.",empty:"선택한 날짜에 등록된 경기 일정이 없습니다."},en:{finished:"Full time",scheduled:"Scheduled",pending:"Result pending",none:"No registered matches today.",review:"Match analysis",more:"All fixtures",tomorrow:"View next day",count:"matches",today:"Today's matches",caption:"All kick-off times are shown in Korea Standard Time.",empty:"No registered matches for this date."}};
let calendar=null,error=null,currentDay=null,loading=false,lastFetchAt=0;
const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=String(value);return n;};
const eventTime=m=>{const epoch=Date.parse(m.date+"T"+(m.time||"00:00")+":00+09:00");return Number.isFinite(epoch)?epoch:null};
const status=m=>m.status==="finished"&&Array.isArray(m.score)&&m.score.length===2?"finished":(eventTime(m)!==null&&eventTime(m)<Date.now()?"pending":"scheduled");
const club=(m,side)=>{
 const name=m[side+"Team"]||m[side];
 const lookup=m[side+"Team"]||m[side];
 const translated=window.NinetyMinI18n?.team?window.NinetyMinI18n.team(name):name;
 const piece=el("span","daily-team");
 const badge=el("span","daily-crest",(translated||"FC").replace(/[^\p{L}\p{N}]/gu,"").slice(0,2).toUpperCase());
 badge.setAttribute("aria-hidden","true");
 window.ClubLogos?.badge(badge,{name:lookup,searchName:lookup,crestId:m[side+"Crest"],eager:true});
 piece.append(badge,el("span","daily-team-name",translated));return piece;
};
function render(){
 if(location.hash&&location.hash!=="#home"&&location.hash!=="#today")return;
 const strings=labels[locale()],date=today(),list=$("homeFixtures");if(!list)return;
 const clock=new Intl.DateTimeFormat(locale()==="en"?"en-US":"ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
 $("homeTodayDate").textContent=fullDate(date);
 $("homeCurrentTime").textContent=clock+" KST";
 $("homeFixturesTitle").textContent=strings.today;
 $("homeAllMatches").textContent=strings.more;
 $("homeAllMatches").href="index.html?date="+date+"&view=day&league=all&status=all#matches";

 if(error){list.replaceChildren(el("div","daily-empty",locale()==="en"?"Match data could not be loaded. Open fixtures to retry.":"경기 목록을 불러오지 못했습니다. 전체 일정에서 다시 확인하세요."));return;}
 if(!calendar){list.replaceChildren(el("div","daily-empty",locale()==="en"?"Loading fixtures...":"경기 일정 불러오는 중…"));return;}
 const games=calendar.filter(m=>m.date===date).slice().sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99")||a.league.localeCompare(b.league));
 window.ClubLogos?.release(list);list.replaceChildren();
 if(!games.length){
  const empty=el("div","daily-empty");empty.append(el("strong","",strings.none),el("p","",locale()==="en"?"Check tomorrow or browse all fixtures.":"다음 날 일정을 확인하거나 전체 경기를 살펴보세요."));
  const next=new Date(Date.parse(date+"T00:00:00Z")+DAY).toISOString().slice(0,10);
  const anchor=el("a","daily-empty-link",strings.tomorrow);anchor.href="index.html?date="+next+"&view=day&league=all&status=all#matches";empty.append(anchor);list.append(empty);return;
 }
 for(const m of games.slice(0,12)){
  const state=status(m),row=el("a","daily-card");
  row.href=window.MatchAnalysis?.matchUrl?.(m)||"index.html?date="+date+"#matches";
  const lg=window.MatchAnalysis?.leagueLabel?.(m.league)||m.league.toUpperCase();
  const meta=el("div","daily-card-meta");
  meta.append(el("span","daily-card-league",lg),el("span","daily-card-time",(m.time||"—")+" · KST"));
  const clubs=el("div","daily-card-clubs");
  clubs.append(club(m,"home"),club(m,"away"));
  const bottom=el("div","daily-card-bottom"),result=el("div","daily-card-result");
  const subtitle=el("span","daily-countdown",strings[state]);
  if(window.NinetyMinCountdown)window.NinetyMinCountdown.set(subtitle,m,state,{compact:true});
  result.append(el("strong","",state==="finished"?m.score.join(" : "):m.time||"—"),subtitle);
  bottom.append(result,el("span","daily-card-action",locale()==="en"?"Analysis":"경기 분석"));
  row.append(meta,clubs,bottom);list.append(row);
 }
 if(games.length>12){
   const more=el("a","daily-bottom-link",locale()==="en"?"See all "+games.length+" fixtures":"오늘 "+games.length+"경기 전체 보기");
   more.href=$("homeAllMatches").href;list.append(more);
 }
}
async function load(force=false){
 if(loading||(!force&&calendar))return;
 loading=true;if(!calendar)render();
 try{
  const get=async name=>window.NinetyMinData
   ?window.NinetyMinData.get(name,{force})
   :(async()=>{const r=await fetch(name,{cache:"no-cache"});if(!r.ok)throw Error("HTTP "+r.status);return r.json()})();
  let data;
  try {
   data=await get("data/nearby-fixtures.json");
   // A missed scheduled workflow must not make the homepage silently go empty.
   if(!Array.isArray(data.matches)||data.windowStart>today()||data.windowEnd<today())throw Error("Nearby snapshot expired");
  }catch(e){data=await get("data/match-calendar.json");}
  if(!Array.isArray(data.matches))throw new Error("Invalid match calendar");
  calendar=data.matches;error=null;lastFetchAt=Date.now();
 }catch(e){if(!calendar)error=e;}
 finally{loading=false;render();}
}
function tick(){
 if(root.classList.contains("hidden"))return;
 const next=today();
 if(currentDay!==next){currentDay=next;render();}
 else $("homeCurrentTime").textContent=new Intl.DateTimeFormat(locale()==="en"?"en-US":"ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date())+" KST";
 if(Date.now()-lastFetchAt>15*60*1000&&!loading)load(true);
}
window.addEventListener("hashchange",()=>{if(location.hash===""||location.hash==="#home"||location.hash==="#today"){render();load();}});
window.addEventListener("ninetymin:languagechange",render);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)tick();});
setInterval(tick,60000);
currentDay=today();render();load();
})();