import http from 'node:http';
import session from '../api/session.js';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('');
const types = {'.ico':'image/x-icon','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
http.createServer(async(req,res)=>{
  try {
    if(new URL(req.url,'http://localhost').pathname==='/api/session'){await session(req,res);return;}
    let pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname === '/missao') pathname = '/missao.html';
    if(pathname === '/recuperar') pathname = '/recuperar.html';
    if(pathname === '/painel') pathname = '/painel.html';
    if(pathname === '/simulador') pathname = '/simulador.html';
    if(!['/','/favicon.ico','/index.html','/simulador.html','/painel.html','/missao.html','/recuperar.html'].includes(pathname) && !pathname.startsWith('/src/')) throw new Error('Not found');
    const target = path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!target.startsWith(root+path.sep)) throw new Error('Not found');
    const body = await fs.readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT)||5173,'127.0.0.1',()=>console.log(`Simulador: http://localhost:${Number(process.env.PORT)||5173}`));
