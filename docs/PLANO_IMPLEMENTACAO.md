# Plano de implementação — Mini 4 Lab

Projeto local: `C:\Projeto\Drone`  
Supabase definitivo: `owxevzgjqdmdluxcehim`  
Data do planejamento: 24/09/2026

## Resultado esperado

Uma plataforma de aulas práticas com login, três perfis, turmas, dez missões avaliadas, checklists, evidências, notas e histórico persistidos no Supabase. O simulador livre permanece público e não gera nota. Cada missão vale até 100 pontos; a trilha completa soma até 1.000 pontos.

## Situação atual e dependências

- Existe simulador 3D, controles, câmera, mapa, automações e separação inicial em módulos.
- Existem telas e código de login, cadastro, gestão de turmas e perfis. A integração completa ainda precisa ser validada com usuários reais e banco ativo.
- Existe migração inicial e testes locais de permissões. A última tentativa de instalação remota falhou na autenticação PostgreSQL; não considerar o banco instalado.
- As dez missões são somente um catálogo. Cenários, objetivos, avaliação e notas ainda serão implementados.
- O Google está desativado na última verificação. O endereço público de produção da Vercel ainda precisa ser confirmado; o link administrativo não é uma URL de retorno de login.
- Dependências externas imediatas: corrigir a senha PostgreSQL no `.env` OU executar a migração existente no SQL Editor; confirmar e-mail do administrador; obter endereço público da Vercel; configurar o provedor Google.

## Entrega 1 — Banco online e autenticação

1. Conferir o estado atual do banco antes de aplicar migrações, evitando sobrescrever objetos já existentes.
2. Instalar a migração inicial de perfis, turmas, matrículas e convites no Supabase.
3. Registrar as migrações aplicadas e adotar migrações incrementais versionadas para as próximas entregas. A simples existência da tabela de perfis não basta para verificar versões futuras.
4. Validar cadastro, confirmação de e-mail, login, sessão, logout e implementar recuperação de senha.
5. Após confirmação do e-mail `dev.cristianodepaula@gmail.com`, executar o bootstrap de superadmin.
6. Validar as permissões online com aluno, dois professores de turmas distintas e superadmin.

Aceite: cadastro e dados persistem após fechar o navegador e entrar em outro dispositivo; aluno não altera papéis; professores não acessam turmas alheias. Nenhuma senha administrativa entra no build.

## Entrega 2 — Painéis e gestão acadêmica

### Aluno

- Página inicial com turmas, atividades pendentes, progresso e últimas notas.
- Entrada por código; visualização de professor, turma e atividades atribuídas.
- Cartão da missão com briefing, prazo, tentativas permitidas e critérios de nota.
- Fluxo: preparação → checklist pré-voo → voo → pós-voo → relatório → resultado.
- Histórico por tentativa, critérios pontuados, evidências e comentários do professor.
- Estados claros para aguardando sincronização, entregue, em revisão, aprovado e refazer.

### Professor

- Criar, editar, arquivar e consultar turmas.
- Adicionar alunos cadastrados por e-mail; remover matrículas; renovar e pausar códigos.
- Atribuir missões à turma com prazo, limite de tentativas e regra de aproveitamento da nota.
- Grade de acompanhamento por aluno/missão, filtros de pendências e resumo da turma.
- Examinar percurso, ocorrências, fotos e respostas; comentar e revisar a avaliação.
- Reabrir tentativa e corrigir nota com justificativa e histórico de auditoria.
- Exportar relatório CSV de desempenho.

### Superadmin

- Administrar papéis e acesso global; proteger o último administrador.
- Consultar usuários, turmas e atividade do sistema.
- Transferir responsabilidade de turmas antes de rebaixar professores.
- Gerenciar publicação e versões das missões e acompanhar alterações de notas.

Aceite: um professor cria turma, cadastra alunos, atribui uma atividade e acompanha sua entrega; aluno visualiza somente o que lhe pertence; ações administrativas são autorizadas pelo banco.

## Entrega 3 — Motor comum das missões

