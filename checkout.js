(() => {
  let busy=false,lastKey='',lastSignature='';
  const value=id=>document.getElementById(id)?.value.trim()||'';
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
      const payload={name,catalogName,amount:priceToNumber(totalLabel),playerId,zoneId,gameServer,paymentMethod:(currentView==='view-payment'&&typeof paymentPayMethod!=='undefined')?paymentPayMethod:'test'};
      const signature=JSON.stringify(payload);if(signature!==lastSignature){lastKey=crypto.randomUUID();lastSignature=signature;}
      const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':Telegram.WebApp.initData},body:JSON.stringify({...payload,checkoutKey:lastKey})});
      const order=await r.json();if(!r.ok)throw new Error(order.error||'Не удалось создать заказ');
      lastSignature='';lastKey='';
      hideSubView();showToast('Открываем страницу оплаты');
      window.refreshPurchases?.();
      if(order.paymentUrl){
        const paymentUrl=new URL(order.paymentUrl,location.origin).href;
        if(Telegram.WebApp.openLink) Telegram.WebApp.openLink(paymentUrl);
        else window.open(paymentUrl,'_blank','noopener');
      } else throw new Error('Ссылка оплаты не создана');
    }catch(e){showToast(e.message);}finally{busy=false;}
  };
  document.querySelector('.navitem[data-view="purchases"]')?.addEventListener('click',()=>{renderPurchases();window.refreshPurchases?.();});
  if(new URLSearchParams(location.search).get('page')==='purchases')showSubView('view-purchases');
})();
