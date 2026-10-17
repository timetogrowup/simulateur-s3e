// Tests de non-régression du prototype GitHub Pages S3E (sans navigateur).
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length,'Bloc JavaScript introuvable');
const js=scripts.map(m=>m[1]).join('\n');
new vm.Script(js,{filename:'index.inline.js'});
const root={innerHTML:''};
const localData=new Map();
let saveName='Essai S3E';
let deletionConfirmed=true;
const context=vm.createContext({
 document:{getElementById:id=>id==='root'?root:{onsubmit:null}},
 window:{print:()=>{}},
 localStorage:{getItem:key=>localData.get(key)??null,setItem:(key,value)=>localData.set(key,value)},
 prompt:()=>saveName,confirm:()=>deletionConfirmed,
 alert:()=>{},console,JSON,Number,Object,Math,URL,Blob,FormData,
});
// Les référentiels sont évalués avant le code de la page, comme dans index.html.
for(const path of ['referentiels/aen_TEST.js','referentiels/compensations_TEST.js','referentiels/vehicules_TEST.js','referentiels/hypotheses_TEST.js']){
  vm.runInContext(fs.readFileSync(path,'utf8'),context,{timeout:3000,filename:path});
}
vm.runInContext(js,context,{timeout:3000});
const ev=(str)=>vm.runInContext(str,context);
assert.match(root.innerHTML,/Commencer/,'Accueil présent');
assert.equal(ev('qs.length'),25,'25 questions : ajout des recharges publiques payantes');
assert.ok(ev('uxCopy.budget[1]').includes('rendiez'),'Scénario personnel explicite');
assert.ok(ev('uxCopy.years[1]').includes('rendiez'),'Durée rattachée au scénario');
assert.ok(ev('uxCopy.persMotor[1]').includes('fonction'),'Motorisation rattachée au scénario');
assert.ok(ev('uxCopy.comp[1]').includes('rendiez'),'Compensation rattachée au scénario');
ev("answers.futureMotor='Diesel (dérogation)'");
assert.equal(ev("active().some(q=>q.id==='home')"),false,'Recharge masquée si non électrique');
ev("answers.futureMotor='Électrique';answers.home='Impossible'");
assert.equal(ev("active().some(q=>q.id==='homeShare')"),false,'Recharge domicile impossible');
assert.equal(ev("active().some(q=>q.id==='homePrice')"),false,'Tarif domicile masqué');
assert.equal(ev("active().some(q=>q.id==='publicPaidShare')"),false,'Part publique imposée à 100 % si domicile impossible');
assert.equal(ev("active().some(q=>q.id==='publicPrice')"),true,'Tarif public demandé si domicile impossible');
ev("answers.home='Installation nécessaire'");
assert.equal(ev("active().some(q=>q.id==='install')"),true,'Installation conditionnelle');
ev("answers.budget='15 000 à 25 000 €';answers.years='5 à 6 ans';answers.comp='150 €/mois';answers.persMotor='Diesel';answers.motor='Diesel';answers.futureMotor='Électrique';answers.home='Déjà installée';answers.homeShare='25 à 50 %';answers.tax='30 %';answers.aen='200 €/mois';answers.aenFuture='200 €/mois'");
const result=ev('calculate(estimates())');
assert.equal(result.length,3,'Trois scénarios calculés');
assert.ok(result.every(x=>Number.isFinite(x.cost)&&Number.isFinite(x.gain)),'Montants finis');
assert.equal(result[0].gain,0,'Écart véhicule actuel = 0');
assert.throws(()=>ev('calculate({...estimates(),homeShare:1.2})'),/100/,'Contrôle proportion domicile');
ev("view='wizard'; step=active().findIndex(q=>q.id==='budget');draw()");
assert.match(root.innerHTML,/Et si vous rendiez votre voiture de fonction/,'Introduction avant achat');
// Contrôles du moteur financier : ventilation, financement distinct et remboursements.
ev("answers.commutePayer='SUEZ';answers.privatePayer='Salarié'");
const scenario=ev('calculate(estimates())');
assert.equal(scenario[0].breakdown.commute,0,'Trajets domicile-travail actuels pris en charge par SUEZ');
assert.ok(scenario[0].breakdown.privateEnergy>0,'Énergie privée actuelle supportée par le salarié');
assert.ok(scenario[2].breakdown.depreciation>0,'Véhicule personnel valorisé par dépréciation');
assert.ok(scenario[2].breakdown.compensation<=0,'Compensation déduite des coûts');
assert.ok(scenario.every(x=>Math.abs(x.cost-Object.values(x.breakdown).reduce((a,b)=>a+b,0))<.00001),'Somme des postes égale coût');
const beforePro=ev('calculate({...estimates(),professional:0})');
const afterPro=ev('calculate({...estimates(),professional:40000})');
assert.ok(beforePro.every((v,i)=>Math.abs(v.cost-afterPro[i].cost)<.00001),'Aucun coût salarié supplémentaire pour les kilomètres professionnels');
ev("answers.commutePayer='Salarié';answers.privatePayer='SUEZ'");
const reverse=ev('calculate(estimates())');
assert.ok(reverse[0].breakdown.commute>0&&reverse[0].breakdown.privateEnergy===0,'Prises en charge par usage indépendantes');
ev("view='report';base=estimates();draw()");
assert.match(root.innerHTML,/Détail des postes annuels/,'Ventilation financière visible');
// Différenciation des motorisations et sensibilités.
const assumptions=ev('estimates()');
assert.ok(assumptions.petrolPrice>assumptions.dieselPrice,'Deux tarifs de carburants distincts');
ev("answers.motor='Diesel';answers.commutePayer='Salarié';answers.privatePayer='Salarié'");
const diesel=ev('calculate(estimates())')[0].cost;
ev("answers.motor='Essence'");
const petrol=ev('calculate(estimates())')[0].cost;
assert.notEqual(diesel,petrol,'Essence et diesel ont des coûts distincts');
ev("answers.persMotor='Hybride rechargeable'");
const phev=ev('calculate(estimates())');
assert.ok(phev.every(x=>Number.isFinite(x.cost)),'Hybride rechargeable calculable');
const sens=ev('sensitivities(estimates())');
assert.equal(sens.energy.length,3,'Trois hypothèses énergie');
assert.equal(sens.resale.length,3,'Trois hypothèses revente');
assert.ok(sens.energy[0].results[2].cost<sens.energy[2].results[2].cost,'Hausse énergie augmente coût personnel');
assert.ok(sens.resale[0].results[2].cost>sens.resale[2].results[2].cost,'Hausse revente réduit coût personnel');
ev("view='report';base=estimates();draw()");
assert.match(root.innerHTML,/Comparaison des coûts économiques nets annuels/,'Graphique coûts visible');
assert.match(root.innerHTML,/Analyses de sensibilité/,'Sensibilités visibles');
assert.match(root.innerHTML,/Gains ou pertes de pouvoir d’achat/,'Graphique gains visible');
// Règle SUEZ de recharge : seules les charges à domicile sont payées par le salarié.
assert.equal(ev("qs.some(q=>q.id==='freeShare')"),false,'Question inutile supprimée');
ev("answers.futureMotor='Électrique';answers.persMotor='Électrique';answers.home='Impossible'");
const zeroHome=ev('calculate({...estimates(),homeShare:0})');
assert.ok(zeroHome[1].breakdown.commute+zeroHome[1].breakdown.privateEnergy>0,'Sans domicile : bornes publiques payantes facturées au salarié');
assert.ok(zeroHome[2].breakdown.commute+zeroHome[2].breakdown.privateEnergy>0,'Véhicule personnel : charges publiques payantes');
const allPublic=ev('calculate({...estimates(),homeShare:0,publicPrice:.60})');
const annualOutside=ev('estimates().trip+estimates().personal');
const expectedOutside=annualOutside*.60*ev('estimates().consumptionElectric')/100;
assert.ok(Math.abs(allPublic[1].breakdown.commute+allPublic[1].breakdown.privateEnergy-expectedOutside)<.00001,'100 % public payant = km × kWh/100 × prix public');
ev("answers.home='Déjà installée';answers.publicPaidShare='0 %';answers.homeShare='0 %'");
const freeSuez=ev('calculate({...estimates(),homeShare:0,publicPaidShare:0})');
assert.equal(freeSuez[1].breakdown.commute+freeSuez[1].breakdown.privateEnergy,0,'Recharge hors domicile réellement prise en charge SUEZ sans coût');
const halfPublic=ev('calculate({...estimates(),homeShare:0,publicPaidShare:.5,publicPrice:.60})');
assert.ok(Math.abs((halfPublic[1].breakdown.commute+halfPublic[1].breakdown.privateEnergy)-expectedOutside/2)<.00001,'50 % des recharges hors domicile payantes');
ev("answers.home='Impossible'");
const fullHome=ev('calculate({...estimates(),homeShare:1})');
assert.ok(fullHome[1].breakdown.commute+fullHome[1].breakdown.privateEnergy>0,'Futur SUEZ : part domicile payante');
assert.equal(ev('active().some(q=>q.id==="freeShare")'),false,'Absence dans parcours conditionnel');
assert.ok(ev('estimates().publicPaidShare')===1,'Sans domicile la part publique payante vaut 100 %');
// Évolution AEN-001 : le brut n'est jamais une charge directe.
const eAen=ev('estimates()');
const impact=ev('netImpact(2400,estimates())');
assert.ok(impact.social>0&&impact.tax>0,'Séparation des cotisations et de l’impôt');
assert.ok(impact.cost<impact.gross,'Coût AEN distinct du montant brut déclaré');
assert.ok(Math.abs(impact.cost-impact.social-impact.tax)<1e-7,'Somme des deux composantes');
const withoutDeduction=ev('netImpact(2400,{...estimates(),socialDeductibleShare:0})');
assert.ok(impact.tax<withoutDeduction.tax,'Déductibilité réduit la base fiscale estimée');
const zeroTax=ev('netImpact(2400,{...estimates(),tax:0})');
assert.equal(zeroTax.tax,0,'TMI à zéro supprime surcoût impôt');
ev("answers.aen='200 €/mois';answers.aenFuture='200 €/mois'");
const rAen=ev('calculate(estimates())');
assert.ok(rAen[0].breakdown.aenSocial>0&&rAen[0].breakdown.aenTax>0,'AEN ventilé en deux postes');
assert.ok(!('aen' in rAen[0].breakdown),'Le brut AEN n’entre pas comme coût');
assert.ok(rAen[2].breakdown.compensation<0,'Compensation nette déduite');
ev("base=estimates();view='report';draw()");
assert.match(root.innerHTML,/AEN : cotisations salariales estimées/,'Ventilation AEN visible');
// Trésorerie : pas de double comptage du prix d'achat ni de la revente.
ev("answers.persMotor='Diesel';answers.futureMotor='Électrique';answers.home='Installation nécessaire';answers.subsidy='Non'");
const cashAssumptions=ev('estimates()');
const cashResults=ev('calculate(estimates())');
const schedule=ev('cashflowSchedule(estimates(),calculate(estimates()))');
assert.equal(schedule.rows.length,Math.ceil(cashAssumptions.years),'Périodes annuelles et fraction terminale');
assert.ok(schedule.rows[0].items[2].oneOff>=cashAssumptions.purchase,'Achat décaissé intégralement au départ');
assert.equal(schedule.rows[1].items[2].oneOff,0,'Aucun nouvel achat en année 2');
assert.equal(schedule.rows.at(-1).items[2].sale,cashAssumptions.purchase*.38,'Revente versée une seule fois en fin de période');
assert.ok(schedule.rows.slice(0,-1).every(row=>row.items[2].sale===0),'Pas de vente avant échéance');
assert.ok(schedule.discrepancy.every(x=>Math.abs(x)<0.01),'Rapprochement économique et trésorerie');
assert.ok(schedule.rows[0].items[1].oneOff>0,'Installation SUEZ à domicile décaissée au début');
const noInstall=ev("cashflowSchedule({...estimates(),install:0},calculate({...estimates(),install:0}))");
assert.equal(noInstall.rows[0].items[1].oneOff,0,'Sans installation, aucun paiement initial futur SUEZ');
ev("base=estimates();view='report';draw()");
assert.match(root.innerHTML,/Trésorerie réelle et coût économique/,'Tableau de trésorerie affiché');
assert.match(root.innerHTML,/Évolution du décaissement cumulé/,'Projection cumulée visible');
// Référentiels : absence de barèmes codés dans le calcul, valeurs tests cohérentes.
assert.equal(ev('validateReferentiels(REF)'),true,'Jeu de référentiels complet');
assert.equal(ev('REF.aen.montants.length'),4,'Quatre valeurs AEN test');
assert.equal(ev('REF.comp.montants.length'),4,'Quatre valeurs de compensation test');
assert.equal(ev("qs.find(q=>q.id==='aen').options[1]"),'200 €/mois','Question AEN dérivée du référentiel');
assert.equal(ev("qs.find(q=>q.id==='comp').options[2]"),'300 €/mois','Question compensation dérivée du référentiel');
assert.equal(ev('estimates().consumptionElectric'),20,'Consommation VE issue du catalogue test');
assert.equal(ev('estimates().insurance'),700,'Assurance issue hypothèses test');
assert.throws(()=>ev("validateReferentiels({...REF,aen:{statut:'FICTIF',montants:[]}})"),/Barème/,'Rejet d’un barème vide');
assert.throws(()=>ev("validateReferentiels({...REF,comp:null})"),/manquants/,'Rejet d’un fichier manquant');
// Affinage en cinq sections et validation sans recalcul automatique.
ev("base=estimates();detail={};last=null;view='refine';draw()");
assert.equal(ev('refineGroups.length'),5,'Cinq sections métiers');
assert.match(root.innerHTML,/Vos déplacements/,'Section déplacements visible');
assert.match(root.innerHTML,/Votre véhicule actuel/,'Section situation actuelle visible');
assert.match(root.innerHTML,/Demain avec une voiture de fonction/,'Section future visible');
assert.match(root.innerHTML,/Demain sans voiture de fonction/,'Section personnelle visible');
assert.match(root.innerHTML,/Fiscalité et hypothèses/,'Section fiscalité visible');
assert.match(root.innerHTML,/Réinitialiser cette section/,'Réinitialisation par section visible');
assert.match(root.innerHTML,/Réinitialiser tout/,'Réinitialisation globale visible');
assert.match(root.innerHTML,/Estimation initiale/,'Valeurs sources conservées');
assert.equal(ev('last'),null,'Ouverture du formulaire sans recalcul');
assert.equal(ev('validateRefine(refineInitial().values)'),null,'Valeurs initiales valides');
assert.match(ev('validateRefine({...refineInitial().values,homeShare:1.5})'),/taux/,'Recharge impossible rejetée');
assert.match(ev('validateRefine({...refineInitial().values,resale:999999})'),/revente/,'Revente aberrante rejetée');
assert.match(ev('validateRefine({...refineInitial().values,purchase:NaN})'),/numériques/,'Champs manquants rejetés');
// Comparaison premier bilan / bilan affiné : uniquement quand le bilan affiné existe.
ev("base=estimates();detail={};last=null;view='report';draw()");
assert.doesNotMatch(root.innerHTML,/Évolution entre le premier bilan et le bilan affiné/,'Ne pas afficher le comparatif sur le premier bilan');
const firstResults=ev('calculate(base)');
const changedAssumptions=ev('({...base,maintenance:base.maintenance+240})');
const refinedResults=ev('calculate({...base,maintenance:base.maintenance+240})');
const comparison=ev('compareBilans(calculate(base),calculate({...base,maintenance:base.maintenance+240}))');
assert.equal(comparison.length,3,'Trois situations dans le comparatif');
assert.ok(Math.abs(comparison[2].annualCostDelta-240)<1e-8,'Entretien +240 euros donne hausse de 240 euros annuels');
assert.ok(Math.abs(comparison[2].monthlyCostDelta-20)<1e-8,'Hausse mensuelle égale 20 euros');
assert.ok(Math.abs(comparison[2].annualGainDelta+240)<1e-8,'Une hausse du coût diminue le pouvoir d’achat');
assert.equal(comparison[0].annualCostDelta,0,'La situation actuelle est inchangée dans le test');
ev("detail={maintenance:base.maintenance+240};last=calculate({...base,...detail});view='refined';draw()");
assert.match(root.innerHTML,/Évolution entre le premier bilan et le bilan affiné/,'Comparatif présent seulement au bilan affiné');
assert.match(root.innerHTML,/Variation du pouvoir d’achat/,'Gain ou perte affiché');
assert.match(root.innerHTML,/Bilan affiné/,'Restitution existante préservée');
assert.throws(()=>ev('compareBilans([],[])'),/incompatibles/,'Rejeter bilans incomplets');
// Sauvegardes nommées, intégrité, persistance et reprise.
ev("answers.motor='Diesel';base=estimates();detail={};last=null;view='report';draw()");
ev('save()');
assert.equal(ev('readSaves().length'),1,'Première sauvegarde conservée');
assert.equal(ev('readSaves()[0].title'),'Essai S3E','Nom de simulation conservé');
ev("answers.motor='Essence';save()");
assert.equal(ev('readSaves().length'),2,'Plusieurs simulations indépendantes');
const firstSaveId=ev('readSaves()[1].id');
ev("answers.motor='Diesel'");
ev("restoreSave(readSaves()[0].id)");
assert.equal(ev('answers.motor'),'Essence','Restauration des réponses de la deuxième simulation');
ev("restoreSave(readSaves()[1].id)");
assert.equal(ev('answers.motor'),'Diesel','Restauration des réponses de la première simulation');
ev('load()');
assert.match(root.innerHTML,/Mes simulations sauvegardées/,'Page de reprise disponible');
assert.match(root.innerHTML,/Reprendre/,'Action de reprise disponible');
assert.match(root.innerHTML,/Supprimer/,'Action de suppression disponible');
ev('removeSave(readSaves()[0].id)');
assert.equal(ev('readSaves().length'),1,'Suppression d’une simulation précise');
assert.ok(ev('validSnapshot(snapshot())')===false,'Vue des sauvegardes non enregistrable');
assert.throws(()=>ev("readSaves.call(null);validateReferentiels({...REF,comp:null})"),/manquants/,'Tests référentiels préservés');
assert.equal(ev('validSnapshot({view:"report",answers:{},detail:{},step:0,base:null})'),false,'Sauvegarde bilan sans base rejetée');
localData.set('s3e-simulations-v2','{broken JSON');
assert.throws(()=>ev('readSaves()'),SyntaxError,'Stockage corrompu refusé');
localData.delete('s3e-simulations-v2');
localData.set('s3e-mobile-test',JSON.stringify({answers:{motor:'Diesel'},step:0,view:'wizard',base:null,detail:{},last:null}));
ev('migrateLegacy()');
assert.equal(ev('readSaves()[0].title'),'Ancienne simulation','Migration de la sauvegarde initiale');
assert.ok(localData.has('s3e-mobile-test'),'Ancien format préservé pour retour arrière');
// Ancienne simulation affinée : ne pas restituer un ancien calcul de recharge gratuite.
ev("answers.futureMotor='Électrique';answers.home='Impossible';base=estimates();detail={};last=calculate(base);view='refined'");
ev("last[1].breakdown.commute=0;last[1].breakdown.privateEnergy=0");
ev("storeSaves([{id:'old-refined',title:'Ancienne estimation',savedAt:Date.now(),data:snapshot()}])");
ev("restoreSave('old-refined')");
assert.ok(ev('last[1].breakdown.commute+last[1].breakdown.privateEnergy')>0,'Restauration recalculée avec bornes publiques payantes');
ev("base={...base,publicPaidShare:undefined,publicPrice:undefined};view='refine';draw()");
assert.ok(ev('Number.isFinite(refineInitial().values.publicPrice)'),'Anciennes sauvegardes : tarif public prérempli');
assert.equal(ev('refineInitial().values.publicPaidShare'),1,'Anciennes sauvegardes : domicile impossible = public payant');
console.log('OK : parcours, AEN, trésorerie, bilans et sauvegardes multiples');



