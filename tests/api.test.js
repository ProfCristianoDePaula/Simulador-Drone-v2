import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSession} from '../api/session.js';
test('API de sessão rejeita acesso sem token antes de consultar o banco',async()=>{const response=await handleSession(new Request('https://academy.invalid/api/session'));assert.equal(response.status,401);});
test('API de sessão rejeita token malformado',async()=>{const response=await handleSession(new Request('https://academy.invalid/api/session',{headers:{Authorization:'Bearer invalid'}}));assert.equal(response.status,401);});
