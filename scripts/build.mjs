import fs from 'node:fs/promises';
await fs.mkdir('dist',{recursive:true});
await fs.copyFile('index.html','dist/index.html');
await fs.copyFile('simulador.html','dist/simulador.html');
await fs.cp('src','dist/src',{recursive:true});
console.log('Aplicação estática gerada em dist/');

await fs.copyFile('painel.html','dist/painel.html');
