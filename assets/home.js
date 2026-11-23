(function(){
"use strict";
const $=id=>document.getElementById(id);
const root=$("home");if(!root)return;
const DAY=86400000,KST=9*3600000;
const locale=()=>window.NinetyMinI18n?.language==="en"?"en":"ko";
const today=()=>new Date(Date.now()+KST).toISOString().slice(0,10);
const fullDate=iso=>new Intl.DateTimeFormat(locale()==="en"?"en-US":"ko-KR",{timeZone:"UTC",month:"long",day:"numeric",weekday:"long"}).format(new Date(iso+"T12:00:00Z"));
const labels={ko:{finished:"종료",scheduled:"예정",pending:"결과 확인 중",none:"오늘 등록된 경기가 없습니다.",review:"경기 분석",more:"전체 일정 보기",tomorrow:"다음 날짜 경기 보기",count:"경기",today:"오늘의 경기",caption:"경기 시작 시각은 한국시간 기준입니다.",empty:"선택한 날짜에 등록된 경기 일정이 없습니다."},en:{finished:"Full time",scheduled:"Scheduled",pending:"Result pending",none:"No registered matches today.",review:"Match analysis",more:"All fixtures",tomorrow:"View next day",count:"matches",today:"Today's matches",caption:"All kick-off times are shown in Korea Standard Time.",empty:"No registered matches for this date."}};
let calendar=null,error=null,currentDay=null,loading=false;
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
 window.ClubLogos?.badge(badge,{name:lookup,searchName:lookup,crestId:m[side+"Crest"]});
 piece.append(badge,el("span","daily-team-name",translated));return piece;
};
function render(){
 if(location.hash&&location.hash!=="#home"&&location.hash!=="#today")return;
 const strings=labels[locale()],date=today(),list=$("homeFixtures");if(!list)return;
 const clock=new Intl.DateTimeFormat(locale()==="en"?"en-US":"ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
 $("homeTodayDate").textContent=fullDate(date);
 $("homeCurrentTime").textContent=clock+" KST";
 $("homeFixturesTitle").textContent=strings.today;
 $("homeFixturesNote").textContent=strings.caption;
 $("homeAllMatches").textContent=strings.more;
 $("homeAllMatches").href="index.html?date="+date+"&view=day&league=all&status=all#matches";
 $("homeFixtureLink").href=$("homeAllMatches").href;
 $("homeFixturesLabel").textContent=date.replace(/-/g,".");
 if(error){list.replaceChildren(el("div","daily-empty",locale()==="en"?"Match data could not be loaded. Open fixtures to retry.":"경기 목록을 불러오지 못했습니다. 전체 일정에서 다시 확인하세요."));return;}
 if(!calendar){list.replaceChildren(el("div","daily-empty",locale()==="en"?"Loading fixtures...":"경기 일정 불러오는 중…"));return;}
 const games=calendar.filter(m=>m.date===date).slice().sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99")||a.league.localeCompare(b.league));
 $("homeMatchCount").textContent=games.length+" "+strings.count;
 window.ClubLogos?.release(list);list.replaceChildren();
 if(!games.length){
  const empty=el("div","daily-empty");empty.append(el("strong","",strings.none),el("p","",locale()==="en"?"Check tomorrow or browse all fixtures.":"다음 날 일정을 확인하거나 전체 경기를 살펴보세요."));
  const next=new Date(Date.parse(date+"T00:00:00Z")+DAY).toISOString().slice(0,10);
  const a=el("a","daily-empty-link",strings.tomorrow);a.href="index.html?date="+next+"&view=day&league=all&status=all#matches";empty.append(a);list.append(empty);return;
 }
 let currentDate=date;
 for(const m of games.slice(0,10)){
  const row=el("a","daily-row");
  row.href=window.MatchAnalysis?.matchUrl?.(m)||"index.html?date="+date+"#matches";
  const s=status(m),league=window.MatchAnalysis?.leagueLabel?.(m.league)||m.league.toUpperCase();
  const info=el("div","daily-when");info.append(el("strong","",m.time||"—"),el("span","",league));
  const matchup=el("div","daily-matchup");matchup.append(club(m,"home"),el("span","daily-versus","vs"),club(m,"away"));
  const result=el("div","daily-result");
  result.append(el("strong","",s==="finished"?m.score.join(" : "):m.time||"—"),el("span","",strings[s]));
  row.append(info,matchup,result,el("span","daily-open",strings.review));list.append(row);
 }
 if(games.length>10){const more=el("a","daily-bottom-link",locale()==="en"?"See all "+games.length+" fixtures":"오늘 "+games.length+"경기 전체 보기");more.href=$("homeAllMatches").href;list.append(more);}
}
async function load(){
 if(loading||calendar)return;loading=true;render();
 try{
  const response=await fetch("data/match-calendar.json",{cache:"no-cache"});
  if(!response.ok)throw new Error("HTTP "+response.status);
  const data=await response.json();if(!Array.isArray(data.matches))throw new Error("Invalid match calendar");
  calendar=data.matches;error=null;
 }catch(e){error=e;}
 finally{loading=false;render();}
}
function tick(){if(!root.classList.contains("hidden")){const next=today();if(currentDay!==next){currentDay=next;render();}else render();}}
window.addEventListener("hashchange",()=>{if(location.hash===""||location.hash==="#home"||location.hash==="#today"){render();load();}});
window.addEventListener("ninetymin:languagechange",render);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)tick();});
setInterval(tick,60000);
currentDay=today();render();load();
})();