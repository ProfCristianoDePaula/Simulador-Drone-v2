import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlightState} from '../src/simulator/state.js';
import {createSafetyRules} from '../src/simulator/safety.js';
import {missions,rubric} from '../src/training/missions.js';
test('estados de voos diferentes não compartilham rotas ou checklists',()=>{
  const a=createFlightState(),b=createFlightState();a.waypoints.push({x:1,z:2});a.checks[0]=true;
  assert.equal(b.waypoints.length,0);assert.equal(b.checks[0],false);
});
test('regras acompanham alterações de cenário, modo e iluminação',()=>{
  const s=createFlightState(),rules=createSafetyRules(s);
  assert.equal(rules.effectiveH(),200);s.scenario='Teto local 60 m';assert.equal(rules.effectiveH(),60);
  s.maxH=40;assert.equal(rules.effectiveH(),40);
  s.scenario='Visibilidade 200 m';assert.equal(rules.effectiveD(),200);
  assert.equal(rules.sensorsAvailable(),true);s.mode='Sport';assert.equal(rules.sensorsAvailable(),false);
  s.mode='Normal';s.light='Pouca luz';assert.equal(rules.sensorsAvailable(),false);
});
test('dez missões independentes valem cem pontos cada',()=>{
  assert.equal(missions.length,10);assert.equal(new Set(missions.map(m=>m.id)).size,10);
  assert.ok(missions.every(m=>m.maxScore===100));assert.equal(Object.values(rubric).reduce((a,b)=>a+b),100);
});
