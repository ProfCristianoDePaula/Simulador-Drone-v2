import './fit-entry.js';
import {getClient,authMessage,SUPABASE_URL,SUPABASE_PUBLIC_KEY} from '../services/supabase.js';
const form = document.getElementById('login-form');
const password = document.getElementById('password');
const toggle = document.getElementById('toggle-password');
const status = document.getElementById('auth-status');
const submit = form.querySelector('[type=submit]');
const signup = document.getElementById('signup-toggle');
const google = document.getElementById('google-login');
let creating = false, busy = false, googleAvailable = false;
const destination = new URL('/painel.html',location.origin).href;
function loading(value){busy=value;submit.disabled=value;signup.disabled=value;google.disabled=value||!googleAvailable;}
toggle.addEventListener('click',()=>{const visible=password.type==='password';password.type=visible?'text':'password';toggle.textContent=visible?'Ocultar':'Mostrar';toggle.setAttribute('aria-pressed',String(visible));});
signup.addEventListener('click',()=>{
  creating=!creating;
  document.getElementById('name-field').hidden=!creating;
  document.getElementById('full-name').required=creating;
  password.autocomplete=creating?'new-password':'current-password';
  if(creating)password.minLength=8;else password.removeAttribute('minlength');
  submit.textContent=creating?'Criar minha conta':'Entrar na minha conta';
  signup.textContent=creating?'Já tenho conta — entrar':'Ainda não tenho conta';
  status.textContent=creating?'O cadastro cria um perfil de aluno. Confirme seu e-mail para acessar.':'';
});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;loading(true);status.textContent='Conectando…';
  try{
    const client=await getClient();const email=document.getElementById('email').value.trim();
    const result=creating
      ?await client.auth.signUp({email,password:password.value,options:{emailRedirectTo:destination,data:{full_name:document.getElementById('full-name').value.trim()}}})
      :await client.auth.signInWithPassword({email,password:password.value});
    if(result.error)throw result.error;password.value='';
    if(result.data.session){location.assign(destination);return;}
    status.textContent='Confira seu e-mail para confirmar o cadastro. Se já possui conta, use a opção de entrar.';
  }catch(error){
    status.textContent=authMessage(error);
    if(!creating&&error.code==='invalid_credentials'&&document.getElementById('email').value.trim().toLowerCase()==='admin@admin.com'){
      status.textContent+=' Se este é o primeiro acesso do administrador, conclua as migrações e o seed no servidor. A configuração no .env não cria a conta automaticamente.';
    }
  }finally{loading(false);}
});
google.addEventListener('click',async()=>{
  loading(true);status.textContent='Abrindo o Google…';
  try{const client=await getClient();const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:destination}});if(error)throw error;}
  catch(error){status.textContent=authMessage(error);loading(false);}
});
async function init(){
  if(!SUPABASE_PUBLIC_KEY){status.textContent='Acesso em configuração. O simulador livre continua disponível.';google.disabled=true;submit.disabled=true;signup.disabled=true;document.getElementById('google-status').textContent='Login Google aguardando configuração.';return;}
  submit.disabled=false;status.textContent='Entre com seu e-mail ou crie sua conta de aluno.';
  try{const response=await fetch(`${SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:SUPABASE_PUBLIC_KEY}});if(response.ok){googleAvailable=!!(await response.json()).external?.google;google.disabled=!googleAvailable;document.getElementById('google-status').textContent=googleAvailable?'':'Login Google aguardando habilitação.';}}
  catch{document.getElementById('google-status').textContent='Não foi possível verificar o login Google.';}
  try{const client=await getClient();const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session)location.replace(destination);}catch(error){status.textContent=authMessage(error);}
}
init();
