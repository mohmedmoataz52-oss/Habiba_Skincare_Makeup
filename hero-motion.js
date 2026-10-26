/* Stylized CSS product animation, not generated video footage. Replace with your MP4 when available. */
(()=>{
 const page=location.pathname.split('/').pop()||'index.html';
 const kind=page.replace('.html','');
 const hero=document.querySelector('.hero');
 if(hero && !['Bundles','Cart','checkout','Auth','Policies','product','dashboard'].includes(kind)){
  hero.querySelectorAll('.hero-photo,.hero-slide,.hero-arrow,.hero-dots').forEach(x=>x.style.display='none');
  const scene=document.createElement('div');scene.className='beauty-scene';scene.dataset.kind=kind;scene.setAttribute('aria-hidden','true');scene.innerHTML='<div class="vessel"></div><div class="orb"></div>';hero.prepend(scene);
  // Keep original copy and logo. On the home slider reuse the first slide's copy.
  if(!hero.querySelector(':scope > .hero-content')&&hero.querySelector('.hero-content'))hero.append(hero.querySelector('.hero-content').cloneNode(true));
  const copy=hero.querySelector('.hero-copy')||hero.querySelector(':scope > .hero-content');
  if(copy){const a=document.createElement('a');a.className='hero-shop';a.href='#bestsellers';a.innerHTML='<span aria-hidden="true">✦</span> SHOP BEST SELLERS';copy.append(a);}
 }
 const category=typeof PAGE_CONFIG!=='undefined';
 document.querySelectorAll('a[href*="#bestsellers"]').forEach(a=>{
  if(category){a.href='#bestsellers';a.addEventListener('click',e=>{e.preventDefault();selectedType='Best Sellers';renderProducts();document.querySelectorAll('.quick-cat').forEach(x=>x.classList.toggle('active',x.dataset.type==='Best Sellers'));document.getElementById('productGrid').scrollIntoView({behavior:'smooth',block:'start'});});}
 });
 if(kind==='index'){
 const section=document.createElement('section');section.className='real-life';section.innerHTML='<h2>Habiba in real life</h2><p>Discover beauty, one moment at a time.</p><div class="real-life-row"></div>';
 const observer=new IntersectionObserver(entries=>entries.forEach(({target, isIntersecting})=>{
  if(isIntersecting && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches){target.muted=true;target.play().catch(()=>{});}else target.pause();
 }),{threshold:.55});
 for(let i=1;i<=5;i++){
  const card=document.createElement('article');card.className='reel-card';
  const video=document.createElement('video');video.src='media/reel-'+i+'.mp4';video.poster='media/reel-'+i+'.jpg';video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='none';video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-label','Habiba beauty video '+i);
  const button=document.createElement('button');button.type='button';button.className='reel-toggle';button.textContent='▶';button.setAttribute('aria-label','Play or pause video '+i);
  button.onclick=()=>{video.muted=true;if(video.paused)video.play().catch(()=>{});else video.pause();};
  video.addEventListener('play',()=>button.textContent='Ⅱ');video.addEventListener('pause',()=>button.textContent='▶');
  card.append(video,button);section.querySelector('.real-life-row').append(card);observer.observe(video);
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)section.querySelectorAll('video').forEach(v=>v.pause());});
 const footer=document.querySelector('footer');if(footer)footer.before(section);
 }
})();
