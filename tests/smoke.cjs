// Tests de non-régression du prototype GitHub Pages S3E (sans navigateur).
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length,'Bloc JavaScript introuvable');
const js=scripts.map(m=>m[1]).join('\n');
new vm.Script(js,{filename:'index.inline.js'});
const root={innerHTML:''};
const context=vm.createContext({
 document:{getElementById:id=>id==='root'?root:{onsubmit:null}},
 window:{print:()=>{}},
 localStorage:{getItem:()=>null,setItem:()=>{}},
 alert:()=>{},console,JSON,Number,Object,Math,URL,Blob,FormData,
});
vm.runInContext(js,context,{timeout:3000});
const ev=(str)=>vm.runInContext(str,context);
assert.match(root.innerHTML,/Commencer/,'Accueil présent');
assert.equal(ev('qs.length'),23,'23 questions : retrait de la recharge gratuite hors domicile');
assert.ok(ev('uxCopy.budget[1]').includes('rendiez'),'Scénario personnel explicite');
assert.ok(ev('uxCopy.years[1]').includes('rendiez'),'Durée rattachée au scénario');
assert.ok(ev('uxCopy.persMotor[1]').includes('fonction'),'Motorisation rattachée au scénario');
assert.ok(ev('uxCopy.comp[1]').includes('rendiez'),'Compensation rattachée au scénario');
ev("answers.futureMotor='Diesel (dérogation)'");
assert.equal(ev("active().some(q=>q.id==='home')"),false,'Recharge masquée si non électrique');
ev("answers.futureMotor='Électrique';answers.home='Impossible'");
assert.equal(ev("active().some(q=>q.id==='homeShare')"),false,'Recharge domicile impossible');
assert.equal(ev("active().some(q=>q.id==='homePrice')"),false,'Tarif domicile masqué');
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
assert.equal(zeroHome[1].breakdown.commute+zeroHome[1].breakdown.privateEnergy,0,'Futur véhicule SUEZ : 0 % domicile = énergie offerte');
assert.ok(zeroHome[2].breakdown.commute+zeroHome[2].breakdown.privateEnergy>0,'Véhicule personnel : charges publiques payantes');
const fullHome=ev('calculate({...estimates(),homeShare:1})');
assert.ok(fullHome[1].breakdown.commute+fullHome[1].breakdown.privateEnergy>0,'Futur SUEZ : part domicile payante');
assert.equal(ev('active().some(q=>q.id==="freeShare")'),false,'Absence dans parcours conditionnel');
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
console.log('OK : parcours, AEN, calculs financiers et échéancier de trésorerie');



