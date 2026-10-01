export function createMissionPanel({panel,toggle,close,stepLabel,mobile=matchMedia('(max-width:999px)'),notifyLayout=()=>window.dispatchEvent(new Event('trainingpanelchange'))}){
 let collapsed=false,phase='prep';
 function update(){
  const hidden=mobile.matches&&collapsed;
  panel.hidden=hidden;toggle.hidden=!hidden;close.hidden=!mobile.matches||phase==='prep';
  toggle.setAttribute('aria-expanded',String(!hidden));
  document.body.classList.toggle('mission-panel-collapsed',hidden);notifyLayout();
 }
 function hide(){collapsed=true;update();if(mobile.matches)toggle.focus();}
 function show(){collapsed=false;update();close.focus();}
 toggle.addEventListener('click',show);close.addEventListener('click',hide);
 mobile.addEventListener('change',update);update();
 return {
  setPhase(value){phase=value;collapsed=value==='flight';update();if(mobile.matches){if(collapsed)toggle.focus();else panel.focus();}},
  setStep(index,total,title){const text=index>=total?'Objetivos concluídos':`Etapa ${index+1}/${total}`;if(stepLabel.textContent!==text)stepLabel.textContent=text;toggle.setAttribute('aria-label',`Abrir painel da missão: ${text}${title?' — '+title:''}`);}
 };
}
