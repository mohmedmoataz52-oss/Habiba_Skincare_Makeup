(()=>{
 const A=HabibaCustomer;let quoteSeq=0,busy=false;
 let requestId=sessionStorage.getItem('habiba-checkout-request');if(!requestId){requestId=crypto.randomUUID();sessionStorage.setItem('habiba-checkout-request',requestId);}
 const money=n=>'EGP '+Number(n||0).toLocaleString('en-EG',{maximumFractionDigits:2});
 const form=()=>document.querySelector('#checkoutForm, #checkout-form, form:has(.checkout-submit)');
 function basket(){let items;try{items=JSON.parse(localStorage.getItem('habibaCart')||'[]')}catch{items=[]}return items.map(x=>({id:String(x.id),quantity:Number(x.quantity)}));}
 function delivery(f){const fd=new FormData(f);return Object.fromEntries(['firstName','lastName','address','apartment','city','postalCode','backupPhone','orderNotes'].map(k=>[k,String(fd.get(k)||'').trim()]).concat([['phone',String(fd.get('customerPhone')||'').trim()],['billingChoice',String(fd.get('billingChoice')||'')],...['billingFirstName','billingLastName','billingAddress','billingCity','billingPostalCode'].map(k=>[k,String(fd.get(k)||'').trim()])]));}
 function status(text){let el=document.getElementById('orderServerStatus');if(!el&&form()){el=document.createElement('p');el.id='orderServerStatus';el.setAttribute('role','status');el.style.cssText='padding:14px;line-height:1.8;color:#8f4d50';form().append(el)}if(el)el.textContent=text;}
 async function quote(){
  const f=form();if(!f)return;const seq=++quoteSeq;
  if(!A.hasSession()){status('سجّل دخولك أو أنشئ حسابًا لتأكيد الطلب وحساب عرض الترحيب.');return;}
  if(!f.elements.city?.value)return;
  try{
   const result=await A.rpc('habiba_checkout',{p_cart:basket(),p_delivery:delivery(f),p_request_id:requestId,p_commit:false});if(seq!==quoteSeq)return;
   for(const [id,key] of [['summarySubtotal','subtotal'],['summaryShipping','shipping'],['summaryTotal','total']]){const el=document.getElementById(id);if(el)el.textContent=money(result[key]);}
   let discount=document.getElementById('serverDiscount');if(!discount){discount=document.createElement('p');discount.id='serverDiscount';form().append(discount);}discount.textContent=result.discount>0?'الخصم المؤكد: '+money(result.discount)+(result.welcomeDiscount>0?' — عرض أول طلب':''):'';
   status('الإجمالي المؤكد شامل الخصم والشحن: '+money(result.total));
  }catch(e){status('تعذر حساب الطلب: '+e.message);}
 }
 function init(){const f=form();if(!f)return;
  f.querySelectorAll('input[name=payment]').forEach(input=>{const cod=input.value==='Cash on Delivery (COD)';input.disabled=!cod;input.checked=cod;if(!cod){const label=input.closest('label');label.style.opacity='.5';label.setAttribute('title','متاح بعد تفعيل Paymob');}});
  const button=f.querySelector('.checkout-submit');if(button)button.textContent='تأكيد الطلب — الدفع عند الاستلام';
  if(!document.getElementById('customerCheckoutLink')){const a=document.createElement('a');a.id='customerCheckoutLink';a.href=A.hasSession()?'account.html':'Auth.html';a.textContent=A.hasSession()?'حسابي وطلباتي':'تسجيل الدخول / إنشاء حساب';a.style.cssText='display:block;text-decoration:underline;margin:15px 0';f.prepend(a);}
  if(A.hasSession())A.user().then(u=>{if(f.elements.customerEmail)f.elements.customerEmail.value=u.email;}).catch(()=>{});
  quote();
 }
 document.addEventListener('change',e=>{if(e.target.closest('form')===form())quote();});
 document.addEventListener('submit',async e=>{
  if(e.target!==form())return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;
  if(!A.hasSession()){status('سجّل دخولك من الرابط أعلى الطلب. السلة هتفضل محفوظة.');return;}
  const f=e.target;if(!f.reportValidity())return;busy=true;const btn=f.querySelector('.checkout-submit');btn.disabled=true;status('جاري حفظ الطلب…');
  try{
   const result=await A.rpc('habiba_checkout',{p_cart:basket(),p_delivery:delivery(f),p_request_id:requestId,p_commit:true});
   localStorage.removeItem('habibaCart');sessionStorage.removeItem('habiba-checkout-request');
   const box=document.createElement('div');box.className='checkout-card';const h=document.createElement('h2');h.textContent='تم استلام طلبك ✓';const p=document.createElement('p');p.textContent='رقم الطلب: '+result.id+' — الإجمالي: '+money(result.total)+' — الدفع عند الاستلام. هنرجعك للرئيسية خلال 10 ثواني.';
   const history=document.createElement('a');history.href='account.html';history.textContent='متابعة طلباتي';const home=document.createElement('a');home.href='index.html';home.textContent='الرجوع للرئيسية';home.style.margin='16px';box.append(h,p,history,home);f.replaceWith(box);
   setTimeout(()=>location.assign('index.html'),10000);
  }catch(err){status('الطلب لم يتم تأكيده: '+err.message);btn.disabled=false;}finally{busy=false;}
 },true);
 init();if(window.HabibaStore)HabibaStore.ready.then(init);
})();
