const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',
 testMatch:'browser.spec.cjs',
 timeout:60000,
 expect:{timeout:10000},
 retries:process.env.CI?1:0,
 reporter:process.env.CI?[['list'],['html',{open:'never'}]]:'list',
 use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'mobile-chromium',use:{...devices['Pixel 7'],browserName:'chromium'}},
  {name:'desktop-chromium',use:{browserName:'chromium',viewport:{width:1280,height:800}}}
 ],
 webServer:{command:'node tests/serve.cjs',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,timeout:30000}
});
