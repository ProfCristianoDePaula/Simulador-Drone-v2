import {element as el,field,choice} from './dom.js';

const paths={
 student:'M3 9l9-5 9 5-9 5-9-5M6 11v6c4 3 8 3 12 0v-6M21 9v7',
 teacher:'M4 3h16v13H4zM8 21l4-5 4 5M8 7h8M8 11h5',
 superadmin:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3M8 12l3 3 5-6',
 classes:'M3 5h7l2 2h9v13H3V5M7 11h10M7 15h6',
 activities:'M8 5H5v16h14V5h-3M9 3h6v4H9zM8 12l2 2 5-4M8 18h8',
 history:'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',
 missions:'M12 3v4M12 17v4M3 12h4M17 12h4M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12M12 10v4M10 12h4',
 arrow:'M5 12h14M13 6l6 6-6 6',
 refresh:'M20 7a8 8 0 0 0-14-1L3 9M3 3v6h6M4 17a8 8 0 0 0 14 1l3-3M15 15h6v6',
 logout:'M10 4H4v16h6M10 12h11M17 8l4 4-4 4',
 search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6'
};
export function icon(name){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false',class:'ui-icon'}))svg.setAttribute(key,value);
 const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]||paths.arrow);svg.append(path);return svg;
}
export function decorate(node,name){node.prepend(icon(name));return node;}
export function badge(text,muted=false){return el('span',text,`badge${muted?' inactive':''}`);}
export function sectionHeading(section,title,description,name){
 const heading=el('div','','section-heading'),copy=el('div'),h=el('h2',title);decorate(h,name);copy.append(h,el('p',description));heading.append(copy);section.append(heading);
}
// A shared, local view of data already authorized by the academic queries.
export function academicTable({container,title,columns,rows,filters=[],empty='Nenhum registro disponível.'}){
 const toolbar=el('div','','table-toolbar'),search=field('Buscar nesta lista','search');search.input.placeholder='Digite para buscar…';toolbar.append(search.box);
 const status=filters.length?choice('Situação',[['','Todas'],...filters]):null;if(status)toolbar.append(status.box);
 const clear=el('button','Limpar filtros','secondary-action');clear.type='button';toolbar.append(clear);
 const wrap=el('div','','academic-table-wrap');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',title);
 const table=el('table','','academic-table'),caption=el('caption',title),head=el('thead'),header=el('tr'),body=el('tbody');
 for(const label of columns){const th=el('th',label);th.scope='col';header.append(th);}head.append(header);table.append(caption,head,body);wrap.append(table);
 const footer=el('div','','table-pagination'),count=el('span'),previous=el('button','Anterior','secondary-action'),next=el('button','Próxima','secondary-action');count.setAttribute('role','status');previous.type=next.type='button';footer.append(count,previous,next);
 let page=0;const pageSize=15,normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 function draw(){
  const term=normalize(search.input.value.trim()),visible=rows.filter(row=>(!status?.input.value||row.status===status.input.value)&&normalize(row.search).includes(term));
  const pages=Math.max(1,Math.ceil(visible.length/pageSize));page=Math.min(page,pages-1);body.replaceChildren();
  for(const row of visible.slice(page*pageSize,(page+1)*pageSize)){const tr=el('tr');for(const content of row.cells){const td=el('td');td.append(content instanceof Node?content:document.createTextNode(String(content??'—')));tr.append(td);}body.append(tr);}
  if(!visible.length){const tr=el('tr'),td=el('td',rows.length?'Nenhum resultado. Altere a busca ou limpe os filtros.':empty,'table-empty');td.colSpan=columns.length;tr.append(td);body.append(tr);}
  count.textContent=`${visible.length} registros · Página ${page+1} de ${pages}`;previous.disabled=page===0;next.disabled=page>=pages-1;
 }
 search.input.addEventListener('input',()=>{page=0;draw();});status?.input.addEventListener('change',()=>{page=0;draw();});clear.addEventListener('click',()=>{search.input.value='';if(status)status.input.value='';page=0;draw();});previous.addEventListener('click',()=>{page--;draw();});next.addEventListener('click',()=>{page++;draw();});
 container.append(toolbar,wrap,footer);draw();
}
