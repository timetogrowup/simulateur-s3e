import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{dayRange,safeBody} from '../cloudflare/src/worker.js';
const ORIGIN='https://timetogrowup.github.io';
const UUID='e8c3a4b5-9d42-4a83-9aa5-a7b5a6169120';
class FakeDB {
 constructor(){this.ids=new Map();this.hours=new Map();}
 prepare(sql){
  return {bind:(...args)=>({sql,args,all:async()=>{
   if(sql.startsWith('SELECT'))return {results:[...this.hours].filter(([hour])=>hour>=args[0]&&hour<args[1]).map(([hour_start_utc,completed_count])=>({hour_start_utc,completed_count}))};
   throw Error('SELECT attendu');
  }})};
 }
 async batch(statements){
  assert.equal(statements.length,2);
  assert.match(statements[0].sql,/INSERT OR IGNORE INTO event_dedupe/);
  assert.match(statements[1].sql,/WHERE changes\(\)=1/);
  const [id,at]=statements[0].args;
  let changes=0;
  if(!this.ids.has(id)){this.ids.set(id,at);changes=1;}
  if(changes){const hour=statements[1].args[0];this.hours.set(hour,(this.hours.get(hour)||0)+1);}
  return [{meta:{changes}},{meta:{changes}}];
 }
}
const env=()=>({DB:new FakeDB(),ALLOWED_ORIGIN:ORIGIN,REPORT_API_TOKEN:'fake-secret-123'});
const payload=(id=UUID)=>({schema:1,event:'simulation_completed',event_id:id,client_time_utc:'2026-10-19T00:00:00Z',app_version:'test-1'});
function req(url,method='POST',body=payload(),origin=ORIGIN){
 return new Request(url,{method,headers:{origin,'content-type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined});
}
const url='https://worker.invalid/v1/events';
const summary=(date,token='fake-secret-123')=>new Request('https://worker.invalid/v1/summary?tz=Europe%2FParis&date='+date,{headers:{authorization:'Bearer '+token}});
test('date Paris : 24 h, 23 h au printemps, 25 h en automne',()=>{
 assert.equal((dayRange('2026-01-15')[1]-dayRange('2026-01-15')[0])/3600000,24);
 assert.equal((dayRange('2026-03-29')[1]-dayRange('2026-03-29')[0])/3600000,23);
 assert.equal((dayRange('2026-10-25')[1]-dayRange('2026-10-25')[0])/3600000,25);
 assert.equal(new Date(dayRange('2026-07-15')[0]).toISOString(),'2026-07-14T22:00:00.000Z');
 assert.equal(new Date(dayRange('2026-01-15')[0]).toISOString(),'2026-01-14T23:00:00.000Z');
 assert.throws(()=>dayRange('2026-02-30'));
});
test('format strict : aucun champ métier accepté',()=>{
 assert.equal(safeBody(payload()),true);
 assert.equal(safeBody({...payload(),salary:1200}),false);
 assert.equal(safeBody({...payload(),answers:{q:1}}),false);
 assert.equal(safeBody({...payload(),event_id:'visitor123'}),false);
});
test('un événement doublonné est compté une fois, succès 202/200',async()=>{
 const e=env();
 const a=await worker.fetch(req(url),e),b=await worker.fetch(req(url),e);
 assert.equal(a.status,202);assert.equal(b.status,200);
 assert.equal((await b.json()).duplicate,true);
 assert.equal([...e.DB.hours.values()][0],1);
});
test('10 événements distincts en une heure : compteur 10',async()=>{
 const e=env();for(let i=0;i<10;i++){
  const id='e8c3a4b5-9d42-4a83-9aa5-'+String(i).padStart(12,'0');
  assert.equal((await worker.fetch(req(url,'POST',payload(id)),e)).status,202);
 }
 assert.equal([...e.DB.hours.values()][0],10);
});
test('rejets origine non autorisée, champs sensibles, trop grand, JSON et type invalide',async()=>{
 const e=env();
 assert.equal((await worker.fetch(req(url,'POST',payload(),'https://evil.example'),e)).status,403);
 assert.equal((await worker.fetch(req(url,'POST',{...payload(),income:5000}),e)).status,400);
 assert.equal((await worker.fetch(req(url,'POST',{...payload(),padding:'x'.repeat(1200)}),e)).status,413);
 assert.equal((await worker.fetch(new Request(url,{method:'POST',headers:{origin:ORIGIN,'content-type':'text/plain'},body:'a'}),e)).status,415);
 assert.equal((await worker.fetch(new Request(url,{method:'POST',headers:{origin:ORIGIN,'content-type':'application/json'},body:'{'}),e)).status,400);
 assert.equal(e.DB.ids.size,0);
});
test('CORS officiel seulement, et aucun secret d’accès public',async()=>{
 const e=env();
 assert.equal((await worker.fetch(new Request(url,{method:'OPTIONS',headers:{origin:ORIGIN}}),e)).status,204);
 assert.equal((await worker.fetch(new Request(url,{method:'OPTIONS',headers:{origin:'https://evil.example'}}),e)).status,403);
 assert.equal((await worker.fetch(summary('2026-10-19','wrong'),e)).status,401);
 assert.equal((await worker.fetch(summary('2026-10-19'),{...e,REPORT_API_TOKEN:''})).status,401);
});
test('bilan journalier inclut toutes les heures et n’invente pas de visiteurs uniques',async()=>{
 const e=env();const start=dayRange('2026-10-19')[0];
 e.DB.hours.set(new Date(start).toISOString(),4);
 e.DB.hours.set(new Date(start+3*3600000).toISOString(),3);
 const res=await worker.fetch(summary('2026-10-19'),e);
 assert.equal(res.status,200);const b=await res.json();
 assert.equal(b.completed_total,7);
 assert.equal(b.hourly.reduce((n,x)=>n+x.count,0),7);
 assert.equal(b.utc_hours.length,24);
 assert.equal(b.distinct_users_estimated,null);
 assert.equal(b.hourly[0].count,4);
 assert.equal(b.hourly[3].count,3);
});
test('journées changement heure : 23 ou 25 intervalles UTC distincts',async()=>{
 for(const [date,hours] of [['2026-03-29',23],['2026-10-25',25]]){
  const e=env(),start=dayRange(date)[0];
  for(let i=0;i<hours;i++)e.DB.hours.set(new Date(start+i*3600000).toISOString(),1);
  const b=await (await worker.fetch(summary(date),e)).json();
  assert.equal(b.utc_hours.length,hours);
  assert.equal(b.completed_total,hours);
  assert.equal(b.hourly.reduce((n,v)=>n+v.count,0),hours);
  if(hours===25)assert.equal(b.utc_hours.filter(x=>x.local_hour==='02').length,2);
 }
});
test('absence D1 et erreurs internes ne révèlent aucune donnée',async()=>{
 assert.equal((await worker.fetch(req(url),{ALLOWED_ORIGIN:ORIGIN})).status,503);
 const e=env();e.DB.batch=async()=>{throw Error('sql secret failed')};
 const res=await worker.fetch(req(url),e);assert.equal(res.status,503);
 assert.doesNotMatch(await res.text(),/sql secret/);
});
