(()=>{
 const E=HabibaHTML;
 const nav=document.querySelector('.nav');const tab=document.createElement('button');tab.dataset.view='reels';tab.textContent='▤ Real life / Reels';nav.append(tab);
 const panel=document.createElement('section');panel.id='view-reels';panel.className='hidden';panel.innerHTML='<div class="panel"><h2>Habiba in real life</h2><p class="sub">مقاطع صامتة قصيرة. اكتب الاسم، وحدد بداية ونهاية المقطع. الحفظ يظهر لكل العملاء بعد ربط Supabase.</p><form id="reelForm"><div class="form-grid"><div class="field"><label>اسم المقطع<input id="reelTitle" required maxlength="90"></label></div><div class="field"><label>رابط MP4 مباشر<input id="reelUrl" type="url" placeholder="https://…"></label></div><div class="field"><label>أو ارفع فيديو MP4 / WebM<input id="reelFile" type="file" accept="video/mp4,video/webm"></label></div><div class="field"><label>بداية المقطع بالثواني<input id="reelStart" type="number" min="0" value="0" step=".1"></label></div><div class="field"><label>نهاية المقطع بالثواني<input id="reelEnd" type="number" min="2" value="7" step=".1"></label></div></div><button class="btn-primary" type="submit">حفظ المقطع</button></form><div id="reelsList"></div><p id="reelStatus" role="status"></p></div>';
 document.querySelector('.main').append(panel);let editing=null;
 const clips=()=>Array.isArray(data.settings.realLife)?data.settings.realLife:structuredClone(window.HabibaMoments);
 function render(){document.getElementById('reelsList').innerHTML=clips().map((c,i)=>'<div class="switchrow"><b>'+E(c.title)+'</b><div><button class="btn-light" data-reel-edit="'+i+'">تعديل</button> <button class="btn-danger" data-reel-delete="'+i+'">حذف</button></div></div>').join('');}
 tab.onclick=()=>{document.querySelectorAll('[id^="view-"]').forEach(e=>e.classList.add('hidden'));panel.classList.remove('hidden');document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b===tab));document.getElementById('pageTitle').textContent='Real life / Reels';document.getElementById('sidebar').classList.remove('open');render();};
 panel.addEventListener('click',async e=>{
  const edit=e.target.closest('[data-reel-edit]'),del=e.target.closest('[data-reel-delete]');
  if(edit){editing=Number(edit.dataset.reelEdit);const c=clips()[editing];document.getElementById('reelTitle').value=c.title;document.getElementById('reelUrl').value=c.src.startsWith('http')?c.src:'';document.getElementById('reelStart').value=c.start||0;document.getElementById('reelEnd').value=c.end||7;}
  if(del&&confirm('حذف المقطع من الموقع؟')){const next=clips();next.splice(Number(del.dataset.reelDelete),1);data.settings.realLife=next;if(await persist())render();}
 });
 document.getElementById('reelForm').onsubmit=async e=>{
  e.preventDefault();const status=document.getElementById('reelStatus'),button=e.target.querySelector('button[type=submit]');button.disabled=true;
  try{
   const start=Number(document.getElementById('reelStart').value),end=Number(document.getElementById('reelEnd').value);
   if(end-start<2||end-start>12)throw Error('مدة المقطع لازم تكون بين ثانيتين و12 ثانية.');
   const next=clips(),old=editing==null?null:next[editing];let src=document.getElementById('reelUrl').value.trim()||old?.src;
   const file=document.getElementById('reelFile').files[0];if(file){status.textContent='جاري رفع الفيديو…';src=await HabibaBackend.uploadVideo(file);}
   if(!src)throw Error('اختار فيديو أو اكتب رابط MP4 مباشر.');
   if(!/^(https:\/\/|media\/)/.test(src))throw Error('استخدم رابط HTTPS مباشر.');
   const c={id:old?.id||crypto.randomUUID(),title:document.getElementById('reelTitle').value.trim(),src,start,end,poster:old?.poster||'media/moment-1.jpg'};
   if(editing==null)next.push(c);else next[editing]=c;data.settings.realLife=next;
   if(await persist()){editing=null;e.target.reset();document.getElementById('reelEnd').value=7;render();status.textContent='تم نشر المقطع ✓';}else status.textContent='لم يتم حفظ المقطع. راجع رسالة الخطأ.';
  }catch(err){status.textContent=err.message;}finally{button.disabled=false;}
 };
})();
