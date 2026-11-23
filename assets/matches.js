(function(){
"use strict";
const root=document.getElementById("matches");
if(!root)return;
const leagueNames={epl:"프리미어리그",laliga:"라리가",seriea:"세리에A",bundesliga:"분데스리가",ligue1:"리그앙",ucl:"챔피언스리그",uel:"유로파리그",uecl:"컨퍼런스리그",championship:"잉글랜드 챔피언십"};
const leagueShort={epl:"EPL",laliga:"LA LIGA",seriea:"SERIE A",bundesliga:"BUNDESLIGA",ligue1:"LIGUE 1",ucl:"UCL",uel:"UEL",uecl:"UECL",championship:"CHAMPIONSHIP"};
const leagueTabs=[["all","전체"],["epl","프리미어리그"],["championship","챔피언십"],["laliga","라리가"],["seriea","세리에A"],["bundesliga","분데스리가"],["ligue1","리그앙"],["ucl","챔피언스리그"],["uel","유로파리그"],["uecl","컨퍼런스리그"]];
const state={league:"all",status:"all",selectedDate:null,viewMode:"day",matches:[],source:null,loading:true,error:false,predictionLeague:"all",predictionVisible:40};
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
 if(lastClockDay&&lastClockDay!==today){if(state.selectedDate===lastClockDay){state.selectedDate=today;renderList()}renderPredictions()}
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
const badgeCache=new Map();
const uclQueries={"AEK Athens":"AEK Athens","Bodø/Glimt":"Bodo Glimt","Club Brugge":"Club Brugge","Fenerbahçe":"Fenerbahce","Feyenoord":"Feyenoord","Galatasaray":"Galatasaray","LASK":"LASK Linz","PSV":"PSV Eindhoven","Porto":"FC Porto","S. Bratislava":"Slovan Bratislava","Sabah":"Sabah FC","Shakhtar":"Shakhtar Donetsk","Slavia Praha":"Slavia Prague","Sporting CP":"Sporting CP","Viking":"Viking FK"};

Object.assign(uclQueries,{"Besiktas":"Besiktas","Ferencváros":"Ferencvaros","Union SG":"Union Saint Gilloise","Levski Sofia":"Levski Sofia","N.E.C.":"NEC Nijmegen","OFI Crete":"OFI","Lech Poznan":"Lech Poznan","GNK Dinamo":"Dinamo Zagreb","H. Beer-Sheva":"Hapoel Beer Sheva","Viktoria Plzen":"Viktoria Plzen","Olympiacos":"Olympiacos","Lillestrøm":"Lillestrom SK","Ararat-Armenia":"Ararat Armenia","U. Craiova":"Universitatea Craiova","L. Red Imps":"Lincoln Red Imps","Kauno Žalgiris":"FK Kauno Zalgiris","Nordsjælland":"Nordsjaelland","Mjällby":"Mjallby","Sint-Truidense":"Sint Truiden","Inter Escaldes":"Inter Club d'Escaldes","Borac":"Borac Banja Luka","Kairat Almaty":"Kairat","Copenhagen":"FC Copenhagen","Crvena Zvezda":"Red Star Belgrade","Twente":"FC Twente","Panathinaikos":"Panathinaikos","KuPS Kuopio":"KuPS","Hajduk Split":"Hajduk Split","Lugano":"FC Lugano","Brann":"SK Brann","Riga":"Riga FC","Aarhus":"AGF Aarhus"});
function getBadge(name){
 if(!badgeCache.has(name)){
  const query=uclQueries[name]||name;
  const url="https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t="+encodeURIComponent(query);
  badgeCache.set(name,fetch(url).then(r=>r.ok?r.json():null).then(d=>{
   const names=(d?.teams||[]).filter(t=>t.strSport==="Soccer"&&t.strBadge?.startsWith("https://"));
   const normalize=t=>String(t||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g,"");
   const matched=names.find(x=>normalize(x.strTeam)===normalize(query)||normalize(x.strTeamAlternate)===normalize(query));
   return matched?.strBadge||null;
  }).catch(()=>null));
 }
 return badgeCache.get(name);
}
function elementLogo(crestId,name,lg){
 const wrap=element("span","initial",(name||"FC").replace(/[^\p{L}\p{N}]/gu,"").slice(0,2).toUpperCase()||"FC");
 if(window.ClubLogos)ClubLogos.badge(wrap,{name:name,searchName:uclQueries[name]||name,crestId:crestId});
 return wrap;
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
 const image=elementLogo(crest,name,m.league);
 el.append(title,image);
 if(!isHome){el.replaceChildren(image,title);}
 holder.append(el);
 return holder;
}
function readFilters(){
 const query=new URLSearchParams(location.search),date=query.get("date");
 const validDate=/^\d{4}-\d{2}-\d{2}$/.test(date||"")&&!Number.isNaN(dateObj(date).getTime())&&dateISO(dateObj(date))===date;
 state.selectedDate=validDate?date:kstToday();
 state.league=leagueTabs.some(([key])=>key===query.get("league"))?query.get("league"):"all";
 state.status=["all","scheduled","finished","unverified"].includes(query.get("status"))?query.get("status"):"all";
 state.viewMode=query.get("view")==="week"?"week":"day";
}
function syncFilters(){
 if(location.hash&&!["#matches","#home"].includes(location.hash))return;
 const url=new URL(location.href);
 url.searchParams.set("date",state.selectedDate);url.searchParams.set("league",state.league);
 url.searchParams.set("view",state.viewMode);url.searchParams.set("status",state.status);
 history.replaceState(null,"",url.pathname+url.search+url.hash);
}
function analysisHref(m,fromPreview){
 const query=new URLSearchParams(window.MatchAnalysis.matchUrl(m).split("?")[1]);
 query.set("backDate",fromPreview?m.date:state.selectedDate);
 query.set("backLeague",fromPreview?state.predictionLeague:state.league);
 query.set("backView",fromPreview?"day":state.viewMode);
 query.set("backStatus",fromPreview?"all":state.status);
 return "match.html?"+query.toString();
}
function row(m,fromPreview){
 const article=element("article","match-item"),line=element("div","match-line");
 const league=element("span","match-league",badgeName(m.league));
 const center=element("a","match-score-area"),href=analysisHref(m,fromPreview);
 const status=eventStatus(m);
 center.href=href;
 center.setAttribute("aria-label",(m.homeTeam||m.home)+" 대 "+(m.awayTeam||m.away)+" 경기 분석");
 center.append(element("strong","",status==="finished"?m.score.join(" : "):(m.time||"시간 미정")));
 const countdown=element("span","match-countdown",status==="finished"?"종료":status==="unverified"?"결과 확인 필요":"예정");
 if(window.NinetyMinCountdown)window.NinetyMinCountdown.set(countdown,m,status,{compact:true});
 center.append(countdown);
 const more=element("a","match-more","경기 분석");more.href=href;
 more.setAttribute("aria-label",(m.homeTeam||m.home)+" 대 "+(m.awayTeam||m.away)+" 경기 분석 보기");
 line.append(league,teamElement(m,true),center,teamElement(m,false),more);
 article.append(line);return article;
}
function renderGames(list,games,fromPreview){
 const groups=new Map();
 for(const match of games){const group=groups.get(match.date)||[];group.push(match);groups.set(match.date,group)}
 for(const [date,dayGames] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const day=element("section","match-day"),head=element("div","match-date-heading");
  head.append(element("h3","",dateLabel(date)),element("span","",dayGames.length+"경기"));day.append(head);
  dayGames.sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99")||a.league.localeCompare(b.league));
  for(const match of dayGames)day.append(row(match,fromPreview));
  list.append(day);
 }
}
function renderLoadState(list){
 if(state.loading){const box=element("div","match-empty match-loading");box.setAttribute("role","status");box.append(element("span","match-loading-spinner"),element("span","","경기 일정을 불러오는 중입니다."));list.replaceChildren(box);return true}
 if(state.error){
  const error=element("div","match-empty");
  error.append(element("strong","","경기 자료를 불러오지 못했습니다."),element("p","","네트워크 연결을 확인한 후 다시 불러와 주세요."));
  const retry=element("button","match-nav-btn","다시 불러오기");retry.type="button";retry.addEventListener("click",loadCalendar);error.append(retry);
  list.replaceChildren(error);return true;
 }
 return false;
}
function renderPredictions(){
 const list=$("predictionList");if(!list||location.hash!=="#predictions")return;
 if(renderLoadState(list))return;
 const today=kstToday(),end=shift(today,13);
 const games=state.matches.filter(m=>m.date>=today&&m.date<=end&&eventStatus(m)==="scheduled"&&(state.predictionLeague==="all"||m.league===state.predictionLeague));
 $("predictionCounter").textContent=shortDate(today)+"–"+shortDate(end)+" · "+games.length+"경기";
 list.replaceChildren();
 if(!games.length){
  const empty=element("div","match-empty");empty.append(element("strong","","이 기간에 등록된 예정 경기가 없습니다."),element("p","","다른 대회를 선택하거나 경기 일정에서 날짜를 변경해 보세요."));
  const link=element("a","match-more","경기 일정 보기");link.href="#matches";empty.append(link);list.append(empty);return;
 }
 renderGames(list,games,true);
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
 $("matchStatusFilter").value=state.status;
 syncFilters();
 $("matchPrevWeek").textContent=state.viewMode==="week"?"이전 주":"이전 날";
 $("matchNextWeek").textContent=state.viewMode==="week"?"다음 주":"다음 날";
 const list=$("matchList");if(renderLoadState(list))return;
 const filtered=state.matches.filter(m=>m.date>=start&&m.date<=end&&(state.league==="all"||m.league===state.league)&&(state.status==="all"||eventStatus(m)===state.status));
 $("matchCounter").textContent=filtered.length+"경기";
 window.ClubLogos?.release(list);list.replaceChildren();
 if(!filtered.length){
  const empty=element("div","match-empty");empty.append(element("strong","","해당 기간에 등록된 경기가 없습니다."),element("p","","다른 리그를 선택하거나 이전 주와 다음 주를 확인하세요."));list.append(empty);return;
 }
 renderGames(list,filtered,false);
}
async function init(){
 readFilters();
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
 document.querySelectorAll("#predictionFilters button").forEach(button=>button.addEventListener("click",()=>{
  state.predictionLeague=button.dataset.comp;
  document.querySelectorAll("#predictionFilters button").forEach(item=>{const active=item===button;item.classList.toggle("active",active);item.setAttribute("aria-pressed",String(active))});
  renderPredictions();
 }));
 window.addEventListener("popstate",()=>{readFilters();renderTabs();renderList()});
 window.addEventListener("hashchange",()=>{if(location.hash==="#matches")syncFilters();if(location.hash==="#predictions")renderPredictions()});
 renderTabs();await loadCalendar();
}
async function loadCalendar(){
 state.loading=true;state.error=false;renderList();renderPredictions();
 try{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  let response;
  try{response=await fetch("./data/match-calendar.json",{cache:"no-cache",signal:controller.signal})}finally{clearTimeout(timeout)}
  if(!response.ok)throw new Error("calendar HTTP "+response.status);
  const data=await response.json();
  if(!Array.isArray(data.matches))throw new Error("no fixtures");
  state.matches=data.matches;state.source=data;state.loading=false;
  const verifiedAt=data.verifiedAtKst?new Date(data.verifiedAtKst):null;
  const checkedLabel=verifiedAt&&!Number.isNaN(verifiedAt.getTime())
   ?new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(verifiedAt)
   :data.capturedAtKst;
  $("matchUpdated").textContent="경기 자료 확인: "+checkedLabel+" (한국시간)";
  renderList();renderPredictions();
 }catch(e){
  state.loading=false;state.error=true;
  $("matchCounter").textContent="조회 실패";$("predictionCounter").textContent="조회 실패";
  $("matchUpdated").textContent="자료를 다시 불러와 주세요.";
  renderList();renderPredictions();
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();