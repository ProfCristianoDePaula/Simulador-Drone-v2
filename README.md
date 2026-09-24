# Drone Academy

Refatoração do Mini 4 Lab existente, preservando o simulador e seus controles.

## Executar

Node.js 20 ou superior. `npm run dev` abre o servidor em http://localhost:5173.
Não abra index.html por file://: a aplicação usa módulos JavaScript.
Execute `npm ci` para instalar ferramentas de desenvolvimento e testes. Three.js 0.160.1 e Supabase JS 2.57.4 são carregados de CDN; imagens de satélite também exigem conexão. WebGL é necessário e vídeo depende de MediaRecorder.

`npm run check` verifica sintaxe e ausência de código inline. `npm test` testa regras de domínio. `npm run build` prepara dist para hospedagem na Vercel.

## Organização

- index.html: estrutura da interface, sem lógica ou CSS inline.
- src/main.js: inicialização e tratamento de falha.
- src/styles: aparência do simulador.
- src/ui: adaptação da interface à tela.
- src/core: funções matemáticas.
- src/simulator/state.js: estado inicial independente por sessão.
- src/simulator/safety.js: limites e disponibilidade de assistência.
- src/simulator/physics.js: movimento, colisões, bateria e contingências.
- src/simulator/engine.js: integração existente de cena, câmera, mapa, controles, automações e painéis. Estes subsistemas ainda poderão ser separados em módulos menores.
- src/training/missions.js: catálogo das dez missões, recursos e checklists planejados.
- tests: testes das regras extraídas.

## Escopo pedagógico

Cada missão vale 100 pontos, totalizando até 1.000 pontos nas dez missões. Critérios propostos: pré-voo 20, pilotagem 30, objetivos 35, pós-voo 15. A nota mínima de aprovação é uma regra separada, ainda a definir. O catálogo distribui os recursos existentes entre as missões; não significa que cenários, avaliação ou telas de missão estejam implementados.

## Próximas entregas

1. Telas de missão, objetivos observáveis, checklists, telemetria e avaliação por tentativa.
2. Cenários específicos de telhado, torre, evento e demais exercícios.
3. Supabase Auth, alunos/professores/turmas, tentativas e histórico com RLS. O servidor deve validar notas; o aluno não pode editar notas oficiais nem se promover a professor.
4. Publicação na Vercel e configuração do projeto Supabase. Nunca colocar chaves secretas ou service_role no cliente.

Login, cadastro por e-mail, entrada Google e painel de turmas estão implementados no cliente Supabase. A ativação depende da migração e das configurações descritas em supabase/SETUP.md. A chave pública não permite instalar o banco automaticamente. O login Google é liberado quando o provedor está habilitado. Notas e missões avaliadas ainda não foram implementadas. A simulação aproxima funcionalidades didaticamente, sem reproduzir integralmente firmware, física ou algoritmos do drone real. Atualmente a origem GPS ativa terreno de satélite e desativa obstáculos artificiais; missões avaliadas precisarão de cenário controlado independente da geolocalização.

O original está preservado em backup/index.original.html (não incluído no build).
