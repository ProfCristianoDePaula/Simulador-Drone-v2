export function goalCriteria(g){
 const hold=g.seconds?` Mantenha por ${g.seconds} s contínuos.`:' Confirmação imediata quando a condição for atendida.';
 const rules={point:`Voe até X ${g.x}, Z ${g.z}, H ${g.h} m. Distância horizontal < ${g.radius} m; erro de altura < ${g.tolerance} m; velocidade < 4 m/s.`,land:`Pouse após decolar: altura < 0,5 m, distância à base < ${g.radius} m e motores parados.`,mode:`Em voo, selecione ${g.value} no seletor C/N/S.`,auto:`Em voo, mantenha ${g.value} ativo. Use WP para Waypoints, H RTH para retorno, AT para rastreamento ou QS para QuickShots.`,photo:`Em voo, fotografe o alvo X ${g.x}, Z ${g.z}, H ${g.h} m. Distância entre 5 e ${g.radius||65} m (inclusive). Erro horizontal e vertical de enquadramento < 17,2° ÷ zoom. Ajuste giro A/D, gimbal e zoom; depois pressione Foto. O alvo é o objeto fotografado, não a posição do drone.`,video:`Em voo, grave no modo ${g.value}. Pare a gravação para salvar a evidência antes de entregar.`,calibration:'Em solo, abra Calibração e conclua o roteiro selecionado.',manual:'Em voo, cancele a automação e mova manualmente com velocidade > 0,3 m/s.',link:'Em voo, enlace Perdido, ação de perda Pairar e velocidade < 1 m/s.',gps:'Em voo, GNSS Fraco e altura > 5 m e < 40 m.',setting:`Com o controle ligado, configure ${ {zoom:'zoom',exposure:'exposição',avoid:'sensores'}[g.key]||g.key} ${g.minimum!==undefined?`≥ ${g.minimum}`:`= ${g.value}`}.`};
 return (rules[g.kind]||g.label)+hold+' Colisão impede a validação da etapa.';
}
export function goalReadings(g,s){
 if(g.kind==='photo'){
  const dx=g.x-s.x,dz=g.z-s.z,dy=g.h-s.h;
  const angle=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,-dz)-s.yaw),Math.cos(Math.atan2(dx,-dz)-s.yaw)))*180/Math.PI;
  const pitch=Math.abs(Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI-s.gimbal);
  return `Distância ao alvo: ${Math.hypot(dx,dz,dy).toFixed(1)} m. Erro de enquadramento: horizontal ${angle.toFixed(1)}° / vertical ${pitch.toFixed(1)}°. Limite atual: ${(0.3*180/Math.PI/Math.max(1,s.zoom||1)).toFixed(1)}°. Zoom ${s.zoom}×; gimbal ${s.gimbal.toFixed(0)}°.`;
 }
 return `Modo ${s.mode}; velocidade ${s.speed.toFixed(1)} m/s; H ${s.h.toFixed(1)} m. Automação: ${s.auto||'nenhuma'}. Gravação: ${s.recording?'ativa':'parada'}. GNSS ${s.gps}; enlace ${s.link}.`;
}
