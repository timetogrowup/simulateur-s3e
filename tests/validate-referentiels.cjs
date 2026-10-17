// Contrôle de structure des référentiels FICTIFS ; pas de validation métier SUEZ.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const files={
 aen:'aen_TEST.js',comp:'compensations_TEST.js',
 vehicles:'vehicules_TEST.js',assumptions:'hypotheses_TEST.js'
};
const ctx=vm.createContext({window:{}});
for(const filename of Object.values(files)){
 const full=path.join('referentiels',filename);
 assert.ok(fs.existsSync(full),'Fichier de référentiel manquant : '+full);
 vm.runInContext(fs.readFileSync(full,'utf8'),ctx,{filename:full,timeout:2000});
}
const {S3E_AEN_TEST:aen,S3E_COMPENSATIONS_TEST:comp,S3E_VEHICULES_TEST:vehicles,S3E_HYPOTHESES_TEST:h}=ctx.window;
const pos=(v,label,zero=true)=>{
 assert.ok(typeof v==='number'&&Number.isFinite(v),'Valeur numérique invalide : '+label);
 assert.ok(zero?v>=0:v>0,'Valeur hors bornes : '+label);
};
const ratio=(v,label)=>{pos(v,label);assert.ok(v<=1,'Taux supérieur à 100 % : '+label)};
for(const [label,obj] of Object.entries({aen,comp,vehicles,assumptions:h})){
 assert.ok(obj&&typeof obj==='object','Référentiel introuvable : '+label);
 assert.equal(obj.statut,'FICTIF','Statut de test obligatoire : '+label);
 assert.ok(typeof obj.version==='string'&&obj.version.startsWith('TEST-'),'Version de test absente : '+label);
}
for(const [label,obj] of Object.entries({aen,comp})){
 assert.equal(obj.unite,'EUR_PAR_MOIS','Unité incorrecte : '+label);
 assert.ok(Array.isArray(obj.montants)&&obj.montants.length>0,'Barème mensuel vide : '+label);
 obj.montants.forEach((v,i)=>pos(v,label+'['+i+']'));
 assert.ok(obj.montants.every((v,i,a)=>i===0||v>a[i-1]),'Barème non strictement croissant : '+label);
}
const c=vehicles.consommations;
assert.ok(c&&typeof c==='object','Consommations manquantes');
for(const [type,field] of [['Diesel','litresDiesel100'],['Essence','litresEssence100'],['Hybride','litresEssence100'],['Hybride rechargeable','litresEssence100'],['Hybride rechargeable','kwh100'],['Électrique','kwh100']]){
 assert.ok(c[type]&&typeof c[type]==='object','Motorisation absente : '+type);
 pos(c[type][field],type+'/'+field,false);
}
assert.ok(h.prix&&h.frais&&h.fiscalite&&h.revente,'Sections hypothèses manquantes');
for(const key of ['diesel','essence','kwhDomicile','kwhPublic'])pos(h.prix[key],'prix.'+key,false);
for(const key of ['assuranceAnnuelle','entretienAnnuel','autresAnnuels'])pos(h.frais[key],'frais.'+key);
ratio(h.fiscalite.cotisationsSalarialesEstimees,'cotisations fictives');
ratio(h.fiscalite.partDeductibleEstimee,'déductibilité fictive');
ratio(h.revente.fractionPrixAchat,'fraction de revente');
console.log('OK : quatre référentiels TEST valides (structure, types, valeurs et unités).');