- Separar os subsistemas ainda concentrados em engine.js: cenário, câmera, controles, automações, mapa e interface.
- Definir contrato único de missão: versão, cenário, estado inicial, objetivos, tolerâncias, recursos permitidos, checklist e rubrica.
- Implementar estados de tentativa, início autorizado pelo servidor e identificador único.
- Registrar eventos: decolagem, pouso, posição, altura, orientação, velocidade, bateria, câmera, automações, obstáculos e falhas.
- Usar cenários 3D controlados nas avaliações. Atualmente o GPS real habilita imagens de satélite e desativa colisões artificiais; essa condição não pode determinar os obstáculos de uma prova.
- Implementar áreas proibidas, alvos identificáveis e verificação geométrica de enquadramento.
- Criar cenários de vento e deriva graduais onde exigidos. Não pontuar comportamentos que o simulador ainda não consegue medir.
- Bloquear recarga artificial, teletransporte e mudança livre de condições durante tentativa avaliada. Contingências serão controladas pela missão.
- Implementar pausa autorizada, abandono, desconexão, expiração e retomada conforme regra da atividade.

Aceite: missão 1 percorre o fluxo completo e salva resultado verificável no banco antes de multiplicar cenários.

## Entrega 4 — Dez missões completas

Os valores abaixo são parâmetros pedagógicos iniciais do simulador, ajustáveis por versão da missão, e não limites de operação real.

| Nº | Missão e cenário | Objetivos verificáveis | Recursos principais |
|---|---|---|---|
| 1 | Primeiro voo, campo de treinamento | Decolar; pairar 20 s em um volume delimitado; executar deslocamentos e giro; pousar na zona marcada | Manetes, modos de orientação, GNSS, origem, decolagem e pouso |
| 2 | Circuito de precisão | Percorrer 6 portais em ordem; respeitar faixa de altitude; frear na zona final; completar trechos com os modos solicitados | Cine, Normal, Sport, frenagem, limites e cancelamento manual |
| 3 | Telhado para instalação solar | Registrar 4 faces/pontos definidos; identificar 3 obstáculos simulados; obter fotos com enquadramento e distância válidos | Gimbal, zoom, foto, grade, exposição e EV |
| 4 | Inspeção de área | Planejar e executar rota com 6 pontos; observar setores definidos; registrar 3 pontos de interesse; retornar | Mapa, Waypoints, altura dos pontos, RTH |
| 5 | Cobertura de evento | Executar 3 tomadas com duração e enquadramento mínimos; respeitar áreas de exclusão; demonstrar trajetórias solicitadas | Cine, vídeo, Dronie, Rocket e Circle em área permitida |
| 6 | Inspeção de torre | Inspecionar 3 faixas de altura; registrar 4 anomalias; manter distância da estrutura; demonstrar resposta a obstáculo | Gimbal, zoom, sensores, frear e desviar |
| 7 | Inspeção de fachada | Executar varredura por setores; localizar defeitos; tomar decisão adequada em pouca luz; cumprir preparação de sensores | Foto, assistência, iluminação e roteiro de calibração |
| 8 | Acompanhamento de obra | Repetir 4 pontos de captura; enquadrar referências; executar tomadas automáticas em área desocupada | Waypoints, foto, vídeo, Helix, Boomerang e Asteroid didático |
| 9 | Busca em área rural | Cobrir setores de busca; localizar alvo; registrar posição; selecionar e acompanhar alvo móvel; cancelar automação | Mapa, seleção, ActiveTrack, câmera e pilotagem manual |
| 10 | Contingências | Resolver episódios controlados de perda de sinal, GNSS fraco, vento e bateria baixa; justificar decisões e pousar | RTH, pairar, pousar, bateria, enlace, limites e decisões |

Organização da produção: missões 1–2, depois 3–4, depois 5–6, depois 7–8 e por fim 9–10. Cada lote inclui cenário, briefing, objetivos, checklist, critérios, persistência e testes. Não considerar missão pronta apenas por ter um botão na tela.

Todos os recursos simulados atuais serão cobertos ao longo da trilha. Não será exigido usar cada recurso em toda missão. Funções de um drone real ainda ausentes precisam de implementação específica antes de entrar na avaliação.

## Avaliação de 0 a 100 por missão

| Critério | Pontos | Evidência |
|---|---:|---|
| Pré-voo | 20 | Checklist, identificação de falhas e configurações adequadas |
| Pilotagem | 30 | Controle, limites, trajetória, obstáculos e pouso |
| Objetivos | 35 | Pontos cumpridos, enquadramentos, registros e decisões |
| Pós-voo e relatório | 15 | Encerramento, inspeção, conferência de evidências e relato |

