// Fit both columns to the available desktop viewport without clipping controls.
const entry=document.querySelector('.entry');
let queued=false;
function fit(){
 queued=false;if(!entry)return;
 const desktop=innerWidth>760;
 entry.style.zoom='';entry.style.width='';entry.style.minHeight='';
 document.documentElement.classList.toggle('entry-fitted',desktop);
 if(!desktop)return;
 entry.style.minHeight='0';
 const natural=entry.scrollHeight;
 let scale=Math.min(1,(innerHeight-2)/Math.max(1,natural));
 for(let pass=0;pass<4;pass++){
  entry.style.zoom=String(scale);entry.style.width=`${innerWidth/scale}px`;entry.style.minHeight=`${innerHeight/scale}px`;
  const actual=entry.getBoundingClientRect().height;
  if(actual<=innerHeight+.25)break;
  scale*=(innerHeight-2)/actual;
 }
}
function schedule(){if(!queued){queued=true;requestAnimationFrame(fit);}}
window.addEventListener('resize',schedule);
document.fonts?.ready.then(schedule);
new MutationObserver(schedule).observe(entry,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});
schedule();
