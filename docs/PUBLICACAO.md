# Publicação

URL: https://simulador-drone-v2.vercel.app
Projeto: cristianodepaulas-projects/simulador-drone-v2
Deploy de produção: dpl_8AqW8kYDC4TkmdVvdPta2KHGtZcE (28/09/2026).

Validação: nove testes locais passaram; build concluído; páginas inicial, painel e missão retornam 200; API sem token retorna 401; login administrativo retorna perfil superadmin ativo em produção. Supabase tem 12 missões publicadas e relatório de 5 a 4.000 caracteres.

Para publicar novamente, na pasta do projeto, execute npm run check, npm test, npm run build e npx vercel deploy --prod. A pasta já está vinculada ao projeto. Arquivos .env, backups, testes e migrações ficam fora do upload conforme .vercelignore.

Login Google continua dependente do provedor no Supabase. Para confirmação de cadastro e recuperação de senha, configure no Supabase Site URL como https://simulador-drone-v2.vercel.app e autorize os retornos /painel.html, /painel e /recuperar.html?reset=1. A configuração dessas URLs no provedor não foi confirmada neste deploy.
