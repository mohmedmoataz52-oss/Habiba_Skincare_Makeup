/* Stylized CSS product animation, not generated video footage. Replace with your MP4 when available. */
(()=>{
 const page=location.pathname.split('/').pop()||'index.html';
 const kind=page.replace('.html','');
 const hero=document.querySelector('.hero');
 if(hero && !['Bundles','Cart','checkout','Auth','Policies','product','dashboard'].includes(kind)){
  hero.querySelectorAll('.hero-photo,.hero-slide,.hero-arrow,.hero-dots').forEach(x=>x.style.display='none');
  const scene=document.createElement('div');scene.className='beauty-scene';scene.dataset.kind=kind;scene.setAttribute('aria-hidden','true');scene.innerHTML='<div class="scene-disc"></div><div class="vessel"><span class="bottle-line"></span></div><div class="orb"></div><div class="scene-caption">DAILY BEAUTY RITUALS</div>';hero.prepend(scene);
  // Keep original copy and logo. On the home slider reuse the first slide's copy.
  if(!hero.querySelector(':scope > .hero-content')&&hero.querySelector('.hero-content'))hero.append(hero.querySelector('.hero-content').cloneNode(true));
  const copy=hero.querySelector('.hero-copy')||hero.querySelector(':scope > .hero-content');
  if(copy){const a=document.createElement('a');a.className='hero-shop';a.href='#bestsellers';a.innerHTML='<span aria-hidden="true">✦</span> SHOP BEST SELLERS';copy.append(a);}
 }
 const category=typeof PAGE_CONFIG!=='undefined';
 document.querySelectorAll('a[href*="#bestsellers"]').forEach(a=>{
  if(category){a.href='#bestsellers';a.addEventListener('click',e=>{e.preventDefault();selectedType='Best Sellers';renderProducts();document.querySelectorAll('.quick-cat').forEach(x=>x.classList.toggle('active',x.dataset.type==='Best Sellers'));document.getElementById('productGrid').scrollIntoView({behavior:'smooth',block:'start'});});}
 });

 if(document.getElementById('habiba-real-life')){
 const section=document.getElementById('habiba-real-life');
 function startVideos(){section.querySelectorAll('video').forEach(v=>{v.muted=true;v.defaultMuted=true;v.playsInline=true;v.play().catch(()=>{});});}
 startVideos();window.addEventListener('pageshow',startVideos);
 let signature='';
 function render(){
  const settings=window.HabibaStore?HabibaStore.getSettings():{};
  if(!Array.isArray(settings.realLife))return;
  const clips=settings.realLife;
  const sig=JSON.stringify(clips);if(sig===signature)return;signature=sig;
  section.querySelectorAll('video').forEach(v=>v.pause());const row=section.querySelector('.real-life-row');row.textContent='';
  clips.forEach((clip,i)=>{
   const card=document.createElement('figure');card.className='moment-card';
   const frame=document.createElement('div');frame.className='moment-frame';
   const v=document.createElement('video');v.autoplay=true;v.loop=true;v.muted=true;v.defaultMuted=true;v.playsInline=true;v.preload='metadata';v.setAttribute('muted','');v.setAttribute('autoplay','');v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');v.poster=clip.poster||'media/moment-1.jpg';v.src=clip.src;
   const start=Math.max(0,Number(clip.start)||0),end=Math.max(start+2,Number(clip.end)||start+7);
   v.addEventListener('loadedmetadata',()=>{if(start<v.duration)v.currentTime=start;v.play().catch(()=>{});});
   v.addEventListener('timeupdate',()=>{if(v.currentTime>=Math.min(end,v.duration-.1))v.currentTime=start;});
   v.addEventListener('error',()=>{frame.classList.add('clip-unavailable');});
   const caption=document.createElement('figcaption');caption.textContent=clip.title||'Beauty moment';
   frame.append(v);card.append(frame,caption);row.append(card);
   if('IntersectionObserver' in window)new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting&&!document.hidden){v.muted=true;v.play().catch(()=>{});}else v.pause();}),{threshold:.1}).observe(v);
  });
 }
 render();if(window.HabibaStore)HabibaStore.ready.then(render);window.addEventListener('habiba:store-updated',render);
 document.addEventListener('visibilitychange',()=>section.querySelectorAll('video').forEach(v=>{if(document.hidden)v.pause();else v.play().catch(()=>{});}));
 }
})();
