// EVOL-TEST-003 lot B : contrôle des profils et des attendus séparés.
// Vérification arithmétique indépendante du moteur calculate() de l'application.
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const profiles=JSON.parse(fs.readFileSync('tests/profils/profils_s3e_TEST.json','utf8'));
const references=JSON.parse(fs.readFileSync('tests/references/attendus_s3e_TEST.json','utf8'));
assert.equal(profiles.format,'S3E_TEST_PROFILES');
assert.equal(references.format,'S3E_TEST_REFERENCES');
for(const obj of [profiles,references]){assert.equal(obj.schemaVersion,1);assert.equal(obj.statut,'FICTIF')}
assert.equal(profiles.profiles.length,10);
assert.equal(references.references.length,10);
const ids=profiles.profiles.map(p=>p.id);
assert.equal(new Set(ids).size,10,'Les identifiants des profils doivent être uniques');
assert.deepEqual(ids,Array.from({length:10},(_,i)=>'PR-'+String(i+1).padStart(2,'0')));
assert.deepEqual(references.references.map(r=>r.id),ids,'Un attendu par profil dans le même ordre');
// Les libellés du questionnaire sont ceux de la version courante du code.
const html=fs.readFileSync('index.html','utf8');
const inline=Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),x=>x[1]).join('\n');
const context=vm.createContext({
 window:{},document:{getElementById:()=>({innerHTML:''})},
 localStorage:{getItem:()=>null,setItem:()=>{}},
 console,Number,Object,Math,JSON,URL,Blob,FormData,alert:()=>{},setTimeout:()=>{}
});
for(const file of ['aen','compensations','vehicules','hypotheses']){
 vm.runInContext(fs.readFileSync('referentiels/'+file+'_TEST.js','utf8'),context,{timeout:3000});
}
vm.runInContext(inline,context,{timeout:3000});
const questionList=vm.runInContext('qs.map(q=>({id:q.id,options:q.options}))',context);
const options=new Map(Array.from(questionList,q=>[q.id,Array.from(q.options)]));
const finite=(n,label)=>assert.ok(typeof n==='number'&&Number.isFinite(n),label+' doit être un nombre fini');
const fraction=(n,label)=>{finite(n,label);assert.ok(n>=0&&n<=1,label+' doit être entre 0 et 1')};
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<0.000001,label+': attendu '+b+', calculé '+a);
function oracle(p){
 const o=p.oracle,kind=o.kind;let value,unit,measure;
 if(kind==='electric'){
  for(const key of ['km','kwh100','homeShare','homePrice','publicPaidShare','publicPrice'])finite(o[key],p.id+'/'+key);
  assert.ok(o.km>=0&&o.kwh100>0&&o.homePrice>=0&&o.publicPrice>=0);
  fraction(o.homeShare,'homeShare');fraction(o.publicPaidShare,'publicPaidShare');
  value=o.km*o.kwh100/100*(o.homeShare*o.homePrice+(1-o.homeShare)*o.publicPaidShare*o.publicPrice);
  unit='EUR/an';measure='cout_energie_eur_an';
 }else if(kind==='installation'){
  finite(o.gross,'gross');fraction(o.employeeShare,'employeeShare');assert.ok(o.gross>=0);
  value=o.gross*o.employeeShare;unit='EUR';measure='installation_restant_salarie';
 }else if(kind==='thermal'){
  for(const key of ['km','litres100','priceLitre']){finite(o[key],key);assert.ok(o[key]>=0)}
  value=o.km/100*o.litres100*o.priceLitre;unit='EUR/an';measure='cout_thermique_eur_an';
 }else if(kind==='professionalExclusion'){
  finite(o.professionalKm,'professionalKm');assert.equal(o.employeeRatePerKm,0);
  value=o.professionalKm*o.employeeRatePerKm;unit='EUR/an';measure='surcout_salarie_missions';
 }else if(kind==='depreciation'){
  for(const key of ['purchase','resale','years'])finite(o[key],key);
  assert.ok(o.purchase>=o.resale&&o.resale>=0&&o.years>0);
  value=(o.purchase-o.resale)/o.years;unit='EUR/an';measure='amortissement_simple';
 }else if(kind==='aen'){
  finite(o.grossAnnual,'grossAnnual');for(const key of ['socialRate','deductibleShare','taxRate'])fraction(o[key],key);
  value=o.grossAnnual*o.socialRate+Math.max(0,o.grossAnnual-o.grossAnnual*o.socialRate*o.deductibleShare)*o.taxRate;
  unit='EUR/an';measure='impact_aen_fictif';
 }else if(kind==='portable'){
  assert.equal(o.format,'S3E_SIMULATION');assert.equal(o.shouldPreserveExisting,true);
  value=o.schemaVersion;unit='schema';measure='version_json';
 }else throw Error('Type de cas inconnu '+kind);
 return {value,unit,measure};
}
for(let i=0;i<10;i++){
 const p=profiles.profiles[i],r=references.references[i];
 assert.equal(typeof p.name,'string');assert.ok(p.name.length>4);
 assert.equal(typeof p.description,'string');assert.ok(p.description.length>8);
 assert.ok(p.answers&&typeof p.answers==='object'&&!Array.isArray(p.answers));
 for(const [key,val] of Object.entries(p.answers)){
  assert.ok(options.has(key),'Question inconnue '+p.id+'/'+key);
  assert.ok(options.get(key).includes(val),'Réponse hors questionnaire '+p.id+'/'+key+' : '+val);
 }
 const check=oracle(p);
 assert.equal(check.measure,r.measure);assert.equal(check.unit,r.unit);
 assert.equal(p.oracle.kind,r.kind);close(check.value,r.value,p.id);
 if(p.oracle.kind==='electric'&&p.oracle.refinedPrice!==undefined){
  const o=p.oracle;
  finite(o.refinedPrice,'refinedPrice');
  const refined=o.km*o.kwh100/100*(o.homeShare*o.homePrice+(1-o.homeShare)*o.publicPaidShare*o.refinedPrice);
  close(refined,r.refinedValue,p.id+' affiné');
  close(refined-check.value,r.refinedDelta,p.id+' variation');
 }
 console.log('OK '+p.id+' : '+p.name);
}
assert.equal(references.references[0].value,1500);
assert.equal(references.references[0].refinedValue,2250);
assert.equal(references.references[0].refinedDelta,750);
console.log('OK : 10 profils synthétiques, libellés questionnaire et attendus indépendants conformes.');
