# Confirmação administrativa de e-mail

Em **Painel do administrador → Gerenciar usuários**, a coluna **E-mail confirmado** consulta o estado atual no Supabase Auth. Contas pendentes oferecem **Confirmar e-mail**. A ação confirma diretamente o endereço atual, sem enviar um link de confirmação. Ela não altera senha, perfil ou bloqueio acadêmico.

O servidor valida a sessão e exige o perfil `superadmin` ativo antes de consultar ou alterar usuários no Auth. A confirmação usa a [API administrativa oficial do Supabase](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), com `email_confirm: true`. Não é uma alteração apenas visual no perfil acadêmico: o Auth processa a confirmação da conta e de sua identidade de e-mail.

## Configuração

- No `.env` local, configure `SUPABASE_SECRET_KEY` com uma chave secreta do mesmo projeto Supabase. A chave legada `SUPABASE_SERVICE_ROLE_KEY` também é aceita.
- Reinicie `npm run dev`. O servidor local carrega o `.env` e atende `/api/user-email` em `http://localhost:5173`.
- Na Vercel, configure a mesma variável de servidor e publique a nova versão.
- A chave não pode entrar em `src`, HTML, commits ou configurações públicas. Nenhuma migração de banco é necessária para esta funcionalidade.

Sem essa configuração, a lista de usuários continua disponível, mas a confirmação aparece como **Indisponível**, com a mensagem de configuração. Contas já confirmadas não oferecem o botão. Se o endereço mudar entre a consulta e a ação, a operação solicita atualizar a lista.

## Verificação

Execute `npm test`, `npm run check` e `npm run build`. Em ambiente de teste configurado, use uma conta de teste pendente: confirme pelo painel, atualize a lista e confira a confirmação em Authentication → Users no Supabase. Verifique também o login dessa conta. Os testes locais simulam a API Auth; não confirmam contas reais.
