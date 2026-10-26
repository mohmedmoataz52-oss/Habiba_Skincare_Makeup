/* Customer sessions are separate from dashboard administrator sessions. */
(()=>{
 const cfg=window.HABIBA_BACKEND||{},base=cfg.url,key=cfg.publishableKey,KEY='habiba_customer_session_v1';
 let session=null,refreshing=null;
 try{session=JSON.parse(sessionStorage.getItem(KEY)||localStorage.getItem(KEY)||'null')}catch(_){}
 function keep(s,remember=false){session=s?{...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+s.expires_in}:null;sessionStorage.removeItem(KEY);localStorage.removeItem(KEY);if(session)(remember?localStorage:sessionStorage).setItem(KEY,JSON.stringify(session));window.dispatchEvent(new Event('habiba:customer'));}
 // Consume Auth callback before other scripts can replace the URL hash.
 const hash=new URLSearchParams(location.hash.slice(1));
 if(hash.has('access_token')){keep({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_in:Number(hash.get('expires_in'))||3600});if(hash.get('type')==='recovery')sessionStorage.setItem('habiba_password_recovery','1');history.replaceState(null,'',location.pathname+location.search);}
 async function request(path,options={},token){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const headers={apikey:key,'Content-Type':'application/json',...options.headers};if(token)headers.Authorization='Bearer '+token;else if(key?.startsWith('eyJ'))headers.Authorization='Bearer '+key;
   const res=await fetch(base+path,{...options,headers,signal:controller.signal});const body=await res.json().catch(()=>null);if(!res.ok){const err=Error(body?.message||body?.msg||body?.error_description||'تعذر تنفيذ الطلب');err.status=res.status;throw err;}return body;
  }finally{clearTimeout(timer);}
 }
 async function token(){
  if(!session)throw Error('سجّل دخولك الأول');
  if(session.expires_at*1000<Date.now()+60000){if(!refreshing)refreshing=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})}).then(s=>keep(s,!!localStorage.getItem(KEY))).catch(e=>{keep(null);throw e}).finally(()=>refreshing=null);await refreshing;}
  return session.access_token;
 }
 async function login(email,password,remember){const s=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});keep(s,remember);return user();}
 const user=async()=>{const u=await request('/auth/v1/user',{},await token());if(!u.email_confirmed_at){keep(null);throw Error('أكد إيميلك الأول عشان تكمّل');}return u;};
 async function logout(){const old=session;keep(null);if(old)await request('/auth/v1/logout',{method:'POST'},old.access_token).catch(()=>{});}
 const rpc=async(name,args)=>request('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(args)},await token());
 const rows=async(path)=>request('/rest/v1/'+path,{},await token());
 document.addEventListener('click',e=>{const b=e.target.closest('#accountBtn,[data-customer-account],[aria-label="Account"]');if(b){e.preventDefault();e.stopImmediatePropagation();location.href=session?'account.html':'Auth.html';}const out=e.target.closest('[data-customer-logout]');if(out){e.preventDefault();e.stopImmediatePropagation();out.disabled=true;logout().finally(()=>location.href='index.html');}},true);
 function renderIdentity(){
  const u=session?.user,full=u?.user_metadata?.full_name||u?.user_metadata?.name||u?.email?.split('@')[0]||'',name=full.trim().split(/\s+/)[0];
  document.querySelectorAll('#accountBtn,[data-customer-account],[aria-label="Account"]').forEach(b=>{
   b.dataset.customerAccount='1';let label=b.querySelector('.customer-header-name');
   if(session&&name){if(!label){label=document.createElement('span');label.className='customer-header-name';b.append(label)}label.textContent=name;b.title=full+(u?.email?' — '+u.email:'');b.setAttribute('aria-label','حساب '+full);}
   else{label?.remove();b.setAttribute('aria-label','Account');b.title='تسجيل الدخول';}
  });
  document.querySelectorAll('a[href="Auth.html"],a[data-customer-signin]').forEach(a=>{if(a.closest('.checkout-section-head'))return;a.dataset.customerSignin='1';a.href=session?'account.html':'Auth.html';a.textContent=session?'حسابي — '+(name||'My account'):'Sign in';});
  const anchor=document.querySelector('[data-customer-account]');
  if(anchor&&!document.querySelector('[data-customer-logout]')){const out=document.createElement('button');out.type='button';out.dataset.customerLogout='1';out.className='customer-header-logout';out.textContent='خروج';out.title='تسجيل الخروج';anchor.insertAdjacentElement('afterend',out);}
  document.querySelectorAll('[data-customer-logout]').forEach(b=>b.hidden=!session);
 }
 function initIdentity(){
  const style=document.createElement('style');style.textContent='[data-customer-account]{display:inline-flex!important;align-items:center;gap:5px;width:auto!important;max-width:120px}.customer-header-name{font-family:inherit;font-size:12px;font-weight:500;line-height:1.3;max-width:65px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.customer-header-logout{font:inherit;font-size:11px;padding:5px;border:0;background:transparent;color:inherit;cursor:pointer}.customer-header-logout[hidden]{display:none!important}@media(max-width:480px){.customer-header-name{max-width:42px;font-size:10px}[data-customer-account]{gap:3px}.customer-header-logout{font-size:10px;padding:2px}}';document.head.append(style);renderIdentity();
  if(session)user().then(u=>{if(session){session.user=u;(localStorage.getItem(KEY)?localStorage:sessionStorage).setItem(KEY,JSON.stringify(session));renderIdentity();}}).catch(e=>{if(e.status===401||e.status===403){keep(null);}});
 }
 window.addEventListener('habiba:customer',renderIdentity);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initIdentity);else initIdentity();
 window.HabibaCustomer={login,logout,user,rpc,rows,hasSession:()=>!!session,
 signup:async(email,password,details)=>{const s=await request('/auth/v1/signup?redirect_to='+encodeURIComponent(new URL('Auth.html',location.href).href),{method:'POST',body:JSON.stringify({email,password,data:details})});if(s.access_token)keep(s);return s;},
 resend:email=>request('/auth/v1/resend?redirect_to='+encodeURIComponent(new URL('Auth.html',location.href).href),{method:'POST',body:JSON.stringify({type:'signup',email})}),
 recover:email=>request('/auth/v1/recover?redirect_to='+encodeURIComponent(new URL('Auth.html?reset=1',location.href).href),{method:'POST',body:JSON.stringify({email})}),
 updatePassword:async password=>request('/auth/v1/user',{method:'PUT',body:JSON.stringify({password})},await token())};
})();
