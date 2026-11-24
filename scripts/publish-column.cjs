'use strict';
/* Maintainer-only editorial publishing. The website never calls this script. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'data','columns.json');
const categories=new Set(['경기 전망','경기 리뷰','전술 분석','선수와 구단','축구 문화']);
const object=v=>!!(v&&typeof v==='object'&&!Array.isArray(v));
function text(value,field,min,max){
 if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw Error(field+' requires '+min+' to '+max+' characters');
 return value.trim();
}
function sourceUrl(input){
 const candidate=text(input,'Source URL',12,2000);let url;
 try{url=new URL(candidate);}catch(_){throw Error('Use a valid HTTPS source URL');}
 if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw Error('Use a public HTTPS source URL');
 if(/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname))throw Error('Use a public HTTPS source URL');
 return url.href;
}
function cleanDraft(draft){
 if(!object(draft)||draft.status!=='draft')throw Error('Only status=draft can be published');
 const id=text(draft.id,'ID',3,90);
 if(!/^[a-z0-9-]{3,90}$/.test(id))throw Error('ID must use lowercase letters, digits and hyphens');
 if(!categories.has(draft.category))throw Error('Unknown editorial category');
 const title=text(draft.title,'Title',8,120);
 const subtitle=text(draft.subtitle,'Subtitle',8,240);
 const author=text(draft.author,'Author',2,40);
 if(!Array.isArray(draft.sections)||draft.sections.length<2||draft.sections.length>25)throw Error('Two to 25 substantive sections are required');
 const sections=draft.sections.map((s,i)=>{
  if(!object(s))throw Error('Invalid section '+i);
  return {heading:text(s.heading,'Section heading',3,150),body:text(s.body,'Section body',80,12000)};
 });
 if(sections.reduce((sum,s)=>sum+s.body.length,0)>40000)throw Error('Body limit exceeded');
 return {id,category:draft.category,title,subtitle,author,sections};
}
function applyApproval(archive,draft,options){
 if(!object(archive)||archive.version!==1||!Array.isArray(archive.articles))throw Error('Invalid archive');
 const article=cleanDraft(draft),reviewer=text(options&&options.reviewer,'Reviewer',2,80);
 const source=sourceUrl(options&&options.source);
 if(archive.articles.some(a=>a.id===article.id))throw Error('Article ID already exists; refusing overwrite');
 const date=new Date(options&&options.now||Date.now());
 if(!Number.isFinite(date.getTime()))throw Error('Invalid publication time');
 const published={...article,status:'published',publishedAt:date.toISOString(),reviewedBy:reviewer,sources:[{label:'원문 및 참고 자료',url:source}]};
 const articles=[published,...archive.articles];
 const samples=articles.some(a=>a.status==='sample');
 const actual=articles.some(a=>a.status==='published');
 const editorialStatus=samples&&actual?'mixed':actual?'published':'sample';
 const notice=editorialStatus==='mixed'?'검수를 거쳐 발행한 칼럼과 편집 예시가 함께 제공됩니다. 각 글의 상태를 확인하세요.':'검수를 거쳐 발행한 칼럼입니다.';
 return {...archive,editorialStatus,notice,articles};
}
function approvedDraftPath(relative){
 if(typeof relative!=='string'||!/^editorial\/drafts\/[a-z0-9][a-z0-9-]{1,89}\.json$/.test(relative))throw Error('Draft path must be editorial/drafts/<lowercase-name>.json');
 return path.resolve(root,relative);
}
function option(args,flag){
 const n=args.indexOf(flag);
 if(n<0||!args[n+1]||args[n+1].startsWith('--'))throw Error('Missing '+flag);
 return args[n+1];
}
function main(args){
 if(!args.includes('--publish'))throw Error('Explicit --publish required');
 const draftPath=approvedDraftPath(args[0]);
 const reviewer=option(args,'--reviewer'),source=option(args,'--source');
 const draft=JSON.parse(fs.readFileSync(draftPath,'utf8'));
 const archive=JSON.parse(fs.readFileSync(output,'utf8'));
 const updated=applyApproval(archive,draft,{reviewer,source});
 const temporary=output+'.tmp-'+process.pid;
 try{
  fs.writeFileSync(temporary,JSON.stringify(updated,null,2)+'\n','utf8');
  fs.renameSync(temporary,output);
 }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 process.stdout.write('Approved column published: '+draft.id+'\n');
}
if(require.main===module){
 try{main(process.argv.slice(2));}
 catch(error){process.stderr.write('Publication rejected: '+error.message+'\n');process.exitCode=1;}
}
module.exports={sourceUrl,cleanDraft,applyApproval,approvedDraftPath};
