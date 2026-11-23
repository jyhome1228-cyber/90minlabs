'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('match report and three-way figures use full main width',()=>{
  const css=read('assets/match-page.css');
  assert.match(css,/\.overview-section \.compact-report\{[\s\S]*?max-width:none/);
  assert.match(css,/\.overview-section \.outcome-probabilities\{[\s\S]*?width:100%;[\s\S]*?max-width:none/);
  assert.match(css,/\.overview-section \.compact-report-copy\{[\s\S]*?max-width:none;[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:1050px\)\{[\s\S]*?\.overview-section \.compact-report-copy\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
  const page=read('match.html');
  assert.match(page,/assets\/match-page\.css\?v=20261124-reportwide1/);
  for(const name of ['reportForecast','outcomeBars','reportBody'])assert.ok(page.includes('id="'+name+'"'));
});

test('signup banner uses honest availability copy, correct link and full-bleed layout',()=>{
  const page=read('index.html');
  const css=read('assets/home.css');
  const account=read('assets/account.js');
  assert.match(page,/class="home-feature signup-feature"/);
  assert.match(page,/href="mypage\.html\?register=1#accountPanel"/);
  assert.match(page,/회원가입 기능은 준비 중입니다/);
  assert.doesNotMatch(page,/기록하고, 예측하다/);
  assert.match(css,/\.home-view \.signup-feature \.home-feature-content\{[\s\S]*?1600px/);
  assert.match(css,/@media\(max-width:650px\)\{[\s\S]*?\.home-view \.home-feature\.signup-feature/);
  assert.match(account,/params\.get\("register"\)==="1"/);
  assert.match(account,/회원가입 서비스를 준비 중입니다/);
  assert.match(page,/assets\/home\.css\?v=20261124-signup-banner/);
  const ids=[...page.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
});
