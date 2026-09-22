// Temporary category pause; retain products and completed orders.
module.exports = product => /^(telegram|телеграм)$/i.test(String(product?.category||'').trim()) || /^(telegram|телеграм)\b/i.test(String(product?.name||''));
