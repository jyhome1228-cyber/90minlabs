'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const pages=['index.html','match.html','leagues.html','team.html','mypage.html','column.html'];
test('Phase 4 grid override is last and exactly once on all public pages',()=>{
  for(const page of pages){
    const html=read(page);
    assert.equal((html.match(/assets\/phase4-ui\.css\?v=20261124-4/g)||[]).length,1,page);
    assert.ok(html.indexOf('phase4-ui.css')<html.indexOf('</head>'),page);
    assert.ok(html.indexOf('phase4-ui.css')>html.indexOf('site-shell.css'),page);
  }
});
test('Phase 4 supports 1600px grid, responsive gutters and minimum primary actions',()=>{
  const css=read('assets/phase4-ui.css');
  for(const term of ['--site-content-max:1600px','main.container','main.wrap','main.page-wrap','main.mypage-wrap','main.col-detail-main','.global-footer-inner','@media(max-width:900px)','@media(max-width:650px)','min-height:44px','#saveFixture','.match-item-actions','.outcome-prob-top strong'])assert.ok(css.includes(term),term);
});
