export const helpAreas=[['student','Sou aluno','student'],['teacher','Sou professor','teacher'],['simulator','Usar o simulador','missions'],['issues','Resolver dúvidas','history']];
const step=(title,text)=>({title,text});
export const helpGuides=[
 {id:'acesso',areas:['student','teacher','issues'],title:'Entrar e preparar sua conta',summary:'Cadastro, confirmação de e-mail, senha e perfil.',steps:[
  step('Acesse a página inicial','Use e-mail e senha para entrar. Se ainda não tem conta, clique em “Ainda não tenho conta”, informe seu nome, e-mail e uma senha com pelo menos 8 caracteres.'),
  step('Confirme seu e-mail','Após o cadastro, abra a mensagem de confirmação. Se o acesso informar que o e-mail não foi confirmado, confira também o spam ou procure o administrador. O botão de login com Google está temporariamente oculto.'),
  step('Confira seu perfil','Uma conta nova começa como aluno. Para usar as funções de professor, peça ao administrador a alteração de perfil após a confirmação do e-mail. Atualize o painel depois da alteração.'),
  step('Recupere a senha se necessário','Na página inicial, clique em “Esqueci minha senha”. Informe o e-mail cadastrado e siga o link recebido para definir outra senha.')],links:[['Abrir acesso','/'],['Recuperar senha','/recuperar.html']]},
 {id:'entrar-turma',areas:['student'],title:'Entrar em uma turma',summary:'Use o código recebido do professor e encontre suas atividades.',steps:[
  step('Peça o código da turma','Solicite ao professor o código de 12 caracteres. Se ele renovar ou pausar o código, a entrada com o código antigo pode deixar de funcionar.'),
  step('Faça a inscrição','No painel, encontre “Entrar em turma”, informe o código e clique em “Entrar”. Confira a turma em “Minhas turmas”. O professor também pode matricular uma conta cadastrada pelo e-mail.'),
  step('Localize a atividade','Abra “Minhas atividades”. Consulte turma, prazo, tentativas permitidas e regra de nota. Use a busca e o filtro de situação para encontrar o que precisa fazer.')],links:[['Abrir meu painel','/painel.html#classes']]},
 {id:'treino-ou-atividade',areas:['student','teacher','simulator'],title:'Voo livre, treino ou atividade?',summary:'Entenda qual caminho gera uma nota oficial.',steps:[
  step('Explore no voo livre','O simulador livre não exige login e não gera nota acadêmica. Use-o para conhecer controles, câmera, mapa e automações.'),
  step('Treine uma missão','Em “Missões para praticar”, use “Treinar sem nota”. Você segue objetivos e checklists, mas o resultado não é uma entrega oficial para o professor.'),
  step('Entre pela atividade para receber nota','Para uma avaliação, abra “Minhas atividades” e clique em “Realizar missão”. Esse caminho vincula a tentativa à atividade e à turma. Treinar pelo catálogo não entrega a atividade.')],links:[['Treinar primeiro voo','/missao.html?missao=primeiro-voo'],['Ver minhas atividades','/painel.html#activities']]},
 {id:'entregar-missao',areas:['student'],title:'Realizar e entregar uma missão',summary:'Do checklist pré-voo até a confirmação da entrega.',steps:[
  step('Leia antes de iniciar','Na atividade, leia o briefing e abra “Plano de voo e critérios de todas as etapas”. Confira o que precisa fazer, por quanto tempo e com quais tolerâncias.'),
  step('Prepare o voo','Complete o checklist pré-voo e responda à pergunta. Confira bateria, GNSS, origem e altura de RTH nas configurações. Clique em “Iniciar missão” quando estiver pronto.'),
  step('Siga a ordem dos objetivos','Acompanhe o objetivo atual, os marcadores e o tempo de permanência. Um objetivo posterior não substitui o atual. Feche os menus e retome o voo para contar o tempo. Faça as fotos e vídeos pedidos.'),
  step('Encerre o voo','Pouse e pare a gravação. Clique em “Encerrar voo e preencher pós-voo”, complete as verificações e escreva seu relatório de 5 a 4.000 caracteres.'),
  step('Confirme a entrega','Clique em “Enviar evidências e finalizar” e mantenha a página aberta. Só considere entregue quando aparecer “Entrega confirmada pelo Supabase” e a nota. Confira depois em “Histórico de tentativas”.')],links:[['Abrir minhas atividades','/painel.html#activities']]},
 {id:'notas',areas:['student','teacher'],title:'Entender notas e tentativas',summary:'Critérios, aprovação, revisão e regra de aproveitamento.',steps:[
  step('Conheça os 100 pontos','Cada missão distribui até 20 pontos no pré-voo, 30 na pilotagem, 35 nos objetivos e 15 no pós-voo. Os detalhes da tentativa mostram a pontuação por critério.'),
  step('Confira aprovação e falhas críticas','O professor define a nota mínima da atividade. Colisão ou entrada em área de exclusão pode exigir refazer mesmo com nota numérica suficiente. Consulte a situação junto com a nota.'),
  step('Compare as tentativas','A atividade usa a melhor nota ou a última nota, conforme a regra escolhida pelo professor. Consulte também o limite de tentativas e o prazo.'),
  step('Leia os comentários','Abra “Ver tentativa” para consultar o relatório, o percurso, as evidências e a revisão do professor. Se precisar de outra tentativa, fale com ele; a liberação adicional não elimina o prazo da atividade.')],links:[['Consultar histórico','/painel.html#history']]},
 {id:'criar-turma',areas:['teacher'],title:'Criar e organizar uma turma',summary:'Nome, código, matrículas e arquivamento.',steps:[
  step('Crie sua turma','No painel do professor, preencha “Nome da turma” e clique em “Criar”. Ela aparecerá na tabela “Minhas turmas”.'),
  step('Abra o gerenciamento','Clique em “Gerenciar turma”. Você pode editar o nome, consultar o código, renovar o código e pausar ou liberar novas entradas.'),
  step('Matricule os alunos','Compartilhe o código para os alunos entrarem pelo próprio painel. Outra opção é preencher “E-mail de aluno cadastrado” e clicar em “Adicionar aluno”. A tabela mostra as matrículas e permite removê-las.'),
  step('Arquive quando encerrar','No gerenciamento, altere a situação para “Arquivada” e salve. Isso não apaga o histórico. Para criar atividades e receber novas tentativas, mantenha a turma ativa.')],links:[['Gerenciar minhas turmas','/painel.html#classes']]},
 {id:'atribuir-missao',areas:['teacher'],title:'Atribuir uma atividade',summary:'Escolha a missão, o prazo e as regras de avaliação.',steps:[
  step('Escolha uma turma ativa','Em “Minhas turmas”, abra “Gerenciar turma”. Localize o formulário “Atribuir missão”. Ele não aparece para turmas arquivadas.'),
  step('Defina o exercício','Selecione uma das 12 missões e informe um título que os alunos reconheçam. Se necessário, defina uma data e horário de prazo; sem preenchimento, a atividade fica sem prazo.'),
  step('Configure a avaliação','Defina entre 1 e 20 tentativas e a nota mínima entre 0 e 100. Escolha “Melhor nota” ou “Última nota”. Revise essas informações antes de atribuir.'),
  step('Atribua à turma','Clique em “Atribuir à turma”. Confira o registro em “Atividades atribuídas” e oriente os alunos a começar por “Realizar missão”, não pelo treino sem nota.')],links:[['Abrir turmas','/painel.html#classes']]},
 {id:'acompanhar-revisar',areas:['teacher'],title:'Acompanhar e revisar entregas',summary:'Percurso, evidências, feedback e tentativa adicional.',steps:[
  step('Encontre o aluno','Em “Acompanhamento dos alunos”, busque o aluno ou a atividade. Filtre por “Entregue” para localizar tentativas finalizadas e clique em “Ver tentativa”.'),
  step('Examine a entrega','Confira a nota automática, a pontuação por critério, o relatório e o percurso. Abra as fotos e vídeos pelos links da tentativa. Se um link expirar, abra os detalhes novamente.'),
  step('Registre uma revisão','Informe uma nota revisada de 0 a 100, ou deixe o campo vazio para usar o cálculo automático. Escreva uma justificativa/comentário de pelo menos 5 caracteres e clique em “Salvar revisão”. Uma falha crítica continua impedindo aprovação.'),
  step('Libere outra tentativa quando necessário','Use “Liberar tentativa adicional” e salve com uma justificativa. Isso permite uma nova tentativa; não retoma o voo anterior e não prorroga automaticamente o prazo.')],links:[['Ver acompanhamento','/painel.html#history']]},
 {id:'exportar',areas:['teacher'],title:'Consultar e exportar notas',summary:'Relatório da atividade e arquivo CSV.',steps:[
  step('Abra o relatório','Em “Atividades atribuídas”, clique em “Ver relatório”. A tabela mostra aluno, e-mail, nota e situação, de acordo com a regra de aproveitamento da atividade.'),
  step('Identifique pendências','“Pendente” indica ausência de uma entrega aproveitada naquele relatório. Para analisar o que aconteceu, consulte as tentativas no acompanhamento.'),
  step('Exporte para planilha','Clique em “Exportar CSV”. O navegador baixa o arquivo de desempenho da atividade. Abra-o em um editor de planilhas; o separador usado é ponto e vírgula.')],links:[['Ver atividades atribuídas','/painel.html#activities']]},
 {id:'primeiro-voo',areas:['simulator','student','teacher'],title:'Aprender os comandos de voo',summary:'Decolagem, manetes, teclado, pausa e retorno.',controls:true,steps:[
  step('Decole com calma','No simulador livre, clique em “Decolar”. Para começar devagar, selecione C (Cine). N é Normal e S é Sport; o modo Sport não oferece assistência de obstáculos.'),
  step('Use o manete esquerdo','W sobe e S desce. A gira para a esquerda e D para a direita. No celular, arraste o manete esquerdo; os manetes aceitam mouse ou toque.'),
  step('Use o manete direito','As setas deslocam o drone para frente, trás e lados em relação à direção para a qual ele aponta. A direção muda quando você gira. Solte os comandos para parar o deslocamento manual.'),
  step('Pause ou retorne','Espaço pausa e retoma. R ou H RTH inicia o retorno à origem quando GNSS e origem permitem. O botão de decolagem também inicia o pouso quando a aeronave está em voo. Menus e saída da janela pausam o exercício; confira “Retomar” ao voltar.')],links:[['Abrir voo livre','/simulador.html']]},
 {id:'camera',areas:['simulator'],title:'Câmera, fotos e vídeos',summary:'Gimbal, zoom, enquadramento e evidências.',steps:[
  step('Enquadre o alvo','O dial esquerdo ajusta a inclinação do gimbal e o direito controla o zoom. C1 centraliza o gimbal. Abra o menu Camera para outros ajustes. Nas missões de foto, respeite distância e enquadramento indicados no objetivo.'),
  step('Fotografe','Use “Foto”, P ou “Tirar e baixar foto” no painel da missão. O navegador inicia o download do PNG tanto no voo livre quanto nas missões. Na missão, a imagem também aparece em “Capturas da missão”, com a opção “Baixar foto” caso o download automático seja bloqueado. As evidências da atividade avaliada são enviadas ao finalizar a entrega.'),
  step('Grave uma tomada','Clique em “Gravar vídeo” e depois em “Parar e salvar vídeo” no painel da missão, ou use o botão de gravação do controle. Ao finalizar, o navegador inicia o download e o vídeo aparece em “Capturas da missão”. Se o download automático for bloqueado, use “Baixar vídeo” na galeria. Ao encerrar o voo em solo, o sistema também finaliza a gravação antes do pós-voo.'),
  step('Respeite os limites','Cada evidência de missão pode ter até 10 MB, com no máximo 30 evidências por tentativa. O gravador encerra automaticamente uma tomada após 2 minutos. Prefira clipes curtos e confira o registro antes de entregar.')],links:[['Experimentar a câmera','/simulador.html']]},
 {id:'mapa-rotas',areas:['simulator'],title:'Mapa, posição e Waypoints',summary:'Leia a telemetria e planeje uma rota.',steps:[
  step('Leia sua posição','H é altura e D é distância à origem. Na missão, a base fica em X 0 / Z 0: X positivo aponta para leste e Z negativo para norte. O rumo informa para onde o drone aponta. M ou “Mapa ⇄” alterna a visualização.'),
  step('Entenda o cenário','No voo livre, “Minha localização” pode usar o GPS autorizado do dispositivo como origem das imagens. Missões usam cenários controlados, sem GPS real. O mapa não garante uma rota livre de obstáculos.'),
  step('Marque os pontos','Abra WP / Waypoints, escolha a altura dos novos pontos e “Adicionar pontos no mapa”. Clique no mapa ampliado para montar a rota, com até 12 pontos. Remova o último ponto ou limpe a rota se precisar.'),
  step('Execute e supervisione','Clique em “Executar rota” com a aeronave pronta para voar. Ao terminar, ela fica pairando. Use “Cancelar execução” para interromper e retome o controle manual. Planeje o retorno e o pouso.')],links:[['Abrir simulador','/simulador.html']]},
 {id:'automacoes',areas:['simulator'],title:'Automações e configurações',summary:'QuickShots, acompanhamento, limites e calibração.',steps:[
  step('Conheça os menus','Use ••• para abrir as configurações. Safety reúne limites e RTH; Transmission inclui a ação de perda de enlace; os ajustes de sensores e iluminação afetam a assistência disponível.'),
  step('Experimente os QuickShots','Abra QS, escolha a tomada e siga as instruções para usar o veículo como referência. As trajetórias são aproximações didáticas. Supervisione o movimento e use o cancelamento automático quando precisar.'),
  step('Acompanhe o alvo','Abra AT / ActiveTrack, selecione e enquadre o veículo e inicie o acompanhamento. Use “Parar acompanhamento” para interromper. Obstáculos, limites e condições de navegação podem interromper automações.'),
  step('Prepare os exercícios','O roteiro de Calibração avança com a aeronave em solo. Durante missões, condições como bateria, GNSS e iluminação são controladas pelo exercício; reinício e recarga artificial ficam bloqueados.')],links:[['Explorar os recursos','/simulador.html']]},
 {id:'recuperar-entrega',areas:['issues','student','teacher'],title:'Falha de envio ou voo interrompido',summary:'O que pode ser recuperado e quando pedir outra tentativa.',steps:[
  step('Se o envio falhar','Mantenha a página aberta, confira a internet e tente enviar novamente. Aguarde a confirmação do servidor; uma captura guardada no navegador ainda não é uma entrega oficial.'),
  step('Se a página foi fechada','Entre no mesmo navegador e dispositivo. Na atividade em andamento, use “Recuperar entrega”. Essa opção recupera os registros locais para envio, não a posição física do voo.'),
  step('Se não houver registro ou o voo parou no ar','Use “Encerrar tentativa” no painel e converse com o professor sobre outra tentativa. Não limpe os dados do navegador antes de tentar recuperar uma entrega que falhou.'),
  step('Se acabou o tempo ou o limite','Siga a orientação de encerramento da missão e consulte o professor. A liberação adicional depende dele; uma turma arquivada ou prazo encerrado também pode impedir um novo início.')],links:[['Consultar atividades','/painel.html#activities']]},
 {id:'problemas-simulador',areas:['issues','simulator'],title:'O simulador não responde',summary:'Tela 3D, comandos, vídeo e objetivos parados.',steps:[
  step('Tela 3D não carregou','Confira sua conexão e o suporte do navegador a WebGL/aceleração gráfica. Abra a aplicação pelo endereço do site ou pelo servidor local, não diretamente pelo arquivo HTML.'),
  step('Os comandos não funcionam','Feche os menus, retome o exercício, confira se o controle está ligado e se a missão já foi iniciada. Se o foco estiver em um campo, termine a edição antes de usar atalhos. Uma colisão encerra o voo.'),
  step('O objetivo não avança','Confira se é a etapa atual e abra suas tolerâncias. Mantenha a posição, altura, velocidade e duração pedidas. Nas fotos, centralize o alvo e confira gimbal e distância. Feche as configurações para o tempo contar.'),
  step('O vídeo não grava','Use um navegador com suporte a MediaRecorder e captura do canvas. Se a missão exige vídeo, use um navegador compatível antes de iniciar a avaliação. Um clipe acima de 10 MB precisa ser refeito mais curto.')],links:[['Treinar sem nota','/missao.html?missao=primeiro-voo']]}
];
export const controlHelp=[
 ['W','Subir','Eleva a aeronave pelo manete esquerdo.'],['S','Descer','Reduz a altura da aeronave.'],['A','Girar à esquerda','Muda o rumo; não desloca lateralmente.'],['D','Girar à direita','Muda o rumo; não desloca lateralmente.'],
 ['↑','Avançar','Move para a frente em relação ao rumo atual.'],['↓','Recuar','Move para trás em relação ao rumo atual.'],['←','Mover à esquerda','Desloca para a esquerda sem girar.'],['→','Mover à direita','Desloca para a direita sem girar.'],
 ['Espaço','Pausar / retomar','Alterna a pausa da simulação.'],['R','Retornar à origem','Inicia RTH quando a navegação está disponível.'],['P','Fotografar','Registra a imagem atual da câmera.'],['M','Alternar mapa','Alterna entre as visualizações do mapa e da câmera.']
];
export function findHelpGuides(area,term=''){
 const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const query=normalize(term.trim());
 return helpGuides.filter(guide=>guide.areas.includes(area)&&normalize([guide.title,guide.summary,...guide.steps.flatMap(s=>[s.title,s.text])].join(' ')).includes(query));
}
