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
assert.equal(ev('qs.length'),24,'24 questions');
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
ev("answers.budget='15 000 à 25 000 €';answers.years='5 à 6 ans';answers.comp='150 €/mois';answers.persMotor='Diesel';answers.motor='Diesel';answers.futureMotor='Électrique';answers.home='Déjà installée';answers.homeShare='25 à 50 %';answers.freeShare='10 %';answers.tax='30 %';answers.aen='200 €/mois';answers.aenFuture='200 €/mois'");
const result=ev('calculate(estimates())');
assert.equal(result.length,3,'Trois scénarios calculés');
assert.ok(result.every(x=>Number.isFinite(x.cost)&&Number.isFinite(x.gain)),'Montants finis');
assert.equal(result[0].gain,0,'Écart véhicule actuel = 0');
assert.throws(()=>ev('calculate({...estimates(),homeShare:.8,freeShare:.5})'),/100/,'Contrôle du cumul recharge');
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
console.log('OK : syntaxe, parcours, moteur par motorisation, sensibilités et graphiques');


