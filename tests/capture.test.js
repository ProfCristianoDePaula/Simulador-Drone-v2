import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneCapture,createCaptureDelivery} from '../src/simulator/capture.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('mission photos produce a PNG download and keep the same blob as evidence',async()=>{
 const downloads=[],evidence=[],blob=new Blob(['png'],{type:'image/png'}),state={h:12,flying:true};
 const deliver=createCaptureDelivery({download:(...args)=>downloads.push(args),onCapture:async(...args)=>evidence.push(args)});
 await deliver(blob,'photo',state);
 assert.equal(downloads.length,1);assert.equal(downloads[0][0],blob);assert.match(downloads[0][1],/^mini4-photo-\d+\.png$/);
 assert.deepEqual(evidence,[[blob,'photo',state]]);
});
test('photo download does not wait for mission persistence and free flight still downloads',async()=>{
 let downloaded=false,release;const blob=new Blob(['png'],{type:'image/png'});
 const deliver=createCaptureDelivery({download:()=>downloaded=true,onCapture:()=>new Promise(resolve=>release=resolve)});
 const pending=deliver(blob,'photo',{});assert.equal(downloaded,true);release();await pending;
 let name;await createCaptureDelivery({download:(_blob,file)=>name=file})(blob,'photo',{});assert.match(name,/\.png$/);
});
function fixture({save=async()=>{},empty=false,beforeCapture=()=>{},maxBytes=Infinity,supported=true,silentStop=false,stopTimeoutMs=15000}={}){
 const notices=[],states=[];let stopped=0,recorder,photoCallback;
 class Recorder{
  static isTypeSupported(type){return type==='video/mp4';}
  constructor(stream,options){this.state='inactive';this.mimeType=options.mimeType;recorder=this;}
  start(){this.state='recording';}
  stop(){this.state='inactive';if(silentStop)return;queueMicrotask(()=>{if(!empty)this.ondataavailable({data:new Blob(['video-frames'],{type:this.mimeType})});void this.onstop();});}
 }
 const canvas={toBlob(callback){photoCallback=callback;},captureStream(){return {getTracks:()=>[{stop(){stopped++;}}]};}};
 const capture=createSceneCapture({canvas,render(){},snapshot:()=>({h:12,flying:true}),save,beforeCapture,maxBytes,stopTimeoutMs,Recorder:supported?Recorder:null,notify:text=>notices.push(text),onState:(...args)=>states.push(args)});
 return {capture,notices,states,get stopped(){return stopped;},get recorder(){return recorder;},finishPhoto(blob=new Blob(['png'],{type:'image/png'})){photoCallback(blob);}};
}
test('photo waits for the generated blob and mission persistence before success',async()=>{
 let release;const saved=[],f=fixture({save:async(...args)=>{saved.push(args);await new Promise(resolve=>release=resolve);}});
 const photo=f.capture.photo();assert.equal(f.capture.saving,true);f.finishPhoto();await tick();
 assert.equal(saved[0][1],'photo');assert.equal(saved[0][2].h,12);assert.equal(f.notices.length,0);
 let flushed=false;const flush=f.capture.flush().then(()=>flushed=true);await tick();assert.equal(flushed,false);
 release();assert.equal(await photo,true);await flush;assert.equal(flushed,true);assert.equal(f.capture.saving,false);
});
test('photo reports empty canvas and failed persistence without success messages',async()=>{
 const empty=fixture(),p=empty.capture.photo();empty.finishPhoto(null);assert.equal(await p,false);assert.match(empty.notices.at(-1),/Falha na foto/);
 const failed=fixture({save:async()=>{throw Error('storage failed');}}),q=failed.capture.photo();failed.finishPhoto();assert.equal(await q,false);assert.match(failed.notices.at(-1),/storage failed/);assert.ok(!failed.notices.some(n=>n.startsWith('Foto capturada')));
});
test('video completion waits for the final blob to be saved and supports MP4',async()=>{
 let release;const saved=[],f=fixture({save:async(...args)=>{saved.push(args);await new Promise(resolve=>release=resolve);}});
 f.capture.record();assert.equal(f.capture.recording,true);const final=f.capture.flush();await tick();
 assert.equal(f.capture.recording,false);assert.equal(f.capture.saving,true);assert.equal(saved[0][0].type,'video/mp4');assert.equal(saved[0][1],'video');assert.equal(f.stopped,1);
 assert.ok(!f.notices.some(n=>n.startsWith('Vídeo capturado')));release();await final;assert.equal(f.capture.saving,false);assert.match(f.notices.at(-1),/Vídeo capturado/);
});
test('empty recordings and storage errors fail explicitly and release the stream',async()=>{
 for(const options of [{empty:true},{save:async()=>{throw Error('storage failed');}}]){
  const f=fixture(options);f.capture.record();await assert.rejects(f.capture.flush());assert.equal(f.stopped,1);assert.equal(f.capture.recording,false);assert.equal(f.capture.saving,false);assert.ok(!f.notices.some(n=>n.startsWith('Vídeo capturado')));
 }
});
test('recording cannot begin before an active mission or without browser support',()=>{
 for(const options of [{beforeCapture(){throw Error('Start mission');}},{supported:false}]){const f=fixture(options);f.capture.record();assert.equal(f.recorder,undefined);assert.equal(f.capture.recording,false);assert.match(f.notices.at(-1),/indisponível/);}
});
test('large clips are rejected instead of reporting a successful capture',async()=>{
 let saved=false;const f=fixture({maxBytes:5,save:async()=>{saved=true;}});f.capture.record();await assert.rejects(f.capture.stop(),/10 MB/);assert.equal(saved,false);assert.equal(f.stopped,1);
});
test('recorder errors in inactive state release resources without hanging',async()=>{
 const f=fixture();f.capture.record();f.recorder.state='inactive';f.recorder.onerror();await tick();assert.equal(f.stopped,1);assert.equal(f.capture.saving,false);assert.match(f.notices.at(-1),/Falha no vídeo/);await f.capture.flush();
});
test('missing stop event produces an error and ignores a late callback',async()=>{
 let saved=false;const f=fixture({silentStop:true,stopTimeoutMs:20,save:async()=>{saved=true;}});
 f.capture.record();await assert.rejects(f.capture.stop(),/não finalizou/);assert.equal(f.capture.saving,false);assert.equal(f.stopped,1);
 f.recorder.ondataavailable({data:new Blob(['late frames'])});await f.recorder.onstop();assert.equal(saved,false);assert.ok(f.notices.some(n=>n.includes('não finalizou')));
});
test('repeated stop requests save a single clip and permit the next recording',async()=>{
 let saved=0;const f=fixture({save:async()=>saved++});f.capture.record();await Promise.all([f.capture.stop(),f.capture.stop()]);assert.equal(saved,1);
 f.capture.record();await f.capture.flush();assert.equal(saved,2);assert.equal(f.capture.saving,false);
});
