(()=>{
 const A=HabibaCustomer,$=id=>document.getElementById(id),notice=$('notice');
 const message=(text)=>{notice.textContent=text;notice.className='status show';};
 const PENDING='habiba_pending_verification',WAIT='habiba_verification_resend_at';
 let pending=localStorage.getItem(PENDING)||'',passwordInMemory='',checking=false;
 const gate=document.createElement('section');gate.hidden=true;gate.dir='rtl';gate.style.cssText='line-height:1.8;padding:12px 0';
 gate.innerHTML='<h2 class="form-title">أكد إيميلك عشان تكمّل</h2><p>افتح رسالة حبيبة واضغط على رابط تأكيد الحساب. راجع Spam لو مش لاقيها.</p><p id="verificationEmail" dir="ltr" style="overflow-wrap:anywhere"></p><label class="field" style="display:block">كلمة السر للمتابعة بعد التأكيد<input id="verificationPassword" type="password" autocomplete="current-password" minlength="8"></label><button type="button" class="primary" id="verificationContinue">تم التأكيد — متابعة</button><button type="button" class="secondary" id="verificationResend" style="margin-top:12px">إعادة إرسال رسالة التأكيد</button><button type="button" class="secondary" id="verificationChange" style="margin-top:12px">تعديل الإيميل / الرجوع لتسجيل الدخول</button><p id="verificationStatus" role="status" aria-live="polite"></p>';
 document.querySelector('section.panel').append(gate);
 const status=t=>$('verificationStatus').textContent=t;
 function showVerification(email){pending=email;localStorage.setItem(PENDING,email);gate.hidden=false;document.querySelector('.tabs').hidden=true;document.querySelectorAll('form[data-panel]').forEach(f=>f.classList.add('hidden'));$('verificationEmail').textContent=email;notice.className='status';}
 function clearPending(){localStorage.removeItem(PENDING);pending='';passwordInMemory='';$('verificationPassword').value='';}
 function cooldown(){const secs=Math.max(0,Math.ceil((Number(localStorage.getItem(WAIT)||0)-Date.now())/1000));$('verificationResend').disabled=secs>0;$('verificationResend').textContent=secs?'إعادة الإرسال بعد '+secs+' ثانية':'إعادة إرسال رسالة التأكيد';}
 $('verificationResend').onclick=async()=>{if($('verificationResend').disabled)return;localStorage.setItem(WAIT,String(Date.now()+60000));cooldown();try{await A.resend(pending);status('لو الحساب محتاج تأكيد، هتوصلك رسالة جديدة. راجع بريدك.');}catch(e){status(e.status===429?'استنى شوية قبل طلب رسالة تانية.':e.message);}};
 $('verificationChange').onclick=()=>{const email=pending;clearPending();gate.hidden=true;document.querySelector('.tabs').hidden=false;$('tab-signin').click();$('signin-form').elements.contact.value=email;};
 async function continueVerified(automatic=false){if(checking)return;checking=true;$('verificationContinue').disabled=true;try{let u;if(A.hasSession())u=await A.user();else{const pw=$('verificationPassword').value||passwordInMemory;if(!pw){if(!automatic)status('بعد التأكيد اكتب كلمة السر واضغط متابعة.');return;}u=await A.login(pending,pw,false);}if(!u.email_confirmed_at)throw Error('لسه الإيميل مش متأكد. افتح رابط التأكيد الأول.');clearPending();location.href='index.html';}catch(e){if(!automatic)status('التأكيد لسه ما اكتملش أو بيانات الدخول مش صحيحة. '+e.message);}finally{checking=false;$('verificationContinue').disabled=false;}}
 $('verificationContinue').onclick=()=>continueVerified();
 setInterval(()=>{if(!gate.hidden)cooldown();},1000);
 window.addEventListener('focus',()=>{if(!gate.hidden)continueVerified(true);});
 if(sessionStorage.getItem('habiba_password_recovery')!=='1'){
  if(pending)showVerification(pending);
  if(A.hasSession())A.user().then(()=>{clearPending();location.href='index.html';}).catch(()=>{});
 }
 function bind(id,fn){$(id).addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();const b=e.target.querySelector('button[type=submit]');b.disabled=true;message('جاري التنفيذ…');try{await fn(e.target)}catch(err){message(err.status===400?'راجع البيانات أو أكد إيميلك. '+err.message:err.message)}finally{b.disabled=false}},true);}
 bind('signin-form',async f=>{await A.login(f.elements.contact.value.trim(),f.elements.password.value,f.elements.remember.checked);clearPending();location.href='index.html';});
 bind('create-form',async f=>{
  if(f.elements.password.value!==f.elements.confirmPassword.value)throw Error('كلمتا السر غير متطابقتين');
  let phone=f.elements.phone.value.replace(/\D/g,'');if(phone.startsWith('20'))phone=phone.slice(2);if(phone.startsWith('0'))phone=phone.slice(1);if(!/^1[0125]\d{8}$/.test(phone))throw Error('اكتب رقم موبايل مصري صحيح');
  passwordInMemory=f.elements.password.value;
  const signupEmail=f.elements.email.value.trim();
  const result=await A.signup(f.elements.email.value.trim(),f.elements.password.value,{full_name:f.elements.firstName.value.trim()+' '+f.elements.lastName.value.trim(),phone:'+20'+phone,whatsapp_marketing:f.elements.marketing.checked,email_marketing:f.elements.emailMarketing.checked});
  f.reset();localStorage.setItem(WAIT,String(Date.now()+60000));showVerification(signupEmail);cooldown();if(result.access_token)await continueVerified();
 });
 bind('forgot-form',async f=>{await A.recover(f.elements.contact.value.trim());message('لو الإيميل مسجّل، هيجيلك رابط لإعادة تعيين كلمة السر. راجع البريد والـSpam.');});
 if(sessionStorage.getItem('habiba_password_recovery')==='1'){
  document.querySelectorAll('form[data-panel]').forEach(f=>f.classList.add('hidden'));
  const form=document.createElement('form');form.id='reset-password-form';form.innerHTML='<h2>Choose a new password</h2><div class="field"><label>New password<input type="password" name="password" minlength="8" autocomplete="new-password" required></label></div><div class="field"><label>Confirm password<input type="password" name="confirm" minlength="8" autocomplete="new-password" required></label></div><button class="primary" type="submit">Save password</button>';
  document.querySelector('section.panel').append(form);
  bind('reset-password-form',async f=>{if(f.elements.password.value!==f.elements.confirm.value)throw Error('كلمتا السر غير متطابقتين');await A.user();await A.updatePassword(f.elements.password.value);sessionStorage.removeItem('habiba_password_recovery');await A.logout();message('تم تغيير كلمة السر. افتح Sign in وسجّل بالكلمة الجديدة.');form.hidden=true;});
 }
})();
