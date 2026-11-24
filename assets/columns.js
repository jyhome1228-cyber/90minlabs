/* 90MIN LABS / independent editorial archive and article reader. */
(function(){
"use strict";
const DATA="data/columns.json";
const byId=id=>document.getElementById(id);
const create=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=String(value);return node;};
const en=()=>window.NinetyMinI18n?.language==="en";
const t=(ko,english)=>en()?english:ko;
const categories=["전체","경기 전망","경기 리뷰","전술 분석","선수와 구단","축구 문화"];
const labels={"전체":"All","경기 전망":"Predictions","경기 리뷰":"Match review","전술 분석":"Tactics","선수와 구단":"Players & clubs","축구 문화":"Football culture"};
const safeId=id=>/^[a-z0-9-]{3,90}$/.test(id||"")?id:null;
const articleLink=a=>"column.html?id="+encodeURIComponent(a.id);
let archive=null,active="전체",term="";
function meta(a,compact=false){
 const line=create("div","col-meta");
 line.append(create("span","col-tag",en()?(labels[a.category]||a.category):a.category));
 if(a.status==="published"){
  line.append(create("span","col-published",t("발행","Published")));
  const stamp=new Date(a.publishedAt||"");
  if(Number.isFinite(stamp.getTime())){
   const date=create("time","col-date",stamp.toLocaleDateString(en()?"en-US":"ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}));
   date.setAttribute("datetime",a.publishedAt);line.append(date);
  }
 }else line.append(create("span","col-sample",t("편집 샘플","Editorial sample")));
 if(!compact)line.append(create("span","",a.author||"90MIN LABS"));
 return line;
}
function tile(a){
 const link=create("a","col-tile");link.href=articleLink(a);
 link.append(meta(a,true),create("h2","",a.title),create("p","",a.subtitle||""));
 const bottom=create("div","col-tile-bottom");
 bottom.append(create("span","",t("칼럼 읽기","Read article")));
 link.append(bottom);return link;
}
function feature(a){
 const link=create("a","col-feature");link.href=articleLink(a);
 const visual=create("div","col-feature-mark");
 visual.append(create("span","",t("90MIN LABS / EDITORIAL","90MIN LABS / EDITORIAL")),create("strong","",a.title));
 const content=create("div","col-feature-info");
 content.append(meta(a),create("h2","",a.title),create("p","",a.subtitle||""),create("span","col-read",t("칼럼 읽기","Read article")));
 link.append(visual,content);return link;
}
function filtered(){
 const list=archive?.articles||[];
 return list.filter(a=>{
   if(a.status!=="sample"&&a.status!=="published")return false;
   if(active!=="전체"&&a.category!==active)return false;
   const q=term.trim().toLocaleLowerCase();
   return !q||[a.title,a.subtitle,a.category,a.author,...(a.sections||[]).map(s=>s.heading)].join(" ").toLocaleLowerCase().includes(q);
 });
}
function filters(){
 const holder=byId("colFilters");if(!holder)return;
 holder.replaceChildren();
 for(const category of categories){
  const b=create("button","col-category",en()?labels[category]:category);
  b.type="button";b.setAttribute("aria-pressed",String(active===category));
  b.addEventListener("click",()=>{active=category;render();});
  holder.append(b);
 }
}
function render(){
 const list=byId("colList");if(!list||!archive)return;
 filters();
 list.replaceChildren();
 const rows=filtered();
 const notice=byId("colNotice");
 if(notice){
  const published=(archive.articles||[]).filter(a=>a.status==="published").length;
  const samples=(archive.articles||[]).filter(a=>a.status==="sample").length;
  notice.textContent=published&&samples?t("발행 칼럼과 편집 샘플이 함께 있습니다. 각 글의 상태를 확인해 주세요.","Published columns and editorial examples are shown together. Check each label."):published?t("검수를 거쳐 발행된 칼럼을 확인하세요.","Browse editor-approved published columns."):t("현재 등록된 글은 편집 구성 예시이며 정식 발행 기사가 아닙니다.","Current articles are examples, not published news.");
 }
 byId("colCount").textContent=t("전체 ","Total ")+rows.length+t("편"," articles");
 if(!rows.length){
  const empty=create("div","col-empty");
  empty.append(create("strong","",t("조건에 맞는 칼럼이 없습니다.","No matching columns.")),create("p","",t("다른 카테고리나 검색어를 선택하세요.","Try another category or keyword.")));
  list.append(empty);return;
 }
 const grid=create("div","col-grid");
 for(const article of rows)grid.append(tile(article));
 list.append(grid);
}
async function load(){
 const list=byId("colList");
 try{
  const data=window.NinetyMinData?await window.NinetyMinData.get(DATA):await (async()=>{const r=await fetch(DATA,{cache:"no-cache"});if(!r.ok)throw Error("HTTP "+r.status);return r.json()})();
  if(!Array.isArray(data.articles))throw new Error("Invalid columns");
  archive=data;render();
 }catch(e){
  if(list){
   const error=create("div","col-empty");
   error.append(create("strong","",t("칼럼을 불러오지 못했습니다.","Could not load columns.")));
   const retry=create("button","col-retry",t("다시 불러오기","Retry"));retry.type="button";retry.addEventListener("click",load);
   error.append(retry);list.replaceChildren(error);
  }
  if(byId("colCount"))byId("colCount").textContent=t("조회 실패","Load failed");
 }
}
function renderDetail(a){
 const target=byId("columnContent");if(!target)return;
 target.replaceChildren();
 const heading=create("header","col-detail-header");
 const name=meta(a);
 heading.append(name,create("h1","",a.title),create("p","",a.subtitle||""));
 const content=create("article","col-detail-article");
 for(const item of a.sections||[]){
  const section=create("section");
  section.append(create("h2","",item.heading),create("p","",item.body));
  content.append(section);
 }
 const foot=create("div","col-detail-foot");
 const back=create("a","",t("칼럼 목록으로","Back to columns"));back.href="index.html#columns";
 const write=create("a","",t("새 칼럼 작성","Write a column"));write.href="index.html#write";
 foot.append(back,write);
 const note=create("p","col-detail-note",a.status!=="published"?t("이 글은 사이트 구성을 위한 편집용 샘플입니다. 공식 취재 기사나 검수 완료 원고가 아닙니다.","This is an editorial sample, not a verified or published news article."):"");
 target.append(heading,content,foot);
 if(a.status==="published"&&Array.isArray(a.sources)&&a.sources.length){
  const references=create("section","col-detail-sources");
  references.append(create("h2","",t("참고 자료","References")));
  for(const entry of a.sources){
   if(!entry||typeof entry.url!=="string")continue;
   try{
    const url=new URL(entry.url);if(url.protocol!=="https:")continue;
    const link=create("a","col-source-link",entry.label||url.hostname);
    link.href=url.href;link.rel="noopener noreferrer";link.target="_blank";references.append(link);
   }catch(e){}
  }
  if(references.querySelector("a"))target.append(references);
 }
 if(note.textContent)target.append(note);
 document.title=a.title+" | 90MIN LABS";
 const robots=document.querySelector('meta[name="robots"]');
 if(robots)robots.setAttribute("content",a.status==="published"?"index,follow":"noindex,follow");
 const desc=document.querySelector('meta[name="description"]');if(desc)desc.setAttribute("content",(a.subtitle||a.title).slice(0,160));
}
async function loadDetail(){
 const id=safeId(new URLSearchParams(location.search).get("id"));
 const loading=byId("colDetailLoading"),target=byId("columnContent");
 if(!target)return;
 try{
  if(!id)throw Error("Unknown article");
  archive=window.NinetyMinData?await window.NinetyMinData.get(DATA):await (async()=>{const r=await fetch(DATA,{cache:"no-cache"});if(!r.ok)throw Error("No columns");return r.json()})();
  const a=archive?.articles?.find(article=>article.id===id&&["sample","published"].includes(article.status));
  if(!a)throw Error("Article not found");
  renderDetail(a);
  if(loading)loading.hidden=true;
 }catch(e){
  if(loading)loading.hidden=true;
  target.replaceChildren();
  target.append(create("div","col-empty",t("칼럼을 찾을 수 없습니다. 목록에서 다시 선택하세요.","Column not available. Please return to the archive.")));
 }
}
function init(){
 if(byId("colList")){
  const input=byId("colSearch");
  input?.addEventListener("input",()=>{term=input.value;render();});
  window.addEventListener("ninetymin:languagechange",render);
  load();
 }
 if(byId("columnContent")){
  window.addEventListener("ninetymin:languagechange",()=>{
    const id=safeId(new URLSearchParams(location.search).get("id"));
    const a=archive?.articles?.find(x=>x.id===id);
    if(a)renderDetail(a);
  });
  loadDetail();
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
