# Ativar Supabase no Mini 4 Lab

Projeto: `owxevzgjqdmdluxcehim`. A URL e a chave publishable estão em src/services/supabase.js. Essa chave é pública por definição; nenhuma chave administrativa é necessária no navegador. As permissões dependem da migração abaixo.

## 1. Preparar banco

No SQL Editor do projeto, execute uma vez todo o arquivo `migrations/202609240001_academy.sql`. Ele cria perfis, turmas, matrículas, códigos, funções e regras RLS. A execução usa uma transação. Não reaplique se já executado com sucesso.

## 2. Autorizar URLs

Em Authentication → URL Configuration:
- Desenvolvimento: Site URL `http://localhost:5173`, Redirect URL `http://localhost:5173/painel.html`.
- Produção: Site URL do endereço definitivo da Vercel e Redirect URL `https://SEU-DOMINIO/painel.html` (autorize também `/painel` se usar clean URLs).
- Se testar em outra porta, autorize o endereço exato correspondente.

## 3. Criar o primeiro superadmin

Abra o site, clique em Ainda não tenho conta e cadastre `dev.cristianodepaula@gmail.com`. Confirme o e-mail recebido. Depois execute `bootstrap-superadmin.sql` no SQL Editor e atualize o painel. O cadastro sempre começa como aluno, mesmo se alguém enviar metadados com outro perfil. Professores e outros superadmins são promovidos pelo painel administrativo. Nunca há promoção pelo JavaScript.

## 4. Habilitar Google

Configure no Google Cloud uma tela de consentimento OAuth e um cliente Aplicativo da Web. Use esta URI autorizada de redirecionamento:

`https://owxevzgjqdmdluxcehim.supabase.co/auth/v1/callback`

Cadastre Client ID e Client Secret em Authentication → Sign In / Providers → Google no Supabase. Não inclua o Client Secret no repositório. Em modo de teste do Google, inclua os usuários de teste. Após habilitar, recarregue a página; ela verifica o provedor e libera o botão.

## 5. Validar com contas distintas

- Superadmin promove uma conta confirmada a professor.
- Professor cria turma, adiciona aluno confirmado por e-mail e copia o código de 12 caracteres.
- Aluno entra pelo código e vê somente suas turmas.
- Outro professor não consegue consultar ou alterar a turma anterior.
- Renovar o código invalida o anterior; pausar a entrada não remove alunos atuais.

## Testes e limitações

`npm ci`, `npm run check`, `npm test`, `npm run build`.
Os testes usam PostgreSQL via PGlite com papéis e esquema auth simulados, verificando migração, RLS, acesso entre turmas, promoção indevida e códigos. Não substituem a validação no projeto Supabase real com contas distintas.

Esta etapa entrega autenticação, painel, perfis e gestão de turmas. Não inclui avaliação automática, histórico de notas, recuperação de senha, exclusão de contas, transferência de turmas ou administração de conteúdo das missões. As dez missões são exibidas como em desenvolvimento.

A chave pública não permite aplicar migrações ou executar o bootstrap. Os comandos supabase login/init/link exigem uma sessão administrativa real e não foram executados. Para a ativação inicial, o SQL Editor dispensa a instalação da CLI. Nunca compartilhe a senha do banco em mensagens.

## Alternativa pela conexão PostgreSQL

A senha foi salva no `.env` local, excluído do Git e do build. `node scripts/setup-database.mjs --apply` lê esse arquivo, valida TLS usando `prod-ca-2021.crt`, aplica a migração somente se a tabela de perfis não existir e promove o administrador somente quando a conta tiver e-mail confirmado. O certificado público foi obtido de `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`.

Última tentativa: o certificado foi validado, mas o PostgreSQL recusou a credencial com `PAM authentication failed for user postgres`. Nenhuma migração remota foi aplicada nessa tentativa. Corrija `SUPABASE_DB_PASSWORD` no `.env` antes de repetir. O login Google ainda está desabilitado no provedor e o domínio público da Vercel ainda precisa ser informado.
