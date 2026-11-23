/* 90MIN LABS / local-only editorial desk, without a public publishing backend. */
(function(){
"use strict";
const KEY="90minlabs.columnDrafts.v1",LIMIT=30,MAX_BODY=40000;
const $=id=>document.getElementById(id);
const en=()=>window.NinetyMinI18n?.language==="en";
const tx=(ko,eng)=>en()?eng:ko;
const fields=["category","author","draftTitle","draftSummary","draftBody"];
const make=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=String(value);return node;};
const safeString=(value,max)=>String(value||"").slice(0,max);
let drafts=[],activeId=null,savingTimer=null,available=true,blocked=false,samples=[];
function status(message){const el=$("editorSaveStatus");if(el)el.textContent=message;}
function reading(){
 try{
  const raw=localStorage.getItem(KEY);if(!raw)return;
  const value=JSON.parse(raw);
  if(!value||value.version!==1||!Array.isArray(value.drafts))throw Error("Invalid draft storage");
  drafts=value.drafts.filter(d=>d&&typeof d.id==="string"&&typeof d.title==="string"&&typeof d.body==="string").slice(0,LIMIT);
  if(drafts.length!==value.drafts.length)throw Error("Invalid draft entries");
 }catch(e){available=false;blocked=true;status(tx("저장된 초안을 안전하게 읽을 수 없습니다. 기존 기록을 덮어쓰지 않도록 저장을 막았습니다. JSON 내보내기는 가능합니다.","Saved drafts could not be read safely. Writes are disabled to prevent data loss."));}
}
function formValue(){
 return {
  id:activeId||"draft-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
  category:safeString($("category").value,40),
  author:safeString($("author").value.trim()||"90MIN LABS 편집부",40),
  title:safeString($("draftTitle").value.trim(),120),
  summary:safeString($("draftSummary").value.trim(),240),
  body:safeString($("draftBody").value,MAX_BODY),
  updatedAt:new Date().toISOString(),
  status:"draft"
 };
}
function meaningful(d){return Boolean(d.title||d.body.trim()||d.summary)}
function showCount(){
 const body=$("draftBody").value;
 const count=$("draftWordCount");if(count)count.textContent=body.length.toLocaleString("ko-KR")+"/"+MAX_BODY.toLocaleString("ko-KR")+" "+tx("자","characters");
}
function persist(showMessage){
 if(blocked){if(showMessage)status(tx("저장소 오류가 있어 기록을 덮어쓰지 않았습니다.","Draft storage unavailable. No data overwritten."));return false;}
 const value=formValue();
 if(!meaningful(value)){if(showMessage)status(tx("제목 또는 본문을 입력해 주세요.","Enter a title or body."));return false;}
 const previous=drafts.find(d=>d.id===value.id);
 if(previous)value.createdAt=previous.createdAt||value.updatedAt;
 else value.createdAt=value.updatedAt;
 const next=[value,...drafts.filter(d=>d.id!==value.id)].slice(0,LIMIT);
 try{
  localStorage.setItem(KEY,JSON.stringify({version:1,drafts:next}));
  drafts=next;activeId=value.id;available=true;
  if(showMessage)status(tx("이 브라우저에 초안을 저장했습니다.","Draft saved in this browser."));
  else status(tx("이 브라우저에 자동 저장됨","Autosaved on this device"));
  listDrafts();return true;
 }catch(e){available=false;status(tx("브라우저에 저장할 수 없습니다. JSON 파일로 내보내 주세요.","Cannot store draft. Export JSON instead."));return false;}
}
function scheduleSave(){
 clearTimeout(savingTimer);
 if(!blocked)savingTimer=setTimeout(()=>persist(false),800);
}
function updatePreview(){
 showCount();
 const panel=$("draftPreview");if(!panel)return;
 panel.replaceChildren();
 const d=formValue();
 const heading=make("div","col-preview-card");
 heading.append(make("div","col-kicker",d.category+" · "+d.author),make("h2","",d.title||tx("제목을 입력해 주세요.","Enter an article title")),make("p","col-preview-summary",d.summary));
 const body=make("div","col-preview-body",d.body||tx("본문을 작성하면 미리보기에 표시됩니다.","Your article will appear here as you type."));
 heading.append(body);panel.append(heading);
}
function load(d){
 clearTimeout(savingTimer);activeId=d.id||null;
 $("category").value=d.category||"경기 전망";
 $("author").value=d.author||"";
 $("draftTitle").value=d.title||"";
 $("draftSummary").value=d.summary||"";
 $("draftBody").value=d.body||"";
 updatePreview();
}
function fresh(){
 clearTimeout(savingTimer);
 if(meaningful(formValue())&&!confirm(tx("현재 글에서 벗어나 새 글을 작성할까요? 저장된 초안은 유지됩니다.","Start a new draft? Saved drafts will remain.")))return;
 activeId=null;
 load({id:null,category:"경기 전망",author:"90MIN LABS 편집부",title:"",summary:"",body:""});
 status(tx("새 초안을 작성할 수 있습니다.","Ready for a new draft."));
 $("draftTitle").focus();
}
function listDrafts(){
 const target=$("editorDraftList");if(!target)return;target.replaceChildren();
 $("draftCount").textContent=drafts.length+tx("개 초안"," drafts");
 if(!drafts.length){target.append(make("p","col-draft-empty",tx("저장된 초안이 없습니다.","No saved drafts.")));return;}
 for(const draft of drafts){
  const row=make("div","col-draft-item");
  const description=make("div");
  description.append(make("h3","",draft.title||tx("제목 없음","Untitled")));
  let date="";
  try{date=new Intl.DateTimeFormat(en()?"en-US":"ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(draft.updatedAt));}catch(e){}
  description.append(make("p","",(draft.category||"")+" · "+date));
  const open=make("button","",tx("열기","Open"));open.type="button";
  open.addEventListener("click",()=>{
   if(draft.id!==activeId&&meaningful(formValue())&&!confirm(tx("다른 초안을 열까요? 저장하지 않은 변경사항은 사라질 수 있습니다.","Open another draft? Unsaved changes may be lost.")))return;
   load(draft);status(tx("저장된 초안을 불러왔습니다.","Draft loaded."));window.scrollTo({top:0,behavior:"smooth"});
  });
  const remove=make("button","",tx("삭제","Delete"));remove.type="button";
  remove.addEventListener("click",()=>{
   if(!confirm(tx("이 초안을 브라우저에서 삭제할까요?","Delete this draft from this browser?")))return;
   if(blocked){status(tx("저장소 오류로 삭제할 수 없습니다.","Storage unavailable."));return;}
   const next=drafts.filter(d=>d.id!==draft.id);
   try{localStorage.setItem(KEY,JSON.stringify({version:1,drafts:next}));drafts=next;}catch(e){status(tx("삭제를 완료하지 못했습니다.","Delete failed."));return;}
   if(activeId===draft.id)load({id:null,category:"경기 전망",author:"90MIN LABS 편집부",title:"",summary:"",body:""});
   listDrafts();status(tx("초안을 삭제했습니다.","Draft deleted."));
  });
  row.append(description,open,remove);target.append(row);
 }
}
function parts(body){
 const sections=[];let current=null;
 for(const line of body.split(/\r?\n/)){
  if(/^##\s+/.test(line)){
   current={heading:line.replace(/^##\s+/,"").trim(),body:""};sections.push(current);
  }else{
   if(!current){current={heading:"본문",body:""};sections.push(current);}
   current.body+=(current.body?"\n":"")+line;
  }
 }
 return sections.map(s=>({heading:s.heading,body:s.body.trim()})).filter(s=>s.body);
}
function download(fileName,content,type){
 const blob=new Blob([content],{type});
 const url=URL.createObjectURL(blob);
 const a=make("a");a.href=url;a.download=fileName;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportJSON(){
 const item=formValue();
 if(!item.title||!item.body.trim()){status(tx("제목과 본문을 입력해 주세요.","Enter a title and a body."));return;}
 const safeId=item.title.toLowerCase().replace(/[^a-z0-9가-힣]+/g,"-").replace(/^-|-$/g,"").slice(0,50)||"new-column";
 const article={id:"column-"+Date.now(),category:item.category,title:item.title,subtitle:item.summary,
  author:item.author,status:"draft",sections:parts(item.body)};
 download("90minlabs-"+safeId+".json",JSON.stringify(article,null,2)+"\n","application/json;charset=utf-8");
 status(tx("게시용 JSON을 내려받았습니다. 공개 반영은 별도의 검수가 필요합니다.","Draft JSON exported. Publishing requires separate review."));
}
async function loadSamples(){
 const selector=$("editorSample");if(!selector)return;
 try{
  const response=await fetch("data/columns.json",{cache:"no-cache"});if(!response.ok)throw Error("No sample data");
  const data=await response.json();samples=Array.isArray(data.articles)?data.articles:[];
  selector.replaceChildren(make("option","",tx("예시 칼럼 선택","Choose a sample")));
  selector.firstChild.value="";
  for(const d of samples){
   const option=make("option","",d.title);option.value=d.id;selector.append(option);
  }
 }catch(e){
  selector.replaceChildren(make("option","",tx("샘플을 불러올 수 없습니다.","Samples unavailable.")));
  selector.disabled=true;$("useSample").disabled=true;
 }
}
function importSample(){
 const item=samples.find(a=>a.id===$("editorSample").value);if(!item)return;
 if(meaningful(formValue())&&!confirm(tx("현재 입력 내용을 예시 칼럼으로 교체할까요?","Replace the current editor content with the sample?")))return;
 const content=item.sections.map(p=>"## "+p.heading+"\n\n"+p.body).join("\n\n");
 load({id:null,category:item.category,author:item.author,title:item.title,summary:item.subtitle,body:content});
 status(tx("예시를 복사했습니다. 직접 수정한 뒤 초안으로 저장하세요.","Sample copied into a new draft. Edit before saving."));
 $("editorSample").value="";
}
function init(){
 if(!$("draftForm"))return;
 reading();
 for(const key of fields){
  $(key)?.addEventListener("input",()=>{updatePreview();scheduleSave();});
  $(key)?.addEventListener("change",()=>{updatePreview();scheduleSave();});
 }
 $("draftForm").addEventListener("submit",e=>e.preventDefault());
 $("saveDraft").addEventListener("click",()=>{clearTimeout(savingTimer);persist(true);});
 $("newDraft").addEventListener("click",fresh);
 $("downloadJson").addEventListener("click",exportJSON);
 $("downloadText").addEventListener("click",()=>{
  const value=formValue();if(!value.title||!value.body.trim()){status(tx("제목과 본문을 입력해 주세요.","Enter a title and body."));return;}
  download("90minlabs-column-draft.md","# "+value.title+"\n\n"+value.summary+"\n\n"+value.body+"\n","text/markdown;charset=utf-8");
 });
 $("useSample").addEventListener("click",importSample);
 window.addEventListener("storage",event=>{
  if(event.key===KEY){blocked=true;status(tx("다른 창에서 초안이 변경되었습니다. 충돌 방지를 위해 저장을 중단했습니다. 페이지를 새로고침하여 최신 초안을 확인하세요.","Drafts changed in another tab. Reload to avoid overwriting them."));}
 });
 window.addEventListener("ninetymin:languagechange",()=>{updatePreview();listDrafts();});
 load({id:null,category:"경기 전망",author:"90MIN LABS 편집부",title:"",summary:"",body:""});
 listDrafts();loadSamples();
 if(!blocked)status(tx("작성 내용은 이 브라우저에만 저장되며 공개되지 않습니다.","Drafts are stored locally and are not published."));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
