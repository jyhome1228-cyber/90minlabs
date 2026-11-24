'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {checkHealth}=require('../scripts/check-results-health.cjs');
const now=Date.parse('2026-11-25T10:20:00+09:00');
const template={league:'epl',date:'2026-11-25',time:'20:00',home:'Arsenal',away:'Chelsea',status:'scheduled'};
const calendar=()=>({matches:[template,...Array.from({length:2000},(_,i)=>({
  league:'epl',date:'2027-04-01',time:'20:00',
  home:'Future Club '+i,away:'Visitor '+i,status:'scheduled'
}))]});
const nearby=()=>({windowStart:'2026-11-21',windowEnd:'2026-12-24',matches:[{...template}]});
const status=()=>({lastCheckedAtKst:'2026-11-25T09:15:00+09:00',
  completedUpdated:0,providerFiles:9,existingScoreConflicts:[]});
const evaluate=(s=status(),c=calendar(),n=nearby())=>checkHealth({status:s,calendar:c,nearby:n,nowMs:now});
test('a zero-new-results sync is healthy if the scheduled check ran today',()=>{
 const r=evaluate();
 assert.equal(r.ok,true);
 assert.equal(r.addedFinals,0);
 assert.equal(r.checkedDay,'2026-11-25');
});
test('a missing daily check is an operational failure',()=>{
 const r=evaluate({...status(),lastCheckedAtKst:'2026-11-24T09:15:00+09:00'});
 assert.equal(r.ok,false);assert.match(r.errors.join(' '),/완료되지 않았습니다/);
});
test('an updated lightweight snapshot must mirror the authoritative calendar',()=>{
 const n=nearby();n.matches[0]={...template,status:'finished',score:[3,0]};
 const r=evaluate(status(),calendar(),n);
 assert.equal(r.ok,false);assert.match(r.errors.join(' '),/불일치/);
});
test('a match without a verified final six hours after kickoff is flagged, not guessed',()=>{
 const c=calendar();
 c.matches[0]={...template,date:'2026-11-24',time:'23:00'};
 const n=nearby();n.matches[0]={...c.matches[0]};
 const r=evaluate(status(),c,n);
 assert.equal(r.ok,false);assert.equal(r.pendingPastFixtures,1);
});
test('a previously confirmed score conflict blocks a green health report',()=>{
 const r=evaluate({...status(),existingScoreConflicts:[{match:'x'}]});
 assert.equal(r.ok,false);assert.match(r.errors.join(' '),/충돌/);
});

test('stale match-level snapshots are a health error even if fixtures are valid',()=>{
 const goodPack={version:1,windowStart:'2026-11-20',windowEnd:'2026-12-08',
   sourceVerifiedAtKst:'2026-11-25T09:00:00+09:00',
   files:Object.fromEntries(Array.from({length:15},(_,i)=>['fixture-'+i,'file-'+i+'.json']))};
 const c=calendar();c.verifiedAtKst='2026-11-25T09:00:00+09:00';
 const normal=checkHealth({status:status(),calendar:c,nearby:nearby(),packs:goodPack,nowMs:now});
 assert.equal(normal.ok,true);
 const stale=checkHealth({status:status(),calendar:c,nearby:nearby(),
   packs:{...goodPack,sourceVerifiedAtKst:'2026-11-24T09:00:00+09:00'},nowMs:now});
 assert.equal(stale.ok,false);
 assert.match(stale.errors.join(' '),/오래되었습니다/);
});
