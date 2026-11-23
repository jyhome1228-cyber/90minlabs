/* Shared KR/EN language selector and canonical club display names. Team IDs and URLs are unchanged. */
(function(){
"use strict";
const KEY="90minlabs.locale.v1";
let lang="ko";
try{lang=localStorage.getItem(KEY)==="en"?"en":"ko";}catch(e){}
const names=window.NINETYMIN_TEAM_NAMES||{};
const enToKo=Object.entries(names).filter(([key,val])=>key&&val).sort((a,b)=>b[0].length-a[0].length);
const koToEn=new Map();
for(const [en,ko] of enToKo){if(!koToEn.has(ko)||en.length<koToEn.get(ko).length)koToEn.set(ko,en);}
const koPairs=[...koToEn.entries()].sort((a,b)=>b[0].length-a[0].length);
const labels={
"칼럼 작성":"Write column","프리미어리그":"Premier League","라리가":"La Liga","세리에A":"Serie A","분데스리가":"Bundesliga","리그앙":"Ligue 1","챔피언스리그":"Champions League","유로파리그":"Europa League","컨퍼런스리그":"Conference League","경기 일정과 분석":"Matches & analysis","경기 일정과 결과":"Fixtures & results","경기 전망":"Predictions","마이페이지":"My page","주간 예측 만들기":"Weekly predictions","저장한 예측":"Saved predictions","분석 요약":"Match overview","전력 비교":"Team comparison","최근 경기":"Recent matches","맞대결":"Head to head","시즌 순위":"Standings","경기 분석":"Match analysis","경기 목록":"Match list","나의 예측":"My picks","전체 경기":"All matches","예정 경기":"Upcoming","종료 경기":"Finished","선택한 경기":"Selected","팀 이름 검색":"Search team","이번 주":"This week","이전 주":"Previous week","다음 주":"Next week","전체 대회":"All competitions","해당 대회":"This competition","최근 5경기":"Last 5 matches","최근 10경기":"Last 10 matches","경기 예정":"Scheduled","경기 종료":"Full time","예정":"Scheduled","종료":"Finished","결과 확인 중":"Awaiting result","승":"Home win","무":"Draw","패":"Away win","홈 승리":"Home win","원정 승리":"Away win","무승부":"Draw","나의 기록":"My records","로그인":"Log in","회원가입":"Sign up","로그아웃":"Log out","내 계정":"Account","비밀번호 재설정":"Reset password","이메일":"Email","비밀번호":"Password","닉네임":"Nickname","선택 마감":"Locked","적중":"Correct","미적중":"Incorrect","결과 대기":"Pending","집계 제외":"Void","다시 불러오기":"Reload","자료 확인 중":"Checking data","리그 순위":"League standings","순위":"Rank","구단":"Club","경기":"Played","득점":"Goals","실점":"Conceded","득실차":"Goal diff.","승점":"Points","칼럼":"Columns","경기 분석 보기":"View analysis","경기 분석으로 이동":"Go to analysis","승무패 기록하기":"Record prediction","예측 묶음 저장":"Save picks","변경 내용 저장":"Save changes","새 묶음":"New group","저장한 기록 보기":"View saved picks","기록 내보내기":"Export records","오늘 경기 보기":"Today's matches","오늘":"Today","이전 날":"Previous day","다음 날":"Next day","날짜 선택":"Choose date","한국시간":"KST","선수 / 소속 구단":"Player / club","경기당 승점":"Points per game","평균 득점":"Avg. scored","평균 실점":"Avg. conceded","승리 비율":"Win rate","무실점 비율":"Clean sheet rate","양 팀 득점":"Both teams scored","합산 3골 이상":"Over 2.5 goals"};
const reverse=new Map(Object.entries(labels).map(([k,v])=>[v,k]));
const tracked=new WeakMap();
function rawTeam(value){return names[value]||value;}
function team(value,preferred){if(!value)return value;const l=preferred||lang;return l==="ko"?rawTeam(value):(koToEn.get(value)||value);}
function escaped(s){return s.replace(/[.*+?^$\x7b\x7d()|[\]\\]/g,"\\$&");}
function replaceNames(text,pairs,english){
 let out=text;
 for(const [from,to] of pairs){
  if(!from||from===to)continue;
  if(english){
   const re=new RegExp("(^|[^A-Za-zÀ-ÿ])("+escaped(from)+")(?=$|[^A-Za-zÀ-ÿ])","g");
   out=out.replace(re,(match,before)=>before+to);
  }else out=out.split(from).join(to);
 }
 return out;
}
function convert(text,to){
 if(!text||!text.trim())return text;
 let value=text;
 const trimmed=value.trim();
 if(to==="en"){
  if(labels[trimmed])value=value.replace(trimmed,labels[trimmed]);
  value=replaceNames(value,koPairs,false);
 }else{
  if(reverse.has(trimmed))value=value.replace(trimmed,reverse.get(trimmed));
  value=replaceNames(value,enToKo,true);
 }
 return value;
}
let applying=false;
function translate(){
 if(applying)return;applying=true;
 try{
 document.documentElement.lang=lang;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{
  acceptNode(node){
   const parent=node.parentElement;
   if(!parent||parent.closest("script,style,textarea,code,pre,[data-no-translate],.shell-language"))return NodeFilter.FILTER_REJECT;
   return node.textContent.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }
 });
 let node;
 while((node=walker.nextNode())){
  const prior=tracked.get(node),now=node.nodeValue;
  const original=prior&&now===prior.shown?prior.original:now;
  const next=convert(original,lang);
  if(next!==now)node.nodeValue=next;
  tracked.set(node,{original,shown:next});
 }
 document.querySelectorAll("[data-lang-button]").forEach(button=>{
  const selected=button.dataset.langButton===lang;
  button.setAttribute("aria-pressed",String(selected));button.classList.toggle("is-selected",selected);
 });
 document.querySelectorAll('input[placeholder],input[aria-label]').forEach(input=>{
  for(const attr of ["placeholder","aria-label"]){
   const current=input.getAttribute(attr);if(!current)continue;
   const original=input.dataset["localeOriginal"+attr.replace(/[^a-z]/gi,"")]||current;
   input.dataset["localeOriginal"+attr.replace(/[^a-z]/gi,"")]=original;
   const value=lang==="ko"?convert(original,"ko"):convert(convert(original,"ko"),"en");
   if(value!==current)input.setAttribute(attr,value);
  }
 });
 }finally{applying=false;}
}
let scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;translate()});}
function setLanguage(next){
 if(next!=="ko"&&next!=="en")return;
 if(lang===next)return;
 lang=next;try{localStorage.setItem(KEY,next);}catch(e){}
 translate();window.dispatchEvent(new CustomEvent("ninetymin:languagechange",{detail:{language:lang}}));
}
function buttons(){
 const header=document.querySelector("[data-site-header] .shell-inner");if(!header||header.querySelector(".shell-language"))return;
 const group=document.createElement("div");group.className="shell-language";group.setAttribute("role","group");group.setAttribute("aria-label","Language / 언어");
 for(const [code,label] of [["ko","KR"],["en","EN"]]){
  const button=document.createElement("button");button.type="button";button.textContent=label;button.dataset.langButton=code;
  button.setAttribute("aria-label",code==="ko"?"한국어":"English");
  button.addEventListener("click",()=>setLanguage(code));group.append(button);
 }
 const menu=header.querySelector(".shell-menu-button");header.insertBefore(group,menu||null);
}
window.NinetyMinI18n={get language(){return lang;},team,setLanguage,translate:schedule};
const observer=new MutationObserver(schedule);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{buttons();translate();observer.observe(document.body,{childList:true,subtree:true,characterData:true});});
else{buttons();translate();observer.observe(document.body,{childList:true,subtree:true,characterData:true});}
})();
