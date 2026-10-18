// EVOL-TEST-004 — conservation glissante ciblée des 3 derniers artefacts pilote.
// Uniquement GITHUB_TOKEN Actions avec permissions actions:write.
'use strict';
const {setTimeout:wait}=require('node:timers/promises');
const token=process.env.GITHUB_TOKEN;
const repo=process.env.GITHUB_REPOSITORY;
const prefix='recette-pilote-';
const runId=process.env.GITHUB_RUN_ID;
const attempt=process.env.GITHUB_RUN_ATTEMPT||'1';
const current=prefix+runId+'-'+attempt;
if(!token||!repo||!runId)throw Error('Token GitHub / référentiel / run ID absents');
const base='https://api.github.com/repos/'+repo;
async function api(endpoint,method='GET'){
 const response=await fetch(base+endpoint,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28','User-Agent':'s3e-pilot-retention'}
 });
 if(!response.ok)throw Error(method+' '+endpoint+' : '+response.status+' '+(await response.text()).slice(0,300));
 return method==='DELETE'?null:response.json();
}
async function list(){
 let output=[];
 for(let page=1;page<=30;page++){
  const data=await api('/actions/artifacts?per_page=100&page='+page);
  output=output.concat(data.artifacts||[]);
  if((data.artifacts||[]).length<100)break;
  if(page===30)throw Error('Pagination >3000 artefacts : nettoyage incomplet');
 }
 return output.filter(a=>a.name.startsWith(prefix)&&!a.expired);
}
async function main(){
 // Le workflow pilote est le seul producteur autorisé du préfixe recette-pilote-.
 let all=await list();
 if(!all.some(a=>a.name===current))throw Error('Artefact actuel introuvable : aucune suppression');
 all.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id);
 const preserved=all.slice(0,3);
 if(!preserved.some(a=>a.name===current))throw Error('Artefact courant absent du trio, refuser la purge');
 const old=all.slice(3);
 for(const artifact of old){
  await api('/actions/artifacts/'+artifact.id,'DELETE');
  console.log('Ancien résultat pilote supprimé : '+artifact.name+' #'+artifact.id);
 }
 // La liste GitHub peut être éventuellement cohérente avec un léger retard.
 await wait(500);
 all=await list();
 if(all.length>3)throw Error('Rotation incomplète : '+all.length+' artefacts pilote subsistent');
 if(!all.some(a=>a.name===current))throw Error('Le rapport courant a disparu');
 console.log('Rotation OK : '+all.length+' artefact(s) pilote restant(s) ; limite 3.');
}
main().catch(e=>{console.error('ÉCHEC ROTATION PILOTE : '+e.message);process.exitCode=1;});
