'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {sourceUrl,cleanDraft,applyApproval,approvedDraftPath}=require('../scripts/publish-column.cjs');
const body='실제 발행할 칼럼에서는 출처와 경기 날짜를 확인하고 기록된 결과와 해석을 분리해야 합니다. 확인되지 않은 정보는 사실처럼 서술하지 않으며 독립적인 자료 검토가 필요합니다.';
const draft=()=>({
 id:'approved-sample-column',category:'경기 전망',title:'검수 자료를 기반으로 한 경기 분석',
 subtitle:'실제 출처와 기록 검증을 마친 뒤 발행하는 글',author:'90MIN LABS 편집부',status:'draft',
 sections:[{heading:'경기 기록 검토',body},{heading:'자료 신뢰도 점검',body}]
});
test('editorial publisher validates draft status and permitted file paths',()=>{
 assert.throws(()=>cleanDraft({...draft(),status:'sample'}),/status=draft/);
 assert.throws(()=>cleanDraft({...draft(),id:'UPPERCASE'}),/lowercase/);
 assert.throws(()=>approvedDraftPath('../data/columns.json'),/Draft path/);
 assert.throws(()=>sourceUrl('javascript:alert(1)'),/HTTPS/);
 assert.throws(()=>sourceUrl('https://127.0.0.1/admin'),/HTTPS/);
});
test('approved article is added with source and reviewer while examples remain labelled',()=>{
 const original={version:1,editorialStatus:'sample',articles:[{id:'example',status:'sample'}]};
 const result=applyApproval(original,draft(),{reviewer:'검수자',source:'https://example.org/record',now:'2026-11-24T00:00:00Z'});
 assert.equal(result.editorialStatus,'mixed');
 assert.equal(result.articles[0].status,'published');
 assert.equal(result.articles[0].reviewedBy,'검수자');
 assert.equal(result.articles[0].sources[0].url,'https://example.org/record');
 assert.equal(result.articles[1].status,'sample');
 assert.equal(original.articles.length,1);
 assert.throws(()=>applyApproval(result,draft(),{reviewer:'검수자',source:'https://example.org/record'}),/already exists/);
});
