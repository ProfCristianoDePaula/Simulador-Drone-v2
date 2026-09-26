import {goalCriteria,goalReadings} from './criteria.js';
export function navigationGuidance(goal,s,progress){
 if(s.paused)return 'Avaliação pausada. Retome o voo e feche as configurações para contar o tempo no objetivo.';
 if(!s.power)return 'Ligue o controle para retomar a avaliação.';
 if(!goal)return 'Todos os objetivos concluídos. Encerre o voo e preencha o pós-voo.';
 if(!['point','land'].includes(goal.kind))return `Etapa ${progress.index+1}: ${goal.label}.\n${goalCriteria(goal)}\n${goalReadings(goal,s)}\nPermanência válida: ${progress.hold.toFixed(1)} / ${goal.seconds} s.`;
 const x=goal.kind==='land'?0:goal.x,z=goal.kind==='land'?0:goal.z,h=goal.kind==='land'?0:goal.h;
 const dx=x-s.x,dz=z-s.z,dh=h-s.h,distance=Math.hypot(dx,dz);
 const right=Math.cos(s.yaw)*dx+Math.sin(s.yaw)*dz,forward=Math.sin(s.yaw)*dx-Math.cos(s.yaw)*dz;
 const lines=[`Etapa ativa ${progress.index+1}: ${goal.label}. Os objetivos devem ser concluídos na ordem.`,`Destino: X ${x} / Z ${z} / H ${h} m.`,`Atual: X ${s.x.toFixed(1)} / Z ${s.z.toFixed(1)} / H ${s.h.toFixed(1)} m.`,`Faltam ${distance.toFixed(1)} m na horizontal; diferença de altura ${dh>=0?'+':''}${dh.toFixed(1)} m.`];
 if(s.crashed)return lines.concat('Colisão registrada. Refaça a tentativa.').join('\n');
 if(!s.flying&&goal.kind!=='land')lines.push('Clique em ↑ Decolar para iniciar o deslocamento.');
 else if(s.auto)lines.push('Automação ativa: supervisione o percurso. Pause/cancele a automação antes de assumir o controle manual.');
 else if(s.link==='Perdido')lines.push('Enlace perdido: os comandos manuais não estão disponíveis.');
 else {
  if(distance>=goal.radius){const commands=[];if(Math.abs(forward)>1)commands.push(forward>0?'↑ avançar':'↓ recuar');if(Math.abs(right)>1)commands.push(right>0?'→ direita':'← esquerda');lines.push(`Na orientação atual do drone: ${commands.join(' e ')}. Observe os valores e solte as setas ao entrar na área.`);}
  else lines.push('Posição horizontal dentro da área aceita. Solte as setas para estabilizar.');
  if(goal.kind==='land')lines.push(distance<goal.radius?'Clique em ↓ Pousar e aguarde os motores pararem.':'Retorne à área da base antes de pousar.');
  else if(Math.abs(dh)>=goal.tolerance)lines.push(dh>0?'W: subir (manete esquerdo para cima).':'S: descer (manete esquerdo para baixo).');
 }
 if(goal.kind==='point')lines.push(`Critério: distância horizontal < ${goal.radius} m; altura entre ${h-goal.tolerance} e ${h+goal.tolerance} m (limites excluídos); velocidade < 4 m/s. Mantenha por ${goal.seconds} s contínuos.`,`Permanência válida: ${progress.hold.toFixed(1)} / ${goal.seconds} s. Sair dos limites reinicia a contagem.`);
 else lines.push(`Critério: pousado, altura < 0,5 m e distância à base < ${goal.radius} m por ${goal.seconds} s.`);
 return lines.join('\n');
}
