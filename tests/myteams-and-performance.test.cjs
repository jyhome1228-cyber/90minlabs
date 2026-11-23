'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
test('columns show every article in a single three-column index, without a featured banner',()=>{
 const script=read('assets/columns.js');
 const style=read('assets/columns.css');
 assert.match(script,/for\(const article of rows\)grid\.append\(tile\(article\)\)/);
 assert.doesNotMatch(script,/feature\(leading\)|list\.append\(feature/);
 assert.match(style,/\.col-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
test('match report shows only sample-qualified three-way estimates with caveat',()=>{
 const html=read('match.html'),source=read('assets/match-page.js'),analysis=read('assets/match-analysis.js');
 assert.match(html,/id="forecastReason"/);
 assert.match(html,/id="outcomeBars"/);
 assert.match(source,/model\.available\?modelPercentages\(model\):null/);
 assert.match(source,/검증된 예측 정확도나 실제 승리 확률은 아닙니다/);
 assert.match(source,/Math\.abs\(total-1\)>.01/);
 assert.match(analysis,/homeSample\.length < 5 \|\| awaySample\.length < 5 \|\| homeVenue\.length < 3 \|\| awayVenue\.length < 3/);
});
test('site reuses recent static data snapshots across navigation',()=>{
 const loader=read('assets/data-cache.js');
 assert.match(loader,/sessionStorage\.getItem/);
 assert.match(loader,/const DEFAULT_TTL=3\*60\*1000/);
 assert.match(loader,/if\(inflight\.has\(name\)\)/);
 for(const page of ['index.html','match.html','team.html','leagues.html','mypage.html','column.html']){
  assert.match(read(page),/assets\/data-cache\.js\?v=20261124-cache1/);
 }
});
test('crest resolver uses local verified URLs before external fallback queries',()=>{
 const logo=read('assets/club-logos.js');
 assert.match(logo,/staticCrests\[norm\(opts\.name\)\]/);
 assert.match(logo,/active<5/);
 assert.match(logo,/fetchPriority=/);
});
test('my team supports local follows, calendar alarm and honest notification limitations',()=>{
 const html=read('mypage.html'),js=read('assets/my-teams.js');
 for(const id of ['myTeams','myTeamSearch','myTeamSelected','myTeamCalendar','myTeamNotify','myTeamUpcoming']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(js,/localStorage\.setItem\(KEY/);
 assert.match(js,/TRIGGER:-PT30M/);
 assert.match(js,/m\.status!=="scheduled"/);
 assert.match(js,/this page remains open/);
 assert.match(html,/이 페이지가 열려 있을 때만 작동/);
});
