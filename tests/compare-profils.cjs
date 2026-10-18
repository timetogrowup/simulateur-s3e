// EVOL-TEST-003 / Lot C : comparer les 10 profils synthétiques au moteur réel.
// Sorties : report/recette-profils.json et .txt, sans données réelles.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const profiles=JSON.parse(fs.readFileSync('tests/profils/profils_s3e_TEST.json','utf8')).profiles;
const refs=JSON.parse(fs.readFileSync('tests/references/attendus_s3e_TEST.json','utf8')).references;
const js=[...fs.readFileSync('index.html','utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const results=[];
const nearly=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=0.000001;
function contextFor(answers){
 const storage=new Map(),root={innerHTML:''};
 const context=vm.createContext({
  window:{},document:{getElementById:()=>root,createElement:()=>({click(){}})},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
  prompt:()=>null,confirm:()=>true,alert:()=>{},console,JSON,Number,Object,Math,URL,Blob,FormData,
  Date,setTimeout:()=>{}
 });
 for(const file of ['aen','compensations','vehicules','hypotheses'])
  vm.runInContext(fs.readFileSync('referentiels/'+file+'_TEST.js','utf8'),context,{filename:file,timeout:3000});
 vm.runInContext(js,context,{filename:'index.inline.js',timeout:3000});
 context.__profileAnswers=answers;
 vm.runInContext('answers={...__profileAnswers}',context,{timeout:3000});
 return {eval:s=>vm.runInContext(s,context,{timeout:3000}),context};
}
function run(p,ref){
 const {eval:ev,context}=contextFor(p.answers);
 const base=ev('estimates()');
 const original=ev('calculate(estimates())');
 if(original.length!==3||original.some(r=>!Number.isFinite(r.cost)||!Number.isFinite(r.gain)))
  throw Error('Calcul standard à trois scénarios invalide');
 const o=p.oracle;
 const calc=(overrides,scenario,keys)=>{
  context.__params={...base,...overrides};
  const rows=ev('calculate(__params)');
  return keys.reduce((sum,key)=>sum+(rows[scenario].breakdown[key]??0),0);
 };
 let actual,notes='Réponses du profil conservées. Paramètres chiffrés de l’oracle injectés dans le calcul affiné, non équivalents aux médianes des tranches.',status='OK';
 const km={trip:o.km,personal:0};
 if(o.kind==='electric'){
  const common={...km,consumptionElectric:o.kwh100,homeShare:o.homeShare,homePrice:o.homePrice,publicPaidShare:o.publicPaidShare,publicPrice:o.publicPrice,electricPublic:o.publicPrice};
  const scenario=p.id==='PR-08'?2:1;
  if(scenario===2&&o.publicPaidShare!==1)throw Error('oracle voiture personnelle incompatible');
  actual=calc(common,scenario,['commute','privateEnergy']);
  if(ref.refinedValue!==undefined){
   const updated=calc({...common,publicPrice:o.refinedPrice},scenario,['commute','privateEnergy']);
   if(!nearly(updated,ref.refinedValue)||!nearly(updated-actual,ref.refinedDelta))
    throw Error('Ecart sur tarif affiné, obtenu '+updated+' au lieu de '+ref.refinedValue);
  }
 }else if(o.kind==='installation'){
  actual=calc({install:o.gross,years:1},1,['installation']);
  notes='ECART CONNU : le moteur ne gère pas le pourcentage de subvention partielle ; il facture actuellement 100 % de l’installation (annualisée). Attendu référence : '+ref.value+' € à 50 % de prise en charge. Le correctif métier n’est pas décidé.';
  if(!nearly(actual,ref.value))status='ECART_CONNU';
 }else if(o.kind==='thermal'){
  actual=calc({trip:o.km,personal:0,consumptionDiesel:o.litres100,dieselPrice:o.priceLitre},1,['commute','privateEnergy']);
 }else if(o.kind==='professionalExclusion'){
  const before=calc({professional:0},1,['commute','privateEnergy','aenSocial','aenTax','installation']);
  const after=calc({professional:o.professionalKm},1,['commute','privateEnergy','aenSocial','aenTax','installation']);
  actual=after-before;
  notes='Invariant : changer uniquement les kilomètres de mission ne doit pas modifier le coût supporté par le salarié.';
 }else if(o.kind==='depreciation'){
  actual=calc({purchase:o.purchase,resale:o.resale,years:o.years},2,['depreciation']);
 }else if(o.kind==='aen'){
  actual=calc({social:o.socialRate,socialDeductibleShare:o.deductibleShare,tax:o.taxRate},1,['aenSocial','aenTax']);
 }else if(o.kind==='portable'){
  ev("base=estimates();detail={};last=null;view='report'");
  const portable=ev("portablePayload('Recette profile')");
  actual=portable.schemaVersion;
  if(portable.format!==o.format||portable.schemaVersion!==o.schemaVersion||
     !ev('validSnapshot(portablePayload().data)'))throw Error('Format ou instantané de sauvegarde non valide');
  notes='Contrôle du schéma JSON et instantané valides ; round-trip sur navigateur couvert séparément par Playwright.';
 }else throw Error('Type oracle inconnu : '+o.kind);
 if(status==='OK'&&!nearly(actual,ref.value))status='ECHEC';
 return {id:p.id,profil:p.name,type:o.kind,attendu:ref.value,obtenu:actual,ecart:actual-ref.value,unite:ref.unit,statut:status,notes};
}
for(const p of profiles){
 try{
  const ref=refs.find(r=>r.id===p.id);
  if(!ref)throw Error('Référence manquante');
  results.push(run(p,ref));
 }catch(e){results.push({id:p.id,profil:p.name,statut:'ECHEC',erreur:e.message});}
}
const totals={ok:results.filter(r=>r.statut==='OK').length,known:results.filter(r=>r.statut==='ECART_CONNU').length,failed:results.filter(r=>r.statut==='ECHEC').length};
const date=new Date().toISOString();
const report={format:'S3E_PROFILE_TEST_REPORT',version:1,createdAt:date,commit:process.env.GITHUB_SHA||'local',hypotheses:'FICTIF',scope:'10 contrôles moteur/valeurs numériques, PAS dix parcours Playwright',totals,results};
fs.mkdirSync('report',{recursive:true});
fs.writeFileSync('report/recette-profils.json',JSON.stringify(report,null,2)+'\n');
const txt=[
 'SIMULATEUR S3E — RAPPORT DE RECETTE DES PROFILS',
 'Date UTC : '+date,'Commit : '+report.commit,
 'Nature : contrôles automatisés du moteur avec paramètres numériques explicites.',
 'Résultats : OK='+totals.ok+', ECART_CONNU='+totals.known+', ECHEC='+totals.failed,
 'ATTENTION : références fictives. Pas de validation de paie ou fiscalité.',
 '',
 ...results.flatMap(r=>[r.id+' — '+r.profil+' — '+r.statut,
  'Attendu: '+r.attendu+' '+(r.unite||'')+' | Obtenu: '+r.obtenu+' | Différence: '+r.ecart,
  r.notes||r.erreur||'', ''])
].join('\n');
fs.writeFileSync('report/recette-profils.txt',txt);
process.stdout.write(txt);
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'### Recette S3E des 10 profils\n\n'+
 '| OK | Écarts connus | Échecs |\n|---:|---:|---:|\n| '+totals.ok+' | '+totals.known+' | '+totals.failed+' |\n\n'+
 results.filter(r=>r.statut!=='OK').map(r=>'- '+r.id+' : **'+r.statut+'** — '+(r.notes||r.erreur)).join('\n')+'\n');
if(totals.failed)process.exitCode=1;
