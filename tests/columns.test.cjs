'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/columns.json'),'utf8'));
test('editorial examples have unique readable IDs and complete sections',()=>{
 assert.equal(data.version,1);
 assert.ok(data.articles.length>=5);
 const ids=data.articles.map(a=>a.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const a of data.articles){
  assert.match(a.id,/^[a-z0-9-]{3,90}$/);
  assert.ok(['sample','published'].includes(a.status));
  assert.ok(a.title.length>=8);
  assert.ok(a.subtitle.length>=8);
  assert.ok(a.author);
  assert.ok(a.category);
  assert.ok(a.sections.length>=3);
  for(const s of a.sections){assert.ok(s.heading.length>3);assert.ok(s.body.length>80);}
 }
});
test('sample editorials are labelled as samples and are not implicitly published',()=>{
 assert.equal(data.editorialStatus,'sample');
 assert.ok(data.articles.every(a=>a.status==='sample'));
 const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const detail=fs.readFileSync(path.join(root,'column.html'),'utf8');
 assert.ok(index.includes('id="colList"')&&index.includes('id="draftForm"'));
 assert.ok(index.includes('assets/columns.js')&&index.includes('assets/column-editor.js'));
 assert.ok(detail.includes('id="columnContent"'));
 assert.ok(detail.includes('name="robots" content="noindex,follow"'));
});
