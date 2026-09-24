import {getClient,authMessage} from '../services/supabase.js';
import {missions} from '../training/missions.js';
const $=id=>document.getElementById(id);
const roles={student:'Aluno',teacher:'Professor',superadmin:'Superadmin'};
let client,profile,selectedClass,invite;
const node=(tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
async function action(button,fn){if(button.disabled)return;button.disabled=true;$('notice').textContent='';try{await fn();}catch(error){$('notice').textContent=authMessage(error);}finally{button.disabled=false;}}
function bindForm(id,fn){$(id).addEventListener('submit',event=>{event.preventDefault();action(event.submitter||$(id).querySelector('button'),fn);});}
async function loadClasses(){
  const {data,error}=await client.from('academy_classes').select('id,name,teacher_id,created_at').order('created_at',{ascending:false});if(error)throw error;
  $('classes').replaceChildren();
  if(!data.length)$('classes').append(node('p','Nenhuma turma por enquanto.'));
  for(const item of data){const card=node('article','','card');card.append(node('h2',item.name));if(profile.role!=='student'){const button=node('button','Gerenciar alunos');button.addEventListener('click',()=>action(button,()=>loadRoster(item)));card.append(button);}else card.append(node('span','Você está nesta turma','badge'));$('classes').append(card);}
}
async function loadRoster(item){
  const [members,invitation]=await Promise.all([client.from('academy_memberships').select('student_id,academy_profiles!academy_memberships_student_id_fkey(id,email,full_name)').eq('class_id',item.id),client.from('academy_invites').select('code,enabled').eq('class_id',item.id).single()]);
  if(members.error)throw members.error;if(invitation.error)throw invitation.error;
  selectedClass=item;invite=invitation.data;$('roster-section').hidden=false;$('roster-title').textContent=item.name;
  $('invite-code').textContent=`Código: ${invite.code} · ${invite.enabled?'Entrada aberta':'Entrada pausada'}`;
  $('toggle-enrollment').textContent=invite.enabled?'Pausar entrada por código':'Liberar entrada por código';
  $('roster').replaceChildren();
  if(!members.data.length)$('roster').append(node('li','Nenhum aluno cadastrado nesta turma.'));
  for(const member of members.data){const p=member.academy_profiles;const row=node('li',`${p.full_name||'Aluno'} — ${p.email}`);const button=node('button','Remover da turma');button.addEventListener('click',()=>action(button,async()=>{await rpc('academy_remove_student',{cid:item.id,uid:member.student_id});await loadRoster(item);}));row.append(button);$('roster').append(row);}
}
async function init(){
  try{
    client=await getClient();const {data,error}=await client.auth.getUser();if(error||!data.user){location.replace('/');return;}
    client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')location.replace('/');});
    const result=await client.from('academy_profiles').select('id,email,full_name,role').eq('id',data.user.id).single();
    if(result.error){$('setup').hidden=false;$('welcome').textContent='Sua conta está conectada';$('notice').textContent='As turmas ainda não estão disponíveis. Se o banco já foi preparado, tente novamente.';return;}
    profile=result.data;$('role-label').textContent=`ÁREA DO ${roles[profile.role].toUpperCase()}`;$('welcome').textContent=`Olá, ${profile.full_name||profile.email}`;
    $('student-actions').hidden=profile.role!=='student';$('teacher-actions').hidden=profile.role==='student';$('admin-section').hidden=profile.role!=='superadmin';
    $('setup').hidden=true;$('workspace').hidden=false;await loadClasses();
  }catch(error){$('notice').textContent=authMessage(error);}
}
$('logout').addEventListener('click',event=>action(event.currentTarget,async()=>{client??=await getClient();const {error}=await client.auth.signOut();if(error)throw error;location.replace('/');}));
$('retry').addEventListener('click',()=>location.reload());
$('refresh').addEventListener('click',event=>action(event.currentTarget,loadClasses));
bindForm('create-form',async()=>{await rpc('academy_create_class',{class_name:$('class-name').value.trim()});$('create-form').reset();await loadClasses();$('notice').textContent='Turma criada. Abra Gerenciar alunos para consultar o código.';});
bindForm('join-form',async()=>{const result=await rpc('academy_join_class',{invite_code:$('class-code').value.trim()});if(!result.ok)throw new Error(result.message);$('join-form').reset();await loadClasses();$('notice').textContent='Você entrou na turma.';});
bindForm('add-form',async()=>{await rpc('academy_add_student',{cid:selectedClass.id,student_email:$('student-email').value.trim()});$('add-form').reset();await loadRoster(selectedClass);});
$('rotate-code').addEventListener('click',event=>action(event.currentTarget,async()=>{await rpc('academy_update_invite',{cid:selectedClass.id,rotate_code:true,allow_join:invite.enabled});await loadRoster(selectedClass);$('notice').textContent='Código renovado. O código anterior não permite novas entradas.';}));
$('toggle-enrollment').addEventListener('click',event=>action(event.currentTarget,async()=>{await rpc('academy_update_invite',{cid:selectedClass.id,rotate_code:false,allow_join:!invite.enabled});await loadRoster(selectedClass);}));
bindForm('admin-search',async()=>{
  const {data,error}=await client.from('academy_profiles').select('id,email,full_name,role').eq('email',$('search-email').value.trim().toLowerCase()).maybeSingle();if(error)throw error;
  $('admin-result').replaceChildren();if(!data){$('admin-result').append(node('p','Usuário não encontrado.'));return;}
  const label=node('label',`${data.full_name||data.email} — perfil de acesso`);const select=node('select','');select.id='new-role';label.htmlFor=select.id;
  for(const [value,title] of Object.entries(roles)){const option=node('option',title);option.value=value;select.append(option);}select.value=data.role;
  const button=node('button','Salvar perfil');button.addEventListener('click',()=>action(button,async()=>{await rpc('academy_set_role',{uid:data.id,new_role:select.value});if(data.id===profile.id){location.reload();return;}$('notice').textContent='Perfil atualizado.';}));$('admin-result').append(label,select,button);
});
for(const mission of missions){const card=node('article','','card');card.append(node('span',`MISSÃO ${mission.order} · ${mission.maxScore} PONTOS`,'badge'),node('h2',mission.title),node('p','Em desenvolvimento'));$('missions').append(card);}
init();
