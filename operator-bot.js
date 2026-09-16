const {deliver} = require('./order-delivery');

// Errors that are shown to the operator as-is instead of being logged as failures.
class OperatorError extends Error {}

function attach(db, save, transport, customerTransport) {
  const token = () => (process.env.ORDERS_BOT_TOKEN || '').trim();
  const customerToken = () => (process.env.BOT_TOKEN || '').trim();
  const admin = () => String(process.env.ADMIN_TELEGRAM_ID || '').trim();
  const enabled = () => token() && /^\d+$/.test(admin()) && token() !== customerToken();

  async function telegram(botToken, method, args) {
    const isForm = args instanceof FormData;
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method:'POST',
      headers:isForm ? undefined : {'Content-Type':'application/json'},
      body:isForm ? args : JSON.stringify(args),
      signal:AbortSignal.timeout(30000)
    });
    const data = await response.json();
    if (!data.ok) {
      if (data.description?.includes('message is not modified')) return;
      throw new Error(`Telegram ${data.error_code}: ${data.description}`);
    }
    return data.result;
  }
  // Operator bot (ORDERS_BOT_TOKEN) and customer bot (BOT_TOKEN).
  const api = (method, args) => transport ? transport(method, args) : telegram(token(), method, args);
  const customerApi = (method, args) => customerTransport ? customerTransport(method, args) : telegram(customerToken(), method, args);

  async function downloadFile(fileId) {
    if (transport) return {blob:new Blob(['test']), name:'receipt.jpg'};
    const info = await api('getFile', {file_id:fileId});
    const response = await fetch(`https://api.telegram.org/file/bot${token()}/${info.file_path}`, {signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Не удалось скачать файл (${response.status})`);
    return {blob:await response.blob(), name:info.file_path.split('/').pop() || 'receipt'};
  }

  // A Telegram file_id belongs to one bot, so the operator bot downloads the
  // receipt and the customer bot uploads it again.
  async function sendReceipt(order) {
    const caption = `🧾 Чек по заказу ${order.id}`;
    if (order.receiptText) {
      await customerApi('sendMessage', {chat_id:order.userId, text:`${caption}\n\n${order.receiptText}`});
    } else if (order.receiptFileId) {
      const file = await downloadFile(order.receiptFileId);
      const form = new FormData();
      form.append('chat_id', String(order.userId));
      form.append('caption', caption);
      form.append(order.receiptIsPhoto ? 'photo' : 'document', file.blob, order.receiptFileName || file.name);
      await customerApi(order.receiptIsPhoto ? 'sendPhoto' : 'sendDocument', form);
    } else return;
    order.receiptSentAt = new Date().toISOString();
  }

  const send = text => api('sendMessage', {chat_id:admin(), text});
  const findOrder = messageId => db.orders.find(o => o.operatorMessageId === messageId || o.receiptPromptMessageId === messageId);

  function card(o) {
    return `${o.status === 'paid' ? '🟢 Оплачен — нужно выдать' : '✅ Выполнен'}\nЗаказ: ${o.id}\n${o.category || 'Товар'} — ${o.productName || 'Товар'}\nСумма: ${o.amount} ₽\nПокупатель: ${o.userId}${o.playerId ? '\nID / логин: '+o.playerId : ''}${o.zoneId ? '\nЗона: '+o.zoneId : ''}${o.gameServer ? '\nСервер: '+o.gameServer : ''}${o.status === 'paid' ? (o.fulfillmentType === 'topup' ? '\nПосле пополнения нажмите кнопку ниже.' : '\nОтправьте код ответом на это сообщение (функция «Ответить»).') : ''}`;
  }

  async function tick() {
    if (!enabled()) return;
    for (const o of db.orders) {
      // Receipt attached before delivery: send it after the customer got the order result.
      if (o.status === 'delivered' && (o.receiptFileId || o.receiptText) && !o.receiptSentAt && !o.receiptFailed && o.notifiedStatus === 'delivered') {
        try { await sendReceipt(o); }
        catch (e) { o.receiptFailed = true; await send(`Не удалось отправить чек по заказу ${o.id}: ${e.message}`).catch(() => {}); }
        await save();
      }
      // Do not import completed history into the operator queue.
      if (o.status !== 'paid' && !(o.operatorMessageId && o.status === 'delivered')) continue;
      if (o.operatorNotifiedStatus === o.status) continue;
      const payload = {chat_id:admin(), text:card(o), reply_markup:{inline_keyboard:o.status === 'paid' && o.fulfillmentType === 'topup' ? [[{text:'Пополнено',callback_data:'done:'+o.id}]] : []}};
      try {
        if (o.operatorMessageId) await api('editMessageText', {...payload, message_id:o.operatorMessageId});
        else { const m = await api('sendMessage', payload); o.operatorMessageId = m.message_id; }
        o.operatorNotifiedStatus = o.status; await save();
        if (o.status === 'delivered') {
          if (!o.receiptFileId && !o.receiptText && !o.receiptPromptMessageId) {
            const prompt = await api('sendMessage', {chat_id:admin(), text:`✅ Выполнен\nЗаказ: ${o.id}\nОтветьте на это сообщение изображением, файлом или текстом чека — покупатель получит его в чате с ботом.`});
            if (prompt) o.receiptPromptMessageId = prompt.message_id;
            await save();
          }
        }
      } catch (e) { console.error('Operator notification:', e.message); break; }
    }
  }

  async function attachReceipt(order, receipt) {
    if (order.receiptSentAt) throw new OperatorError('Чек по этому заказу уже отправлен покупателю');
    Object.assign(order, {receiptFileId:null, receiptIsPhoto:false, receiptFileName:null, receiptText:null, receiptFailed:false}, receipt);
    if (order.status !== 'delivered') { await save(); return 'Чек сохранён — покупатель получит его после выдачи заказа.'; }
    try { await sendReceipt(order); }
    catch (e) { throw new OperatorError(`Не удалось отправить чек покупателю: ${e.message}`); }
    await save();
    return 'Чек отправлен покупателю.';
  }

  async function handle(message, callback) {
    if (callback) {
      const order = db.orders.find(o => 'done:'+o.id === callback.data && o.operatorMessageId === message.message_id);
      if (!order || order.fulfillmentType !== 'topup') throw new OperatorError('Заказ для пополнения не найден');
      deliver(db, order, null, 'telegram:'+admin()); await save();
      return 'Пополнение отмечено. Покупатель получит уведомление.';
    }
    if (message.text === '/start') return 'Здесь появятся оплаченные заказы. Для выдачи кода ответьте на сообщение заказа. Для пополнений используйте кнопку «Пополнено».';
    if (!message.reply_to_message) return 'Чтобы выдать код, отправьте его ответом на сообщение оплаченного заказа.';
    const order = findOrder(message.reply_to_message.message_id);
    if (!order) throw new OperatorError('Ответьте на сообщение нужного заказа');
    const replyToPrompt = order.receiptPromptMessageId === message.reply_to_message.message_id;

    if (message.photo || message.document) {
      return attachReceipt(order, message.photo
        ? {receiptFileId:message.photo[message.photo.length-1].file_id, receiptIsPhoto:true}
        : {receiptFileId:message.document.file_id, receiptFileName:message.document.file_name || null});
    }
    if (!message.text) return 'Отправьте код текстом или чек изображением/файлом.';
    // A text reply is a receipt after delivery, otherwise it is the code.
    if (replyToPrompt || order.status === 'delivered') return attachReceipt(order, {receiptText:message.text.slice(0, 3500)});
    if (order.fulfillmentType === 'topup') throw new OperatorError('Для этого заказа используйте кнопку «Пополнено»');
    deliver(db, order, message.text, 'telegram:'+admin()); await save();
    return 'Код сохранён.';
  }

  async function poll() {
    if (!enabled()) return;
    const updates = await api('getUpdates', {offset:db.operatorOffset || 0, timeout:0, allowed_updates:['message','callback_query']});
    for (const update of updates || []) {
      const callback = update.callback_query, message = callback?.message || update.message;
      const sender = callback?.from || message?.from;
      if (String(sender?.id) === admin() && message?.chat?.type === 'private' && String(message.chat.id) === admin()) {
        let result;
        try { result = await handle(message, callback); }
        catch (e) {
          if (e instanceof OperatorError || e.status) result = e.message;
          else { console.error('Operator update:', e.message); result = `Ошибка: ${e.message}`; }
        }
        try {
          if (callback) await api('answerCallbackQuery', {callback_query_id:callback.id, text:result});
          else if (result) await send(result);
        } catch (e) { console.error('Operator reply:', e.message); }
      } else if (callback) await api('answerCallbackQuery', {callback_query_id:callback.id, text:'Нет доступа'}).catch(() => {});
      // Always move past the update so one failing message cannot block the queue.
      db.operatorOffset = update.update_id + 1; await save();
    }
  }
  return {tick, poll};
}
module.exports = {attach};
