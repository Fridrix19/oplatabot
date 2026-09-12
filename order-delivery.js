function deliver(db, order, value, actor) {
  const fail = message => {throw Object.assign(new Error(message), {status:409});};
  if (!order) fail('Заказ не найден');
  if (order.status === 'delivered') fail('Заказ уже выполнен');
  if (order.status !== 'paid') fail('Выдача возможна только после оплаты');
  const code = String(value || '').trim();
  if (order.fulfillmentType !== 'topup') {
    if (!code || code.length > 2000) fail('Введите код длиной до 2000 символов');
    if (db.orders.some(other => other.id !== order.id && other.status === 'delivered' && other.code === code)) fail('Этот код уже выдан другому заказу');
  }
  Object.assign(order, {code:order.fulfillmentType === 'topup' ? null : code, status:'delivered', deliveredAt:new Date().toISOString(), deliveredBy:actor});
}
module.exports = {deliver};
