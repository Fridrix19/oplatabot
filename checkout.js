(() => {
  let busy=false,lastKey='',lastSignature='';
  const value=id=>document.getElementById(id)?.value.trim()||'';
  window.buySingleItem=item=>{const catalogName=item.type==='game'?games[productDetailState.listKey][productDetailState.idx].name:item.type==='subscription'?subs.find(s=>s.key===subDetailState.tier).name:item.name;openPaymentPage({title:item.name,heading:item.name,itemName:item.name,itemPrice:item.priceNum||priceToNumber(item.price),itemGrad:item.grad,itemImg:item.img,showId:false,showQty:false,onConfirm:(total,email)=>window.checkoutOrder([{...item,catalogName,qty:1}],`${total} ₽`,email)});};
  window.checkoutOrder=async(items,totalLabel,email)=>{
    if(busy)return;
    if(!window.Telegram?.WebApp?.initData){showToast('Откройте магазин в Telegram');return;}
    busy=true;
    try{
      const item=items[0];let name=item.name,catalogName=item.catalogName||item.name,playerId='',zoneId='',gameServer='';
      if(currentView==='view-payment'&&paymentConfig){
        if(paymentConfig.showId)playerId=value('payment-id-input');
        if(paymentConfig.showUsername)playerId=value('payment-username-input');
        if(paymentConfig.showZoneId)zoneId=value('payment-zoneid-input');
        if(paymentConfig.showServer)gameServer=selectedPaymentServer;
      }
      if(document.getElementById('topup-custom-login')?.offsetParent){playerId=value('topup-custom-login');catalogName=donateServices[currentTopup].name;const v=getCurrentTopupVariant();name=catalogName+' — '+value('topup-custom-amount')+' '+(v?.currency||'');}
      if(name.startsWith('Telegram Stars ')){playerId=value('tgstars-username-input');catalogName=name=getTgStarsItems()[tgStarsSelectedIdx].name;}
      if(name.startsWith('Telegram Premium ')){playerId=value('tgprem-username-input');catalogName=name=getTgPremItems()[tgPremSelectedIdx].name;}
      const payload={name,catalogName,amount:priceToNumber(totalLabel),playerId,zoneId,gameServer,email};
      const signature=JSON.stringify(payload);if(signature!==lastSignature){lastKey=crypto.randomUUID();lastSignature=signature;}
      const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':Telegram.WebApp.initData},body:JSON.stringify({...payload,checkoutKey:lastKey})});
      const order=await r.json();if(!r.ok)throw new Error(order.error||'Не удалось создать заказ');
      lastSignature='';lastKey='';
      hideSubView();showToast('Оплатите товар в Telegram');
      window.refreshPurchases?.();
      if(order.botUrl){Telegram.WebApp.openTelegramLink(order.botUrl);Telegram.WebApp.close();}
      else throw new Error('В настройках сервера не указан BOT_USERNAME');
    }catch(e){showToast(e.message);}finally{busy=false;}
  };
  // Cart is no longer a navigable feature; legacy DOM is removed after binding.
  document.getElementById('view-cart')?.remove();
  document.getElementById('cart-add-toast')?.remove();
  document.getElementById('cart-buy-btn')?.remove();
  document.querySelectorAll('.navitem[data-view="purchases"] .nav-badge').forEach(el=>el.remove());
  document.querySelector('.navitem[data-view="purchases"]')?.addEventListener('click',()=>{renderPurchases();window.refreshPurchases?.();});
  if(new URLSearchParams(location.search).get('page')==='purchases')showSubView('view-purchases');
})();