- Registrar pontos e motivos por critério, não apenas a soma.
- Proposta inicial: aprovação com 70 pontos, configurável pelo professor antes da atividade.
- Colisão ou entrada em área de exclusão poderá exigir refazer, mesmo com nota numérica suficiente. Registrar separadamente nota e status de aprovação.
- Versionar critérios e parâmetros: alterações futuras não mudam retroativamente avaliações entregues.
- Proposta inicial: prática ilimitada; atividades avaliadas seguem o limite e a regra de nota definidos pelo professor.
- Nota oficial calculada no servidor; aluno envia eventos e evidências, nunca uma nota final arbitrária.
- Validar duração, sequência, limites físicos e duplicidade dos eventos. Como a simulação roda no navegador, verificações de consistência reduzem manipulação, mas não equivalem a um motor inteiramente autoritativo no servidor.

## Checklists

Pré-voo: cenário, pessoas/obstáculos, clima simulado, estrutura/hélices, bateria, sensores, GNSS, origem, limites e RTH. Parte das verificações exigirá localizar ou corrigir uma condição simulada.

Pós-voo: confirmar pouso, motores parados, desligamento, inspeção, bateria restante, conferência das capturas, ocorrências e relatório. Salvar respostas e horários ligados à tentativa.

## Entrega 5 — Dados online, evidências e notas

| Estrutura | Uso |
|---|---|
| academy_profiles / classes / memberships / invites | Identidade acadêmica, turmas e matrículas já modeladas |
| academy_missions / mission_versions | Catálogo publicado e configurações versionadas |
| academy_assignments | Missão atribuída à turma, prazo, limites e regra de nota |
| academy_attempts | Aluno, atividade, versão, início/fim e estado da tentativa |
| academy_attempt_events | Eventos e amostras de telemetria em lotes ordenados |
| academy_checklist_responses | Respostas pré e pós-voo |
| academy_evidence | Metadados de capturas e arquivos privados no Storage |
| academy_scores / feedback | Resultado por critério e observações do professor |
| academy_audit_log | Promoções, revisões de nota e alterações administrativas |

- Supabase será a fonte principal para matrículas, atribuições, tentativas entregues e notas.
- Usar cache local somente para contingência, com fila de envio identificada e confirmação de recebimento. Não apresentar uma entrega como salva antes de o servidor confirmar.
- Enviar telemetria em lotes, com sequência e idempotência, evitando gravar cada quadro de renderização.
- Arquivos em buckets privados com políticas por tentativa/turma; links temporários para consulta autorizada.
- Fotos e eventos como evidência padrão. Vídeos terão limites configurados de tamanho/duração e não serão enviados continuamente.
- Aplicar políticas também ao Storage e às funções de banco. Finalização e atribuição de nota serão transacionais.

Aceite: uma tentativa finalizada aparece para o aluno e seu professor após novo login em outro dispositivo; usuário alheio não acessa dados nem arquivos; repetição de envio não duplica nota.

## Entrega 6 — Publicação e homologação

- Publicar versão de teste na Vercel e configurar URLs do Supabase.
- Habilitar Google conforme o guia separado e testar contas reais.
- Testar telas em desktop, tablet e celular, teclado e toque.
- Validar captura quando MediaRecorder não existir, interrupções de rede, sessão expirada e atualização de página.
- Executar testes das dez missões, pontuação, RLS, anexos e alterações de papel.
- Confirmar que build não contém `.env`, senhas, migrações administrativas ou arquivos de backup.
- Revisar limites de armazenamento e plano de recuperação de dados antes de uso com turmas reais.

Aceite final: professor cria uma turma e uma atividade; aluno entra por código, realiza uma missão, entrega evidências e recebe nota; professor revisa; superadmin acompanha; dados persistem online; voo livre continua público.

## Ordem de execução

Banco e autenticação → painéis e atribuições → motor comum e missão 1 com persistência completa → lotes das demais missões → relatórios e revisão → Google e homologação na Vercel.

A modelagem de notas e evidências deve ocorrer junto ao motor comum; a Entrega 5 detalha esse trabalho transversal, não uma adição somente depois de construir dez missões sem persistência.

O planejamento não aplica migrações, não publica na Vercel e não altera configurações de contas. Cada entrega deve ser marcada concluída somente após os respectivos critérios de aceite.
