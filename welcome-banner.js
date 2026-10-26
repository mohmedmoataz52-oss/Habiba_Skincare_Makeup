(()=>{
 if(!window.HabibaStore)return;
 let current='';
 async function render(){const o=HabibaStore.getSettings().welcomeOffer;let el=document.getElementById('welcomeAccountBanner');
  if(!o?.enabled||!o.percent){el?.remove();return;}
  if(HabibaCustomer.hasSession()){
   try{const u=await HabibaCustomer.user(),p=await HabibaCustomer.rows('habiba_customers?select=welcome_used&id=eq.'+encodeURIComponent(u.id));if(p[0]?.welcome_used){el?.remove();return;}}catch{return;}
  }
  const included=o.allProducts?'كل المنتجات المؤهلة':HabibaStore.getProducts().filter(p=>(o.productIds||[]).includes(String(p.id))).map(p=>p.name).join('، ');
  if(!included){el?.remove();return;}
  if(!el){el=document.createElement('aside');el.id='welcomeAccountBanner';el.dir='rtl';el.style.cssText='padding:16px 20px;background:#fce8f1;text-align:center;color:#853858;border-bottom:1px solid #ecc1d3;font-size:13px;line-height:1.8';document.querySelector('main')?.prepend(el);}
  el.textContent='سجّل بإيميلك وخد خصم '+Number(o.percent)+'% على أول طلب مؤهل. المنتجات: '+included+'. لا يُجمع مع خصم آخر على نفس المنتج. ';
  const a=document.createElement('a');a.href=HabibaCustomer.hasSession()?'checkout.html':'Auth.html#create-account';a.textContent=HabibaCustomer.hasSession()?'إتمام الطلب':'إنشاء حساب';a.style.textDecoration='underline';el.append(a);
 }
 HabibaStore.ready.then(render);window.addEventListener('habiba:store-updated',()=>{const sig=JSON.stringify(HabibaStore.getSettings().welcomeOffer);if(sig!==current){current=sig;render();}});
})();
