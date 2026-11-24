#!/usr/bin/env node
/* 90MIN LABS daily sync health. Checking the upstream source is separate from
 * finding a new final score: 0 updated matches can be perfectly healthy. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const HOUR = 3600000;
const KST = 9 * HOUR;
const DAY = 24 * HOUR;
function kstDay(ms) { return new Date(ms + KST).toISOString().slice(0, 10); }
function fixtureKey(f) { return [f.league, f.date, f.time, f.home, f.away].join('|'); }
function checkHealth({status, calendar, nearby, nowMs=Date.now()}) {
 const errors=[], warnings=[];
 const checkedMs=Date.parse(status?.lastCheckedAtKst||'');
 const today=kstDay(nowMs);
 const hour=new Date(nowMs+KST).getUTCHours();
 if(!Number.isFinite(checkedMs)) errors.push('자동 점검 완료 시각을 확인할 수 없습니다.');
 else {
  const checkedDay=kstDay(checkedMs);
  const age=nowMs-checkedMs;
  if(age< -10*60000) errors.push('자동 점검 기록의 시각이 현재보다 미래입니다.');
  if((hour>=10 && checkedDay!==today) || (hour<10 && age>26*HOUR))
   errors.push('예약 자동 점검이 예상 시간 안에 완료되지 않았습니다. 마지막 점검: '+status.lastCheckedAtKst);
 }
 if(!Array.isArray(calendar?.matches)||calendar.matches.length<2000)
  errors.push('전체 경기 일정 파일이 비어 있거나 경기가 비정상적으로 적습니다.');
 if(!Array.isArray(nearby?.matches)||!nearby.matches.length)
  errors.push('빠른 경기 목록 파일이 비어 있습니다.');
 if(Number.isInteger(status?.providerFiles) && status.providerFiles!==9)
  warnings.push('검증 제공처 파일 수: '+status.providerFiles+'개 (예상 9개)');
 const full=new Map((calendar?.matches||[]).map(m=>[fixtureKey(m),m]));
 let wrong=0,missing=0;
 for(const match of nearby?.matches||[]) {
  const original=full.get(fixtureKey(match));
  if(!original){missing++;continue;}
  if(original.status!==match.status || JSON.stringify(original.score||null)!==JSON.stringify(match.score||null))
    wrong++;
 }
 if(missing || wrong) errors.push('전체 일정과 빠른 일정이 불일치합니다. 누락 '+missing+', 상태/스코어 불일치 '+wrong+'경기.');
 if(nearby?.windowStart && nearby?.windowEnd &&
   (today<nearby.windowStart||today>nearby.windowEnd))
  errors.push('빠른 일정 파일의 제공 날짜 범위가 오늘을 포함하지 않습니다.');
 const overdue=(calendar?.matches||[]).filter(m=>{
  if(m.status!=='scheduled'||!/^\d{4}-\d{2}-\d{2}$/.test(m.date||'')||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(m.time||'')) return false;
  return Date.parse(m.date+'T'+m.time+':00+09:00') < nowMs-6*HOUR;
 });
 if(overdue.length)
  errors.push('킥오프 이후 6시간이 넘도록 미확정인 경기 '+overdue.length+'개. 원천 결과 검증이 필요합니다.');
 if((status?.existingScoreConflicts||[]).length)
  errors.push('결과 충돌 '+status.existingScoreConflicts.length+'건. 기존 확정 스코어를 덮어쓰지 마세요.');
 if(status?.completedUpdated===0) warnings.push('점검에서 신규 확정 결과는 0건입니다. 이것만으로 실패는 아닙니다.');
 return {
  ok:errors.length===0,checkedAtKst:status?.lastCheckedAtKst||null,
  checkedDay:Number.isFinite(checkedMs)?kstDay(checkedMs):null,
  today, totalFixtures:calendar?.matches?.length||0,
  nearbyFixtures:nearby?.matches?.length||0,
  pendingPastFixtures:overdue.length,
  addedFinals:status?.completedUpdated??null, errors,warnings
 };
}
if(require.main===module){
 const data=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name),'utf8'));
 try{
  const result=checkHealth({status:data('auto-sync-status.json'),
    calendar:data('match-calendar.json'), nearby:data('nearby-fixtures.json')});
  console.log(JSON.stringify(result,null,2));
  if(!result.ok){for(const message of result.errors)console.error('::error::'+message);process.exitCode=1;}
 }catch(error){console.error('::error::'+error.message);process.exitCode=1;}
}
module.exports={checkHealth,kstDay,fixtureKey};
