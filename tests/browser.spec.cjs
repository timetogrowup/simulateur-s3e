const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');

test('parcours, recharge payante, affinage et export/import',async({page},testInfo)=>{
 const pageErrors=[];
 page.on('pageerror',error=>pageErrors.push(error.message));
 page.on('dialog',async dialog=>{
  if(dialog.type()==='prompt')await dialog.accept('S3E Recette navigateur');
  else await dialog.accept();
 });
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Votre véhicule, votre pouvoir d’achat'})).toBeVisible();
 await expect(page.getByText(/fictives/).first()).toBeVisible();
 await page.getByRole('button',{name:'Commencer'}).click();

 let reachedRecap=false;
 for(let i=0;i<30;i++){
  const heading=page.locator('article h2').first();
  if(await page.getByRole('heading',{name:'Récapitulatif'}).count()){
   reachedRecap=true;break;
  }
  await expect(heading).toBeVisible();
  const title=await heading.textContent();
  const radios=page.locator('input[name="choice"]');
  let optionIndex=0;
  if(/recharger.*domicile|Recharge possible à domicile/i.test(title)){
    optionIndex=await page.locator('label.opt').allTextContents().then(xs=>xs.findIndex(x=>x.includes('Impossible')));
    expect(optionIndex).toBeGreaterThanOrEqual(0);
  }
  if(/Tarif des bornes publiques payantes/i.test(title)){
   throw new Error('Le tarif public ne doit pas être demandé dans le parcours rapide si domicile impossible.');
  }
  await radios.nth(optionIndex).check();
  await page.getByRole('button',{name:'Suivant'}).click();
 }
 expect(reachedRecap).toBeTruthy();
 await page.getByRole('button',{name:'Calculer le premier bilan'}).click();
 await expect(page.getByRole('heading',{name:'Premier bilan estimatif'})).toBeVisible();
 await page.getByRole('button',{name:'Affiner mon bilan'}).click();
 await expect(page.getByRole('heading',{name:'Affiner le bilan'})).toBeVisible();
 const publicPrice=page.locator('#detail input[name="publicPrice"]');
 await expect(publicPrice).toHaveValue('0.5');
 await publicPrice.fill('0.75');
 await page.getByRole('button',{name:'Recalculer le bilan affiné'}).click();
 await expect(page.getByRole('heading',{name:'Bilan affiné'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Évolution entre le premier bilan et le bilan affiné'})).toBeVisible();

 const csvDownload=page.waitForEvent('download');
 await page.getByRole('button',{name:'Exporter CSV détaillé'}).click();
 const csv=await csvDownload;
 expect(csv.suggestedFilename()).toBe('S3E_TEST_bilan_detail.csv');
 const csvText=await fs.readFile(await csv.path(),'utf8');
 expect(csvText).toContain('bilan_affine');
 expect(csvText).toContain('publicPrice');

 const jsonDownload=page.waitForEvent('download');
 await page.getByRole('button',{name:'Sauvegarder en JSON'}).click();
 const json=await jsonDownload;
 const jsonBuffer=await fs.readFile(await json.path());
 const contents=JSON.parse(jsonBuffer.toString('utf8'));
 expect(contents.format).toBe('S3E_SIMULATION');
 expect(contents.schemaVersion).toBe(2);

 await page.getByRole('button',{name:'Sauvegarder',exact:true}).click();
 await page.reload();
 await page.getByRole('button',{name:'Reprendre une sauvegarde'}).click();
 await expect(page.getByRole('heading',{name:'Mes simulations sauvegardées'})).toBeVisible();
 await expect(page.getByText('S3E Recette navigateur').first()).toBeVisible();
 await page.getByRole('button',{name:'Reprendre'}).first().click();
 await expect(page.getByRole('heading',{name:'Bilan affiné'})).toBeVisible();

 await page.reload();
 const chooser=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'Importer un JSON'}).click();
 const fileChooser=await chooser;
 await fileChooser.setFiles({name:'simulation.json',mimeType:'application/json',buffer:jsonBuffer});
 await page.getByRole('button',{name:'Reprendre une sauvegarde'}).click();
 await expect(page.getByText('S3E Recette navigateur').first()).toBeVisible();
 expect(pageErrors).toEqual([]);
 if(testInfo.project.name==='mobile-chromium'){
  const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport+5);
 }
});

test('accueil et absence d’erreur JavaScript au chargement',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Commencer'})).toBeVisible();
 expect(errors).toEqual([]);
});
