import {element as el,field,choice} from './dom.js';
import {authMessage} from '../services/supabase.js';
const roles={student:'Aluno',teacher:'Professor',superadmin:'Administrador'};
const literal=value=>value.trim().replace(/[\\%_]/g,'\\$&');
export async function renderUsersTable({client,container,profile,onAudit}){
 let page=0,sort='full_name',ascending=true,version=0,filters={name:'',email:'',role:''};
 const form=el('form','','user-filters'),name=field('Nome','search'),email=field('E-mail','search'),role=choice('Perfil',[['','Todos'],...Object.entries(roles)]);
 const apply=el('button','Buscar'),clear=el('button','Limpar filtros');apply.type='submit';clear.type='button';clear.className='secondary-action';form.append(name.box,email.box,role.box,apply,clear);
 const message=el('p','');message.setAttribute('role','status');
 const wrap=el('div','','users-table-wrap'),table=el('table','','users-table');table.append(el('caption','Usuários cadastrados'));const head=el('thead'),tr=el('tr'),body=el('tbody');const headers=[];
 for(const [key,label] of [['full_name','Nome'],['email','E-mail'],['role','Perfil'],['active','Situação']]){const th=el('th'),button=el('button',label);th.scope='col';button.type='button';button.addEventListener('click',()=>{ascending=sort===key?!ascending:true;sort=key;page=0;load();});th.append(button);tr.append(th);headers.push({th,button,key,label});}
 const emailHead=el('th','E-mail confirmado');emailHead.scope='col';tr.append(emailHead);
 const actionHead=el('th','Ações');actionHead.scope='col';tr.append(actionHead);head.append(tr);table.append(head,body);wrap.append(table);
 const footer=el('div','','table-pagination'),previous=el('button','Anterior'),next=el('button','Próxima'),count=el('span');previous.type=next.type='button';previous.addEventListener('click',()=>{page--;load();});next.addEventListener('click',()=>{page++;load();});footer.append(count,previous,next);container.append(form,message,wrap,footer);
 async function emailRequest(path,body){
  const {data,error}=await client.auth.getSession();if(error)throw error;
  if(!data.session?.access_token)throw new Error('Entre novamente para continuar.');
  const response=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${data.session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Reinicie npm run dev para habilitar a confirmação de e-mail.');
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível consultar a confirmação de e-mail.');return result;
 }
 function emailAction(user,emailState){
  const b=el('button','Confirmar e-mail','secondary-action');b.type='button';b.setAttribute('aria-label',`Confirmar e-mail de ${user.full_name||user.email}`);
  b.disabled=!emailState||!!emailState.email_confirmed_at||!emailState.email;
  if(!emailState)b.title='Status indisponível. Atualize a lista após configurar o servidor.';
  b.addEventListener('click',async()=>{
   if(b.disabled)return;b.disabled=true;b.textContent='Confirmando…';message.textContent='';
   try{await emailRequest('/api/user-email',{id:user.id,email:emailState.email});await load();message.textContent=`E-mail de ${emailState.email} confirmado no Supabase Auth.`;await onAudit?.();}
   catch(error){message.textContent=authMessage(error);b.disabled=false;}
   finally{b.textContent='Confirmar e-mail';}
  });return b;
 }
 function edit(user,toggleOnly=false){
  const dialog=el('dialog','','academy-dialog user-edit-dialog'),title=el('h2',toggleOnly?(user.active?'Desativar usuário':'Reativar usuário'):'Alterar usuário');title.id='user-edit-title';dialog.setAttribute('aria-labelledby',title.id);
  const details=el('p',`${user.full_name||'Sem nome'} · ${user.email}`),error=el('p','','modal-error');error.setAttribute('role','alert');
  const nameField=field('Nome completo','text',user.full_name),emailField=field('E-mail','email',user.email);nameField.input.required=true;nameField.input.maxLength=120;nameField.input.autocomplete='name';emailField.input.readOnly=true;
  const editForm=el('form'),profileField=choice('Perfil',Object.entries(roles),user.role),statusField=choice('Situação',[['true','Ativo'],['false','Desativado']],String(user.active));
  if(toggleOnly)editForm.append(el('p',user.active?'Este usuário perderá o acesso acadêmico. Os dados e o histórico serão preservados.':'O acesso acadêmico deste usuário será restaurado.'));else editForm.append(nameField.box,emailField.box,profileField.box,statusField.box);
  const actions=el('div','','actions'),cancel=el('button','Cancelar'),save=el('button',toggleOnly?(user.active?'Desativar':'Reativar'):'Salvar alterações');cancel.type='button';save.type='submit';cancel.className='secondary-action';if(toggleOnly&&user.active)save.className='danger-action';actions.append(cancel,save);editForm.append(error,actions);dialog.append(title,details,editForm);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());cancel.addEventListener('click',()=>dialog.close());
  editForm.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;error.textContent='';try{const {error:failure}=await client.rpc(toggleOnly?'academy_manage_user':'academy_edit_user',{uid:user.id,new_role:toggleOnly?user.role:profileField.input.value,is_active:toggleOnly?!user.active:statusField.input.value==='true',...(!toggleOnly?{new_name:nameField.input.value.trim()}:{})});if(failure)throw failure;dialog.close();if(user.id===profile.id){location.reload();return;}await load();message.textContent='Usuário atualizado.';await onAudit?.();}catch(failure){error.textContent=authMessage(failure);}finally{save.disabled=false;}});dialog.showModal();
 }
 async function load(){const requestVersion=++version;previous.disabled=next.disabled=true;wrap.setAttribute('aria-busy','true');message.textContent='Carregando usuários…';
  for(const h of headers){h.th.setAttribute('aria-sort',h.key===sort?(ascending?'ascending':'descending'):'none');h.button.textContent=h.label+(h.key===sort?(ascending?' ↑':' ↓'):' ↕');}
  try{let request=client.from('academy_profiles').select('id,full_name,email,role,active',{count:'exact'}).order(sort,{ascending}).order('id',{ascending:true}).range(page*30,page*30+29);
   if(filters.name)request=request.ilike('full_name',`%${literal(filters.name)}%`);if(filters.email)request=request.ilike('email',`%${literal(filters.email)}%`);if(filters.role)request=request.eq('role',filters.role);
   const {data,error,total,...rest}=await request;if(requestVersion!==version)return;if(error)throw error;const totalRows=rest.count||0;
   let emailStates=new Map(),emailError='';
   if(data.length){try{const result=await emailRequest('/api/user-email?ids='+encodeURIComponent(data.map(user=>user.id).join(',')));emailStates=new Map(result.users.map(user=>[user.id,user]));}catch(error){emailError=authMessage(error);}}
   if(requestVersion!==version)return;body.replaceChildren();
   for(const user of data){const row=el('tr');const emailState=emailStates.get(user.id);for(const value of [user.full_name||'Sem nome',emailState?.email||user.email,roles[user.role]])row.append(el('td',value));const status=el('td'),badge=el('span',user.active?'Ativo':'Desativado',user.active?'badge':'badge inactive');status.append(badge);row.append(status);
    const emailCell=el('td'),confirmed=!!emailState?.email_confirmed_at;emailCell.append(el('span',emailState?(confirmed?'Confirmado':emailState.email?'Pendente':'Sem e-mail'):'Indisponível',confirmed?'badge':'badge inactive'));row.append(emailCell);
    const actions=el('td'),buttons=el('div','','actions');if(!confirmed)buttons.append(emailAction(user,emailState));for(const [label,handler,cls] of [['Alterar',()=>edit(user),'secondary-action'],[user.active?'Desativar':'Reativar',()=>edit(user,true),user.active?'danger-action':'']]){const b=el('button',label,cls);b.type='button';b.setAttribute('aria-label',`${label} ${user.full_name||user.email}`);b.addEventListener('click',handler);buttons.append(b);}actions.append(buttons);row.append(actions);body.append(row);}
   if(!data.length){const cell=el('td','Nenhum usuário encontrado com esses filtros.');cell.colSpan=6;const row=el('tr');row.append(cell);body.append(row);}
   count.textContent=`${totalRows} usuários · Página ${page+1} de ${Math.max(1,Math.ceil(totalRows/30))}`;previous.disabled=page===0;next.disabled=(page+1)*30>=totalRows;message.textContent=emailError;
  }catch(error){if(requestVersion===version){body.replaceChildren();message.textContent=authMessage(error);count.textContent='Não foi possível carregar a lista.';}}finally{if(requestVersion===version)wrap.setAttribute('aria-busy','false');}
 }
 form.addEventListener('submit',event=>{event.preventDefault();filters={name:name.input.value,email:email.input.value,role:role.input.value};page=0;load();});clear.addEventListener('click',()=>{name.input.value=email.input.value=role.input.value='';filters={name:'',email:'',role:''};page=0;load();});await load();
}
