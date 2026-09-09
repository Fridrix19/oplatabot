(() => {
  const escape = s => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pending=new Set();
  let ready=false, refreshBusy=false, purchases=[];
  const status=document.createElement('p');status.setAttribute('role','status');
  document.querySelector('#view-profile .profile-head')?.after(status);
  async function api(url,method='GET',body) {
    const response=await fetch(url,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':window.Telegram?.WebApp?.initData||''},body:body?JSON.stringify(body):undefined});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Ошибка сервера');
    return data;
  }
  function hearts(){
    updateFavBadge();renderFavoritesView();
    document.querySelectorAll('[data-fav-id].card-heart').forEach(el=>el.classList.toggle('active',!!favorites[el.dataset.favId]));
  }
  window.profileFavoritesToggle=async id=>{
    if(!ready){showToast('Откройте профиль в Telegram и дождитесь загрузки');return;}
    if(pending.has(id))return;
    pending.add(id);
    try{
      if(favorites[id]){await api('/api/me/favorites/'+encodeURIComponent(id),'DELETE');delete favorites[id];}
      else {const f=favoriteCandidates[id];if(!f)return;await api('/api/me/favorites/'+encodeURIComponent(id),'PUT',f);favorites[id]=f;}
      hearts();
    }catch(e){showToast(e.message);}finally{pending.delete(id);}
  };
  const labels={awaiting_payment:'Ожидает оплаты',pending:'Ожидает оплаты',delivered:'Код выдан',paid:'Оплачено',expired:'Время оплаты истекло',cancelled:'Отменён',error:'Ошибка выдачи',failed:'Ошибка оплаты'};
  renderPurchases=function(){
    const list=document.getElementById('purchases-list');if(!list)return;
    list.replaceChildren();
    if(!purchases.length){const p=document.createElement('p');p.textContent=ready?'Пока нет покупок':'Откройте Mini App в Telegram для просмотра покупок';list.append(p);return;}
    for(const order of purchases){
      const card=document.createElement('article');card.className='po-card';
      for(const text of [order.productName,`Заказ ${order.id}`,labels[order.status]||order.status,`${order.amount} ₽`,new Date(order.createdAt).toLocaleString('ru-RU')]){const p=document.createElement('p');p.textContent=text;card.append(p);}
      if(order.code){const code=document.createElement('code');code.textContent=order.code;const copy=document.createElement('button');copy.textContent='Копировать код';copy.className='empty-btn';copy.onclick=()=>navigator.clipboard.writeText(order.code).then(()=>showToast('Код скопирован')).catch(()=>showToast('Выделите код и скопируйте вручную'));card.append(code,copy);}
      list.append(card);
    }
  };
  async function refresh(){
    if(refreshBusy)return;refreshBusy=true;
    try{
      const [me,history]=await Promise.all([api('/api/me'),api('/api/me/orders')]);
      ready=true;status.textContent='Профиль сохранён на сервере';
      document.querySelector('.profile-name').textContent=[me.first_name,me.last_name].filter(Boolean).join(' ')||me.username||'Пользователь';
      document.querySelector('.profile-id').textContent='Telegram ID: '+me.id;
      document.querySelector('#view-profile .avatar').textContent=(me.first_name||me.username||'П').slice(0,1);
      if(!pending.size){favorites=Object.fromEntries(Object.entries(me.favorites).map(([id,f])=>[id,Object.fromEntries(Object.entries(f).map(([k,v])=>[k,escape(v)]))]));hearts();}
      purchases=history;renderPurchases();
    }catch(e){status.textContent=e.message;if(!ready)renderPurchases();}finally{refreshBusy=false;}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('focus',refresh);
  setInterval(()=>{if(!document.hidden&&window.Telegram?.WebApp?.initData)refresh();},15000);
  refresh();
})();
