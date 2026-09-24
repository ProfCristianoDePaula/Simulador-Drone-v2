# Habilitar login Google — Mini 4 Lab

## Passos

1. Confirme o domínio público em Vercel → projeto → Domains. Use `https://SEU-DOMINIO` abaixo.
2. No [Google Cloud](https://console.cloud.google.com/), selecione/crie um projeto e abra Google Auth Platform.
3. Configure Branding (nome/e-mail), Audience (External para contas Gmail) e Data Access: `openid`, `userinfo.email`, `userinfo.profile`. Se estiver em teste, adicione as contas de teste.
4. Em Clients, crie um cliente OAuth **Web application**.
5. Em **Authorized JavaScript origins**, informe `https://SEU-DOMINIO` e, para desenvolvimento, `http://localhost:5173`.
6. Em **Authorized redirect URIs**, informe exatamente:

   `https://owxevzgjqdmdluxcehim.supabase.co/auth/v1/callback`

7. No Supabase → Authentication → Sign In / Providers → Google, habilite o provedor e salve Client ID e Client Secret. O segredo fica nesse painel.
8. Em Authentication → URL Configuration, configure Site URL como `https://SEU-DOMINIO` e autorize os retornos:

   - `https://SEU-DOMINIO/painel.html`
   - `https://SEU-DOMINIO/painel`
   - `http://localhost:5173/painel.html`

9. Recarregue o site, clique **Continuar com Google**, entre e confira o painel. Teste sair/entrar e confirme o usuário em Authentication → Users.
10. Antes de liberar para alunos, revise o status de publicação e eventuais exigências de verificação do Google.

Referências: [Google no Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google) e [URLs de retorno](https://supabase.com/docs/guides/auth/redirect-urls).

## Verificação específica deste projeto

A conta nova deve iniciar como aluno. A promoção a professor/superadmin é uma operação separada. O banco e o perfil precisam estar preparados para que o painel carregue após autenticar. A última verificação encontrou Google desativado; o código atual detecta a habilitação ao recarregar a página.

Se aparecer `redirect_uri_mismatch`, compare a URI cadastrada no Google com o callback Supabase acima. Se retornar ao endereço errado, revise Site URL e Redirect URLs no Supabase. O endereço administrativo `vercel.com/cristianodepaulas-projects/simulador-drone-v2` não substitui o domínio público.
