
// Independent of the 3D/CDN boot: fitting works even while resources load.
(()=>{
  const root=document.documentElement,wrap=document.querySelector('.wrap');
  const desktop=matchMedia('(any-hover:hover) and (any-pointer:fine)');
  function fitDesktop(){
    root.classList.toggle('desktop-fit',desktop.matches);
    if(!desktop.matches){wrap.style.transform='';wrap.style.left='';wrap.style.top='';return}
    const width=document.documentElement.clientWidth,height=window.innerHeight;
    const scale=Math.min(width/1220,height/1040);
    wrap.style.transform=`scale(${scale})`;
    wrap.style.left=`${Math.max(0,(width-1220*scale)/2)}px`;
    wrap.style.top=`${Math.max(0,(height-1040*scale)/2)}px`;
    window.dispatchEvent(new Event('desktopfit'));
  }
  window.addEventListener('resize',fitDesktop);
  desktop.addEventListener('change',fitDesktop);
  fitDesktop();
})();
