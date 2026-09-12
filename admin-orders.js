(() => {
  const list=document.getElementById('olist');
  let authenticated=false,busy=false;
  const drafts=new Map();
  const controls=document.createElement('div');
  const search=document.createElement('input');search.placeholder='Заказ, товар или ID пользователя';search.setAttribute('aria-label','Поиск заказов');
  const filter=document.createElement('select');filter.setAttribute('aria-label','Статус заказа');
  for(const [value,label] of [['','Все заказы'],['paid','Ожидают выдачи'],['awaiting_payment','Ожидают оплаты'],['delivered','Выдано'],['cancelled','Отменено']]){const option=document.createElement('option');option.value=value;option.textContent=label;filter.append(option);}
  const refresh=document.createElement('button');refresh.textContent='Обновить заказы';
  const notice=document.createElement('p');notice.setAttribute('role','status');
  controls.append(search,filter,refresh,notice);list.before(controls);
  const labels={awaiting_payment:'Ожидает оплаты',paid:'Оплачено — ожидает выдачи',delivered:'Выдано',cancelled:'Отменено',expired:'Отменено'};
  async function request(url,method='GET',body){const r=await fetch(url,{method,headers:H(),body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw new Error(d.error||'Ошибка');return d;}
  const original=load;
  load=async function(){try{await request('/api/admin/orders');authenticated=true;await original();await render();}catch(e){authenticated=false;document.getElementById('feedback').textContent=e.message;list.textContent=e.message;}};
  async function render(){
    if(busy)return;busy=true;
    try{const orders=await request('/api/admin/orders');list.replaceChildren();
    const query=search.value.toLocaleLowerCase().trim();
    const shown=orders.filter(o=>(!filter.value||(o.status==='expired'?'cancelled':o.status)===filter.value)&&[o.id,o.productName,o.userId,o.playerId].some(v=>String(v||'').toLocaleLowerCase().includes(query)));
    notice.textContent=`Найдено: ${shown.length}. Ожидают выдачи: ${orders.filter(o=>o.status==='paid').length}`;
    for(const o of shown.slice().reverse()){
      const card=document.createElement('article');card.className='card info';
      for(const value of [o.id,o.category,o.productName||o.productId,`Пользователь: ${o.userId}`,o.playerId?`ID / логин: ${o.playerId}`:'',o.zoneId?`Зона: ${o.zoneId}`:'',o.gameServer?`Сервер: ${o.gameServer}`:'',`${o.amount} ₽`,labels[o.status]||o.status]){if(!value)continue;const p=document.createElement('p');p.textContent=value;card.append(p);}
      if(o.code){const code=document.createElement('pre');code.textContent=o.code;card.append(code);}
      if(o.status==='paid'){
        const input=document.createElement('textarea');input.placeholder='Код для покупателя';input.maxLength=2000;input.style.width='90%';
        input.value=drafts.get(o.id)||'';input.oninput=()=>drafts.set(o.id,input.value);
        if(o.fulfillmentType!=='topup')card.append(input);
        const button=document.createElement('button');button.textContent=o.fulfillmentType==='topup'?'Пополнено':'Выдать код';
        const result=document.createElement('p');result.setAttribute('role','status');
        button.onclick=async()=>{button.disabled=true;try{await request('/api/admin/orders/'+encodeURIComponent(o.id),'PATCH',{action:'deliver',code:input.value});drafts.delete(o.id);await render();}catch(e){result.textContent=e.message;button.disabled=false;}};
        card.append(button,result);
      }
      list.append(card);
    }}catch(e){notice.textContent=e.message;}finally{busy=false;}
  }
  refresh.onclick=render;filter.onchange=render;
  let searchTimer;search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(render,250);};
  setInterval(()=>{if(authenticated&&!document.hidden&&document.getElementById('orders').classList.contains('active')&&!list.contains(document.activeElement))render();},10000);
})();
