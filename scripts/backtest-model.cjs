'use strict';
/* Retrospective test of pre-kickoff model output; never describe this as calibrated probability. */
const fs=require('node:fs');
const path=require('node:path');
const MatchAnalysis=require('../assets/match-analysis.js');
const root=path.resolve(__dirname,'..');
const round=(v,d=4)=>Number.isFinite(v)?Number(v.toFixed(d)):null;
function kickoff(f){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(f.date||'')||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(f.time||''))return null;
  const ms=Date.parse(f.date+'T'+f.time+':00+09:00');
  return Number.isFinite(ms)?ms:null;
}
function resultClass(f){
  if(!Array.isArray(f.score)||f.score.length!==2||!f.score.every(x=>Number.isInteger(x)&&x>=0))return null;
  return f.score[0]>f.score[1]?0:f.score[0]===f.score[1]?1:2;
}
const scoreVerified=f=>typeof f.scoreSourceUrl==='string'&&/^https?:\/\//i.test(f.scoreSourceUrl);
function scorePrediction(values,actual){
  if(![0,1,2].includes(actual)||!Array.isArray(values)||values.length!==3||!values.every(v=>Number.isFinite(v)&&v>=0&&v<=1))return null;
  const sum=values.reduce((a,b)=>a+b,0);if(Math.abs(sum-1)>0.005)return null;
  const p=values.map(v=>v/sum);
  const pick=p.indexOf(Math.max(...p));
  return {pick,actual,correct:Number(pick===actual),brier:p.reduce((a,v,i)=>a+(v-Number(i===actual))**2,0),logLoss:-Math.log(Math.max(p[actual],1e-12))};
}
function measures(rows){
  if(!rows.length)return {count:0,topPickAccuracy:null,brierScore:null,logLoss:null,uniformBrierBenchmark:null};
  const avg=k=>rows.reduce((n,row)=>n+row[k],0)/rows.length;
  return {count:rows.length,topPickAccuracy:round(avg('correct')),brierScore:round(avg('brier')),logLoss:round(avg('logLoss')),uniformBrierBenchmark:round(2/3)};
}
function evaluate(data,opts={}){
  const calendar=data.calendar||{};
  if(!Array.isArray(calendar.matches))throw new Error('Calendar matches unavailable');
  const now=Number.isFinite(opts.now)?opts.now:Date.now();
  const limit=opts.limit===10?10:5;
  const context=MatchAnalysis.createContext({
    calendar,results:data.results||{},profiles:data.profiles||{},standings:data.standings||{},uefa:data.uefa||{}
  });
  const all=calendar.matches.filter(f=>f.status==='finished'&&resultClass(f)!==null&&kickoff(f)!==null&&kickoff(f)<now)
    .sort((a,b)=>kickoff(a)-kickoff(b)||MatchAnalysis.fixtureId(a).localeCompare(MatchAnalysis.fixtureId(b)));
  const recorded=[],verified=[];
  let insufficient=0,invalid=0;
  for(const fixture of all){
    const report=MatchAnalysis.analyze(context,fixture,{limit,scope:'competition'});
    if(!report.model.available){insufficient++;continue;}
    const item=scorePrediction([report.model.homeWin,report.model.draw,report.model.awayWin],resultClass(fixture));
    if(!item){invalid++;continue;}
    recorded.push(item);
    if(scoreVerified(fixture))verified.push(item);
  }
  return {
    generatedAtUtc:new Date(now).toISOString(),season:calendar.season||null,
    methodology:'Retrospective pre-kickoff league/venue history; same model as fixture pages',
    model:'Independent Poisson goal distribution (uncalibrated; not xG)',
    recentResultsLimit:limit,
    sourceCaveat:'Recorded results are provider-reported; independently verified subset requires a per-fixture source URL. No URL does not prove the score is wrong.',
    interpretWithCare:'Retrospective scores are descriptive, not calibrated future win probabilities, odds, or a guarantee. Uniform three-outcome Brier reference is 0.6667.',
    coverage:{
      finishedWithScore:all.length,insufficientHistory:insufficient,invalidProbabilities:invalid,
      verifiedScoreSources:all.filter(scoreVerified).length,
      assessed:recorded.length,assessedVerified:verified.length,
      coverageRate:all.length?round(recorded.length/all.length):null
    },
    recordedResults:measures(recorded),verifiedResults:measures(verified)
  };
}
function read(file){return JSON.parse(fs.readFileSync(path.join(root,'data',file),'utf8'));}
if(require.main===module){
  try{
    const report=evaluate({
      calendar:read('match-calendar.json'),results:read('team-results.json'),
      profiles:read('team-profiles.json'),standings:read('league-data.json'),uefa:read('uefa-standings.json')
    },{limit:process.argv.includes('--limit=10')?10:5});
    if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
    else process.stdout.write('Pre-kickoff audit (not calibrated)\nFinished: '+report.coverage.finishedWithScore+'; assessable: '+report.coverage.assessed+'; independently source-verified assessable: '+report.coverage.assessedVerified+'\nBrier score: '+(report.recordedResults.brierScore??'not enough data')+'\n');
  }catch(error){process.stderr.write('Model audit failed: '+error.message+'\n');process.exitCode=1;}
}
module.exports={kickoff,resultClass,scorePrediction,measures,evaluate};
