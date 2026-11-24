'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const pages=['index.html','match.html','leagues.html','team.html','mypage.html','column.html'];
test('site header and footer maintain canonical menu, account links and language switcher',()=>{
  for(const page of pages){
    const html=read(page);
    assert.deepEqual([...html.matchAll(/data-nav-key="([^"]+)"/g)].map(m=>m[1]),
      ['predictions','matches','leagues','columns'],page+' navigation');
    assert.match(html,/class="shell-utility"[^>]*aria-label="계정 메뉴"/,page+' account menu');
    assert.match(html,/href="mypage\.html\?login=1#accountPanel"/,page+' login link');
    assert.match(html,/data-footer-language/,page+' footer language control');
    assert.doesNotMatch(html,/class="shell-language"/,page+' old header switch');
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(new Set(ids).size,ids.length,page+' duplicated IDs');
  }
});
test('all pages load matching shared styles and language behavior',()=>{
  for(const page of pages){
    const html=read(page);
    // Cache-busting versions are deliberately free to change without breaking QA.
    // What matters is that each shared asset is linked exactly once.
    for (const asset of ['site-shell.css','site-shell.js','site-language.js']) {
      const matches = html.match(new RegExp('assets/' + asset.replace('.', '\\.') + '\\?v=[A-Za-z0-9._-]+', 'g')) || [];
      assert.equal(matches.length, 1, page + ' shared asset ' + asset);
    }
  }
  const language=read('assets/site-language.js');
  assert.match(language,/global-footer \[data-footer-language\]/);
  assert.doesNotMatch(language,/nav\.querySelector\("\.shell-language"\)/);
});
test('result styling and comparative rules correctly separate directional metrics',()=>{
  const style=read('assets/match-page.css');
  const code=read('assets/match-page.js');
  assert.match(style,/\.form-chip\.W\{background:var\(--result-win\)/);
  assert.match(style,/\.form-chip\.L\{background:var\(--result-loss\)/);
  assert.match(style,/\.form-chip\.D\{background:var\(--result-draw-tint\)/);
  assert.match(code,/\["gaAvg", "평균 실점", null, decimal, "lower"\]/);
  assert.match(code,/\["bttsRate", "양 팀 득점", 1, percent, null\]/);
  assert.match(code,/\["over25Rate", "합산 3골 이상", 1, percent, null\]/);
  assert.match(code,/venue-form-breakdown/);
});
