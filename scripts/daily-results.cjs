#!/usr/bin/env node
/* 90MIN LABS daily score sync: cautious, reproducible, zero-dependency Node 22.
 * Only provider-confirmed final scores with exact club identity and kickoff matching are imported.
 * Local finished scores are never overwritten. Missing/uncertain outcomes remain unverified.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const LEAGUES=Object.freeze({
 epl:'ENG_1_premier-league',championship:'ENG_2_championship',
 laliga:'ESP_1_la-liga',seriea:'ITA_1_serie-a',
 bundesliga:'GER_1_bundesliga',ligue1:'FRA_1_ligue-1',
 ucl:'UEFA_1_champions-league',uel:'UEFA_1_europa-league',
 uecl:'UEFA_1_conference-league'
});
const BASE='https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data/';
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name),'utf8'));
const write=(name,data)=>fs.writeFileSync(path.join(root,'data',name),JSON.stringify(data,null,2)+'\n');
const norm=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const dateOnly=date=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')?Date.parse(date+'T12:00:00Z'):NaN;
const dayDistance=(a,b)=>Math.round((dateOnly(a)-dateOnly(b))/86400000);
const isoKst=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,19)+'+09:00';
const validScore=(a,b)=>Number.isInteger(a)&&a>=0&&a<=30&&Number.isInteger(b)&&b>=0&&b<=30;
function csv(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&c===','){row.push(field);field='';}
  else if(!quoted&&(c==='\n'||c==='\r')){
   if(c==='\r'&&text[i+1]==='\n')i++;
   row.push(field);field='';if(row.some(Boolean))rows.push(row);row=[];
  } else field+=c;
 }
 if(quoted)throw Error('Invalid CSV: unterminated quote');
 if(row.length||field){row.push(field);rows.push(row)}
 if(rows.length<1)throw Error('Empty CSV');
 const headers=rows.shift();
 return rows.filter(x=>x.some(Boolean)).map(fields=>Object.fromEntries(headers.map((h,i)=>[h,fields[i]||''])));
}
async function fetchCsv(league){
 const url=BASE+LEAGUES[league]+'/results_2627.csv';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const result=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'90minlabs-daily-sync/1.0','Accept':'text/csv'}});
  if(!result.ok)throw Error(league+' HTTP '+result.status);
  const parsed=csv(await result.text());
  if(parsed.length<3||!parsed[0].hasOwnProperty('ft_home'))throw Error(league+' malformed source data');
  return {league,url,rows:parsed};
 }finally{clearTimeout(timer)}
}
function aliases(match,side,profiles){
 const league=match[side+'TeamLeague']||match.league;
 const canonical=match[side+'Team']||match[side];
 const profile=profiles.clubs?.[league+':'+canonical]||{};
 return new Set([match[side],canonical,profile.name,profile.searchName,profile.wikiEn].filter(Boolean).map(norm));
}
function sourceMatch(match,source,profiles){
 if(!aliases(match,'home',profiles).has(norm(source.home)))return false;
 if(!aliases(match,'away',profiles).has(norm(source.away)))return false;
 // Provider data has European dates. The local fixture is in KST, often +1 calendar day.
 const distance=dayDistance(match.date,source.date);
 if(!Number.isInteger(distance)||distance<0||distance>1)return false;
 if(match.time&&source.time&&/^([01]\d|2[0-3]):[0-5]\d$/.test(source.time)){
  // open-matchday time convention: CET (UTC+01:00); KST is 8 hours ahead.
  const expected=Date.parse(source.date+'T'+source.time+':00+01:00');
  const local=Date.parse(match.date+'T'+match.time+':00+09:00');
  if(!Number.isFinite(expected)||!Number.isFinite(local)||Math.abs(local-expected)>120*60000)return false;
 }
 return true;
}
function approvedSource(row){
 const home=Number(row.ft_home),away=Number(row.ft_away);
 if(!/^\d+$/.test(row.ft_home)||!/^\d+$/.test(row.ft_away)||!validScore(home,away))return false;
 const result=home>away?'H':home<away?'A':'D';
 return (!row.ft_result||row.ft_result===result)&&Boolean(dateOnly(row.date));
}
function auditFinished(calendar,leagueData){
 const warnings=[];
 for(const [lg,comp] of Object.entries(leagueData.leagues||{})){
  if(!comp.standings?.rows?.length)continue;
  const matches=calendar.matches.filter(m=>m.league===lg&&m.status==='finished'&&validScore(...(m.score||[])));
  for(const team of comp.standings.rows){
   const played=matches.filter(m=>(m.homeTeam||m.home)===team.team||(m.awayTeam||m.away)===team.team).length;
   if(played!==team.played)warnings.push(lg+':'+team.team+' expected '+team.played+' played, got '+played);
  }
 }
 return warnings;
}
function updateTeamResults(match,source,results){
 if(!['epl','championship','laliga','seriea','bundesliga','ligue1'].includes(match.league))return;
 const keys=['home','away'].map(side=>(match[side+'TeamLeague']||match.league)+':'+(match[side+'Team']||match[side]));
 const both=keys.map(k=>results.teams?.[k]);
 if(both.some(team=>!team))return;
 const record={date:source.date,home:both[0].matchName,away:both[1].matchName,
  homeScore:Number(source.ft_home),awayScore:Number(source.ft_away),
  round:String(match.round||source.gw||''),provider:'open-matchday-daily'};
 for(const team of both){
  const old=team.matches.find(r=>r.date===record.date&&norm(r.home)===norm(record.home)&&norm(r.away)===norm(record.away));
  if(old&&!validScore(old.homeScore,old.awayScore))throw Error('Invalid old team result');
  if(old&&(old.homeScore!==record.homeScore||old.awayScore!==record.awayScore))throw Error('History conflict for '+team.team);
  if(!old)team.matches.push({...record});
  team.matches.sort((a,b)=>b.date.localeCompare(a.date)||Number(b.round||0)-Number(a.round||0));
  team.matches=team.matches.slice(0,10);
  team.lastMatchDate=team.matches[0]?.date||team.lastMatchDate;
 }
}
function updateStandings(calendar,leagueData,stamp){
 const skipped=[],updated=[];
 for(const [lg,comp] of Object.entries(leagueData.leagues||{})){
  const standing=comp.standings;
  if(!standing?.rows?.length)continue;
  const matches=calendar.matches.filter(m=>m.league===lg&&m.status==='finished'&&validScore(...(m.score||[])));
  const accumulated=new Map(standing.rows.map(row=>[row.team,{played:0,won:0,drawn:0,lost:0,points:0,goalsFor:0,goalDifference:0}]));
  let unknown=0;
  for(const m of matches){
   const home=accumulated.get(m.homeTeam||m.home),away=accumulated.get(m.awayTeam||m.away);
   if(!home||!away){unknown++;continue;}
   for(const [x,gf,ga] of [[home,m.score[0],m.score[1]],[away,m.score[1],m.score[0]]]){
    x.played++;x.goalsFor+=gf;x.goalDifference+=gf-ga;
    if(gf>ga){x.won++;x.points+=3}else if(gf===ga){x.drawn++;x.points++}else x.lost++;
   }
  }
  if(unknown||[...accumulated.values()].some(x=>!x.played)){
   skipped.push(lg+': missing or unknown clubs ('+unknown+')');continue;
  }
  const previous=new Map(standing.rows.map(row=>[row.team,row.rank]));
  for(const row of standing.rows){const stats=accumulated.get(row.team);Object.assign(row,{
    played:stats.played,won:stats.won,drawn:stats.drawn,lost:stats.lost,
    goalDifference:stats.goalDifference,points:stats.points
  });}
  standing.rows.sort((a,b)=>b.points-a.points||b.goalDifference-a.goalDifference||
    accumulated.get(b.team).goalsFor-accumulated.get(a.team).goalsFor||
    previous.get(a.team)-previous.get(b.team));
  standing.rows.forEach((row,i)=>row.rank=i+1);
  standing.updatedAt=stamp;
  standing.supplementalSourceUrl='https://github.com/oladeeayo/open-matchday';
  standing.note='2026/27 시즌 확정 경기 결과로 자동 재계산한 참고 순위. 동률 규정(상대 전적 등)은 공식 순위와 다를 수 있습니다.';
  updated.push(lg);
 }
 return {updated,skipped};
}
async function run(){
 const dry=process.argv.includes('--dry-run');
 const calendar=read('match-calendar.json'),results=read('team-results.json'),leagueData=read('league-data.json'),profiles=read('team-profiles.json');
 if(!Array.isArray(calendar.matches)||calendar.matches.length<2000)throw Error('Calendar unexpectedly small');
 const stamp=isoKst(),sourceFiles=await Promise.all(Object.keys(LEAGUES).map(fetchCsv));
 const approved=new Map(),conflicts=[],ambiguous=[],unmatched=[];
 for(const {league,rows,url} of sourceFiles){
  const fixtures=calendar.matches.filter(m=>m.league===league);
  for(const entry of rows.filter(approvedSource)){
   const candidates=fixtures.filter(m=>sourceMatch(m,entry,profiles));
   if(candidates.length!==1){if(candidates.length>1)ambiguous.push({league,date:entry.date,home:entry.home,away:entry.away});else unmatched.push({league,date:entry.date,home:entry.home,away:entry.away});continue;}
   const fixture=candidates[0];
   const kickoff=Date.parse(fixture.date+'T'+fixture.time+':00+09:00');
   if(!Number.isFinite(kickoff)||kickoff>Date.now()-2*3600000)continue;
   const key=league+'|'+fixture.date+'|'+fixture.time+'|'+fixture.home+'|'+fixture.away;
   if(approved.has(key)){ambiguous.push({key,reason:'duplicate provider matches'});continue;}
   approved.set(key,{fixture,source:entry,url});
  }
 }
 if(ambiguous.length)console.warn('Ambiguous provider matches skipped:',JSON.stringify(ambiguous.slice(0,15)));
 let completed=0,already=0;
 const changedMatches=[];
 for(const {fixture,source,url} of approved.values()){
  const score=[Number(source.ft_home),Number(source.ft_away)];
  if(fixture.status==='finished'){
   if(fixture.score?.[0]!==score[0]||fixture.score?.[1]!==score[1])conflicts.push({league:fixture.league,date:fixture.date,home:fixture.home,away:fixture.away,local:fixture.score,provider:score});
   else already++;
   continue;
  }
  if(['cancelled','canceled','postponed'].includes(fixture.status))continue;
  if(fixture.status!=='scheduled'&&fixture.status!=='unverified')continue;
  fixture.status='finished';fixture.score=score;
  fixture.scoreSource='open-matchday';fixture.scoreSourceUrl=url;fixture.scoreVerifiedAtKst=stamp;
  updateTeamResults(fixture,source,results);
  changedMatches.push({league:fixture.league,date:fixture.date,home:fixture.home,away:fixture.away,score});
  completed++;
 }
 if(conflicts.length){
  console.error('Existing final score conflicts; manual review required:',JSON.stringify(conflicts.slice(0,30)));
  // Existing finished scores are authoritative, never overwritten.
 }
 let standings={updated:[],skipped:[]};
 if(completed){standings=updateStandings(calendar,leagueData,stamp);}
 const sanity=auditFinished(calendar,leagueData);
 if(sanity.length){
  console.warn('Standing vs local calendar discrepancy:',sanity.slice(0,15));
  if(completed&&standings.updated.length)throw Error('Calculated standings failed post-sync count audit');
 }
 const report={lastCheckedAtKst:stamp,source:'open-matchday',
  schedule:'09:00 Asia/Seoul daily',providerFiles:sourceFiles.length,
  completedUpdated:completed,previouslyFinished:already,
  existingScoreConflicts:conflicts,
  ambiguous:ambiguous.slice(0,30),
  unmatchedSourceResults:unmatched.length,
  updatedLeagueStandings:standings.updated,skippedStandings:standings.skipped,
  changedMatches:changedMatches.slice(0,150),
  note:'Verified finals only. No guessing; upstream timestamps and scheduling can lag. League standings are derived from the local finished-match calendar.'
 };
 console.log(JSON.stringify(report,null,2));
 if(dry)return;
 if(completed){
  calendar.verifiedAtKst=stamp;
  calendar.providerNotes='Daily verified scores imported from open-matchday (09:00 KST GitHub Actions). Completed existing scores are never overwritten.';
  results.lastAutoSyncAtKst=stamp;
  write('match-calendar.json',calendar);
  write('team-results.json',results);
  if(standings.updated.length)write('league-data.json',leagueData);
 }
 write('auto-sync-status.json',report);
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
module.exports={csv,norm,dayDistance,sourceMatch,approvedSource,updateStandings};
