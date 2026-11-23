(function(){
"use strict";
const root=document.getElementById("matches");
if(!root)return;
const leagueNames={epl:"프리미어리그",seriea:"세리에A",bundesliga:"분데스리가",ligue1:"리그앙",ucl:"챔피언스리그",championship:"잉글랜드 챔피언십"};
const leagueShort={epl:"EPL",seriea:"SERIE A",bundesliga:"BUNDESLIGA",ligue1:"LIGUE 1",ucl:"UCL",championship:"CHAMPIONSHIP"};
const leagueTabs=[["all","전체"],["epl","프리미어리그"],["championship","챔피언십"],["seriea","세리에A"],["bundesliga","분데스리가"],["ligue1","리그앙"],["ucl","챔피언스리그"]];
const state={league:"all",status:"all",selectedDate:null,viewMode:"day",matches:[],source:null,forms:null};
const $=id=>document.getElementById(id);
function element(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined&&value!==null)el.textContent=String(value);return el;}
function dateObj(iso){return new Date(iso+"T12:00:00Z");}
function dateISO(obj){return obj.toISOString().slice(0,10);}
function shift(iso,days){const d=dateObj(iso);d.setUTCDate(d.getUTCDate()+days);return dateISO(d);}
function weekStart(iso){const d=dateObj(iso),days=(d.getUTCDay()+6)%7;return shift(iso,-days);}
function kstToday(){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const val=(type)=>parts.find(p=>p.type===type)?.value;
 return val("year")+"-"+val("month")+"-"+val("day");
}
function kstNowClock(){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
 return parts.find(p=>p.type==="hour")?.value+":"+parts.find(p=>p.type==="minute")?.value;
}
let lastClockDay=null;
function updateCurrentTime(){
 const today=kstToday();
 const dateNode=$("matchTodayDate"),clockNode=$("matchLiveClock");
 if(dateNode)dateNode.textContent=new Intl.DateTimeFormat("ko-KR",{timeZone:"UTC",year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(dateObj(today));
 if(clockNode)clockNode.textContent="현재 "+kstNowClock()+" · 한국시간";
 if(lastClockDay&&lastClockDay!==today&&state.selectedDate===lastClockDay){state.selectedDate=today;renderList()}
 lastClockDay=today;
}
function dateLabel(iso){return new Intl.DateTimeFormat("ko-KR",{timeZone:"UTC",month:"long",day:"numeric",weekday:"long"}).format(dateObj(iso));}
function shortDate(iso){const arr=iso.split("-");return Number(arr[1])+"."+Number(arr[2]);}
function routeFor(team,lg){return "team.html?league="+encodeURIComponent(lg)+"&team="+encodeURIComponent(team);}
function badgeName(league){return leagueShort[league]||league;}
function eventStatus(m){
 if(m.status==="finished"&&Array.isArray(m.score))return "finished";
 const now=kstToday();
 if(m.date<now)return "unverified";
 if(m.date===now&&m.time&&m.time<=kstNowClock())return "unverified";
 return "scheduled";
}
function elementLogo(crestId,name){
 const wrap=element("span","initial",(name||"FC").slice(0,2).toUpperCase());
 if(!crestId)return wrap;
 const img=document.createElement("img");img.alt="";img.loading="lazy";
 img.src="https://crests.football-data.org/"+encodeURIComponent(String(crestId))+".png";
 img.addEventListener("error",()=>{img.replaceWith(wrap);},{once:true});return img;
}
function teamElement(m,isHome){
 const key=isHome?"home":"away";
 const holder=element("div","match-club "+key);
 const team=m[isHome?"homeTeam":"awayTeam"];
 const lg=m[isHome?"homeTeamLeague":"awayTeamLeague"];
 const name=m[key];
 const crest=m[isHome?"homeCrest":"awayCrest"];
 const el=element(team&&lg?"a":"div","");
 if(team&&lg)el.href=routeFor(team,lg);
 el.setAttribute("title",name);
 const title=element("span","name",team||name);
 const image=elementLogo(crest,name);
 el.append(title,image);
 if(!isHome){el.replaceChildren(image,title);}
 holder.append(el);
 return holder;
}
function getForm(team,league,date){
 if(!team||!league)return null;
 const data=state.forms?.teams?.[league+":"+team];
 if(!data?.matches)return null;
 const recent=data.matches.filter(g=>g.date<date).slice(0,5);
 if(!recent.length)return null;
 return recent.map(g=>{
  const h=g.home===data.matchName;
  const f=h?g.homeScore:g.awayScore,o=h?g.awayScore:g.homeScore;
  return f>o?"승":f===o?"무":"패";
 });
}
function detailBox(m,side){
 const box=element("div","match-detail-box");
 const team=m[side+"Team"],league=m[side+"TeamLeague"],name=team||m[side];
 box.append(element("h4","",name));
 const form=getForm(team,league,m.date);
 if(form){
  box.append(element("p","","경기 시작 전 기준 최근 리그 "+form.length+"경기"));
  const wrap=element("div","match-form");for(const f of form)wrap.append(element("span","",f));box.append(wrap);
 } else box.append(element("p","","이 구단의 최근 경기 기록은 확인되지 않았습니다."));
 const links=element("div","match-detail-links");
 if(team&&league){const a=element("a","","구단 정보 보기");a.href=routeFor(team,league);links.append(a);}
 const src=state.source?.sourceByLeague?.[m.league];
 if(src){const a=element("a","","일정 및 결과 출처");a.href=src+(m.status==="finished"?"results_2627.csv":"fixtures_2627.csv");a.target="_blank";a.rel="noopener noreferrer";links.append(a);}
 box.append(links);return box;
}
function row(m){
 const article=element("article","match-item"),line=element("div","match-line");
 const league=element("span","match-league",badgeName(m.league));
 const center=element("div","match-score-area");
 const status=eventStatus(m);
 center.append(element("strong","",status==="finished"?m.score.join(" : "):(m.time||"시간 미정")));
 center.append(element("span","",status==="finished"?"종료":status==="unverified"?"결과 확인 필요":"예정"));
 const more=element("button","match-more","상세 보기");more.type="button";more.setAttribute("aria-expanded","false");
 const details=element("div","match-details");details.hidden=true;
 more.addEventListener("click",()=>{
  const open=more.getAttribute("aria-expanded")!=="true";
  more.setAttribute("aria-expanded",String(open));more.textContent=open?"접기":"상세 보기";
  details.hidden=!open;
  if(open&&!details.hasChildNodes())details.append(detailBox(m,"home"),detailBox(m,"away"));
 });
 line.append(league,teamElement(m,true),center,teamElement(m,false),more);
 article.append(line,details);return article;
}
function renderTabs(){
 const el=$("matchLeagueFilter");el.replaceChildren();
 for(const [key,label] of leagueTabs){
  const button=element("button","match-tab"+(state.league===key?" active":""),label);
  button.type="button";button.dataset.league=key;
  button.setAttribute("aria-pressed",String(state.league===key));
  button.addEventListener("click",()=>{state.league=key;renderTabs();renderList();});
  el.append(button);
 }
}
function renderList(){
 if(!state.selectedDate)state.selectedDate=kstToday();
 const start=state.viewMode==="week"?weekStart(state.selectedDate):state.selectedDate;
 const end=state.viewMode==="week"?shift(start,6):start;
 $("matchWeekLabel").textContent=state.viewMode==="week"?shortDate(start)+" ~ "+shortDate(end):dateLabel(start);
 $("matchDateInput").value=state.selectedDate;
 $("matchViewMode").value=state.viewMode;
 $("matchPrevWeek").textContent=state.viewMode==="week"?"이전 주":"이전 날";
 $("matchNextWeek").textContent=state.viewMode==="week"?"다음 주":"다음 날";
 const filtered=state.matches.filter(m=>m.date>=start&&m.date<=end&&(state.league==="all"||m.league===state.league)&&(state.status==="all"||eventStatus(m)===state.status));
 $("matchCounter").textContent=filtered.length+"경기";
 const list=$("matchList");list.replaceChildren();
 if(!filtered.length){
  const empty=element("div","match-empty");empty.append(element("strong","","해당 기간에 등록된 경기가 없습니다."),element("p","","다른 리그를 선택하거나 이전 주와 다음 주를 확인하세요."));list.append(empty);return;
 }
 const groups=new Map();
 for(const m of filtered){const g=groups.get(m.date)||[];g.push(m);groups.set(m.date,g);}
 for(const [date,games] of groups){
  const day=element("section","match-day");
  const head=element("div","match-date-heading");head.append(element("h3","",dateLabel(date)),element("span","",games.length+"경기"));day.append(head);
  games.sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99")||a.league.localeCompare(b.league));
  for(const item of games)day.append(row(item));
  list.append(day);
 }
}
async function init(){
 const today=kstToday();
 state.selectedDate=today;
 updateCurrentTime();
 setInterval(updateCurrentTime,30000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)updateCurrentTime()});
 $("matchPrevWeek").addEventListener("click",()=>{state.selectedDate=shift(state.selectedDate,state.viewMode==="week"?-7:-1);renderList()});
 $("matchNextWeek").addEventListener("click",()=>{state.selectedDate=shift(state.selectedDate,state.viewMode==="week"?7:1);renderList()});
 $("matchGoToday").addEventListener("click",()=>{state.selectedDate=kstToday();state.viewMode="day";renderList()});
 $("matchDateInput").addEventListener("change",e=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))return;
  state.selectedDate=e.target.value;renderList();
 });
 $("matchViewMode").addEventListener("change",e=>{state.viewMode=e.target.value==="week"?"week":"day";renderList()});
 $("matchStatusFilter").addEventListener("change",e=>{state.status=e.target.value;renderList()});
 renderTabs();
 const el=$("matchList");el.replaceChildren(element("div","match-empty","경기 일정을 불러오는 중입니다."));
 try{
  const response=await fetch("./data/match-calendar.json",{cache:"no-store"});
  if(!response.ok)throw new Error("calendar HTTP "+response.status);
  const data=await response.json();
  if(!Array.isArray(data.matches))throw new Error("no fixtures");
  state.matches=data.matches;state.source=data;
  $("matchUpdated").textContent="저장된 자료 기준: "+data.capturedAtKst+" · 한국시간";
  renderList();
  fetch("./data/team-results.json",{cache:"force-cache"}).then(r=>r.ok?r.json():null).then(d=>{state.forms=d}).catch(()=>{});
 }catch(e){
  el.replaceChildren();
  const err=element("div","match-empty");err.append(element("strong","","경기 자료를 불러오지 못했습니다."),element("p","","잠시 후 새로고침해 주세요. 확인되지 않은 일정을 임의로 표시하지 않습니다."));el.append(err);
  $("matchCounter").textContent="조회 실패";
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();