# Ativar o banco e o administrador

Projeto Supabase: owxevzgjqdmdluxcehim.

## 1. Validar a conexão

No painel do Supabase, abra Connect e copie os parâmetros da conexão PostgreSQL. Para Session pooler, copie o host e o usuário exatamente como apresentados; o usuário normalmente inclui a referência do projeto. No .env local configure:

```dotenv
SUPABASE_PROJECT_REF=owxevzgjqdmdluxcehim
SUPABASE_DB_HOST=HOST_DA_CONEXAO
SUPABASE_DB_PORT=5432
SUPABASE_DB_USER=USUARIO_DA_CONEXAO
SUPABASE_DB_PASSWORD=SENHA_DO_BANCO
SUPABASE_DB_PASSWORD_CONFIRMED=true
ADMIN_EMAIL=admin@admin.com
ADMIN_INITIAL_PASSWORD=SENHA_INICIAL
```

Sem host e usuário explícitos, o script usa a conexão direta db.owxevzgjqdmdluxcehim.supabase.co, usuário postgres. A última conexão validou TLS, mas retornou PAM authentication failed. Verifique a senha do banco e os parâmetros do Connect; a senha de login do site Supabase é outra credencial.

## 2. Aplicar e criar o administrador

No terminal em C:\Projeto\Drone:

```powershell
npm ci
npm run migrate
npm run seed:admin
npm run dev
```

Execute o próximo comando somente após o anterior concluir com sucesso. As cinco migrações são aplicadas em ordem e registradas por checksum. Se houver uma base antiga sem registro, o instalador para para evitar sobrescrita: compare o esquema antes de adotar as migrações. Não use o antigo setup-database.mjs ou bootstrap-superadmin.sql neste fluxo.

O seed cria admin@admin.com confirmado e com perfil superadmin, usando a senha do .env. Recusa sobrescrever uma conta existente. A senha solicitada pelo proprietário já foi definida no .env local; ela não está neste documento nem no código público.

Abra http://localhost:5173 e entre na tela inicial. O painel mostrará somente gestão de usuários. Cadastre e confirme uma conta de professor pelo fluxo normal; entre como administrador e promova essa conta a professor.

## 3. Configurar URLs e Google

Authentication → URL Configuration: autorize /painel.html e /recuperar.html?reset=1 nos domínios de desenvolvimento e produção. Autorize também /painel e /recuperar se usar clean URLs. Use a porta real do servidor local.

O passo a passo do Google está em ../docs/GUIA_LOGIN_GOOGLE.md. O endereço vercel.com do painel de gestão não é o domínio público do simulador.

## 4. Validar com contas diferentes

1. Administrador promove usuário confirmado a professor.
2. Professor cria turma e atividade, adiciona aluno ou compartilha código.
3. Aluno entra, inicia missão, envia relatório e evidências e vê nota.
4. Professor consulta tentativa, registra revisão justificada e exporta notas.
5. Outro aluno/professor não tem acesso à turma nem às evidências.
6. Usuário desativado não acessa o painel acadêmico.

Os testes PGlite validam funções e políticas com auth/storage simulados. Ainda é necessário validar Auth e Storage no Supabase real. A chave publishable não permite aplicar migrações; a chave secret mascarada enviada não é utilizável nem necessária para o endpoint de sessão implementado.
