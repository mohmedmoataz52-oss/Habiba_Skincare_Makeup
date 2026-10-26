(()=>{
 const A=HabibaCustomer,$=id=>document.getElementById(id),notice=$('notice');
 const message=(text)=>{notice.textContent=text;notice.className='status show';};
 function bind(id,fn){$(id).addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();const b=e.target.querySelector('button[type=submit]');b.disabled=true;message('جاري التنفيذ…');try{await fn(e.target)}catch(err){message(err.status===400?'راجع البيانات أو أكد إيميلك. '+err.message:err.message)}finally{b.disabled=false}},true);}
 bind('signin-form',async f=>{await A.login(f.elements.contact.value.trim(),f.elements.password.value,f.elements.remember.checked);location.href='account.html';});
 bind('create-form',async f=>{
  if(f.elements.password.value!==f.elements.confirmPassword.value)throw Error('كلمتا السر غير متطابقتين');
  let phone=f.elements.phone.value.replace(/\D/g,'');if(phone.startsWith('20'))phone=phone.slice(2);if(phone.startsWith('0'))phone=phone.slice(1);if(!/^1[0125]\d{8}$/.test(phone))throw Error('اكتب رقم موبايل مصري صحيح');
  const result=await A.signup(f.elements.email.value.trim(),f.elements.password.value,{full_name:f.elements.firstName.value.trim()+' '+f.elements.lastName.value.trim(),phone:'+20'+phone,whatsapp_marketing:f.elements.marketing.checked,email_marketing:f.elements.emailMarketing.checked});
  f.reset();if(result.access_token)location.href='account.html';else message('راجع بريدك لتأكيد الحساب، وبعدها سجّل دخولك. لو الإيميل مسجّل قبل كده استخدم تسجيل الدخول أو استعادة كلمة السر.');
 });
 bind('forgot-form',async f=>{await A.recover(f.elements.contact.value.trim());message('لو الإيميل مسجّل، هيجيلك رابط لإعادة تعيين كلمة السر. راجع البريد والـSpam.');});
 if(sessionStorage.getItem('habiba_password_recovery')==='1'){
  document.querySelectorAll('form[data-panel]').forEach(f=>f.classList.add('hidden'));
  const form=document.createElement('form');form.id='reset-password-form';form.innerHTML='<h2>Choose a new password</h2><div class="field"><label>New password<input type="password" name="password" minlength="8" autocomplete="new-password" required></label></div><div class="field"><label>Confirm password<input type="password" name="confirm" minlength="8" autocomplete="new-password" required></label></div><button class="primary" type="submit">Save password</button>';
  document.querySelector('section.panel').append(form);
  bind('reset-password-form',async f=>{if(f.elements.password.value!==f.elements.confirm.value)throw Error('كلمتا السر غير متطابقتين');await A.user();await A.updatePassword(f.elements.password.value);sessionStorage.removeItem('habiba_password_recovery');await A.logout();message('تم تغيير كلمة السر. افتح Sign in وسجّل بالكلمة الجديدة.');form.hidden=true;});
 }
})();
