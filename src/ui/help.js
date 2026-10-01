import {element as el,link} from './dom.js';
import {icon} from './academic-table.js';
import {helpAreas,helpGuides,controlHelp,findHelpGuides} from './help-content.js';

const areas=document.getElementById('help-audiences'),topics=document.getElementById('help-topics'),content=document.getElementById('guide-content'),search=document.getElementById('help-search'),results=document.getElementById('help-results');
const requested=new URLSearchParams(location.search).get('perfil');
let area=helpAreas.some(([id])=>id===requested)?requested:'student';
let selected=readHash();const positions=new Map(),completed=new Set();
function readHash(){try{return decodeURIComponent(location.hash.slice(1));}catch{return '';}}
function button(label,handler,className='secondary-action'){
 const node=el('button',label,className);node.type='button';node.addEventListener('click',handler);return node;
}
function syncUrl(){const url=new URL(location.href);url.searchParams.set('perfil',area);url.hash=selected;history.replaceState(null,'',url);}
function drawAreas(){
 areas.replaceChildren();
 for(const [id,label,name] of helpAreas){
  const b=button(label,()=>{area=id;search.value='';selected='';draw();},'help-area');b.prepend(icon(name));b.setAttribute('aria-pressed',String(area===id));areas.append(b);
 }
}
function draw({focus=false}={}){
 drawAreas();const matches=findHelpGuides(area,search.value);topics.replaceChildren();
 if(!matches.some(g=>g.id===selected))selected=matches[0]?.id||'';
 results.textContent=`${matches.length} ${matches.length===1?'guia encontrado':'guias encontrados'}`;
 const list=el('ul','','help-topic-list');topics.append(list);
 for(const guide of matches){
  const a=el('a','','help-topic');a.href=`?perfil=${area}#${guide.id}`;
  a.append(el('strong',guide.title),el('span',`${guide.steps.length} etapas${completed.has(guide.id)?' · Lido':''}`));
  if(guide.id===selected)a.setAttribute('aria-current','true');
  a.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();selected=guide.id;draw({focus:true});});const item=el('li');item.append(a);list.append(item);
 }
 syncUrl();drawGuide();if(focus)content.focus();
}
function drawGuide(){
 content.replaceChildren();const guide=helpGuides.find(g=>g.id===selected);
 if(!guide){content.append(icon('search'),el('h2','Nenhum guia encontrado'),el('p','Tente outro termo, limpe a busca ou escolha outra área do manual.'),button('Limpar busca',()=>{search.value='';draw();search.focus();}));return;}
 const position=positions.get(guide.id)||0,isDone=completed.has(guide.id),heading=el('div','','guide-heading');
 heading.append(el('span',isDone?'GUIA LIDO':'PASSO A PASSO','eyebrow'),el('h2',guide.title),el('p',guide.summary));content.append(heading);
 const progress=el('progress');progress.max=guide.steps.length;progress.value=isDone?guide.steps.length:position+1;progress.setAttribute('aria-label',`Etapa ${position+1} de ${guide.steps.length}`);content.append(progress);
 const steps=el('nav','','guide-steps');steps.setAttribute('aria-label','Etapas deste guia');
 guide.steps.forEach((step,index)=>{
  const b=button(`${index+1}. ${step.title}`,()=>showStep(index),'guide-step');b.setAttribute('aria-current',index===position?'step':'false');steps.append(b);
 });content.append(steps);
 const detail=el('section','','guide-detail');detail.setAttribute('aria-live','polite');detail.append(el('span',`ETAPA ${position+1} DE ${guide.steps.length}`,'guide-counter'),el('h3',guide.steps[position].title),el('p',guide.steps[position].text));content.append(detail);
 const navigation=el('div','','guide-navigation'),previous=button('← Anterior',()=>showStep(position-1)),next=button(position===guide.steps.length-1?'Concluir leitura':'Próxima etapa →',()=>{
  if(position<guide.steps.length-1){showStep(position+1);return;}
  completed.add(guide.id);draw();content.querySelector('.guide-complete')?.focus();
 },'');previous.disabled=position===0;next.disabled=isDone&&position===guide.steps.length-1;navigation.append(previous,next);content.append(navigation);
 if(isDone){const done=el('div','','guide-complete');done.tabIndex=-1;done.setAttribute('role','status');done.append(el('strong','Leitura concluída!'),el('p','Quando quiser, consulte as etapas novamente ou coloque o guia em prática.'),button('Reiniciar guia',()=>{completed.delete(guide.id);showStep(0);}));content.append(done);}
 if(guide.controls)drawControls();
 const links=el('div','','guide-links');links.append(el('h3','Coloque em prática'));
 for(const [label,href] of guide.links){const a=link(label+' ↗',href);a.target='_blank';a.rel='noopener';a.setAttribute('aria-label',label+' (abre em nova aba)');links.append(a);}links.append(el('small','Os atalhos abrem uma nova aba para você manter o manual por perto.'));content.append(links);
 function showStep(index){positions.set(guide.id,index);drawGuide();const detail=content.querySelector('.guide-detail');detail.tabIndex=-1;detail.focus();}
}
function drawControls(){
 const section=el('section','','control-explorer');section.append(el('h3','Explore os comandos'),el('p','Clique em uma tecla para consultar sua função. Este painel é apenas uma referência; ele não pilota o drone.'));
 const grid=el('div','','control-grid'),description=el('p','Selecione um comando acima.','control-description');description.setAttribute('role','status');
 for(const [key,title,text] of controlHelp){const b=button('',()=>{for(const node of grid.children)node.setAttribute('aria-pressed',String(node===b));description.textContent=`${title}: ${text}`;},'control-key');b.append(el('kbd',key),el('span',title));b.setAttribute('aria-pressed','false');grid.append(b);}
 section.append(grid,description);content.append(section);
}
search.addEventListener('input',()=>draw());
document.getElementById('help-clear').addEventListener('click',()=>{search.value='';draw();search.focus();});
window.addEventListener('hashchange',()=>{selected=readHash();const guide=helpGuides.find(g=>g.id===selected);if(guide&&!guide.areas.includes(area))area=guide.areas[0];search.value='';draw({focus:true});});
const initial=helpGuides.find(g=>g.id===selected);if(initial&&!initial.areas.includes(area))area=initial.areas[0];draw();
