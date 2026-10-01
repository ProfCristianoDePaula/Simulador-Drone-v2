import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissionPanel} from '../src/training/panel.js';
function fixture(matches=true){
 const classes=new Set();globalThis.document={body:{classList:{toggle(name,value){value?classes.add(name):classes.delete(name);}}}};
 const node=()=>({hidden:false,attributes:{},events:{},focused:false,textContent:'',setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.events[k]=fn;},focus(){this.focused=true;}});
 const panel=node(),toggle=node(),close=node(),stepLabel=node(),mobile={matches,addEventListener(_event,fn){this.change=fn;}};
 let layouts=0;const controller=createMissionPanel({panel,toggle,close,stepLabel,mobile,notifyLayout(){layouts++;}});
 return {panel,toggle,close,stepLabel,mobile,controller,classes,get layouts(){return layouts;}};
}
test('mobile mission panel collapses for flight and can be opened and hidden again',()=>{
 const f=fixture();assert.equal(f.panel.hidden,false);assert.equal(f.toggle.hidden,true);assert.equal(f.close.hidden,true);
 f.controller.setPhase('flight');assert.equal(f.panel.hidden,true);assert.equal(f.toggle.hidden,false);assert.equal(f.toggle.attributes['aria-expanded'],'false');assert.ok(f.classes.has('mission-panel-collapsed'));
 f.toggle.events.click();assert.equal(f.panel.hidden,false);assert.equal(f.close.hidden,false);assert.equal(f.close.focused,true);
 f.close.events.click();assert.equal(f.panel.hidden,true);assert.equal(f.toggle.focused,true);assert.ok(f.layouts>=4);
});
test('post-flight, recovery, result and expiration remain visible on mobile',()=>{
 const f=fixture();for(const phase of ['post','recovered','done','expired']){f.controller.setPhase('flight');f.controller.setPhase(phase);assert.equal(f.panel.hidden,false);assert.equal(f.toggle.hidden,true);assert.equal(f.panel.focused,true);}
 f.controller.setStep(2,6,'Fotografar alvo');assert.equal(f.stepLabel.textContent,'Etapa 3/6');assert.match(f.toggle.attributes['aria-label'],/Fotografar alvo/);
 f.controller.setStep(6,6);assert.equal(f.stepLabel.textContent,'Objetivos concluídos');
});
test('desktop keeps its panel and resizing restores the mobile collapsed state',()=>{
 const f=fixture(false);f.controller.setPhase('flight');assert.equal(f.panel.hidden,false);assert.equal(f.toggle.hidden,true);assert.equal(f.close.hidden,true);
 f.mobile.matches=true;f.mobile.change();assert.equal(f.panel.hidden,true);
 f.mobile.matches=false;f.mobile.change();assert.equal(f.panel.hidden,false);assert.ok(!f.classes.has('mission-panel-collapsed'));
});
