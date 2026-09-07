/* Stock applies after both initial loading and dynamic catalog rendering. */
(() => {
  let products = [], busy = false;
  const norm = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  function apply() {
    const byId = new Map(products.map(p => [p.id, p]));
    const byName = new Map(products.map(p => [norm(p.name), p]));
    document.querySelectorAll('.giftcard, .product-card, [data-product-id]').forEach(card => {
      const label = card.querySelector('.giftcard-name,.topup-grid-name,.product-name');
      const country = card.querySelector('.giftcard-country')?.textContent;
      const name = card.dataset.catalogName || (label?.textContent + (country ? ` (${country})` : ''));
      const product = byId.get(card.dataset.productId) || byName.get(norm(name));
      if (!product) return;
      card.dataset.productId = product.id;
      card.classList.toggle('product-sold-out', product.soldOut);
      card.setAttribute('aria-disabled', String(product.soldOut));
    });
  }
  async function refresh() {
    if (busy) return;
    busy = true;
    try {
      const response = await fetch('/api/products', {cache:'no-store'});
      if (!response.ok) throw new Error('Catalog unavailable');
      products = await response.json();
      apply();
    } catch (error) { console.warn('Не удалось обновить наличие товаров'); }
    finally { busy = false; }
  }
  document.addEventListener('click', event => {
    if (event.target.closest('.product-sold-out')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  new MutationObserver(apply).observe(document.body, {childList:true, subtree:true});
  window.addEventListener('focus', refresh);
  window.addEventListener('storage', e => {if(e.key === 'stock-updated') refresh();});
  document.addEventListener('visibilitychange', () => {if(!document.hidden) refresh();});
  setInterval(() => {if(!document.hidden) refresh();}, 3000);
  refresh();
})();
