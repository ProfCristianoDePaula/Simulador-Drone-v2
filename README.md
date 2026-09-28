# Drone Academy — Mini 4 Lab

## Executar e acessar

Requer Node.js 20 ou superior. No diretório C:\Projeto\Drone:

```powershell
npm ci
npm run dev
```

Abra http://localhost:5173. O login é o mesmo para alunos, professores e administradores; o perfil determina o painel. Não abra o HTML diretamente pelo explorador de arquivos.

O administrador inicial é admin@admin.com, com a senha definida em ADMIN_INITIAL_PASSWORD no .env. Essa conta só existe depois de aplicar as migrações e executar npm run seed:admin com sucesso. Salvar as credenciais no .env não cria o usuário.

## Funcionalidades implementadas

- Doze missões com cenários, objetivos sequenciais, telemetria, fotos/vídeos e checklists. Cada missão vale 100 pontos: pré-voo 20, pilotagem 30, objetivos 35 e pós-voo 15.
- Alunos: inscrição por código, atividades, tentativas, notas, histórico e recuperação de entregas locais.
- Professores: suas turmas, matrículas, atividades, prazos, tentativas, revisão justificada e exportação CSV.
- Administrador: usuários, perfis e bloqueio de acesso. O painel administrativo não gerencia turmas.
- Avaliação calculada por funções PostgreSQL, RLS e evidências em bucket privado.
- Voo livre público e treino sem nota em /missao.html?missao=primeiro-voo.
- Login por e-mail, recuperação de senha e integração Google, dependente da configuração do provedor.

## Ativação e publicação

Veja supabase/SETUP.md para migrações e administrador, e docs/GUIA_LOGIN_GOOGLE.md para OAuth. A Vercel usa npm run build e dist; api/session.js é uma função de servidor que valida a sessão com @supabase/server.

Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_JWKS_URL na Vercel. O endpoint de sessão usa o token do próprio usuário e não precisa de chave secret. Não publique senha PostgreSQL, senha inicial do administrador ou .env.

## Verificação

npm test valida regras de avaliação, API e permissões com PostgreSQL local via PGlite. npm run check verifica sintaxe e separação dos HTML. npm run build gera a distribuição.

Publicado em https://simulador-drone-v2.vercel.app em 28/09/2026. Migrações aplicadas no Supabase, 12 missões publicadas e login administrativo validado no endpoint de produção. Relatório pós-voo: 5 a 4.000 caracteres. Google depende da habilitação do provedor.

## Organização e limites

src/training contém catálogo, cenários, avaliação e entrega; src/simulator contém o simulador; src/ui contém autenticação e painéis; supabase/migrations contém o esquema; scripts contém build, migração e seed.

Three.js e Supabase JS são carregados por CDN. WebGL e conexão são necessários; vídeo exige MediaRecorder. As manobras e a física são aproximações didáticas. A telemetria recebida do navegador passa por validações no banco, mas não é uma prova inviolável de pilotagem. Interrupções recuperam registros para entrega, não o estado físico do voo. O original está em backup/index.original.html.
