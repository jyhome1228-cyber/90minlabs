/* 90MIN LABS — saved match watchlist. Browser-local, no account or prediction required. */
(function(root){
"use strict";
const KEY="90minlabs.savedMatches.v1",MAX=80,VERSION=1;
const $=id=>document.getElementById(id);
const node=(tag,cls,value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=String(value);return el;};
const lang=()=>root.NinetyMinI18n?.language==="en"?"en":"ko";
const tr=(ko,en)=>lang()==="en"?en:ko;
let current=null,calendar=null,error="",limit=9,initialized=false;
function validString(value,max){return typeof value==="string"&&value.length>0&&value.length<=max&&!/[\r\n\x00-\x1f]/.test(value)}
function ident(fixture){
 if(!fixture||!validString(fixture.league,40)||!/^\d{4}-\d{2}-\d{2}$/.test(String(fixture.date||"")))throw Error("경기 정보가 올바르지 않습니다.");
 const id=root.MatchAnalysis?.fixtureId?.(fixture);
 if(!validString(id,650))throw Error("경기 ID를 확인할 수 없습니다.");
 return id;
}
function snapshot(fixture){
 const id=ident(fixture);
 const out={id,league:fixture.league,date:fixture.date,time:String(fixture.time||""),home:String(fixture.home||""),away:String(fixture.away||""),
 homeTeam:String(fixture.homeTeam||fixture.home||""),awayTeam:String(fixture.awayTeam||fixture.away||""),
 savedAt:new Date().toISOString()};
 if(!validString(out.home,100)||!validString(out.away,100))throw Error("구단 정보가 부족합니다.");
 return out;
}
function read(){
 let raw;
 try{raw=localStorage.getItem(KEY)}catch(e){throw Error("브라우저 저장소에 접근할 수 없습니다.");}
 if(!raw)return [];
 try{
  const data=JSON.parse(raw);
  if(!data||data.version!==VERSION||!Array.isArray(data.items)||data.items.length>MAX||
    data.items.some(item=>!item||!validString(item.id,650)||!validString(item.home,100)||!validString(item.away,100)||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(item.date||""))||!validString(item.league,40))||
    new Set(data.items.map(item=>item.id)).size!==data.items.length)throw Error("Invalid saved items");
  return data.items;
 }catch(e){throw Error("저장한 경기 기록을 읽을 수 없습니다. 기존 데이터를 보호하기 위해 덮어쓰지 않았습니다.");}
}
function list(){return read().map(item=>({...item}));}
function persist(items){
 try{localStorage.setItem(KEY,JSON.stringify({version:VERSION,items}));}
 catch(e){throw Error("경기를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.");}
 root.dispatchEvent(new CustomEvent("ninetymin:savedmatcheschange"));
}
function has(id){return list().some(item=>item.id===id);}
function add(fixture){
 const item=snapshot(fixture),items=read();
 if(items.some(entry=>entry.id===item.id))return false;
 if(items.length>=MAX)throw Error("담을 수 있는 경기는 최대 "+MAX+"개입니다.");
 persist([item,...items]);return true;
}
function remove(id){
 const items=read(),next=items.filter(item=>item.id!==id);
 if(next.length===items.length)return false;
 persist(next);return true;
}
function detailStatus(message){
 const target=$("saveFixtureStatus");if(target)target.textContent=message;
}
function updateButton(){
 const button=$("saveFixture"),link=$("viewSavedFixtures");if(!button)return;
 if(!current){button.disabled=true;button.textContent=tr("경기 확인 중","Loading match");return;}
 try{
  const saved=has(ident(current));button.disabled=false;button.setAttribute("aria-pressed",String(saved));
  button.textContent=saved?tr("담기 완료","Saved to My Page"):tr("마이페이지에 경기 담기","Save match to My Page");
  if(link)link.hidden=!saved;
 }catch(e){button.disabled=true;button.textContent=tr("저장 불가","Storage unavailable");detailStatus(e.message);}
}
function bindFixture(fixture){
 current=fixture;updateButton();
}
function onSave(){
 if(!current)return;
 try{
  const id=ident(current);
  if(has(id)){remove(id);detailStatus(tr("담은 경기에서 제외했습니다.","Match removed from saved list."));}
  else{add(current);detailStatus(tr("마이페이지에 담았습니다. 승·무·패 선택은 별도로 기록할 수 있습니다.","Saved to My Page. Predictions can be made separately."));}
  updateButton();
 }catch(e){detailStatus(e.message);}
}
function shownDate(f){
 const date=Date.parse(f.date+"T"+(f.time||"00:00")+":00+09:00");
 return Number.isFinite(date)?new Intl.DateTimeFormat(lang()==="en"?"en-GB":"ko-KR",
 {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(date))+" KST":f.date;
}
function render(){
 const holder=$("savedMatchesList"),count=$("savedMatchesCount"),expand=$("savedMatchesMore");
 if(!holder)return;
 holder.replaceChildren();let items;
 try{items=list();error="";}catch(e){error=e.message;holder.append(node("p","saved-match-error",error));if(expand)expand.hidden=true;return;}
 if(count)count.textContent=items.length+tr("경기"," matches");
 if(!items.length){holder.append(node("p","saved-match-empty",tr("아직 담은 경기가 없습니다. 경기 상세에서 '마이페이지에 경기 담기'를 선택해 보세요.","No saved matches yet. Open a match and choose Save to My Page.")));if(expand)expand.hidden=true;return;}
 const map=new Map((calendar?.matches||[]).map(f=>[root.MatchAnalysis.fixtureId(f),f]));
 const entries=items.map(item=>{
  const found=map.get(item.id),f=found||item;
  const when=Date.parse(item.date+"T"+(item.time||"00:00")+":00+09:00");
  const upcoming=found?found.status==="scheduled"&&when>Date.now():when>Date.now();
  return {item,fixture:f,known:!!found,upcoming,when:Number.isFinite(when)?when:0};
 }).sort((a,b)=>Number(b.upcoming)-Number(a.upcoming)||(a.upcoming?a.when-b.when:b.when-a.when));
 for(const {item,fixture,known,upcoming} of entries.slice(0,limit)){
  const card=node("article","saved-match-card");
  const top=node("div","saved-match-top");
  top.append(node("span","",shownDate(fixture)),node("span","saved-match-league",String(fixture.league||"").toUpperCase()));
  const title=node("a","saved-match-title",(fixture.homeTeam||fixture.home)+"  vs  "+(fixture.awayTeam||fixture.away));
  title.href="match.html?id="+encodeURIComponent(item.id);
  const state=node("p","saved-match-state",!known&&calendar?tr("일정 재확인 필요","Fixture not found in latest data"):
   fixture.status==="finished"&&Array.isArray(fixture.score)?fixture.score.join(" : ")+tr(" · 경기 종료"," · Final"):
   upcoming?tr("예정 경기","Upcoming"):fixture.status==="postponed"?tr("경기 연기","Postponed"):
   fixture.status==="cancelled"?tr("경기 취소","Cancelled"):tr("결과 확인 필요","Result pending"));
  const actions=node("div","saved-match-actions");
  const open=node("a","",tr("경기 분석","Analysis"));open.href=title.href;
  actions.append(open);
  if(upcoming&&known){
   const pick=node("a","",tr("승·무·패 선택","Make a pick"));
   pick.href="mypage.html?match="+encodeURIComponent(item.id)+"#predictionBuilder";
   actions.append(pick);
  }
  const removeButton=node("button","",tr("제외","Remove"));
  removeButton.type="button";removeButton.setAttribute("aria-label",tr("담은 경기 제거: ","Remove match: ")+(fixture.homeTeam||fixture.home)+" vs "+(fixture.awayTeam||fixture.away));
  removeButton.addEventListener("click",()=>{try{remove(item.id);render()}catch(e){const note=$("savedMatchesStatus");if(note)note.textContent=e.message;}});
  actions.append(removeButton);
  card.append(top,title,state,actions);holder.append(card);
 }
 if(expand){expand.hidden=entries.length<=limit;expand.textContent=tr("더 보기","See more")+" ("+(entries.length-limit)+")";}
}
async function enhance(){
 if(!$("savedMatchesList"))return;
 try{
  const value=root.NinetyMinData?await root.NinetyMinData.get("data/match-calendar.json"):
    await fetch("./data/match-calendar.json",{cache:"no-cache"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()});
  if(Array.isArray(value.matches)){calendar=value;render();}
 }catch(e){const status=$("savedMatchesStatus");if(status)status.textContent=tr("저장된 경기 정보로 표시 중입니다. 최신 일정은 경기 목록에서 확인하세요.","Showing saved details; check fixtures for updates.");}
}
function init(){
 if(initialized)return;initialized=true;
 const button=$("saveFixture");if(button)button.addEventListener("click",onSave);
 const more=$("savedMatchesMore");if(more)more.addEventListener("click",()=>{limit+=9;render();});
 if($("savedMatchesList")){render();enhance();}
 root.addEventListener("ninetymin:savedmatcheschange",()=>{updateButton();render();});
 root.addEventListener("storage",event=>{if(event.key===KEY){updateButton();render();}});
 root.addEventListener("ninetymin:languagechange",()=>{updateButton();render();});
}
root.NinetyMinSavedMatches=Object.freeze({key:KEY,list,has,add,remove,bindFixture});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})(window);
