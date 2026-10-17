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
console.log('OK : syntaxe et 13 contrôles fonctionnels du questionnaire et calcul');
