(()=>{
 const A=HabibaCustomer,$=id=>document.getElementById(id);
 $('customerLogout').onclick=async()=>{await A.logout();location.href='index.html';};
 (async()=>{
  try{const user=await A.user();$('customerIdentity').textContent=user.email;
   const [profiles,orders]=await Promise.all([A.rows('habiba_customers?select=*&id=eq.'+encodeURIComponent(user.id)),A.rows('habiba_orders?select=id,details,status,created_at&order=created_at.desc&customer_id=eq.'+encodeURIComponent(user.id))]);
   const p=profiles[0];if(p){$('customerName').textContent=p.full_name||'Welcome to Habiba';$('whatsappConsent').checked=p.whatsapp_marketing;$('emailConsent').checked=p.email_marketing;}
   $('customerOrders').textContent=orders.length?'':'مفيش طلبات سابقة لسه.';
   orders.forEach(o=>{const box=document.createElement('article');box.className='order-card';const title=document.createElement('h3');title.textContent='طلب '+o.id.slice(0,8);const line=document.createElement('p');line.textContent=new Date(o.created_at).toLocaleString('ar-EG')+' — '+o.status+' — EGP '+o.details.total;box.append(title,line);o.details.items.forEach(i=>{const text=document.createElement('p');text.textContent=i.name+' × '+i.quantity;box.append(text)});$('customerOrders').append(box);});
  }catch(e){$('accountStatus').textContent=e.message+' — سجّل دخولك من الرابط.';}
 })();
 $('consentForm').onsubmit=async e=>{e.preventDefault();try{await A.rpc('habiba_marketing_preferences',{p_whatsapp:$('whatsappConsent').checked,p_email:$('emailConsent').checked});$('accountStatus').textContent='تم حفظ تفضيلات العروض.'}catch(err){$('accountStatus').textContent=err.message;}};
})();
