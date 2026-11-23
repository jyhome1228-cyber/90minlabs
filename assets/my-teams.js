/* 90MIN LABS My Team Pick — local club follows, in-page reminders and calendar export.
 * Browser notifications only operate while this page is open. No server push subscription. */
(function(root){
"use strict";
const KEY="90minlabs.myteams.v1",NOTIFY_KEY="90minlabs.myteams.notify.v1",SENT_KEY="90minlabs.myteams.sent.v1",LIMIT=18;
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
const norm=value=>String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const language=()=>root.NinetyMinI18n?.language==="en"?"en":"ko";
const words=(ko,en)=>language()==="en"?en:ko;
const kstMs=m=>{const value=Date.parse(String(m.date||"")+"T"+String(m.time||"00:00")+":00+09:00");return Number.isFinite(value)?value:NaN;};
let clubs=[],calendar=[],selected=[],dirty=false,fetching=true,notifyEnabled=false,notice="",reminderTimer=0;
const lookup=new Map();
function keyFor(match,side){
 const league=match[side+"TeamLeague"]||match.league;
 const name=match[side+"Team"]||match[side];
 return league+":"+name;
}
function parseSaved(){
 try{
  const raw=localStorage.getItem(KEY);if(!raw)return;
  const data=JSON.parse(raw);
  if(!data||data.version!==1||!Array.isArray(data.teams)||data.teams.some(v=>typeof v!=="string"||v.length>140))throw Error("Invalid saved teams");
  selected=[...new Set(data.teams)].slice(0,LIMIT);
 }catch(e){
  dirty=true;
  updateNotice("저장된 마이팀 기록을 읽을 수 없어 덮어쓰기를 막았습니다. 브라우저 저장 내용을 확인해 주세요.");
 }
 try{notifyEnabled=localStorage.getItem(NOTIFY_KEY)==="enabled";}catch(e){}
}
function updateNotice(message){
 notice=message;
 if($("myTeamStatus"))$("myTeamStatus").textContent=message;
}
function write(){
 if(dirty){updateNotice(words("다른 탭 또는 저장소 오류가 있어 변경을 저장하지 않았습니다.","Changes blocked to protect existing data."));return false;}
 try{localStorage.setItem(KEY,JSON.stringify({version:1,teams:selected}));return true;}
 catch(e){updateNotice(words("저장 공간에 기록할 수 없습니다.","Unable to save your teams locally."));return false;}
}
function displayName(key){return lookup.get(key)?.display||String(key).split(":").slice(1).join(":");}
function buildOptions(profiles,fixtures){
 const map=new Map(),profilesMap=profiles?.clubs||{};
 for(const [key,value] of Object.entries(profilesMap)){
  if(!value||!value.name)continue;
  const entry={key,display:value.wikiKo||value.name,english:value.name,league:value.league||key.split(":")[0],search:value.searchName||value.name};
  map.set(key,entry);
 }
 // Also include Championship teams and other scheduled clubs not in profile metadata.
 for(const m of fixtures){
  for(const side of ["home","away"]){
   const key=keyFor(m,side),name=m[side+"Team"]||m[side];
   if(!key||!name||map.has(key))continue;
   map.set(key,{key,display:root.NinetyMinI18n?.team?.(name)||name,english:name,league:key.split(":")[0],search:name});
  }
 }
 clubs=[...map.values()].sort((a,b)=>a.display.localeCompare(b.display,"ko"));
 lookup.clear();for(const club of clubs)lookup.set(club.key,club);
}
function teamMatches(){
 const keys=new Set(selected),names=new Set(selected.map(key=>norm(lookup.get(key)?.english||key.split(":").slice(1).join(":"))));
 const now=Date.now(),cutoff=now+45*86400000;
 return calendar.filter(m=>{
  const ms=kstMs(m);
  if(!Number.isFinite(ms)||ms<=now||ms>cutoff||["finished","postponed","cancelled","canceled"].includes(m.status))return false;
  // Exact league + canonical name first, with an exact-name cross-competition fallback.
  return ["home","away"].some(side=>keys.has(keyFor(m,side))||names.has(norm(m[side+"Team"]||m[side])));
 }).sort((a,b)=>kstMs(a)-kstMs(b)||a.league.localeCompare(b.league));
}
function refreshSelected(){
 const holder=$("myTeamSelected");if(!holder)return;
 holder.replaceChildren();
 if(!selected.length)holder.append(el("p","myteam-empty",words("등록한 팀이 없습니다. 팀 이름을 검색해 추가해 보세요.","No teams saved yet. Search to add one.")));
 else for(const key of selected){
  const club=lookup.get(key),chip=el("span","myteam-chip");
  chip.append(el("span","",club?club.display:displayName(key)));
  const button=el("button","", "×");button.type="button";button.setAttribute("aria-label",displayName(key)+" "+words("관심 해제","Remove"));
  button.addEventListener("click",()=>{
   selected=selected.filter(x=>x!==key);
   if(!write()){selected.push(key);return;}
   updateNotice(words("마이팀 목록을 저장했습니다.","Your team picks are saved in this browser."));
   refreshSelected();refreshSearch();refreshFixtures();
  });
  chip.append(button);holder.append(chip);
 }
 const counter=$("myTeamCount");if(counter)counter.textContent=selected.length+"/"+LIMIT;
}
function refreshSearch(){
 const query=norm($("myTeamSearch")?.value);
 const results=$("myTeamSearchResults");if(!results)return;
 results.replaceChildren();
 if(!query||query.length<2)return;
 const filtered=clubs.filter(team=>
  !selected.includes(team.key)&&[team.display,team.english,team.search].some(value=>norm(value).includes(query))
 ).slice(0,12);
 if(!filtered.length){results.append(el("p","myteam-empty",words("검색 결과가 없습니다.","No matching teams.")));return;}
 for(const team of filtered){
  const button=el("button","myteam-search-item");
  button.type="button";button.append(el("span","",team.display),el("small","",team.league.toUpperCase()));
  button.addEventListener("click",()=>{
   if(selected.length>=LIMIT){updateNotice(words("마이팀은 최대 "+LIMIT+"개까지 등록할 수 있습니다.","Limit "+LIMIT+" teams."));return;}
   selected.push(team.key);
   if(!write()){selected=selected.filter(x=>x!==team.key);return;}
   $("myTeamSearch").value="";
   results.replaceChildren();refreshSelected();refreshFixtures();
   updateNotice(words("마이팀을 저장했습니다. 아래에서 다음 경기를 확인하세요.","Team saved. Upcoming matches appear below."));
  });
  results.append(button);
 }
}
function fixtureId(m){return root.MatchAnalysis?.fixtureId?.(m)||m.league+"-"+m.date+"-"+m.time+"-"+m.home+"-"+m.away;}
function shortDay(m){
 return new Intl.DateTimeFormat(language()==="en"?"en-GB":"ko-KR",{timeZone:"Asia/Seoul",month:"short",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(kstMs(m)));
}
function refreshFixtures(){
 const list=$("myTeamUpcoming"),counter=$("myTeamMatchCount");if(!list)return;
 list.replaceChildren();
 if(fetching){list.append(el("p","myteam-empty",words("경기 자료를 불러오는 중입니다.","Loading fixtures...")));return;}
 const matches=teamMatches();
 if(counter)counter.textContent=matches.length+words("경기 · 45일 이내"," upcoming · next 45 days");
 if(!selected.length||!matches.length){list.append(el("p","myteam-empty",selected.length?words("앞으로 45일 이내 등록된 경기 일정이 없습니다.","No registered fixtures in the next 45 days."):words("마이팀을 등록하면 해당 팀의 다음 경기가 여기에 표시됩니다.","Follow a team to see its upcoming fixtures.")));return;}
 for(const m of matches.slice(0,9)){
  const a=el("a","myteam-fixture");a.href=root.MatchAnalysis?.matchUrl?.(m)||"index.html#matches";
  const top=el("span","myteam-fixture-date",shortDay(m)+" KST");
  const center=el("strong","",String(m.homeTeam||m.home)+"  vs  "+String(m.awayTeam||m.away));
  const bottom=el("span","myteam-fixture-league",m.league.toUpperCase());
  a.append(top,center,bottom);list.append(a);
 }
}
function icsEscape(value){return String(value||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");}
function icsStamp(milliseconds){return new Date(milliseconds).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");}
function exportCalendar(){
 const matches=teamMatches();if(!matches.length){updateNotice(words("달력에 추가할 예정 경기가 없습니다.","No upcoming matches to export."));return;}
 const rows=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//90MIN LABS//MY TEAM PICK//KO","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:90MIN LABS My Team Pick"];
 const stamp=icsStamp(Date.now());
 for(const m of matches){
  const ms=kstMs(m),id=fixtureId(m);
  rows.push("BEGIN:VEVENT","UID:"+id.replace(/[^a-zA-Z0-9._-]/g,"-")+"@90minlabs","DTSTAMP:"+stamp,
    "DTSTART:"+icsStamp(ms),"DTEND:"+icsStamp(ms+2*3600000),
    "SUMMARY:"+icsEscape((m.homeTeam||m.home)+" vs "+(m.awayTeam||m.away)),
    "DESCRIPTION:"+icsEscape("90MIN LABS · "+m.league.toUpperCase()+" · 한국시간 기준. 경기 시간이 변경될 수 있습니다."),
    "BEGIN:VALARM","TRIGGER:-PT30M","ACTION:DISPLAY","DESCRIPTION:"+icsEscape("경기 시작 30분 전"),"END:VALARM","END:VEVENT");
 }
 rows.push("END:VCALENDAR");
 const file=new Blob([rows.join("\r\n")+"\r\n"],{type:"text/calendar;charset=utf-8"});
 const url=URL.createObjectURL(file),a=el("a");a.href=url;a.download="90minlabs-myteams.ics";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 updateNotice(words("경기 알림이 포함된 달력 파일을 내보냈습니다. 캘린더 앱으로 가져와야 알림을 받을 수 있습니다.","Calendar file exported. Import it into your calendar app to activate reminders."));
}
function notifyButton(){
 const button=$("myTeamNotify");if(!button)return;
 button.textContent=notifyEnabled?words("브라우저 알림 끄기","Disable browser alerts"):words("브라우저 알림 켜기","Enable browser alerts");
}
async function toggleNotify(){
 if(notifyEnabled){
  notifyEnabled=false;try{localStorage.removeItem(NOTIFY_KEY);}catch(e){}
  notifyButton();updateNotice(words("마이팀 브라우저 알림을 껐습니다.","Browser alerts disabled."));return;
 }
 if(!("Notification" in root)||!root.isSecureContext){
  updateNotice(words("이 브라우저에서는 알림을 지원하지 않습니다. 달력 파일을 이용하세요.","Notifications are not supported. Use calendar export."));return;
 }
 const granted=Notification.permission==="granted"?"granted":await Notification.requestPermission();
 if(granted!=="granted"){updateNotice(words("알림 권한이 허용되지 않았습니다.","Notification permission was not granted."));return;}
 notifyEnabled=true;try{localStorage.setItem(NOTIFY_KEY,"enabled");}catch(e){}
 notifyButton();updateNotice(words("이 페이지가 열려 있을 때 경기 시작 30분 전 알림을 표시합니다.","Alerts show 30 minutes before kickoff while this page remains open."));
 checkReminders();
}
function checkReminders(){
 if(!notifyEnabled||Notification.permission!=="granted"||!selected.length)return;
 const now=Date.now();
 let sent={};try{sent=JSON.parse(localStorage.getItem(SENT_KEY)||"{}");}catch(e){}
 let changed=false;
 for(const m of teamMatches()){
  const kickoff=kstMs(m);if(kickoff-now>30*60000||kickoff<=now)continue;
  const id=fixtureId(m);if(sent[id])continue;
  try{
   new Notification("90MIN LABS · 곧 경기 시작",{body:(m.homeTeam||m.home)+" vs "+(m.awayTeam||m.away)+" · "+shortDay(m)+" KST",tag:"90minlabs-"+id});
   sent[id]=now;changed=true;
  }catch(e){updateNotice(words("알림을 표시하지 못했습니다. 브라우저 설정을 확인해 주세요.","Browser blocked the alert."));}
 }
 if(changed){try{localStorage.setItem(SENT_KEY,JSON.stringify(Object.fromEntries(Object.entries(sent).filter(([,t])=>now-t<14*86400000))));}catch(e){}}
}
async function start(){
 if(!$("myTeams"))return;
 parseSaved();notifyButton();
 $("myTeamSearch").addEventListener("input",refreshSearch);
 $("myTeamCalendar").addEventListener("click",exportCalendar);
 $("myTeamNotify").addEventListener("click",toggleNotify);
 $("myTeamStatus").textContent=notice||words("관심 구단은 이 브라우저에만 저장됩니다.","Team picks are stored only in this browser.");
 root.addEventListener("storage",event=>{if(event.key===KEY){dirty=true;updateNotice(words("다른 탭에서 마이팀이 변경됐습니다. 새로고침해 확인해 주세요.","Team picks changed in another tab. Reload before editing."));}});
 root.addEventListener("ninetymin:languagechange",()=>{refreshSearch();refreshSelected();refreshFixtures();notifyButton();});
 refreshSelected();refreshFixtures();
 try{
  const get=async path=>{
   if(root.NinetyMinData)return root.NinetyMinData.get(path);
   const response=await fetch("./"+path,{cache:"no-cache"});if(!response.ok)throw Error(path+" "+response.status);return response.json();
  };
  const [profile,fixtures]=await Promise.all([get("data/team-profiles.json"),get("data/match-calendar.json")]);
  if(!Array.isArray(fixtures.matches))throw Error("Invalid match calendar");
  calendar=fixtures.matches;buildOptions(profile,calendar);fetching=false;
  refreshSelected();refreshFixtures();
  reminderTimer=setInterval(checkReminders,60000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)checkReminders();});
  checkReminders();
 }catch(e){fetching=false;updateNotice(words("구단이나 경기 데이터를 불러오지 못했습니다. 새로고침해 주세요.","Could not load team fixtures. Try reloading."));refreshFixtures();}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})(window);
