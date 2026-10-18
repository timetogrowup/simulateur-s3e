'use strict';
const {spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const cases=[
 ['2026-01-15T03:00:00Z','0 3 * * *',2],
 ['2026-01-15T04:00:00Z','0 4 * * *',0],
 ['2026-07-15T03:00:00Z','0 3 * * *',0],
 ['2026-07-15T04:00:00Z','0 4 * * *',2],
 ['2026-03-29T03:00:00Z','0 3 * * *',0],
 ['2026-03-29T04:00:00Z','0 4 * * *',2],
 ['2026-10-25T03:00:00Z','0 3 * * *',2],
 ['2026-10-25T04:00:00Z','0 4 * * *',0]
];
for(const [date,cron,expected] of cases){
 const r=spawnSync(process.execPath,['tests/select-paris-slot.cjs','schedule',cron,date],{encoding:'utf8'});
 assert.equal(r.status,expected,date+' / '+cron+' : '+r.stdout+' '+r.stderr);
}
const manual=spawnSync(process.execPath,['tests/select-paris-slot.cjs','workflow_dispatch','',cases[0][0]],{encoding:'utf8'});
assert.equal(manual.status,0);
console.log('Garde-fou Paris : 8 cas calendaires + manuel OK.');
