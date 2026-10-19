// EVOL-COM-001 Lot T1 — Worker Cloudflare sans données individuelles.
// Aucun déploiement sans validation de la confidentialité et de l'anti-abus.
const ALLOWED_EVENT='simulation_completed';
const MAX_BODY=1024;
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_FIELDS=new Set(['schema','event','event_id','client_time_utc','app_version']);
const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
const json=(obj,status=200,extra={})=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
function partDict(date){return Object.fromEntries(fmt.formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));}
function dateParis(date){const p=partDict(date);return p.year+'-'+p.month+'-'+p.day;}
function utcHour(ms){return new Date(ms).toISOString().slice(0,13)+':00:00.000Z';}
function midnightUTC(day){
 const anchor=Date.parse(day+'T00:00:00.000Z');
 for(let h=-3;h<=3;h++){
  const ms=anchor+h*3600000,parts=partDict(new Date(ms));
  if(parts.year+'-'+parts.month+'-'+parts.day===day && parts.hour==='00')return ms;
 }
 throw new Error('Date Paris non trouvée');
}
function dayRange(date){
 if(!DATE.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Date invalide');
 const next=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 return [midnightUTC(date),midnightUTC(next)];
}
function sameOrigin(origin,allowed){return Boolean(origin)&&origin===allowed;}
function safeBody(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!ALLOWED_FIELDS.has(k)))return false;
 if(x.schema!==1||x.event!==ALLOWED_EVENT||typeof x.event_id!=='string'||!ID.test(x.event_id))return false;
 if(x.app_version!==undefined&& (typeof x.app_version!=='string'||!/^[a-zA-Z0-9._-]{1,40}$/.test(x.app_version)))return false;
 if(x.client_time_utc!==undefined&&(typeof x.client_time_utc!=='string'||! /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(x.client_time_utc)||!Number.isFinite(Date.parse(x.client_time_utc))))return false;
 return true;
}
async function ingest(request,env){
 const origin=request.headers.get('origin');
 const cors=sameOrigin(origin,env.ALLOWED_ORIGIN)?{'access-control-allow-origin':origin,'vary':'Origin'}:{};
 if(!sameOrigin(origin,env.ALLOWED_ORIGIN))return json({error:'origin_rejected'},403);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'content_type'},415,cors);
 const declared=Number(request.headers.get('content-length')||0);
 if(declared>MAX_BODY)return json({error:'too_large'},413,cors);
 const raw=await request.text();
 if(new TextEncoder().encode(raw).length>MAX_BODY)return json({error:'too_large'},413,cors);
 let body;try{body=JSON.parse(raw)}catch{return json({error:'invalid_json'},400,cors)}
 if(!safeBody(body))return json({error:'invalid_event'},400,cors);
 const now=new Date().toISOString(),hour=utcHour(Date.now());
 try{
  // D1.batch exécute ces instructions dans une transaction : changes()
  // dans la deuxième requête reflète l'INSERT OR IGNORE précédent.
  const result=await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO event_dedupe(event_id,inserted_at_utc) VALUES (?,?)').bind(body.event_id,now),
   env.DB.prepare('INSERT INTO hourly_counts(hour_start_utc,completed_count) SELECT ?,1 WHERE changes()=1 ON CONFLICT(hour_start_utc) DO UPDATE SET completed_count=completed_count+1').bind(hour)
  ]);
  const inserted=result[0]?.meta?.changes===1;
  return json({accepted:true,duplicate:!inserted},inserted?202:200,cors);
 }catch{return json({error:'storage_unavailable'},503,cors)}
}
async function summary(request,env){
 const header=request.headers.get('authorization');
 if(!env.REPORT_API_TOKEN||header!== 'Bearer '+env.REPORT_API_TOKEN)return json({error:'unauthorized'},401);
 const url=new URL(request.url),day=url.searchParams.get('date'),tz=url.searchParams.get('tz');
 if(tz!=='Europe/Paris'||!day)return json({error:'invalid_query'},400);
 let start,end;try{[start,end]=dayRange(day)}catch{return json({error:'invalid_date'},400)}
 const utcSlots=[],hourly=Array.from({length:24},(_,h)=>({local_hour:String(h).padStart(2,'0'),count:0}));
 const rows=await env.DB.prepare('SELECT hour_start_utc,completed_count FROM hourly_counts WHERE hour_start_utc >= ? AND hour_start_utc < ? ORDER BY hour_start_utc').bind(new Date(start).toISOString(),new Date(end).toISOString()).all();
 const counts=new Map((rows.results||[]).map(r=>[r.hour_start_utc,Number(r.completed_count)]));
 for(let ms=start;ms<end;ms+=3600000){
  const utc=utcHour(ms),local=partDict(new Date(ms)),count=counts.get(utc)||0;
  utcSlots.push({hour_start_utc:utc,local_hour:local.hour,count});
  hourly[Number(local.hour)].count+=count;
 }
 const completed=hourly.reduce((a,b)=>a+b.count,0);
 return json({schema:1,date_paris:day,measurement_status:'complete',
  completed_total:completed,started_total:null,distinct_users_estimated:null,
  hourly,utc_hours:utcSlots,measurement_asof_utc:new Date().toISOString(),
  notes:['Mesure des simulations terminées, pas des personnes distinctes.']});
}
export default {
 async scheduled(controller,env){
  // Purger uniquement les identifiants éphémères de dédoublonnage (48 h).
  if(!env.DB)return;
  const cutoff=new Date(Date.now()-48*3600000).toISOString();
  await env.DB.prepare('DELETE FROM event_dedupe WHERE inserted_at_utc < ?').bind(cutoff).run();
 },
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('origin');
  if(request.method==='OPTIONS'&&url.pathname==='/v1/events'){
   if(!sameOrigin(origin,env.ALLOWED_ORIGIN))return json({error:'origin_rejected'},403);
   return new Response(null,{status:204,headers:{
    'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'content-type','access-control-max-age':'3600',
    'cache-control':'no-store','vary':'Origin'}});
  }
  if(!env.DB)return json({error:'service_unavailable'},503);
  if(url.pathname==='/v1/events'){
   if(request.method!=='POST')return json({error:'method_not_allowed'},405);
   return ingest(request,env);
  }
  if(url.pathname==='/v1/summary'){
   if(request.method!=='GET')return json({error:'method_not_allowed'},405);
   try{return await summary(request,env)}catch{return json({error:'storage_unavailable'},503)}
  }
  return json({error:'not_found'},404);
 }
};
export {dayRange,safeBody};
