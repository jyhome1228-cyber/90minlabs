'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {csv,norm,dayDistance,sourceMatch,approvedSource,updateStandings}=require('../scripts/daily-results.cjs');
test('CSV respects quoted goal minutes and Windows line endings',()=>{
 const rows=csv('gw,date,home,away,ft_home,ft_away,goal_minutes\r\n12,2026-11-22,Milan,Frosinone,5,1,"4,19,25"\r\n');
 assert.equal(rows.length,1);assert.equal(rows[0].goal_minutes,'4,19,25');
});
test('club names normalize accents without fuzzy unrelated matches',()=>{
 assert.equal(norm('Málaga CF'),norm('Malaga CF'));
 assert.notEqual(norm('Lazio'),norm('Le Mans'));
});
test('European result on 22 November matches KST match on 23 November',()=>{
 const fixture={league:'seriea',date:'2026-11-23',time:'04:45',home:'Atalanta',away:'Internazionale',homeTeam:'Atalanta',awayTeam:'Inter',homeTeamLeague:'seriea',awayTeamLeague:'seriea'};
 const source={date:'2026-11-22',time:'20:45',home:'Atalanta',away:'Internazionale',ft_home:'4',ft_away:'4',ft_result:'D'};
 assert.equal(sourceMatch(fixture,source,{clubs:{}}),true);
 assert.equal(approvedSource(source),true);
 assert.equal(sourceMatch(fixture,{...source,home:'Roma'},{clubs:{}}),false);
 assert.equal(sourceMatch(fixture,{...source,date:'2026-11-20'},{clubs:{}}),false);
 assert.equal(sourceMatch(fixture,{...source,time:'15:00'},{clubs:{}}),false);
});
test('reject invalid or contradictory full-time scores',()=>{
 assert.equal(approvedSource({date:'2026-11-22',ft_home:'2',ft_away:'1',ft_result:'A'}),false);
 assert.equal(approvedSource({date:'2026-11-22',ft_home:'',ft_away:'1',ft_result:'A'}),false);
 assert.equal(approvedSource({date:'2026-11-22',ft_home:'2',ft_away:'1',ft_result:'H'}),true);
});
test('rebuild league points without inventing data',()=>{
 const calendar={matches:[
  {league:'epl',date:'2026-11-20',home:'Alpha',away:'Beta',status:'finished',score:[2,0]},
  {league:'epl',date:'2026-11-22',home:'Beta',away:'Alpha',status:'finished',score:[1,1]}
 ]};
 const league={leagues:{epl:{standings:{rows:[
  {rank:1,team:'Alpha',played:1,won:1,drawn:0,lost:0,points:3,goalDifference:2},
  {rank:2,team:'Beta',played:1,won:0,drawn:0,lost:1,points:0,goalDifference:-2}
 ]}}}};
 const res=updateStandings(calendar,league,'2026-11-23T09:00:00+09:00');
 assert.deepEqual(res.updated,['epl']);
 assert.equal(league.leagues.epl.standings.rows[0].team,'Alpha');
 assert.equal(league.leagues.epl.standings.rows[0].points,4);
 assert.equal(league.leagues.epl.standings.rows[1].points,1);
});
