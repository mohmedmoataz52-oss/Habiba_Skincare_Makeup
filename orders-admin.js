(()=>{
 const tab=document.createElement('button');tab.textContent='▤ العملاء والطلبات';tab.dataset.view='customers';document.querySelector('.nav').append(tab);
 const panel=document.createElement('section');panel.id='view-customers';panel.className='hidden';panel.innerHTML='<div class="panel" dir="rtl"><h2>العملاء والطلبات</h2><p>بيانات خاصة بالإدارة. الاشتراك في العروض منفصل عن تسجيل الحساب. الرسائل التسويقية لا تُرسل تلقائيًا من هذه الصفحة.</p><button class="btn-light" id="refreshOrders">تحديث البيانات</button><p id="ordersAdminStatus" role="status"></p><h3>العملاء</h3><div id="adminCustomers"></div><h3>الطلبات</h3><div id="adminOrders"></div></div>';document.querySelector('.main').append(panel);
 const E=HabibaHTML;
 async function refresh(){
  const status=document.getElementById('ordersAdminStatus');status.textContent='جاري التحميل…';
  try{
   const [customers,orders]=await Promise.all([HabibaBackend.adminRequest('/rest/v1/habiba_customers?select=*&order=created_at.desc&limit=200'),HabibaBackend.adminRequest('/rest/v1/habiba_orders?select=*&order=created_at.desc&limit=200')]);
   document.getElementById('adminCustomers').innerHTML='<div class="table-wrap"><table class="products-table"><thead><tr><th>الاسم</th><th>الإيميل</th><th>واتساب</th><th>عروض واتساب</th><th>عروض إيميل</th><th>خصم الترحيب استُخدم</th></tr></thead><tbody>'+customers.map(c=>'<tr><td>'+E(c.full_name)+'</td><td>'+E(c.email)+'</td><td>'+E(c.phone)+'</td><td>'+(c.whatsapp_marketing?'مشترك':'غير مشترك')+'</td><td>'+(c.email_marketing?'مشترك':'غير مشترك')+'</td><td>'+(c.welcome_used?'نعم':'لا')+'</td></tr>').join('')+'</tbody></table></div>';
   const list=document.getElementById('adminOrders');list.textContent=orders.length?'':'لا توجد طلبات بعد.';
   orders.forEach(o=>{const d=o.details,box=document.createElement('article');box.className='panel';const h=document.createElement('h3');h.textContent=o.id+' — '+o.status;const info=document.createElement('p');info.textContent=d.email+' · '+(d.delivery?.phone||'')+' · EGP '+d.total+' · '+o.payment_status;const address=document.createElement('p');address.textContent=[d.delivery?.firstName,d.delivery?.lastName,d.delivery?.address,d.delivery?.city].filter(Boolean).join(' ');box.append(h,info,address);
    d.items.forEach(p=>{const row=document.createElement('p');row.textContent=p.name+' × '+p.quantity+' — EGP '+p.lineTotal;box.append(row)});
    const select=document.createElement('select');['confirmed','processing','shipped','completed','cancelled'].forEach(s=>select.add(new Option(s,s)));if(o.status!=='pending')select.value=o.status;
    const save=document.createElement('button');save.className='btn-light';save.textContent='تحديث الحالة';save.onclick=async()=>{save.disabled=true;try{await HabibaBackend.adminRequest('/rest/v1/rpc/habiba_order_status',{method:'POST',body:JSON.stringify({p_id:o.id,p_status:select.value})});await refresh();}catch(e){status.textContent=e.message}finally{save.disabled=false}};box.append(select,save);list.append(box);
   });status.textContent='عرض آخر 200 عميل و200 طلب. الدفع عند الاستلام يظل غير مدفوع حتى التحصيل.';
  }catch(e){status.textContent='لم يتم التحميل: '+e.message+' — شغّل customer-orders.sql أولًا.';}
 }
 document.getElementById('refreshOrders').onclick=refresh;
 tab.onclick=()=>{document.querySelectorAll('[id^="view-"]').forEach(x=>x.classList.add('hidden'));panel.classList.remove('hidden');document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b===tab));document.getElementById('pageTitle').textContent='العملاء والطلبات';document.getElementById('sidebar').classList.remove('open');refresh();};
})();
