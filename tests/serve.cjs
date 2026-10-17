// Serveur statique limité au dépôt pour les tests locaux sans accès à GitHub Pages.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:4173');
  const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
  const full=path.resolve(root,'.'+name);
  if(!full.startsWith(root+path.sep)){res.writeHead(403).end('Forbidden');return;}
  fs.readFile(full,(err,data)=>{
   if(err){res.writeHead(404).end('Not found');return;}
   res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'text/plain; charset=utf-8','Cache-Control':'no-store'});
   res.end(data);
  });
 }catch(error){res.writeHead(400).end('Invalid request');}
}).listen(4173,'127.0.0.1',()=>console.log('S3E test server listening on 4173'));
