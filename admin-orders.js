(() => {
  const list=document.getElementById('olist');
  const labels={awaiting_payment:'Ожидает оплаты',paid:'Оплачено — ожидает выдачи',delivered:'Выдано',cancelled:'Отменено',expired:'Отменено'};
  async function request(url,method='GET',body){const r=await fetch(url,{method,headers:H(),body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw new Error(d.error||'Ошибка');return d;}
  const original=load;
  load=async function(){try{await original();await render();}catch(e){document.getElementById('feedback').textContent=e.message;list.textContent=e.message;}};
  async function render(){const orders=await request('/api/admin/orders');list.replaceChildren();
    for(const o of orders.slice().reverse()){
      const card=document.createElement('article');card.className='card info';
      for(const value of [o.id,o.category,o.productName||o.productId,`Пользователь: ${o.userId}`,o.playerId?`ID / логин: ${o.playerId}`:'',o.zoneId?`Зона: ${o.zoneId}`:'',o.gameServer?`Сервер: ${o.gameServer}`:'',`${o.amount} ₽`,labels[o.status]||o.status]){if(!value)continue;const p=document.createElement('p');p.textContent=value;card.append(p);}
      if(o.code){const code=document.createElement('pre');code.textContent=o.code;card.append(code);}
      if(o.status==='paid'){
        const input=document.createElement('textarea');input.placeholder='Код для покупателя';input.maxLength=2000;input.style.width='90%';
        if(o.fulfillmentType!=='topup')card.append(input);
        const button=document.createElement('button');button.textContent=o.fulfillmentType==='topup'?'Пополнено':'Выдать код';
        const result=document.createElement('p');result.setAttribute('role','status');
        button.onclick=async()=>{button.disabled=true;try{await request('/api/admin/orders/'+encodeURIComponent(o.id),'PATCH',{action:'deliver',code:input.value});await render();}catch(e){result.textContent=e.message;button.disabled=false;}};
        card.append(button,result);
      }
      list.append(card);
    }
  }
})();
