'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const A=require('../assets/match-analysis.js');
const root=path.resolve(__dirname,'..');
const data=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name),'utf8'));
const manifest=data('match-packs/manifest.json');
const full={
 calendar:data('match-calendar.json'),results:data('team-results.json'),
 profiles:data('team-profiles.json'),standings:data('league-data.json'),
 uefa:data('uefa-standings.json')
};
const fullContext=A.createContext(full);
const entries=Object.entries(manifest.files||{});
test('manifest covers a rolling set of exact fixtures without unsafe filenames',()=>{
 assert.equal(manifest.version,1);
 assert.ok(entries.length>=15,'too few compact fixtures: '+entries.length);
 assert.equal(manifest.counts.skipped,0,'no fixtures should fail full-history parity');
 assert.equal(manifest.counts.generated,entries.length);
 assert.match(manifest.generatedAtKst,/^\d{4}-\d{2}-\d{2}$/);
 const seen=new Set();
 for(const [id,file] of entries){
  assert.ok(fullContext.findMatch(id),'missing fixture '+id);
  assert.match(file,/^[a-f0-9]{24}\.json$/);
  assert.ok(!seen.has(file),'colliding compact fixture path: '+file);
  seen.add(file);
 }
});
test('all serialized packs retain exact match identity and correct historical sources',()=>{
 for(const [id,file] of entries){
  const pack=data('match-packs/'+file);
  assert.equal(pack.version,1);
  assert.equal(pack.matchId,id);
  assert.equal(A.fixtureId(pack.calendar.matches[0]),id);
  assert.ok(pack.normalizedRecords.length<=fullContext.records.length);
  assert.ok(pack.calendar.matches.length<=4);
  assert.ok(pack.normalizedRecords.every(row=>Number.isFinite(row.upperBoundMs)&&row.homeKey&&row.awayKey));
  assert.ok(fs.statSync(path.join(root,'data/match-packs',file)).size<90000,
   'compact data must not become another giant season file: '+file);
 }
});
test('representative leagues and four viewing modes match full-season reports exactly',()=>{
 const chosen=new Map();
 for(const [id,file] of entries){
  const league=id.split('~')[0], list=chosen.get(league)||[];
  if(list.length<2){list.push([id,file]);chosen.set(league,list);}
 }
 const saved=Date.now,instant=saved();
 try{
  Date.now=()=>instant;
  for(const [league,items] of chosen)for(const [id,file] of items){
   const pack=data('match-packs/'+file);
   const lean=A.createContext({
    calendar:pack.calendar,results:pack.results,profiles:pack.profiles,
    standings:pack.standings,uefa:pack.uefa,normalizedRecords:pack.normalizedRecords
   });
   const a=lean.findMatch(id),b=fullContext.findMatch(id);
   assert.ok(a&&b,'cannot resolve '+league+' fixture');
   for(const limit of [5,10])for(const scope of ['all','competition']){
    assert.deepStrictEqual(A.analyze(lean,a,{limit,scope}),
      A.analyze(fullContext,b,{limit,scope}),league+' '+id+' '+limit+' '+scope);
   }
  }
 }finally{Date.now=saved;}
});
