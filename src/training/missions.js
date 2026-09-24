// Catálogo pedagógico. Não atribui notas nem representa missões já implementadas.
export const rubric = Object.freeze({preFlight:20,piloting:30,objectives:35,postFlight:15});
export const missions = [
  ['primeiro-voo','Primeiro voo',['Manetes','Decolagem e pouso','Pairado','Normal','GPS','Home Point']],
  ['precisao','Circuito de precisão',['Cine','Normal','Sport','Frenagem','Limites de altura e distância']],
  ['solar','Telhado para instalação solar',['Gimbal','Zoom','Foto','Grade','Exposição Auto/Pro','EV']],
  ['area','Inspeção de área',['Mapa','Waypoints','Altura dos pontos','RTH']],
  ['evento','Cobertura de evento',['Cine','Vídeo','QuickShots: Dronie, Rocket, Circle']],
  ['torre','Inspeção de torre',['Sensores','Frear','Desviar','Gimbal','Zoom']],
  ['fachada','Inspeção de fachada',['Foto','Pouca luz','Assistência desligada','Calibração']],
  ['obra','Acompanhamento de obra',['Waypoints','Foto','Vídeo','QuickShots: Helix, Boomerang, Asteroid']],
  ['busca','Busca em área rural',['Mapa','Seleção de alvo','ActiveTrack','Cancelar automação']],
  ['contingencia','Missão com contingências',['Perda de enlace','RTH','Pairar','Pousar','GNSS fraco','Bateria baixa e crítica']]
].map(([id,title,features],index)=>Object.freeze({id,order:index+1,title,maxScore:100,features,status:'planned'}));
export const checklists = {
  preFlight:['Avaliar cenário e obstáculos','Verificar clima simulado','Inspecionar hélices e estrutura','Verificar bateria','Conferir sensores e calibração','Confirmar GNSS e origem','Configurar limites e RTH','Confirmar área de decolagem'],
  postFlight:['Confirmar pouso e motores parados','Desligar equipamento','Inspecionar estrutura e hélices','Registrar bateria restante','Conferir fotos e vídeos','Registrar ocorrências e relatório']
};
