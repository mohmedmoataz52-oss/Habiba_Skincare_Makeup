/* Shared public reads + authenticated admin writes. Authorization is enforced by SQL/RLS. */
(function () {
  'use strict';
  window.HabibaHTML = function(value){return String(value == null ? '' : value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));};
  const config = window.HABIBA_BACKEND || {};
  const url = String(config.url || '').replace(/\/$/, '');
  const key = config.publishableKey || '';
  const configured = /^https:\/\/[^/]+\.supabase\.co$/.test(url) && !!key;
  const SESSION = 'habiba_admin_session_v1';
  let session = null, refreshing = null;
  try { session = JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch (_) {}
  function remember(s) {
    session = s ? Object.assign({}, s, {expires_at: s.expires_at || Math.floor(Date.now()/1000) + s.expires_in}) : null;
    try { if (session) sessionStorage.setItem(SESSION, JSON.stringify(session)); else sessionStorage.removeItem(SESSION); } catch (_) {}
  }
  async function request(path, options, token) {
    if (!configured) throw Error('اربط إعدادات Supabase أولًا؛ راجع ملف START-HERE.md.');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = Object.assign({'apikey':key, 'Content-Type':'application/json'}, (options || {}).headers);
      if (token) headers.Authorization = 'Bearer ' + token;
      else if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
      const r = await fetch(url + path, Object.assign({}, options, {headers, signal:controller.signal}));
      const value = await r.json().catch(() => null);
      if (!r.ok) {
        const e = Error((value && (value.message || value.msg || value.error_description)) || 'تعذر الاتصال بالخادم.');
        e.status = r.status; throw e;
      }
      return value;
    } finally { clearTimeout(timer); }
  }
  async function access() {
    if (!session) throw Error('سجّل دخول الإدارة أولًا.');
    if (session.expires_at * 1000 < Date.now() + 60000) {
      if (!refreshing) refreshing = request('/auth/v1/token?grant_type=refresh_token', {method:'POST', body:JSON.stringify({refresh_token:session.refresh_token})})
        .then(remember).catch(e => {remember(null); throw e;}).finally(() => {refreshing = null;});
      await refreshing;
    }
    return session.access_token;
  }
  async function isAdmin() {
    const token = await access();
    const user = await request('/auth/v1/user', {}, token);
    const rows = await request('/rest/v1/habiba_admins?select=user_id&user_id=eq.' + encodeURIComponent(user.id), {}, token);
    if (!rows || !rows.length) throw Error('الحساب ده مش مسموح له بإدارة المتجر.');
    return user;
  }
  async function signIn(email, password) {
    remember(await request('/auth/v1/token?grant_type=password', {method:'POST', body:JSON.stringify({email,password})}));
    try { return await isAdmin(); } catch(e) { await signOut(); throw e; }
  }
  async function signOut() {
    const old = session; remember(null);
    if (old) try { await request('/auth/v1/logout', {method:'POST'}, old.access_token); } catch (_) {}
  }
  async function read() {
    const rows = await request('/rest/v1/habiba_store?select=document,revision,updated_at&id=eq.1', {cache:'no-store'});
    if (!rows || rows.length !== 1) throw Error('جدول المتجر غير جاهز؛ شغّل backend-setup.sql.');
    return rows[0];
  }
  async function save(document, revision) {
    const result = await request('/rest/v1/rpc/habiba_save_store', {method:'POST', body:JSON.stringify({p_document:document,p_revision:revision})}, await access());
    if (!result) throw Error('لم يؤكد الخادم الحفظ.');
    return result;
  }
  // Legacy GitHub tokens are no longer used or kept by this dashboard.
  try { localStorage.removeItem('habiba_gh_publish_v1'); } catch (_) {}
  window.HabibaMoments=Array.from({length:5},(_,i)=>({id:'moment-'+(i+1),title:['A little glow','Everyday beauty','Your daily ritual','Beauty in motion','The Habiba edit'][i],src:'moment-'+(i+1)+'.mp4',poster:'media/moment-'+(i+1)+'.jpg',start:0,end:7}));
  async function uploadVideo(file){
    if(file.size>30*1024*1024)throw Error('اختار فيديو أقل من 30 MB.');
    if(!['video/mp4','video/webm'].includes(file.type))throw Error('اختار MP4 أو WebM.');
    const token=await access(),path=crypto.randomUUID()+(file.type==='video/mp4'?'.mp4':'.webm');
    const res=await fetch(url+'/storage/v1/object/habiba-reels/'+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':file.type},body:file});
    if(!res.ok)throw Error('تعذر رفع الفيديو؛ شغّل reels-storage.sql وراجع صلاحيات الإدارة.');
    return url+'/storage/v1/object/public/habiba-reels/'+path;
  }
  window.HabibaBackend = {configured,read,save,signIn,signOut,isAdmin,uploadVideo};
})();
