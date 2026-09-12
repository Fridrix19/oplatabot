(() => {
  const input = document.getElementById('catalog-search');
  const clear = document.getElementById('search-clear');
  const panel = document.getElementById('search-results');
  const list = document.getElementById('search-items');
  const count = document.getElementById('search-count');
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const aliases = {pubg:'пабг пубг', mlbb:'мобайл легендс', steam:'стим', tgstars:'телеграм telegram звезды stars premium премиум', psstore:'плейстейшн playstation пс', psplus:'плейстейшн playstation пс плюс', netflix:'нетфликс', capcut:'капкат', battlenet:'батлнет battle net', nintendo:'нинтендо'};
  function entries() {
    const rows = [];
    const add = (name, category, img, key, open) => rows.push({name, category, img, open, text:normalize(`${name} ${category} ${aliases[key] || ''}`)});
    for (const [key, items] of Object.entries(games)) items.forEach((item, i) => add(item.name, 'Игры', item.img, key, () => openProduct(key, i)));
    for (const [key, service] of Object.entries(donateServices)) {
      const category = digitalSubscriptionKeys.includes(key) ? 'Цифровые сервисы' : 'Пополнение';
      add(service.name, category, service.img, key, () => openTopup(key));
      const groups = service.variants ? [...service.variants] : [{key:'direct',packages:service.packages||[]}];
      if(service.codesCatalog) groups.push({key:'codes',packages:service.codesCatalog.items||[]});
      groups.forEach(group => (group.packages||[]).forEach(item => add(`${service.name} — ${item.name}`, category, item.img || service.img, key, () => {
        openTopup(key); topupMode=group.key; renderTopupModeTabs(); updateTopupPkgLabel(); renderTopupPackages();
      })));
    }
    for (const [key, catalog] of Object.entries(giftCatalogs)) {
      add(catalog.title, 'Карты и подписки', catalog.img, key, () => openGiftCards(key));
      const countries = catalog.countries || [{name:'', code:null, items:catalog.items || []}];
      countries.forEach(country => (country.items || []).forEach(item => add(item.name || `${catalog.title} ${item.amount}`, `${catalog.title} · ${country.name}`, item.img || catalog.img, key, () => {
        openGiftCards(key);
        giftCardState.country = country.code;
        if (catalog.countries) renderGiftCountryTabs();
        updateGiftcardLabel(); renderGiftGrid();
      })));
    }
    subGroups.forEach(group => add(group.title, 'Подписки', group.img, group.key, () => openSubGroup(group.key)));
    return rows;
  }
  function render() {
    const query = normalize(input.value);
    clear.hidden = !input.value;
    panel.hidden = !query;
    document.getElementById('view-home').classList.toggle('search-active', !!query);
    list.replaceChildren();
    if (!query) return;
    const words = query.split(' ');
    const seen = new Set();
    const matches = entries().filter(row => {
      const key = normalize(`${row.name} ${row.category}`);
      if (seen.has(key) || !words.every(word => row.text.includes(word))) return false;
      seen.add(key); return true;
    }).sort((a,b) => Number(normalize(b.name).startsWith(query)) - Number(normalize(a.name).startsWith(query)));
    count.textContent = matches.length ? `Найдено: ${matches.length}` : 'Ничего не найдено. Попробуйте другое название.';
    for (const row of matches) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'search-result';
      if (row.img) {const img = document.createElement('img'); img.src = row.img; img.alt = ''; img.loading = 'lazy'; button.append(img);}
      const body = document.createElement('span');
      const title = document.createElement('strong'); title.textContent = row.name;
      const subtitle = document.createElement('small'); subtitle.textContent = row.category;
      body.append(title, subtitle); button.append(body);
      button.addEventListener('click', () => {input.blur(); row.open();}); list.append(button);
    }
  }
  input.addEventListener('input', render);
  input.addEventListener('keydown', event => {if(event.key === 'Escape') {input.value = ''; render();} if(event.key === 'Enter') {event.preventDefault(); list.querySelector('button')?.focus();}});
  clear.addEventListener('click', () => {input.value = ''; render(); input.focus();});
})();
