'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {scorePrediction,evaluate}=require('../scripts/backtest-model.cjs');
test('three-way Brier scores are mathematically valid and normalized',()=>{
  const p=scorePrediction([.6,.2,.2],0);
  assert.equal(p.correct,1);
  assert.equal(Math.round(p.brier*100),24);
  assert.equal(scorePrediction([.9,.9,.9],1),null);
  assert.equal(scorePrediction([NaN,.5,.5],1),null);
});
function fixtureData(){
  const matches=[];
  for(let n=1;n<=14;n++){
    matches.push({date:'2026-09-'+String(n).padStart(2,'0'),time:'20:00',league:'epl',home:'Home FC',away:'Away FC',status:'finished',score:[n%3===0?0:2,n%4===0?2:1],scoreSourceUrl:n>10?'https://example.org/results/'+n:undefined});
  }
  return {calendar:{season:'2026/27',matches},results:{teams:{}},profiles:{clubs:{}}};
}
test('historical results are evaluated only after enough earlier observations',()=>{
  const result=evaluate(fixtureData(),{now:Date.parse('2026-10-01T00:00:00Z')});
  assert.equal(result.coverage.finishedWithScore,14);
  assert.ok(result.coverage.insufficientHistory>=5);
  assert.ok(result.coverage.assessed>0);
  assert.equal(result.recordedResults.count,result.coverage.assessed);
  assert.ok(result.verifiedResults.count>0);
  assert.ok(result.recordedResults.brierScore>=0&&result.recordedResults.brierScore<=2);
  assert.match(result.interpretWithCare,/not calibrated/);
});
test('results beyond audit cutoff never become historical evidence',()=>{
  const data=fixtureData();
  data.calendar.matches.push({date:'2026-12-05',time:'20:00',league:'epl',home:'Home FC',away:'Away FC',status:'finished',score:[19,0]});
  assert.equal(evaluate(data,{now:Date.parse('2026-10-01T00:00:00Z')}).coverage.finishedWithScore,14);
});
