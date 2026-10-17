// Traçabilité documentaire du projet, sans prétendre valider le contenu métier.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const mandatory=[
 'docs/gouvernance_projet_chatgpt_github.txt',
 'docs/guide_developpement_supervise.txt',
 'docs/evolutions/EVOL-CI-001_github_actions.txt'
];
for(const filename of mandatory){
 assert.ok(fs.existsSync(filename),'Document TXT obligatoire absent : '+filename);
 const content=fs.readFileSync(filename,'utf8');
 assert.ok(content.length>150,'Document TXT vide ou trop court : '+filename);
 assert.ok(!content.includes('\uFFFD'),'Encodage UTF-8 suspect : '+filename);
}
const guide=fs.readFileSync(mandatory[1],'utf8');
assert.match(guide,/Version\s+\d+\.\d+/,'Guide : numéro de version requis');
const governance=fs.readFileSync(mandatory[0],'utf8');
assert.match(governance,/GOUVERNANCE/,'Gouvernance : intitulé non reconnu');
const hasBase=process.env.S3E_DIFF_BASE;
if(hasBase&&/^[a-fA-F0-9]{40}$/.test(hasBase)&&!/^0{40}$/.test(hasBase)){
 const names=cp.execFileSync('git',['diff','--name-only',hasBase, 'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 const appChanged=names.some(n=>n==='index.html'||n.startsWith('referentiels/')||n.startsWith('src/'));
 const docChanged=names.some(n=>n.startsWith('docs/')&&n.endsWith('.txt'));
 if(appChanged) assert.ok(docChanged,'Évolution applicative sans mise à jour de document TXT dans docs/ : '+names.join(', '));
 console.log('OK : historique documentaire contrôlé sur '+names.length+' fichier(s) modifié(s).');
}else{
 console.log('INFO : base Git non fournie : contrôle de différence non exécuté (présence TXT contrôlée).');
}
console.log('OK : documents TXT principaux présents et contrôlés.');
