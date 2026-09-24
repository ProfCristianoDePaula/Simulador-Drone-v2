import './ui/viewport.js';
import {bootSimulator} from './simulator/engine.js';
const $ = id => document.getElementById(id);
bootSimulator().catch(error=>{
  $("boot").hidden=false;
  $("boot").replaceChildren();
  const box=document.createElement("div");
  const title=document.createElement("h2");
  title.textContent="Não foi possível iniciar o 3D";
  const p=document.createElement("p");
  p.textContent="Verifique a internet, o acesso ao CDN e a aceleração gráfica do navegador. "+
    "Tente abrir o arquivo por localhost. Detalhe: "+error.message;
  box.append(title,p);$("boot").appendChild(box);
  console.error(error);
});
