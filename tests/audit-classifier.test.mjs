// Isolated synthetic classifier tests. These are never browser evidence.
import assert from 'node:assert/strict';
import { SCENARIOS, stepsFor, visibleRows, ALL } from '../scripts/spec.mjs';
import { verifyReport, expectedBaselineFailures } from '../scripts/classify.mjs';
function report(variant) {
  return {schemaVersion:1,variant,completed:true,status:variant==='baseline'?'contract-failed':'passed',exitCode:variant==='baseline'?1:0,errors:[],failures:variant==='baseline'?expectedBaselineFailures():[],scenarios:SCENARIOS.map(s=>({...s,ready:true,completed:true,initial:{visibleRows:visibleRows(s.initialPage),selected:[],events:[],pageEvents:[],currentPage:s.initialPage,headerChecked:false,headerDisabled:false,visibleChecked:[false,false]},checkpoints:stepsFor(s).map(step=>{const keys=variant==='baseline'&&!s.reserve&&step.type==='check'?ALL:step.selected;return{scenario:s.id,step:step.id,action:step.action,page:step.page,expected:step.selected,selected:keys,visibleRows:visibleRows(step.page),headerChecked:step.selected.length>0,visibleChecked:[step.selected.length>0,step.selected.length>0],event:step.action==='toggle'||!s.reserve?{type:step.type,currentRowKey:step.currentRowKey,keys,selectedRowDataIds:keys,selectedRowData:keys.map(id=>({id,name:`Row ${id}`}))}:null,screenshot:`${s.id}-${step.id}.png`,screenshotSha256:'a'.repeat(64)}})}))};
}
let rejected=0;
for(const variant of ['baseline','fixed']) {
 const clean=report(variant);
 for (const s of clean.scenarios) {
   s.readyScreenshot = { path: `${s.id}--00-ready.png`, sha256: 'a'.repeat(64) };
   s.trace = { path: `${s.id}-trace.zip`, sha256: 'b'.repeat(64) };
 }
 verifyReport(clean,variant);
 for(const err of ['setup failed','navigation failed','TimeoutError','strict mode selector violation','browser launch denied','HTTP 404','cleanup failed']) {
   const r=structuredClone(clean);r.errors.push(err);assert.throws(()=>verifyReport(r,variant));rejected++;
 }
 for(let i=0;i<clean.scenarios.length;i++) {
  for(let j=0;j<clean.scenarios[i].checkpoints.length;j++) {
   for(const mutate of [c=>c.selected=[99],c=>c.visibleRows=[99],c=>c.headerChecked=!c.headerChecked,c=>c.screenshot='',c=>c.expected=[99]]) {
    const r=structuredClone(clean);mutate(r.scenarios[i].checkpoints[j]);assert.throws(()=>verifyReport(r,variant));rejected++;
   }
   if(clean.scenarios[i].checkpoints[j].event) {
    for(const mutate of [e=>e.keys=[99],e=>e.selectedRowDataIds=[99],e=>e.selectedRowData=[{id:99,name:'Wrong'}],e=>e.type='unrelated',e=>e.currentRowKey='unrelated']) {
      const r=structuredClone(clean);mutate(r.scenarios[i].checkpoints[j].event);assert.throws(()=>verifyReport(r,variant));rejected++;
    }
   }
  }
 }
}
console.log(`Exact synthetic reports accepted; ${rejected} isolated invalid reports rejected.`);
console.log('No browser, package installation, network, source build, or original-file modifications.');
