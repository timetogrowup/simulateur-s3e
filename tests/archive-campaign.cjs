// EVOL-TEST-004 — métadonnées horodatées de chaque campagne automatisée.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const now=new Date().toISOString();
const runId=process.env.GITHUB_RUN_ID||'local';
const attempt=process.env.GITHUB_RUN_ATTEMPT||'1';
const prefix=process.env.S3E_CAMPAIGN_PREFIX||'recette-pilote';
const name=prefix+'-'+runId+'-'+attempt;
const phase=process.env.S3E_PHASE||'pilote';
const unit=process.env.S3E_UNIT_OUTCOME||'unknown';
const browser=process.env.S3E_BROWSER_OUTCOME||'unknown';
const success=unit==='success'&&browser==='success';
const target=path.join('report','campagne');
fs.mkdirSync(target,{recursive:true});
let count=null,known=null,failed=null;
try{
 const summary=JSON.parse(fs.readFileSync('report/recette-profils.json','utf8'));
 count=summary.totals.ok;known=summary.totals.known;failed=summary.totals.failed;
}catch(e){ /* documenter absence de résultat sans masquer le défaut */ }
const report={format:'S3E_CAMPAIGN',version:1,phase,name,runId,attempt,
 dateUTC:now,commit:process.env.GITHUB_SHA||'local',event:process.env.GITHUB_EVENT_NAME||'local',
 requestedFrequencyMinutes:phase==='quotidien'?1440:10,
 dateParis:new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'short',timeStyle:'medium'}).format(new Date(now)),
 unitOutcome:unit,browserOutcome:browser,
 totals: {ok:count,known,failed},
 status:success?'SUCCESS':'FAILURE',
 limitations:['Référentiels fictifs','Recette physique non réalisée','ECART_CONNU PR-03 non validé métier']};
fs.writeFileSync(path.join(target,'metadata.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(target,'statut-campagne.txt'),[
 'S3E — CAMPAGNE '+phase.toUpperCase()+' HORODATÉE',
 'Identifiant : '+name,
 'Date UTC : '+now,'Run GitHub : '+runId,'Tentative : '+attempt,
 'SHA : '+report.commit,'Déclencheur : '+report.event,
 'Contrôles de calcul : '+unit,'Tests navigateur : '+browser,
 'Verdict global : '+report.status,
 'Profils OK : '+count+', écarts connus : '+known+', échecs : '+failed,
 'Rapports métier fictifs : pas de validation fiscale ni de paie.'
].join('\n')+'\n');
console.log('Rapport campagne écrit : '+name+' / '+report.status);
