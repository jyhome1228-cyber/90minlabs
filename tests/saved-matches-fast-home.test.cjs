'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
test('rolling homepage snapshot contains only a small, date-bounded subset',()=>{
 const small=JSON.parse(read('data/nearby-fixtures.json'));
 const full=JSON.parse(read('data/match-calendar.json'));
 assert.ok(small.matches.length>0&&small.matches.length<full.matches.length/2);
 assert.ok(small.matches.every(m=>m.date>=small.windowStart&&m.date<=small.windowEnd));
 assert.match(read('assets/home.js'),/data\/nearby-fixtures\.json/);
 assert.match(read('.github/workflows/daily-results.yml'),/node scripts\/build-nearby-fixtures\.cjs/);
 assert.match(read('.github/workflows/daily-results.yml'),/data\/nearby-fixtures\.json/);
});
test('homepage does not request full calendar until match list or predictions',()=>{
 const script=read('assets/matches.js');
 assert.match(script,/if\(location\.hash==="#matches"\|\|location\.hash==="#predictions"\)await ensureCalendar\(\)/);
 assert.match(script,/function ensureCalendar\(\)/);
 assert.match(read('index.html'),/assets\/match-prefetch\.js/);
});
test('fixture header appears before optional match details arrive',()=>{
 const code=read('assets/match-page.js'),html=read('match.html');
 assert.match(code,/renderFixturePreview\(fixture,calendar,id\)/);
 assert.match(code,/const supporting = Promise\.allSettled\(paths\.slice\(1\)\.map\(json\)\)/);
 assert.match(code,/await json\(paths\[0\]\)/);
 assert.match(html,/id="detailDataLoading"/);
 assert.match(html,/id="saveFixture"/);
});
function watchlist(){
 const saved=new Map(),events=[];
 const storage={getItem:k=>saved.has(k)?saved.get(k):null,setItem:(k,v)=>saved.set(k,v)};
 const root={MatchAnalysis:{fixtureId:match=>[match.league,match.date,match.time||'',match.home,match.away].join('~')},
   addEventListener:()=>{},dispatchEvent:e=>events.push(e.type)};
 const document={readyState:'loading',addEventListener:()=>{},getElementById:()=>null};
 vm.runInNewContext(read('assets/saved-matches.js'),{
   window:root,document,localStorage:storage,CustomEvent:class{constructor(type){this.type=type}}
 },{timeout:1500});
 return {api:root.NinetyMinSavedMatches,saved,events,root};
}
test('Save to My Page works without prediction or login; duplicate entries are prevented',()=>{
 const {api,events,root}=watchlist();
 const match={league:'seriea',date:'2026-11-27',time:'04:45',home:'AC Monza',away:'ACF Fiorentina'};
 const id=root.MatchAnalysis.fixtureId(match);
 assert.equal(api.add(match),true);
 assert.equal(api.add(match),false);
 assert.equal(api.has(id),true);
 assert.equal(api.list().length,1);
 assert.equal(api.remove(id),true);
 assert.equal(api.list().length,0);
 assert.equal(events.length,2);
});
test('corrupt saved lists are never silently replaced',()=>{
 const {api,saved}=watchlist();
 saved.set(api.key,'{"version":99,"items":[]}');
 const original=saved.get(api.key);
 assert.throws(()=>api.add({league:'seriea',date:'2026-11-27',time:'04:45',home:'AC Monza',away:'ACF Fiorentina'}));
 assert.equal(saved.get(api.key),original);
});
test('saved-matches archive and list buttons exist in both views',()=>{
 assert.match(read('mypage.html'),/id="savedMatchesList"/);
 assert.match(read('mypage.html'),/id="savedMatchesMore"/);
 assert.match(read('assets/matches.js'),/dataset\.saveMatchId/);
 assert.match(read('index.html'),/assets\/saved-matches\.js/);
 assert.match(read('match.html'),/assets\/saved-matches\.js/);
 assert.match(read('assets/matches.css'),/\.match-item-actions/);
});
