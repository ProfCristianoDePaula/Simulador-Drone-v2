import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {helpAreas,helpGuides,controlHelp,findHelpGuides} from '../src/ui/help-content.js';
test('help links point to shipped pages and guide IDs are unique',()=>{
 assert.equal(new Set(helpGuides.map(g=>g.id)).size,helpGuides.length);
 for(const guide of helpGuides){assert.ok(guide.steps.length>1);for(const [,href] of guide.links){const url=new URL(href,'https://academy.invalid');assert.equal(url.origin,'https://academy.invalid');assert.ok(fs.existsSync('.'+(url.pathname==='/'?'/index.html':url.pathname)),href);}}
 for(const [area] of helpAreas)assert.ok(findHelpGuides(area).length>0);
});
test('help search respects the area and matches words without accents',()=>{
 assert.ok(findHelpGuides('student','confirmacao').some(g=>g.id==='acesso'));
 assert.ok(findHelpGuides('teacher','matricule').some(g=>g.id==='criar-turma'));
 assert.ok(!findHelpGuides('student').some(g=>g.id==='criar-turma'));
 assert.equal(findHelpGuides('teacher','termo inexistente 123').length,0);
 assert.equal(controlHelp.length,12);
});
