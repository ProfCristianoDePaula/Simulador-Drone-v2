import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
function check(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())check(file);else if(/\.(js|mjs)$/.test(file))execFileSync(process.execPath,['--check',file],{stdio:'inherit'});}}
check('api');check('src');check('scripts');check('tests');
for(const file of ['index.html','simulador.html','painel.html','missao.html','recuperar.html','ajuda.html']){
  const html=fs.readFileSync(file,'utf8');
  if(/<style>|<script[^>]*>\s*\S+[\s\S]*?<\/script>|\son\w+=/.test(html))throw new Error('Código inline encontrado em '+file);
}
console.log('Sintaxe válida; HTML sem lógica, estilos ou eventos inline.');
