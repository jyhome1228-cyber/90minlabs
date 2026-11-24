'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=pathName=>fs.readFileSync(path.join(root,pathName),'utf8');
const pages=['index.html','match.html','leagues.html','team.html','mypage.html','column.html'];
test('the header renders only Login in a signed-out session on all pages',()=>{
 for(const page of pages){
  const html=read(page);
  const wrappers=[...html.matchAll(/<div class="shell-(?:mobile-)?utility" aria-label="계정 메뉴">([\s\S]*?)<\/div>/g)];
  assert.equal(wrappers.length,2,page);
  for(const match of wrappers){
   const block=match[1];
   assert.match(block,/data-utility-key="login" href="mypage.html\?login=1#accountPanel"/);
   assert.match(block,/data-utility-key="mypage" href="mypage.html" hidden/);
   assert.match(block,/data-utility-key="logout" type="button" hidden/);
  }
  assert.match(html,/site-shell\.js\?v=[A-Za-z0-9._-]+/);
  assert.match(html,/site-shell\.css\?v=[A-Za-z0-9._-]+/);
 }
});
function exercise(authenticated){
 const source=read('assets/site-shell.js');
 const expression=source.match(/  function renderAccount\(\) \{([\s\S]*?)\n  \}\n\n  function feedback/);
 assert.ok(expression,'renderAccount must remain testable');
 const nodes=['login','mypage','logout'].map(key=>{
  const attr=new Map(),classNames=new Set();
  return {dataset:{utilityKey:key},hidden:null,disabled:null,classNames,attrs:attr,
   classList:{toggle:(cls,on)=>on?classNames.add(cls):classNames.delete(cls)},
   setAttribute:(k,v)=>attr.set(k,v),removeAttribute:k=>attr.delete(k)};
 });
 const header={dataset:{}},location={pathname:'/90minlabs/mypage.html',search:'?login=1'};
 new Function('accountNodes','header','location','authenticated','signOutBusy','URLSearchParams',
   'function renderAccount(){'+expression[1]+'}\nrenderAccount();')(nodes,header,location,authenticated,false,class TestURLSearchParams {get(key){return key==='login'?'1':null;}});
 return {nodes,state:header.dataset.authState};
}
test('Firebase-authenticated state, not local storage, controls visible account actions',()=>{
 const visitor=exercise(false);
 assert.deepEqual(visitor.nodes.map(n=>n.hidden),[false,true,true]);
 assert.equal(visitor.state,'signed-out');
 const member=exercise(true);
 assert.deepEqual(member.nodes.map(n=>n.hidden),[true,false,false]);
 assert.equal(member.state,'signed-in');
});
test('logout is an actual Firebase signOut operation and may protect unsaved predictions',()=>{
 const script=read('assets/site-shell.js'),style=read('assets/site-shell.css');
 assert.match(script,/authSdk\.onAuthStateChanged\(firebaseAuth/);
 assert.match(script,/await firebaseSignOut\(firebaseAuth\)/);
 assert.match(script,/NinetyMinPage\?\.isDirty\?\.\(\)/);
 assert.doesNotMatch(script,/localStorage\.(?:getItem|setItem)\([^)]*(?:auth|login|signedIn)/i);
 assert.match(style,/\[data-utility-key\]\[hidden\]\{[\s\S]*?display:none!important/);
 assert.match(style,/\[data-utility-key="login"\]/);
 assert.match(style,/\[data-utility-key="logout"\]:hover/);
});
