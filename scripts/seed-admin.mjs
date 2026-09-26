import {connectDatabase} from './database-client.mjs';
let client;
try{
 const connection=await connectDatabase();client=connection.client;const {env}=connection;
 if(env.ADMIN_EMAIL!=='admin@admin.com'||!env.ADMIN_INITIAL_PASSWORD||env.ADMIN_INITIAL_PASSWORD.length<8)throw new Error('Configure ADMIN_EMAIL e ADMIN_INITIAL_PASSWORD no .env.');
 const existing=await client.query('select id from auth.users where lower(email)=$1',[env.ADMIN_EMAIL]);
 if(existing.rowCount)throw new Error('A conta já existe. O seed não redefine a senha nem promove uma conta existente automaticamente.');
 await client.query('begin');
 const result=await client.query(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
 values('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated',$1,extensions.crypt($2,extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Administrador"}',now(),now(),'','','','') returning id`,[env.ADMIN_EMAIL,env.ADMIN_INITIAL_PASSWORD]);
 const id=result.rows[0].id;
 await client.query(`insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at) values($1::text,$1::uuid,jsonb_build_object('sub',$1::text,'email',$2::text,'email_verified',true),'email',now(),now(),now())`,[id,env.ADMIN_EMAIL]);
 await client.query("update public.academy_profiles set role='superadmin',active=true where id=$1",[id]);
 await client.query('commit');console.log('Conta admin@admin.com criada. A senha permanece no .env.');
}catch(error){await client?.query('rollback').catch(()=>{});console.error('Seed não concluído:',error.code||'',error.message);process.exitCode=1;}finally{await client?.end();}
