const {deliver} = require('./order-delivery');
function attach(db, save, transport) {
  const token = () => (process.env.ORDERS_BOT_TOKEN || '').trim();
  const admin = () => String(process.env.ADMIN_TELEGRAM_ID || '').trim();
  const enabled = () => token() && /^\d+$/.test(admin()) && token() !== (process.env.BOT_TOKEN || '').trim();
  async function api(method, args) {
    if (transport) return transport(method,args);
    const response = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(args), signal:AbortSignal.timeout(15000)});
    const data = await response.json();
    if (!data.ok) {
      if (data.description?.includes('message is not modified')) return;
      throw new Error(`Telegram ${data.error_code}: ${data.description}`);
    }
    return data.result;
  }
  const send = text => api('sendMessage', {chat_id:admin(), text});
  function card(o) {
    return `${o.status === 'paid' ? '🟢 Оплачен — нужно выдать' : '✅ Выполнен'}\nЗаказ: ${o.id}\n${o.category || 'Товар'} — ${o.productName || 'Товар'}\nСумма: ${o.amount} ₽\nПокупатель: ${o.userId}${o.playerId ? '\nID / логин: '+o.playerId : ''}${o.zoneId ? '\nЗона: '+o.zoneId : ''}${o.gameServer ? '\nСервер: '+o.gameServer : ''}${o.status === 'paid' ? (o.fulfillmentType === 'topup' ? '\nПосле пополнения нажмите кнопку ниже.' : '\nОтправьте код ответом на это сообщение (функция «Ответить»).') : ''}`;
  }
  async function tick() {
    if (!enabled()) return;
    for (const o of db.orders) {
      // Do not import completed history into the operator queue.
      if (o.status !== 'paid' && !(o.operatorMessageId && o.status === 'delivered')) continue;
      if (o.operatorNotifiedStatus === o.status) continue;
      const payload = {chat_id:admin(), text:card(o), reply_markup:{inline_keyboard:o.status === 'paid' && o.fulfillmentType === 'topup' ? [[{text:'Пополнено',callback_data:'done:'+o.id}]] : []}};
      try {
        if (o.operatorMessageId) await api('editMessageText', {...payload,message_id:o.operatorMessageId});
        else {const m = await api('sendMessage',payload); o.operatorMessageId=m.message_id;}
        o.operatorNotifiedStatus=o.status; await save();
      } catch(e) {console.error('Operator notification:', e.message); break;}
    }
  }
  async function poll() {
    if (!enabled()) return;
    const updates = await api('getUpdates',{offset:db.operatorOffset || 0,timeout:0,allowed_updates:['message','callback_query']});
    for (const update of updates || []) {
      const callback=update.callback_query, message=callback?.message || update.message;
      const sender=callback?.from || message?.from;
      if (String(sender?.id) === admin() && message?.chat?.type === 'private' && String(message.chat.id) === admin()) {
        let result;
        try {
          if (callback) {
            const order=db.orders.find(o => 'done:'+o.id === callback.data && o.operatorMessageId === message.message_id);
            if (!order || order.fulfillmentType !== 'topup') throw new Error('Заказ для пополнения не найден');
            deliver(db,order,null,'telegram:'+admin()); await save(); result='Пополнение отмечено. Покупатель получит уведомление.';
          } else if (message.text === '/start') {
            result='Здесь появятся оплаченные заказы. Для выдачи кода ответьте на сообщение заказа. Для пополнений используйте кнопку «Пополнено».';
          } else if (message.reply_to_message && message.text) {
            const order=db.orders.find(o => o.operatorMessageId === message.reply_to_message.message_id);
            if (!order) throw new Error('Ответьте на сообщение нужного заказа');
            if (order.fulfillmentType === 'topup') throw new Error('Для этого заказа используйте кнопку «Пополнено»');
            deliver(db,order,message.text,'telegram:'+admin()); await save(); result='Код сохранён. Покупатель получит его в магазине и чате.';
          } else result='Чтобы выдать код, отправьте его ответом на сообщение оплаченного заказа.';
        } catch(e) {if(!e.status && !['Заказ для пополнения не найден','Ответьте на сообщение нужного заказа','Для этого заказа используйте кнопку «Пополнено»'].includes(e.message)) throw e; result=e.message;}
        if (callback) await api('answerCallbackQuery',{callback_query_id:callback.id,text:result});
        else await send(result);
      } else if (callback) await api('answerCallbackQuery',{callback_query_id:callback.id,text:'Нет доступа'});
      db.operatorOffset=update.update_id+1; await save();
    }
  }
  return {tick,poll};
}
module.exports={attach};
