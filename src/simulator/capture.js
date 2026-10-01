// Both capture types produce a local file and remain available as mission evidence.
export function createCaptureDelivery({download,onCapture}){
 return async(blob,kind,state)=>{
  const extension=kind==='photo'?'png':blob.type.includes('mp4')?'mp4':'webm';
  download(blob,`mini4-${kind}-${Date.now()}.${extension}`);
  if(onCapture)await onCapture(blob,kind,state);
 };
}

// The recorder remains busy until its final blob has been accepted by the mission.
export function createSceneCapture({canvas,render,snapshot,save,beforeCapture=()=>{},notify,onState=()=>{},Recorder=globalThis.MediaRecorder,maxBytes=Infinity,stopTimeoutMs=15000}){
 let session=null;const pending=new Set();
 function track(promise){pending.add(promise);promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;}
 async function photo(){
  try{
   beforeCapture('photo');render();const state=snapshot();
   await track((async()=>{
    const blob=await new Promise((resolve,reject)=>{try{canvas.toBlob(value=>value?.size?resolve(value):reject(new Error('A imagem gerada está vazia.')),'image/png');}catch(error){reject(error);}});
    await save(blob,'photo',state);
   })());notify('Foto capturada. Confira a imagem nas capturas da missão ou nos downloads do voo livre.');
   return true;
  }catch(error){notify('Falha na foto: '+error.message);return false;}
 }
 function cleanup(current){clearTimeout(current.timer);clearTimeout(current.stopTimer);current.stream.getTracks().forEach(track=>track.stop());}
 async function stop(){
  const current=session;if(!current)return;
  if(!current.stopping){
   current.stopping=true;current.state=snapshot();onState(false,true);
   current.stopTimer=setTimeout(()=>{
    current.failed=true;cleanup(current);if(session===current)session=null;onState(false,false);
    current.reject(new Error('O navegador não finalizou o arquivo de vídeo. Tente uma tomada curta novamente; nenhuma gravação foi salva.'));
   },stopTimeoutMs);
   try{if(current.rec.state!=='inactive')current.rec.stop();}catch(error){current.failed=true;cleanup(current);session=null;onState(false,false);current.reject(error);}
  }
  return current.done;
 }
 function record(){
  if(session){return stop().catch(error=>{notify('Falha no vídeo: '+error.message);});}
  let stream;
  try{
   beforeCapture('video');
   if(!Recorder||!canvas.captureStream)throw new Error('Este navegador não oferece gravação de vídeo. Use um navegador compatível.');
   stream=canvas.captureStream(24);
   const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(type=>Recorder.isTypeSupported(type));
   const rec=new Recorder(stream,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:600000});
   const current={rec,stream,chunks:[],bytes:0,stopping:false,error:null};
   current.done=new Promise((resolve,reject)=>{current.resolve=resolve;current.reject=reject;});
   // Timer-triggered stops must surface errors even when nobody awaits stop().
   current.done.catch(error=>notify('Falha no vídeo: '+error.message));session=current;
   rec.ondataavailable=event=>{
    if(event.data?.size){current.chunks.push(event.data);current.bytes+=event.data.size;}
    if(current.bytes>=maxBytes*.8&&!current.stopping){notify('Finalizando o clipe para respeitar o limite de tamanho.');void stop().catch(()=>{});}
   };
   rec.onerror=()=>{current.error=new Error('O navegador interrompeu a gravação. Grave uma nova tomada.');if(rec.state!=='inactive')void stop().catch(()=>{});else{current.failed=true;cleanup(current);if(session===current)session=null;onState(false,false);current.reject(current.error);}};
   rec.onstop=async()=>{
    if(current.failed)return;
    current.stopping=true;
    cleanup(current);onState(false,true);
    try{
     if(current.error)throw current.error;
     const blob=new Blob(current.chunks,{type:rec.mimeType||current.chunks[0]?.type||'video/webm'});
     if(!blob.size)throw new Error('O navegador não gerou frames de vídeo. Inicie e pare uma nova tomada.');
     if(blob.size>maxBytes)throw new Error('O clipe excedeu 10 MB. Grave uma tomada mais curta.');
     await save(blob,'video',current.state||snapshot());
     notify('Vídeo capturado. Confira a filmagem nas capturas da missão ou nos downloads do voo livre.');current.resolve();
    }catch(error){current.reject(error);}
    finally{if(session===current)session=null;onState(false,false);}
   };
   rec.start(1000);current.timer=setTimeout(()=>{void stop().catch(()=>{});},120000);onState(true,false);
   notify('Gravando a câmera simulada. Clique novamente para parar e salvar o clipe.');
  }catch(error){stream?.getTracks().forEach(track=>track.stop());session=null;onState(false,false);notify('Gravação indisponível: '+error.message);}
 }
 return {photo,record,stop,get recording(){return session?.rec.state==='recording'&&!session.stopping;},get saving(){return !!session?.stopping||pending.size>0;},async flush(){await stop();await Promise.all([...pending]);}};
}
