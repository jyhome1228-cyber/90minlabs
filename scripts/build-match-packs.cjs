#!/usr/bin/env node
/* Fast per-fixture data packs. Original MatchAnalysis remains the source of
 * truth. A pack is published only if all four views exactly match full data. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const A=require('../assets/match-analysis.js');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'data/match-packs');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name),'utf8'));
const data={
 calendar:read('match-calendar.json'),results:read('team-results.json'),
 profiles:read('team-profiles.json'),standings:read('league-data.json'),
 uefa:read('uefa-standings.json')
};
const context=A.createContext(data),DAY=86400000;
const localDay=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const shift=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*DAY).toISOString().slice(0,10);
const windowStart=shift(localDay,-7),windowEnd=shift(localDay,14);
const fixtureId=A.fixtureId,matchKey=match=>fixtureId(match);
const output={version:1,generatedAtKst:localDay,windowStart,windowEnd,
 sourceVerifiedAtKst:data.calendar.verifiedAtKst||null,
 files:{},counts:{generated:0,skipped:0}};
fs.mkdirSync(dir,{recursive:true});
const retained=new Set(['manifest.json']);
const targetMatches=context.matches.filter(m=>m.date>=windowStart&&m.date<=windowEnd);
function sourceInput(match){
 const home=context.teamFor(match,'home'),away=context.teamFor(match,'away');
 const teamKeys=new Set([home.key,away.key]),clubs={};
 for(const key of teamKeys)if(data.profiles.clubs?.[key])clubs[key]=data.profiles.clubs[key];
 const normalizedRecords=context.records.filter(row=>
  teamKeys.has(row.homeKey)||teamKeys.has(row.awayKey)
 );
 // Match page shows exactly three nearest same-competition fixtures.
 const target=Date.parse(match.date+'T'+(match.time||'00:00')+':00+09:00');
 const neighbors=context.matches.filter(row=>row.league===match.league&&fixtureId(row)!==fixtureId(match))
  .sort((a,b)=>Math.abs(Date.parse(a.date+'T'+(a.time||'00:00')+':00+09:00')-target)-
     Math.abs(Date.parse(b.date+'T'+(b.time||'00:00')+':00+09:00')-target))
  .slice(0,3);
 const domesticLeagues=new Set([match.league,home.profileLeague,away.profileLeague]);
 const standings={season:data.standings.season,leagues:{}};
 for(const league of domesticLeagues){
  if(data.standings.leagues?.[league])standings.leagues[league]=data.standings.leagues[league];
 }
 const europa={season:data.uefa.season,capturedAtKst:data.uefa.capturedAtKst,competitions:{}};
 if(data.uefa.competitions?.[match.league])
  europa.competitions[match.league]=data.uefa.competitions[match.league];
 const calendar={
  season:data.calendar.season,verifiedAtKst:data.calendar.verifiedAtKst,
  capturedAtKst:data.calendar.capturedAtKst,providerUrl:data.calendar.providerUrl,
  sourceByLeague:data.calendar.sourceByLeague,
  matches:[match,...neighbors]
 };
 return {
  version:1,matchId:fixtureId(match),calendar,
  results:{season:data.results.season,capturedAt:data.results.capturedAt,
   supplementalVerifiedAtKst:data.results.supplementalVerifiedAtKst},
  profiles:{version:data.profiles.version,clubs},
  standings,uefa:europa,normalizedRecords
 };
}
function validatePack(pack,fixture){
 const lean=A.createContext({
  calendar:pack.calendar,results:pack.results,profiles:pack.profiles,
  standings:pack.standings,uefa:pack.uefa,normalizedRecords:pack.normalizedRecords
 });
 const target=lean.findMatch(pack.matchId);
 if(!target)throw Error('target fixture was lost');
 // Both analyses must share the identical evaluation instant: before kickoff,
 // coverage.cutoffMs is Date.now(), not a stable fixture timestamp.
 const originalNow=Date.now,assessmentMs=originalNow();
 try{
  Date.now=()=>assessmentMs;
  for(const limit of [5,10])for(const scope of ['all','competition']){
   const original=A.analyze(context,fixture,{limit,scope});
   const reduced=A.analyze(lean,target,{limit,scope});
   // Covers both teams, historical samples, models, source links and standings.
   assert.deepStrictEqual(reduced,original);
  }
 }finally{Date.now=originalNow;}
 const targetDate=Date.parse(fixture.date+'T'+(fixture.time||'00:00')+':00+09:00');
 const related=context.matches.filter(row=>row.league===fixture.league&&fixtureId(row)!==pack.matchId)
  .sort((a,b)=>Math.abs(Date.parse(a.date+'T'+(a.time||'00:00')+':00+09:00')-targetDate)-
   Math.abs(Date.parse(b.date+'T'+(b.time||'00:00')+':00+09:00')-targetDate)).slice(0,3);
 assert.deepStrictEqual(lean.matches.slice(1),related);
}
let failures=[];
for(const match of targetMatches){
 const id=matchKey(match),file=crypto.createHash('sha256').update(id).digest('hex').slice(0,24)+'.json';
 try{
  const pack=sourceInput(match);
  validatePack(pack,match);
  fs.writeFileSync(path.join(dir,file),JSON.stringify(pack)+'\n');
  retained.add(file);
  output.files[id]=file;
  output.counts.generated++;
 }catch(error){
  failures.push({match:id,reason:error.message.slice(0,260)});
  output.counts.skipped++;
 }
}
for(const name of fs.readdirSync(dir)){
 if(name.endsWith('.json')&&!retained.has(name))fs.rmSync(path.join(dir,name));
}
if(!output.counts.generated)throw Error('No validated match packs generated');
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(output)+'\n');
console.log(JSON.stringify({...output,files:undefined,failures:failures.slice(0,8)},null,2));
if(failures.length)console.warn('Unmatched fixtures use the unchanged full-data fallback.');
