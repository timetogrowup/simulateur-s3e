// EVOL-TEST-004 lot B — purge glissante des seuls artefacts quotidiens >30 jours.
'use strict';
const token=process.env.GITHUB_TOKEN;
const repo=process.env.GITHUB_REPOSITORY;
const prefix='recette-quotidienne-';
const current=prefix+process.env.GITHUB_RUN_ID+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');
if(!token||!repo||!process.env.GITHUB_RUN_ID)throw Error('Jeton, dépôt ou run id manquant');
const base='https://api.github.com/repos/'+repo;
async function api(path,method='GET'){
 const r=await fetch(base+path,{method,headers:{
 Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
 'X-GitHub-Api-Version':'2022-11-28','User-Agent':'s3e-daily-retention'}});
 if(!r.ok)throw Error(method+' '+path+' HTTP '+r.status+' '+(await r.text()).slice(0,200));
 return method==='DELETE'?null:r.json();
}
async function list(){
 const artifacts=[];
 for(let page=1;page<=30;page++){
  const p=await api('/actions/artifacts?per_page=100&page='+page);
  artifacts.push(...(p.artifacts||[]));
  if((p.artifacts||[]).length<100)break;
  if(page===30)throw Error('Pagination incomplète, ne pas supprimer');
 }
 return artifacts.filter(a=>a.name.startsWith(prefix)&&!a.expired);
}
async function main(){
 const all=await list();
 if(!all.some(a=>a.name===current))throw Error('Artefact actuel non vérifié, purge refusée');
 const cutoff=Date.now()-30*24*60*60*1000;
 let removed=0;
 for(const a of all){
  if(a.name===current)continue;
  if(Date.parse(a.created_at)<cutoff){
   await api('/actions/artifacts/'+a.id,'DELETE');
   console.log('Archive quotidienne >30j supprimée : '+a.name);
   removed++;
  }
 }
 const after=await list();
 if(!after.some(a=>a.name===current))throw Error('Artefact actuel manquant après purge');
 if(after.some(a=>Date.parse(a.created_at)<cutoff))
  throw Error('Une archive quotidienne périmée subsiste');
 console.log('Rétention 30 jours vérifiée ; supprimés : '+removed+' ; présents : '+after.length);
}
main().catch(e=>{console.error('ECHEC ROTATION QUOTIDIENNE : '+e.message);process.exitCode=1;});
