export function createSafetyRules(S){
  function effectiveH(){
    return Math.min(S.maxH,
      S.scenario==="Teto local 60 m"?60:
      S.scenario==="Restrição de firmware 30 m"?30:200);
  }
  function effectiveD(){
    return Math.min(S.maxD,S.scenario==="Visibilidade 200 m"?200:20000);
  }
  function sensorsAvailable(){
    return S.mode!=="Sport" && S.light==="Dia" && S.avoid!=="Desligado";
  }
  return {effectiveH, effectiveD, sensorsAvailable};
}
