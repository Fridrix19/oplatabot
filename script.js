/* Включает срабатывание :active на тап пальцем в мобильном Safari/Telegram
   webview — без этого пустого обработчика iOS игнорирует :active на div'ах. */
document.addEventListener("touchstart", function(){}, true);
/* ---------- Telegram: высота экрана ----------
   Telegram может показывать мини-приложение не на всю высоту (шторка
   свёрнута) — тогда нижняя часть страницы оказывается за краем экрана,
   а вместе с ней нижняя панель и кнопка «Перейти к оплате». Поэтому высоту
   приложения берём из viewportStableHeight, а не из 100vh. */
(() => {
  const tg = window.Telegram?.WebApp;
  if(!tg) return;
  tg.ready();
  tg.expand();
  if(tg.isVersionAtLeast?.("7.7")) tg.disableVerticalSwipes?.();
  const applyHeight = () => {
    const h = tg.viewportStableHeight;
    if(h && h > 200) document.documentElement.style.setProperty("--app-height", `${h}px`);
  };
  applyHeight();
  tg.onEvent?.("viewportChanged", e => { if(!e || e.isStateStable) applyHeight(); });
})();

/* ---------- Favorites (избранное) ---------- */
let favorites = {};
let favoriteCandidates = {};

function heartHTML(id, extraClass){
  const active = favorites[id] ? "active" : "";
  return `<div class="card-heart ${extraClass || ""} ${active}" data-fav-id="${id}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
  </div>`;
}

function bindHearts(container){
  container.querySelectorAll(".card-heart").forEach(h=>{
    h.addEventListener("click",(e)=>{
      e.stopPropagation();
      toggleFavoriteById(h.dataset.favId, h);
    });
  });
}

function infoHTML(idx){
  return `<div class="card-info" data-info-idx="${idx}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>
  </div>`;
}

function bindInfoButtons(container, pkgs){
  container.querySelectorAll(".card-info").forEach(btn=>{
    btn.addEventListener("click",(e)=>{
      e.stopPropagation();
      const p = pkgs[parseInt(btn.dataset.infoIdx, 10)];
      if(p && p.info) openPkgInfo(p.name, p.info);
    });
  });
}

function toggleFavoriteById(id, el){
  return window.profileFavoritesToggle?.(id);

  if(favorites[id]){
    delete favorites[id];
  } else if(favoriteCandidates[id]){
    favorites[id] = favoriteCandidates[id];
  }
  const isActive = !!favorites[id];
  document.querySelectorAll(`.card-heart[data-fav-id="${id}"]`).forEach(h=>{
    h.classList.toggle("active", isActive);
  });
  updateFavBadge();
  renderFavoritesView();
}

function updateFavBadge(){
  const count = Object.keys(favorites).length;
  const badge = document.querySelector('.navitem[data-view="fav"] .nav-badge');
  if(!badge) return;
  badge.textContent = count;
  badge.style.display = count>0 ? "flex" : "none";
}

function renderFavoritesView(){
  const view = document.getElementById("view-fav");
  const ids = Object.keys(favorites).filter(id=>!id.includes('tgstars')&&!/^Telegram\b/i.test(favorites[id]?.name||''));

  if(ids.length === 0){
    view.innerHTML = `<div class="empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7.5-4.9-10-9.3C.5 8.1 2.3 4.5 6 4.1c2-.2 3.6.9 6 3.4 2.4-2.5 4-3.6 6-3.4 3.7.4 5.5 4 4 7.6-2.5 4.4-10 9.3-10 9.3z"/></svg>
      </div>
      <div class="empty-title">Пока пусто</div>
      <div class="empty-sub">Добавляйте товары в избранное, нажав на сердечко в карточке товара</div>
      <button class="empty-btn" onclick="hideSubView()">Открыть каталог</button>
    </div>`;
    return;
  }

  view.innerHTML = `<div class="fav-header">Избранное</div>
    <div class="giftcard-grid">
      ${ids.map(id=>{
        const f = favorites[id];
        return `<div class="giftcard" data-fav-id="${id}">
          <div class="giftcard-cover" style="background:${f.img ? `url('${f.img}') center/cover no-repeat` : f.grad};">
            ${heartHTML(id)}
            ${(f.sub && !f.img) ? `<div class="giftcard-inner"><div class="giftcard-amount-box" style="background:rgba(0,0,0,.28);"><div class="giftcard-amount-value">${f.sub}</div></div></div>` : ""}
          </div>
          <div class="giftcard-price">${f.price}${f.old ? ` <span class="giftcard-old">${f.old}</span>` : ""}</div>
          <div class="giftcard-name">${f.name}</div>
        </div>`;
      }).join("")}
    </div>`;
  bindHearts(view);
  view.querySelectorAll(".giftcard[data-fav-id]").forEach(el=>{
    el.style.cursor = "pointer";
    el.addEventListener("click", ()=> openFavoriteItem(el.dataset.favId));
  });
}

/* Opens the correct product/payment page for a favorited item based on its id prefix */
function openFavoriteItem(id){
  const parts = id.split(":");
  const type = parts[0];
  if(type === "donate"){
    if(!donateServices[parts[1]]) return showToast('Этот сервис больше не представлен в каталоге');
    openTopup(parts[1]);
  } else if(type === "giftcard"){
    openGiftCardPayment(parts[1], parts[2] === "_" ? null : parts[2], parseInt(parts[3],10));
  } else if(type === "topuppkg"){
    const svc = donateServices[parts[1]];
    if(!svc) return showToast('Этот сервис больше не представлен в каталоге');
    // Resolve saved packages by their name: catalog edits can shift array indices.
    const decoder = document.createElement('textarea');
    decoder.innerHTML = favorites[id]?.name || '';
    const savedName = decoder.value;
    const groups = svc.variants ? svc.variants.map(v=>({key:v.key,packages:v.packages||[]})) : [{key:'direct',packages:svc.packages||[]}];
    if(svc.codesCatalog) groups.push({key:'codes',packages:svc.codesCatalog.items||[]});
    for(const group of groups){
      const index = group.packages.findIndex(p=>(group.key==='codes'?p.name:`${svc.name} — ${p.name}`)===savedName);
      if(index<0) continue;
      currentTopup=parts[1]; topupMode=group.key; goToTopupPayment(index); return;
    }
    return showToast('Этот вариант больше не представлен в каталоге');
  }
}

/* ---------- Gift card catalog (Сервисы пополнения) ----------
   Чтобы добавить фото товара (как в разделе "Игровой донат"/каталог игр),
   впишите ссылку на статичное изображение в поле `img` каждого сервиса ниже.
   Если `img` задан — на карточке товара, странице оплаты, в корзине и в
   избранном вместо градиента с эмодзи будет показано это фото.
   Оставьте `img: null`, чтобы сохранить прежний вид (градиент + логотип).
   Пример: img:"https://example.com/ps-store-card.jpg" */
const giftCatalogs = {
  psstore: {
    title:"PS Store", logo:"🎮", img:"images/psstore/logo.jpg",
    label:"Выберите номинал карты PS Store. Код придёт после оплаты — активируйте его в аккаунте выбранного региона.",
    countries:[
      {code:"TR", name:"Турция", label:"Покупайте карты PS Store для Турецкого региона и закупайтесь эксклюзивами на PS4 и PS5. Активация только на аккаунте региона Турция. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем приятно провести время за новой игрой!",
items:[
        {region:"TRY", amount:"250", price:499, old:573,img:"images/psstore/try/250.png", name:"Карта PS Store 250 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#B01E0A)"},
        {region:"TRY", amount:"500", price:999, old:1132,img:"images/psstore/try/500.png", name:"Карта PS Store 500 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#B01E0A)"},
        {region:"TRY", amount:"750", price:1490, old:1698,img:"images/psstore/try/750.png", name:"Карта PS Store 750 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#B01E0A)"},
        {region:"TRY", amount:"1000", price:1990, old:2264,img:"images/psstore/try/1000.png", name:"Карта PS Store 1000 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#B01E0A)"},
        {region:"TRY", amount:"1500", price:2990, old:3396,img:"images/psstore/try/1500.png", name:"Карта PS Store 1500 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#B01E0A)"},
        {region:"TRY", amount:"2000", price:3990, old:4528,img:"images/psstore/try/2000.png", name:"Карта PS Store 2000 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#B01E0A)"},
        {region:"TRY", amount:"2500", price:4990, old:5660,img:"images/psstore/try/2500.png", name:"Карта PS Store 2500 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#B01E0A)"},
        {region:"TRY", amount:"3000", price:5990, old:6792,img:"images/psstore/try/3000.png", name:"Карта PS Store 3000 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#B01E0A)"},
        {region:"TRY", amount:"4000", price:7790, old:9056,img:"images/psstore/try/4000.png", name:"Карта PS Store 4000 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#B01E0A)"},
        {region:"TRY", amount:"5000", price:9749, old:11320,img:"images/psstore/try/5000.png", name:"Карта PS Store 5000 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#B01E0A)"},
      ]},
      {code:"IN", name:"Индия", label:"Покупайте карты PS Store для региона Индия и закупайтесь топовыми играми на PS4 и PS5. Активация только на аккаунте региона Индия. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем удачной игры!",
items:[
        {region:"INR", amount:"1000", price:1189, old:1275,img:"images/psstore/inr/1000.png", name:"Карта PS Store 1000 INR (Индия)", grad:"linear-gradient(160deg,#E8A02E,#B0640A)"},
        {region:"INR", amount:"2000", price:2379, old:2550,img:"images/psstore/inr/2000.png", name:"Карта PS Store 2000 INR (Индия)", grad:"linear-gradient(160deg,#E8A02E,#B0640A)"},
        {region:"INR", amount:"3000", price:3559, old:3825,img:"images/psstore/inr/3000.png", name:"Карта PS Store 3000 INR (Индия)", grad:"linear-gradient(160deg,#E8A02E,#B0640A)"},
        {region:"INR", amount:"4000", price:4719, old:5100,img:"images/psstore/inr/4000.png", name:"Карта PS Store 4000 INR (Индия)", grad:"linear-gradient(160deg,#E8A02E,#B0640A)"},
        {region:"INR", amount:"5000", price:5990, old:6375,img:"images/psstore/inr/5000.png", name:"Карта PS Store 5000 INR (Индия)", grad:"linear-gradient(160deg,#E8A02E,#B0640A)"},
        {region:"INR", amount:"7000", price:8449, old:8925,img:"images/psstore/inr/7000.png", name:"Карта PS Store 7000 INR (Индия)", grad:"linear-gradient(160deg,#E8A02E,#B0640A)"},
        {region:"INR", amount:"8000", price:9549, old:10200,img:"images/psstore/inr/8000.png", name:"Карта PS Store 8000 INR (Индия)", grad:"linear-gradient(160deg,#E8A02E,#B0640A)"},
      ]},
      {code:"US", name:"США", label:"Покупайте карты PS Store для региона США и закупайтесь играми на PS4 и PS5. Активация только на аккаунте региона США. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем приятной игры!",
items:[
        {region:"USD", amount:"1", price:92, old:92,img:"images/psstore/usa/1.png", name:"Карта PS Store 1 USD (США)", grad:"linear-gradient(160deg,#2E9FE8,#0A5FB0)"},
        {region:"USD", amount:"2 USD", price:179, old:184,img:"images/psstore/usa/2.png", name:"Карта PS Store 2 USD (США)", grad:"linear-gradient(160deg,#2E9FE8,#0A5FB0)"},
        {region:"USD", amount:"5", price:449, old:460,img:"images/psstore/usa/5.png", name:"Карта PS Store 5 USD (США)", grad:"linear-gradient(160deg,#2E9FE8,#0A5FB0)"},
        {region:"USD", amount:"10", price:829, old:920,img:"images/psstore/usa/10.png", name:"Карта PS Store 10 USD (США)", grad:"linear-gradient(160deg,#2E9FE8,#0A5FB0)"},
        {region:"USD", amount:"25", price:2049, old:2300,img:"images/psstore/usa/25.png", name:"Карта PS Store 25 USD (США)", grad:"linear-gradient(160deg,#2E9FE8,#0A5FB0)"},
        {region:"USD", amount:"50", price:4099, old:4600,img:"images/psstore/usa/50.png", name:"Карта PS Store 50 USD (США)", grad:"linear-gradient(160deg,#2E9FE8,#0A5FB0)"},
        {region:"USD", amount:"75", price:6290, old:6900,img:"images/psstore/usa/75.png", name:"Карта PS Store 75 USD (США)", grad:"linear-gradient(160deg,#2E9FE8,#0A5FB0)"},
        {region:"USD", amount:"100", price:8290, old:9200,img:"images/psstore/usa/100.png", name:"Карта PS Store 100 USD (США)", grad:"linear-gradient(160deg,#2E9FE8,#0A5FB0)"},
        {region:"USD", amount:"150", price:12490, old:13800,img:"images/psstore/usa/150.png", name:"Карта PS Store 150 USD (США)", grad:"linear-gradient(160deg,#2E9FE8,#0A5FB0)"},
        {region:"USD", amount:"200", price:16290, old:18400,img:"images/psstore/usa/200.png", name:"Карта PS Store 200 USD (США)", grad:"linear-gradient(160deg,#2E9FE8,#0A5FB0)"},
      ]},
      {code:"PL", name:"Польша", label:"Покупайте карты PS Store для региона Польша и наслаждайтесь играми на PS4 и PS5. Активация только на аккаунте региона Польша. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем классно провести время!",
items:[
        {region:"PLN", amount:"50", price:1219, old:1292,img:"images/psstore/pln/50.png", name:"Карта PS Store 50 PLN (Польша)", grad:"linear-gradient(160deg,#E82E7B,#8A0A4A)"},
        {region:"PLN", amount:"100", price:2449, old:2585,img:"images/psstore/pln/100.png", name:"Карта PS Store 100 PLN (Польша)", grad:"linear-gradient(160deg,#E82E7B,#8A0A4A)"},
        {region:"PLN", amount:"200", price:4979, old:5170,img:"images/psstore/pln/200.png", name:"Карта PS Store 200 PLN (Польша)", grad:"linear-gradient(160deg,#E82E7B,#8A0A4A)"},
        {region:"PLN", amount:"300", price:7349, old:7755,img:"images/psstore/pln/300.png", name:"Карта PS Store 300 PLN (Польша)", grad:"linear-gradient(160deg,#E82E7B,#8A0A4A)"},
        {region:"PLN", amount:"500", price:12249, old:12925,img:"images/psstore/pln/500.png", name:"Карта PS Store 500 PLN (Польша)", grad:"linear-gradient(160deg,#E82E7B,#8A0A4A)"},
      ]}
    ]
  },
  appleid: {
    title:"Подарочные карты Apple", logo:"", img:"images/apple/logo.jpg", label:"Подарочные карты Apple",
    countries:[
      {code:"TR", name:"Турция", label:"Покупайте подарочные карты Apple ID Турция и закупайтесь по низким ценам в AppStore и iTunes. Активация только на аккаунте региона Турция. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем удачных покупок!",
items:[
        {region:"TRY", amount:"10", price:27, old:23,img:"images/apple/try/10.png", name:"Apple Gift Card 10 TRY (Турция)", grad:"linear-gradient(160deg,#3A3A3A,#0E0E0E)"},
        {region:"TRY", amount:"25", price:68, old:57,img:"images/apple/try/25.png", name:"Apple Gift Card 25 TRY (Турция)", grad:"linear-gradient(160deg,#3A3A3A,#0E0E0E)"},
        {region:"TRY", amount:"50", price:139, old:113,img:"images/apple/try/50.png", name:"Apple Gift Card 50 TRY (Турция)", grad:"linear-gradient(160deg,#3A3A3A,#0E0E0E)"},
        {region:"TRY", amount:"100", price:199, old:226,img:"images/apple/try/100.png", name:"Apple Gift Card 100 TRY (Турция)", grad:"linear-gradient(160deg,#3A3A3A,#0E0E0E)"},
        {region:"TRY", amount:"250", price:499, old:566,img:"images/apple/try/250.png", name:"Apple Gift Card 250 TRY (Турция)", grad:"linear-gradient(160deg,#3A3A3A,#0E0E0E)"},
        {region:"TRY", amount:"500", price:1049, old:1132,img:"images/apple/try/500.png", name:"Apple Gift Card 500 TRY (Турция)", grad:"linear-gradient(160deg,#3A3A3A,#0E0E0E)"},
        {region:"TRY", amount:"1000", price:2089, old:2264,img:"images/apple/try/1000.png", name:"Apple Gift Card 1000 TRY (Турция)", grad:"linear-gradient(160deg,#3A3A3A,#0E0E0E)"},
        {region:"TRY", amount:"1250", price:2590, old:2830,img:"images/apple/try/1250.png", name:"Apple Gift Card 1250 TRY (Турция)", grad:"linear-gradient(160deg,#3A3A3A,#0E0E0E)"},
        {region:"TRY", amount:"1500", price:2990, old:3396,img:"images/apple/try/1500.png", name:"Apple Gift Card 1500 TRY (Турция)", grad:"linear-gradient(160deg,#3A3A3A,#0E0E0E)"},
        {region:"TRY", amount:"1750", price:3590, old:3962,img:"images/apple/try/1750.png", name:"Apple Gift Card 1750 TRY (Турция)", grad:"linear-gradient(160deg,#3A3A3A,#0E0E0E)"},
        {region:"TRY", amount:"2000", price:4090, old:4528,img:"images/apple/try/2000.png", name:"Apple Gift Card 2000 TRY (Турция)", grad:"linear-gradient(160deg,#3A3A3A,#0E0E0E)"},
      ]},
      {code:"US", name:"США", label:"Покупайте подарочные карты Apple ID США и закупайтесь эксклюзивами в AppStore и iTunes. Активация только на аккаунте региона США. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем приятных покупок!",
items:[
        {region:"USD", amount:"2", price:179, old:174,img:"images/apple/usa/2.png", name:"Apple Gift Card 2 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"3", price:279, old:261,img:"images/apple/usa/3.png", name:"Apple Gift Card 3 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"5", price:459, old:435,img:"images/apple/usa/5.png", name:"Apple Gift Card 5 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"10", price:929, old:870,img:"images/apple/usa/10.png", name:"Apple Gift Card 10 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"15", price:1390, old:1305,img:"images/apple/usa/15.png", name:"Apple Gift Card 15 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"20", price:1819, old:1740,img:"images/apple/usa/20.png", name:"Apple Gift Card 20 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"25", price:2290, old:2175,img:"images/apple/usa/25.png", name:"Apple Gift Card 25 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"30", price:2749, old:2610,img:"images/apple/usa/30.png", name:"Apple Gift Card 30 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"35", price:3190, old:3045,img:"images/apple/usa/35.png", name:"Apple Gift Card 35 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"40", price:3690, old:3480,img:"images/apple/usa/40.png", name:"Apple Gift Card 40 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"50", price:4590, old:4350,img:"images/apple/usa/50.png", name:"Apple Gift Card 50 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"60", price:5490, old:5220,img:"images/apple/usa/60.png", name:"Apple Gift Card 60 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"70", price:6390, old:6090,img:"images/apple/usa/70.png", name:"Apple Gift Card 70 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"100", price:9190, old:8700,img:"images/apple/usa/100.png", name:"Apple Gift Card 100 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
        {region:"USD", amount:"150", price:13990, old:13050,img:"images/apple/usa/150.png", name:"Apple Gift Card 150 USD (США)", grad:"linear-gradient(160deg,#565656,#161616)"},
      ]}
    ]
  },
  battlenet: {
    title:"Карты пополнения Battle.net", logo:"❄️", img:"images/battlenet/logo.png",
    label:"Пополняйте свой аккаунт battle.net по лучшим ценам. Миры Blizzard уже ждут именно Вас! Проверьте регион перед покупкой. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем приятной игры!",
    items:[
      {region:"EU", amount:"20€", price:945.20, old:1010,img:"images/battlenet/20.png", name:"Battle.net Balance 20 EUR (EU)", grad:"linear-gradient(160deg,#2E7BE8,#0A3C8A)"},
      {region:"EU", amount:"50€", price:1868.40, old:2000,img:"images/battlenet/50.png", name:"Battle.net Balance 50 EUR (EU)", grad:"linear-gradient(160deg,#2E7BE8,#0A3C8A)"},
      {region:"EU", amount:"100€", price:4610.00, old:4930,img:"images/battlenet/100.png", name:"Battle.net Balance 100 EUR (EU)", grad:"linear-gradient(160deg,#2E7BE8,#0A3C8A)"},
      {region:"US", amount:"5$", price:1622.40, old:1730,img:"images/battlenet/usd/5.png", name:"Battle.net Balance 5 USD (США)", grad:"linear-gradient(160deg,#4A4AC0,#181870)"},
      {region:"US", amount:"20$", price:3995.00, old:4260,img:"images/battlenet/usd/20.png", name:"Battle.net Balance 20 USD (США)", grad:"linear-gradient(160deg,#4A4AC0,#181870)"},
      {region:"US", amount:"50$", price:3995.00, old:4260,img:"images/battlenet/usd/50.png", name:"Battle.net Balance 50 USD (США)", grad:"linear-gradient(160deg,#4A4AC0,#181870)"},
    ]
  },
  tgstars: {
    title:"Telegram", logo:"⭐️", img:"images/telegram/logo.png",
    label:"Выберите Stars или подписку Telegram Premium.",
    countries:[
      {code:"STARS", name:"Stars", label:"Выберите количество Telegram Stars. Звёзды придут на ваш аккаунт после оплаты на Ваш указанный @username.", items:[
        {region:"Stars", amount:"50", price:89.00, old:99, name:"Telegram Stars 50 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
        {region:"Stars", amount:"75", price:89.00, old:99, name:"Telegram Stars 75 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
        {region:"Stars", amount:"100", price:169.00, old:189, name:"Telegram Stars 100 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
        {region:"Stars", amount:"150", price:89.00, old:99, name:"Telegram Stars 150 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
        {region:"Stars", amount:"250", price:399.00, old:449, name:"Telegram Stars 250 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
        {region:"Stars", amount:"350", price:89.00, old:99, name:"Telegram Stars 350 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
        {region:"Stars", amount:"500", price:769.00, old:869, name:"Telegram Stars 500 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
        {region:"Stars", amount:"750", price:89.00, old:99, name:"Telegram Stars 750 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
        {region:"Stars", amount:"1000", price:1499.00, old:1699, name:"Telegram Stars 1000 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
        {region:"Stars", amount:"1500", price:89.00, old:99, name:"Telegram Stars 1500 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
        {region:"Stars", amount:"2500", price:3599.00, old:4099, name:"Telegram Stars 2500 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
        {region:"Stars", amount:"5000", price:89.00, old:99, name:"Telegram Stars 5000 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
        {region:"Stars", amount:"10000", price:89.00, old:99, name:"Telegram Stars 10000 ⭐️", grad:"linear-gradient(160deg,#3AA1E8,#0A5FB0)"},
      ]},
      {code:"PREM", name:"Premium", label:"Выберите срок подписки Telegram Premium. После оплаты подписка активируется на указанном аккаунте.", items:[
        {region:"Premium", amount:"3 месяца", price:799, old:949,img:"images/telegram/prem/3.jpg", name:"Telegram Premium — 3 месяца", grad:"linear-gradient(160deg,#7B5CFF,#3A1FB0)"},
        {region:"Premium", amount:"6 месяцев", price:1490, old:1790,img:"images/telegram/prem/3.jpg", name:"Telegram Premium — 6 месяцев", grad:"linear-gradient(160deg,#7B5CFF,#3A1FB0)"},
        {region:"Premium", amount:"12 месяцев", price:2490, old:2990,img:"images/telegram/prem/3.jpg", name:"Telegram Premium — 12 месяцев", grad:"linear-gradient(160deg,#7B5CFF,#3A1FB0)"},
      ]}
    ]
  },
  nintendo: {
    title:"Карты пополнения Nintendo eShop", logo:"🎮", img:"images/nintendo/logo.png",
    label:"Покупайте подарочные карты nintendo и врывайтесь в уникальный мир nintendo с множеством эксклюзивных игр. Карты для региона США. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем приятно провести время за любимыми играми!",
    countries:[
      {code:"US", name:"США", label:"Покупайте подарочные карты nintendo и врывайтесь в уникальный мир nintendo с множеством эксклюзивных игр. Карты для региона США. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем приятно провести время за любимыми играми!", items:[
        {region:"US", amount:"10 USD", price:829, old:920,img: "images/nintendo/10.png", name:"Nintendo eShop 10 USD (США)", grad:"linear-gradient(160deg,#E60012,#8B0000)"},
        {region:"US", amount:"20 USD", price:1649, old:1840,img:"images/nintendo/20.png", name:"Nintendo eShop 20 USD (США)", grad:"linear-gradient(160deg,#E60012,#8B0000)"},
        {region:"US", amount:"50 USD", price:4099, old:4600,img: "images/nintendo/50.png", name:"Nintendo eShop 50 USD (США)", grad:"linear-gradient(160deg,#E60012,#8B0000)"},
        {region:"US", amount:"3 мес", price:5690, old:6440,img:"images/nintendo/3m.png", name:"Nintendo Switch Online - 3 Месяца (США)", grad:"linear-gradient(160deg,#E60012,#8B0000)"},
      ]},
    ]
  },
  xboxgiftcard: {
    title:"Xbox Gift Card", logo:"🎮", img:"images/xbox/logo.png",
    label:"Выберите номинал подарочной карты Xbox нужного региона. Код придёт после оплаты — активируйте его в аккаунте выбранного региона.",
    countries:[
      {code:"US", name:"США", label:"Покупайте подарочные карты Xbox для региона США и пополняйте баланс Microsoft Store для игр и подписок Game Pass. Активация только на аккаунте региона США. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем приятной игры!",
items:[
        {region:"USD", amount:"1", price:929, old:1030,name:"Xbox Gift Card 1 USD (США)", grad:"linear-gradient(160deg,#3EA836,#0E4A0E)",img: "images/xbox/usa/1.png",},
        {region:"USD", amount:"5", price:1379, old:1545,name:"Xbox Gift Card 5 USD (США)", grad:"linear-gradient(160deg,#3EA836,#0E4A0E)",img: "images/xbox/usa/5.png",},
        {region:"USD", amount:"10", price:2290, old:2575,name:"Xbox Gift Card 10 USD (США)", grad:"linear-gradient(160deg,#3EA836,#0E4A0E)",img: "images/xbox/usa/10.png",},
        {region:"USD", amount:"25", price:4590, old:5150,name:"Xbox Gift Card 25 USD (США)", grad:"linear-gradient(160deg,#3EA836,#0E4A0E)",img: "images/xbox/usa/25.png",},
        {region:"USD", amount:"50", price:9190, old:10300,name:"Xbox Gift Card 50 USD (США)", grad:"linear-gradient(160deg,#3EA836,#0E4A0E)",img: "images/xbox/usa/50.png",},
      ]},
      {code:"TR", name:"Турция", label:"Покупайте подарочные карты Xbox для региона Турция по выгодному курсу. Активация только на аккаунте региона Турция. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем удачных покупок!",
items:[
        {region:"TRY", amount:"25", price:249, old:283,name:"Xbox Gift Card 25 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#8A1E0A)",img: "images/xbox/try/25.png",},
        {region:"TRY", amount:"50", price:589, old:665,name:"Xbox Gift Card 50 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#8A1E0A)",img: "images/xbox/try/50.png",},
        {region:"TRY", amount:"100", price:1149, old:1298,name:"Xbox Gift Card 100 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#8A1E0A)",img: "images/xbox/try/100.png",},
        {region:"TRY", amount:"300", price:2249, old:2544,name:"Xbox Gift Card 300 TRY (Турция)", grad:"linear-gradient(160deg,#E8502E,#8A1E0A)",img: "images/xbox/try/300.png",},
      ]},
      {code:"PL", name:"Польша", label:"Покупайте подарочные карты Xbox для региона Польша и пополняйте баланс Microsoft Store. Активация только на аккаунте региона Польша. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем классно провести время!",
items:[
        {region:"PLN", amount:"20", price:1229, old:1300,name:"Xbox Gift Card 20 PLN (Польша)", grad:"linear-gradient(160deg,#2E9FE8,#0A3C8A)",img: "images/xbox/pln/20.png",},
        {region:"PLN", amount:"50", price:2449, old:2600,name:"Xbox Gift Card 50 PLN (Польша)", grad:"linear-gradient(160deg,#2E9FE8,#0A3C8A)",img: "images/xbox/pln/50.png",},
        {region:"PLN", amount:"70", price:4879, old:5200,name:"Xbox Gift Card 70 PLN (Польша)", grad:"linear-gradient(160deg,#2E9FE8,#0A3C8A)",img: "images/xbox/pln/70.png",},
        {region:"PLN", amount:"100", price:7290, old:7800,name:"Xbox Gift Card 100 PLN (Польша)", grad:"linear-gradient(160deg,#2E9FE8,#0A3C8A)",img: "images/xbox/pln/100.png",},
  {region:"PLN", amount:"200", price:7290, old:7800,name:"Xbox Gift Card 200 PLN (Польша)", grad:"linear-gradient(160deg,#2E9FE8,#0A3C8A)",img: "images/xbox/pln/200.png",},
      ]},
    ]
  },
  googleplay: {
    title:"Google Play", logo:"▶️", img:"images/gplay/logo.png",
    label:"Выберите номинал подарочной карты Google Play нужного региона. Код придёт после оплаты — активируйте его в аккаунте выбранного региона.",
    countries:[
      {code:"US", name:"Америка (USD)", label:"Покупайте подарочные карты Google Play для региона США и пополняйте баланс для игр, приложений и подписок. Активация только на аккаунте региона США. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем приятных покупок!",
items:[
  {region:"USD", amount:"5", price:929, old:1030,name:"Google Play Gift Card 5 USD (США)", grad:"linear-gradient(160deg,#3EBEEB,#0A5FB0)",img: "images/gplay/usa/5.png",},
        {region:"USD", amount:"10", price:929, old:1030,name:"Google Play Gift Card 10 USD (США)", grad:"linear-gradient(160deg,#3EBEEB,#0A5FB0)",img: "images/gplay/usa/10.png",},
        {region:"USD", amount:"15", price:1379, old:1545,name:"Google Play Gift Card 15 USD (США)", grad:"linear-gradient(160deg,#3EBEEB,#0A5FB0)",img: "images/gplay/usa/15.png",},
        {region:"USD", amount:"25", price:2290, old:2575,name:"Google Play Gift Card 25 USD (США)", grad:"linear-gradient(160deg,#3EBEEB,#0A5FB0)",img: "images/gplay/usa/25.png",},
        {region:"USD", amount:"50", price:4590, old:5150,name:"Google Play Gift Card 50 USD (США)", grad:"linear-gradient(160deg,#3EBEEB,#0A5FB0)",img: "images/gplay/usa/50.png",},
      ]},
      {code:"TR", name:"Турция (TRY/TL)", label:"Покупайте подарочные карты Google Play для региона Турция по выгодному курсу. Активация только на аккаунте региона Турция. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем удачных покупок!",
items:[
   {region:"TRY", amount:"25", price:249, old:283,name:"Google Play Gift Card 25 TRY (Турция)", grad:"linear-gradient(160deg,#F4B400,#B07800)",img: "images/gplay/try/25.png",},
   {region:"TRY", amount:"50", price:249, old:283,name:"Google Play Gift Card 50 TRY (Турция)", grad:"linear-gradient(160deg,#F4B400,#B07800)",img: "images/gplay/try/50.png",},
        {region:"TRY", amount:"100", price:249, old:283,name:"Google Play Gift Card 100 TRY (Турция)", grad:"linear-gradient(160deg,#F4B400,#B07800)",img: "images/gplay/try/100.png",},
        {region:"TRY", amount:"250", price:589, old:665,name:"Google Play Gift Card 250 TRY (Турция)", grad:"linear-gradient(160deg,#F4B400,#B07800)",img: "images/gplay/try/250.png",},
        {region:"TRY", amount:"500", price:1149, old:1298,name:"Google Play Gift Card 500 TRY (Турция)", grad:"linear-gradient(160deg,#F4B400,#B07800)",img: "images/gplay/try/500.png",},
      ]},
    ]
  }
};


/* ---------- Orders / "Мои покупки" ----------
   Каждый оформленный заказ (из корзины, доната, пополнения или Telegram
   Stars) попадает сюда со статусом "processing". Через некоторое время
   (имитация проверки поступления оплаты) статус меняется на "paid", и
   вместе с этим для каждой позиции показываются коды/ключи — если
   куплено несколько штук одного товара, кодов будет столько же, и
   каждый выводится отдельной строкой. Если пользователь в этот момент
   смотрит на список покупок — он перерисовывается сам. */
let orders = [];
let orderIdSeq = 1001;

function createOrder(items,totalLabel,email,payMethod){return window.checkoutOrder(items,totalLabel,email,payMethod);}

function formatOrderDate(d){
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${dd}.${mm} · ${hh}:${mi}`;
}

function renderPurchases(){
  const list = document.getElementById("purchases-list");
  if(orders.length === 0){
    list.innerHTML = `<div class="empty" style="padding:60px 20px;">
      <div class="empty-title">Пока нет покупок</div>
      <div class="empty-sub">Оформите заказ — он появится здесь со статусом обработки оплаты.</div>
      <button class="empty-btn" onclick="hideSubView()">Открыть каталог</button>
    </div>`;
    return;
  }
  list.innerHTML = orders.map(o=>{
    const statusHtml = o.status === "processing"
      ? `<div class="po-status processing"><span class="po-dot"></span>Обработка</div>`
      : `<div class="po-status paid">✓ Оплачено</div>`;
    const noteHtml = o.status === "processing"
      ? `<div class="po-note">Проверяем поступление оплаты — обычно занимает пару минут.</div>`
      : `<div class="po-note paid">Оплата подтверждена. По вопросам — <a href="https://t.me/metrapayhelp" target="_blank" rel="noopener" class="po-support-link">обращаться в поддержку</a>.</div>`;
    const itemsHtml = o.items.map((it, itemIdx)=>{
      const codesId = `po-codes-${o.id}-${itemIdx}`;
      const hasMultiple = it.codes && it.codes.length > 1;
      const codesInner = (it.codes || []).map((code,i)=>{
        const denomLabel = it.codeLabels && it.codeLabels[i] ? `<div class="po-code-denom">${it.codeLabels[i]}</div>` : "";
        const numLabel = (!it.codeLabels && hasMultiple) ? `<span class="po-code-num">${i+1}.</span> ` : "";
        const copyLabel = it.codeLabels ? "" : "Копировать";
        return `
        ${denomLabel}
        <div class="po-code-row">
          <span class="po-code-text">${numLabel}${code}</span>
          <button class="po-code-copy" data-code="${code}" aria-label="Копировать код">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            ${copyLabel}
          </button>
        </div>`;
      }).join("");

      const codesHtml = (o.status === "paid" && it.codes && it.codes.length)
        ? (hasMultiple
            ? `<div class="po-codes">
                <button type="button" class="po-codes-toggle" data-codes-target="${codesId}">
                  <span class="po-codes-label">Ваши коды (${it.codes.length})</span>
                  <svg class="po-codes-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="po-codes-list" id="${codesId}" style="display:none;">${codesInner}</div>
              </div>`
            : `<div class="po-codes">
                <div class="po-codes-label">Ваш код</div>
                ${codesInner}
              </div>`)
        : "";
      return `
      <div class="po-item">
        <div class="po-item-row">
          <div class="po-item-cover" style="background:${it.img ? `url('${it.img}') center/cover no-repeat` : (it.grad || "var(--card-2)")};"></div>
          <div class="po-item-name">${it.name}${it.qty>1 ? `<span class="po-item-qty">× ${it.qty}</span>` : ""}</div>
          <div class="po-item-price">${it.price}</div>
        </div>
        ${codesHtml}
      </div>`;
    }).join("");
    return `<div class="po-card">
      <div class="po-head">
        <div>
          <div class="po-id">Заказ #${o.id}</div>
          <div class="po-date">${formatOrderDate(o.date)}</div>
        </div>
        ${statusHtml}
      </div>
      ${itemsHtml}
      <div class="po-foot">
        <div class="po-foot-label">Итого</div>
        <div class="po-foot-total">${o.total}</div>
      </div>
      ${noteHtml}
    </div>`;
  }).join("");

  list.querySelectorAll(".po-code-copy").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const code = btn.dataset.code;
      const done = ()=>{
        const original = btn.innerHTML;
        btn.classList.add("copied");
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 6"/></svg>Скопировано`;
        setTimeout(()=>{
          btn.classList.remove("copied");
          btn.innerHTML = original;
        }, 1500);
      };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(code).then(done).catch(done);
      } else {
        done();
      }
    });
  });

  list.querySelectorAll(".po-codes-toggle").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const target = document.getElementById(btn.dataset.codesTarget);
      if(!target) return;
      const isOpen = target.style.display !== "none";
      target.style.display = isOpen ? "none" : "flex";
      btn.classList.toggle("open", !isOpen);
    });
  });
}

document.getElementById("purchases-row").addEventListener("click", ()=>{
  renderPurchases();
  showSubView("view-purchases");
});
document.getElementById("purchases-back").addEventListener("click", ()=> goBack());

function priceToNumber(str){
  if(typeof str !== "string") return Number(str) || 0;
  // Russian formatting uses a space as thousands separator and a comma as decimal separator.
  // Strip spaces/currency symbols, then convert the decimal comma to a dot before parsing,
  // so "503,74 ₽" becomes 503.74 instead of being read as 50374.
  const cleaned = str.replace(/\s|₽/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function showToast(text){
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = "position:fixed; left:50%; bottom:90px; transform:translateX(-50%); background:var(--green,#17A876); color:#0A0F1C; padding:10px 18px; border-radius:30px; font-size:13px; font-weight:700; z-index:999; box-shadow:0 6px 18px rgba(0,0,0,.4);";
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 1600);
}

/* ---------- Top-up (donate) ----------
   Чтобы добавить фото товара:
   - `img` на уровне сервиса — фото для карточки на главной и для страницы
     оплаты, показывается по умолчанию для всех его пакетов;
   - `img` внутри конкретного пакета в `packages` — переопределяет фото
     сервиса именно для этого номинала (подкатегории на странице пополнения).
   Если `img` не задан — остаётся прежний вид (градиент + эмодзи-иконка).

   `idHelp:{img:"...", text:"..."}` — необязательное поле. Если заполнено,
   рядом с подписью ID на странице оплаты появляется кружок "?", по нажатию
   на который открывается подсказка (картинка сверху + текст снизу + кнопка
   "Закрыть"). img — путь до картинки (как везде выше), text — обычный текст
   подсказки. Если оставить оба поля пустыми — кружок "?" просто не покажется. */
const donateServices = {
  pubg: {
    name:"PUBG Mobile", grad:"linear-gradient(135deg,#3A1414,#1E0A0A)", icon:"🪖", idLabel:"UID",
    idHelp:{img:"images/pubg/help.png", text:"Откройте PUBG Mobile, зайдите в профиль и скопируйте Ваш UID, он нужен для доставки монет. Проверьте все данные, чтобы не было ошибок. Удачной покупки!"},
    pkgLabel:{direct:"Быстрое пополнение UC по UID по самым низким ценам. Пополнение происходит автоматически в течении 5-10 минут. Желаем удачной игры!", codes:"Быстрое пополнение WOW Coins для Пабг Мобайл по UID. Пополнение происходит автоматически в течении 5-10 минут. Желаем приятной игры!"},
    img:"images/pubg/pre.jpg",
    // UC Coins — прямое зачисление по UID.
    packages:[
      {name:"60 UC", price:140, old:169, img:"images/pubg/60uc.jpeg"},
      {name:"300 + 25 UC", price:489, old:549, img:"images/pubg/325.jpeg"},
      {name:"600 + 60 UC", price:945, old:1080, img:"images/pubg/660.jpeg"},
      {name:"1500 + 300 UC", price:2390, old:2790, img:"images/pubg/1800.jpeg"},
      {name:"3000 + 850 UC", price:2390, old:2790, img:"images/pubg/3850.jpeg"},
      {name:"6000 + 2100 UC", price:2390, old:2790, img:"images/pubg/8100.jpeg"},
      {name:"12000 + 4200 UC", price:2390, old:2790, img:"images/pubg/16200.jpeg"},
      {name:"18000 + 6300 UC", price:2390, old:2790, img:"images/pubg/24300.jpeg"},
      {name:"24000 + 8400 UC", price:2390, old:2790, img:"images/pubg/32400.jpeg"},
      {name:"30000 + 10500 UC", price:2390, old:2790, img:"images/pubg/40500.jpeg"},
    ],
    // WOW Coins — коды, зачисляются в «Мои покупки». Раньше жили отдельно в
    // giftCatalogs.pubgcodes; перенесены сюда, рядом с UC Coins, так как это
    // один и тот же сервис (PUBG Mobile), просто второй способ пополнения.
    codesCatalog:{
      title:"PUBG Mobile (WOW Coins)", logo:"🪖",
      label:"Выберите количество UC. Пополнение проходит по UID в течение 5-10 минут после оплаты.",
      items:[
        {region:"WOW", amount:"60", price:141.00, old:150, img:"images/pubg/wow/60.png", name:"60 WOW Coins", grad:"linear-gradient(160deg,#E8502E,#8A1E0A)"},
        {region:"WOW", amount:"325", price:459.66, old:489, img:"images/pubg/wow/325.png", name:"300 + 25 WOW Coins", grad:"linear-gradient(160deg,#E8502E,#8A1E0A)"},
        {region:"WOW", amount:"660", price:888.30, old:945, img:"images/pubg/wow/660.png", name:"600 + 60 WOW Coins", grad:"linear-gradient(160deg,#E8502E,#8A1E0A)"},
        {region:"WOW", amount:"1800", price:2246.60, old:2390, img:"images/pubg/wow/1800.png", name:"1500 + 300 WOW Coins", grad:"linear-gradient(160deg,#E8502E,#8A1E0A)"},
        {region:"WOW", amount:"3850", price:4593.30, old:4885, img:"images/pubg/wow/3850.png", name:"3000 + 850 WOW Coins", grad:"linear-gradient(160deg,#E8502E,#8A1E0A)"},
        {region:"WOW", amount:"8100", price:9354.40, old:9950, img:"images/pubg/wow/8100.png", name:"6000 + 2100 WOW Coins", grad:"linear-gradient(160deg,#E8502E,#8A1E0A)"},
        ]
    }
  },
  mlbb: {
    name:"Mobile Legends: Bang Bang", grad:"linear-gradient(135deg,#4B4E9E,#2E3070)", icon:"🛡️",
    idLabel:"User ID", idPattern:/^\d+$/, idErrorText:"User ID — только цифры",
    idHelp:{img:"images/mlbb/help.png", text:"Откройте Mobile Legends, нажмите на аватар в левом верхнем углу — там будут указаны User ID и (Zone ID в скобках). Сюда введите Ваш User ID, подсказка на фото. Удачной покупки!"},
    zoneIdLabel:"Zone ID", zoneIdPattern:/^\d+$/, zoneIdErrorText:"Zone ID — только цифры",
    zoneIdHelp:{img:"images/mlbb/help.png", text:"Zone ID — это цифры в скобках рядом с User ID в профиле игры. Сюда введите Ваш Zone ID, подсказка на фото. Удачной покупки!"},
    pkgLabel:"Покупайте алмазы Мобайл Легендс, стильные скины уже ждут Вас. Пополнение по Player ID и Zone ID — никакие данные не нужны. Пополнение в течении 5 минут. Покупай и наслаждайся. Желаем удачной игры!",
    img:"images/mlbb/mbl.jpg",
    packages:[
      {name:"Недельный пропуск", displayName:"<span class=\"topup-grid-main\">Недельный пропуск</span><span class=\"topup-grid-region\">РОССИЯ</span>", price:3190, old:3650, img:"images/mlbb/week.jpg",
   info:"В состав Недельного пропуска входит: сразу получаете 80 алмазов и карту позднего входа(позволяет забрать награду за 1 пропущенный день). Затем в течении 7 дней (включая день покупки): 20 алмазов при ежедневном входе в игру, 30 звездных очков и набор выбора алмазного пропуска.\nВнимание: для покупки нужно получить 5-й уровень или выше. Пропуск можно приобрести до 10 раз, что соответствует максимуму 70 дней подписки."},
      {name:"35 алмазов", displayName:"<span class=\"topup-grid-main\">32 + 3 алмаза<span class=\"emoji\">💎</span></span><span class=\"topup-grid-region\">РОССИЯ</span>", price:150, old:169, img:"images/mlbb/150.jpg"},
      {name:"55 алмазов", displayName:"<span class=\"topup-grid-main\">50 + 5 алмазов<span class=\"emoji\">💎</span></span><span class=\"topup-grid-region\">РОССИЯ</span>", price:295, old:335, img:"images/mlbb/150.jpg"},
      {name:"165 алмазов", displayName:"<span class=\"topup-grid-main\">150 + 15 алмазов<span class=\"emoji\">💎</span></span><span class=\"topup-grid-region\">РОССИЯ</span>", price:1090, old:1240, img:"images/mlbb/150.jpg"},
      {name:"275 алмазов", displayName:"<span class=\"topup-grid-main\">250 + 25 алмазов<span class=\"emoji\">💎</span></span><span class=\"topup-grid-region\">РОССИЯ</span>", price:3190, old:3650, img:"images/mlbb/250.jpg"},
      {name:"565 алмазов", displayName:"<span class=\"topup-grid-main\">500 + 65 алмазов<span class=\"emoji\">💎</span></span><span class=\"topup-grid-region\">РОССИЯ</span>", price:3190, old:3650, img:"images/mlbb/1500.jpg"},
      {name:"1765 алмазов", displayName:"<span class=\"topup-grid-main\">1500 + 265 алмазов<span class=\"emoji\">💎</span></span><span class=\"topup-grid-region\">РОССИЯ</span>", price:3190, old:3650, img:"images/mlbb/1500.jpg"},
      {name:"2975 алмазов", displayName:"<span class=\"topup-grid-main\">2500 + 475 алмазов<span class=\"emoji\">💎</span></span><span class=\"topup-grid-region\">РОССИЯ</span>", price:3190, old:3650, img:"images/mlbb/2500.jpg"},
      {name:"6000 алмазов", displayName:"<span class=\"topup-grid-main\">5000 + 1000 алмазов<span class=\"emoji\">💎</span></span><span class=\"topup-grid-region\">РОССИЯ</span>", price:3190, old:3650, img:"images/mlbb/5000.jpg"},
    ]
  },
  honorkings: {
    name:"Honor of Kings", grad:"linear-gradient(135deg,#3A2A0E,#1E1608)", icon:"🔥",
    idLabel:"Player ID", idPattern:/^\d+$/, idErrorText:"UID — только цифры",
    idHelp:{img:"images/honor/help.png", text:"Введите или скопируйте Ваш ID из игры Honor of Kings. Проверьте все данные, чтобы не было ошибок. Удачной покупки!"},
    pkgLabel:"Покупайте жетоны для Honor of Kings и наслаждайтесь любимой игрой блистая на поле боя. Пополнение проходит по ID, никакие данные не требуются. Пополнение в течении 5-10 минут. Желаем удачной игры!",
    img:"images/honor/logo.png",
    packages:[
      {name:"Недельная карта", displayName:"<span class=\"topup-grid-main\">Недельная карта</span>", price:4590, old:5490, img:"images/honor/week.png",
    info:"Можно купить 1 раз в 7 дней. После покупки сразу получаете: 80 жетонов и талон на 100 жетонов.\n Затем, в течении 7 дней 15 жетонов ежедневно и гарантированный сундук."},
      {name:"Недельная карта плюс", displayName:"<span class=\"topup-grid-main\">Недельная карта плюс</span>", price:4590, old:5490, img:"images/honor/plus.png",
    info:"Можно купить 1 раз в 7 дней. После покупки сразу получаете: 240 жетонов и 200 золотых ваучеров.\n После этого, в течении 7 дней 20 жетонов ежедневно и дополнительные подарки."},
      {name:"16 жетонов", displayName:"<span class=\"topup-grid-main\">16 жетонов", price:99, old:112, img:"images/honor/16.png"},
      {name:"80 жетонов", displayName:"<span class=\"topup-grid-main\">80 жетонов", price:299, old:339, img:"images/honor/80.png"},
      {name:"240 жетонов", displayName:"<span class=\"topup-grid-main\">240 жетонов", price:489, old:559, img:"images/honor/400.png"},
      {name:"400 жетонов", displayName:"<span class=\"topup-grid-main\">400 жетонов", price:945, old:1080, img:"images/honor/400.png"},
      {name:"560 жетонов", displayName:"<span class=\"topup-grid-main\">560 жетонов", price:1890, old:2190, img:"images/honor/800.png"},
      {name:"800 + 30 жетонов", displayName:"<span class=\"topup-grid-main\">800 + 30 жетонов", price:4590, old:5490, img:"images/honor/800.png"},
      {name:"1200 + 45 жетонов", displayName:"<span class=\"topup-grid-main\">1200 + 45 жетонов", price:99, old:112, img:"images/honor/1200.png"},
      {name:"2400 + 108 жетонов", displayName:"<span class=\"topup-grid-main\">2400 + 108 жетонов", price:99, old:112, img:"images/honor/2400.png"},
      {name:"4000 + 180 жетонов", displayName:"<span class=\"topup-grid-main\">4000 + 180 жетонов", price:99, old:112, img:"images/honor/4000.png"},
      {name:"8000 + 360 жетонов", displayName:"<span class=\"topup-grid-main\">8000 + 360 жетонов", price:99, old:112, img:"images/honor/8000.png"},
    ]
  },
  identityv: {
    name:"Identity V", grad:"linear-gradient(135deg,#2A1B3D,#0A0610)", icon:"🎭",img:"images/identity/logo.jpg",
    idLabel:"Ваш ID", idPattern:/^\d+$/, idErrorText:"ID — только цифры",
    idHelp:{img:"images/identity/help.png", text:"Введите или скопируйте ID из Вашего профиля игры Identity V в поле ID. Проверьте все данные, чтобы не было ошибок. Удачной покупки!"},
    serverLabel:"Выберите Ваш сервер", serverOptions:["NA and EU","Asia"],
    pkgLabel:{
      echoes:"БУ! Здесь для Вас Печати по самым низким ценам. Пополнение по ID в течении 5-10 минут. Желаем классно провести время за любимой игрой!",
      packs:"Покупайте наборы и играйте с удовольствием в любимую игру. Пополнение по ID в течении 5-10 минут. Желаем приятной игры, друг!"
    },
    /* variants — вкладки-переключатели прямо на странице пополнения (пакеты
       заданы тут же, аналогично codesCatalog у PUBG). key уходит в
       topupMode, label — подпись таба. */
    variants:[
      {
        key:"echoes", label:"Эхо (печати)",
        packages:[
          {name:"60 + 6 печатей", displayName:"<span class=\"topup-grid-main\">60 + 6 печатей", price:89, old:99,img:"images/identity/60.png", grad:"linear-gradient(160deg,#4A3470,#150E24)"},
          {name:"185 + 18 печатей", displayName:"<span class=\"topup-grid-main\">185 + 18 печатей", price:402, old:449,img:"images/identity/185.png", grad:"linear-gradient(160deg,#4A3470,#150E24)"},
          {name:"305 + 30 печатей", displayName:"<span class=\"topup-grid-main\">305 + 30 печатей", price:1320, old:1390,img:"images/identity/305.png", grad:"linear-gradient(160deg,#4A3470,#150E24)"},
          {name:"690 + 69 печатей", displayName:"<span class=\"topup-grid-main\">690 + 69 печатей", price:2650, old:2890,img:"images/identity/690.png", grad:"linear-gradient(160deg,#4A3470,#150E24)"},
          {name:"2025 + 202 печатей", displayName:"<span class=\"topup-grid-main\">2025 + 202 печатей", price:4455, old:4690,img:"images/identity/2025.png", grad:"linear-gradient(160deg,#4A3470,#150E24)"},
          {name:"3330 + 333 печатей", displayName:"<span class=\"topup-grid-main\">3330 + 333 печатей", price:9015, old:9490,img:"images/identity/3330.png", grad:"linear-gradient(160deg,#4A3470,#150E24)"},
    {name:"6590 + 659 печатей", displayName:"<span class=\"topup-grid-main\">6590 + 659 печатей", price:89, old:99,img:"images/identity/6590.png", grad:"linear-gradient(160deg,#4A3470,#150E24)"},
]
      },
      {
        key:"packs", label:"Пакеты",
        /* info — необязательное поле, текст состава пакета. Если заполнено,
           на карточке появляется круглая кнопка (i) в углу — по клику
           открывается окно по центру экрана с этим текстом и кнопкой
           «Закрыть». Чтобы добавить такую кнопку другим товарам — впишите
           поле info:"..." в нужный пакет в donateServices. */
        packages:[
          {name:"Пакет сфера памяти", displayName:"<span class=\"topup-grid-main\">Пакет сфера памяти</span>", price:299, old:339,img:"images/identity/mem.png", grad:"linear-gradient(160deg,#5A2E4A,#1E0A16)",
            info:"Доступен 1 раз в месяц. В состав набора сфера памяти входит:\n— 10 Сфер памяти\n— 50 Писем дружбы\n— 20 Остатков костюма\n— 20 Шпионские очки\n— 188 Пазлов (подсказок)"},
          {name:"Пакет вдохновения", displayName:"<span class=\"topup-grid-main\">Пакет вдохновения</span>", price:549, old:620,img:"images/identity/insp.png", grad:"linear-gradient(160deg,#5A2E4A,#1E0A16)",
            info:"Доступен 1 раз в месяц. В состав набора вдохновения входит:\n— 60 Вдохновения\n— 10 Шпионские очки\n— 10 Остатков костюма\n— 88 Пазлов(подсказок)"},
          {name:"Пакет пазлов", displayName:"<span class=\"topup-grid-main\">Пакет пазлов</span>", price:990, old:1120,img:"images/identity/clu.png", grad:"linear-gradient(160deg,#5A2E4A,#1E0A16)",
            info:"Доступен 1 раз в месяц. В состав набора пазлов входит:\n— 2488 Пазлов(подсказок)\n— 20 Остатков костюма\n— 20 Шпионские очки"},
        ]
      }
    ]
  },
bloodstrike: {
    name:"Blood Strike", grad:"linear-gradient(135deg,#3A0E0E,#120303)", icon:"🔫", img: "images/bstrike/logo.png",
    idLabel:"Player ID", idPattern:/^\d+$/, idErrorText:"Player ID — только цифры",
    idHelp:{text:"Откройте Blood Strike, нажмите на иконку профиля в левом верхнем углу и скопируйте Ваш ID (подсказки на фото). Проверьте все данные, чтобы не было ошибок. Удачной покупки!", img: "images/bstrike/help.png",},
    pkgLabel:{
      gold:"Покупайте золото для Blood Strike по самым низким ценам и забирай топ 1 с легкостью. Пополнение по ID в течение 5-10 минут. Желаем удачной игры!",
      passes:"Покупайте боевые пропуски Blood Strike и удиви всех противников на поле боя. Пополнение по ID в течение 5-10 минут. Желаем приятной игры!"
    },
    /* variants — подкатегории Золото / Пропуски, аналогично Identity V выше. */
    variants:[
      {
        key:"gold", label:"Золото",
        packages:[
          {name:"50 + 1 золота", displayName:"<span class=\"topup-grid-main\">50 + 1 золота", price:99, old:119, grad:"linear-gradient(160deg,#B08A2E,#3A2A0A)", img: "images/bstrike/gold/50.png",},
          {name:"100 + 5 золота", displayName:"<span class=\"topup-grid-main\">100 + 5 золота", price:289, old:339, grad:"linear-gradient(160deg,#B08A2E,#3A2A0A)", img: "images/bstrike/gold/300.png",},
          {name:"300 + 20 золота", displayName:"<span class=\"topup-grid-main\">300 + 20 золота", price:459, old:529, grad:"linear-gradient(160deg,#B08A2E,#3A2A0A)", img: "images/bstrike/gold/300.png",},
          {name:"500 + 40 золота", displayName:"<span class=\"topup-grid-main\">500 + 40 золота", price:899, old:1030, grad:"linear-gradient(160deg,#B08A2E,#3A2A0A)", img: "images/bstrike/gold/500.png",},
          {name:"1000 + 100 золота", displayName:"<span class=\"topup-grid-main\">1000 + 100 золота", price:1790, old:2050, grad:"linear-gradient(160deg,#B08A2E,#3A2A0A)", img: "images/bstrike/gold/1000.png",},
          {name:"2000 + 260 золота", displayName:"<span class=\"topup-grid-main\">2000 + 260 золота", price:4290, old:4890, grad:"linear-gradient(160deg,#B08A2E,#3A2A0A)", img: "images/bstrike/gold/2000.png",},
          {name:"5000 + 800 золота", displayName:"<span class=\"topup-grid-main\">5000 + 800 золота", price:4290, old:4890, grad:"linear-gradient(160deg,#B08A2E,#3A2A0A)", img: "images/bstrike/gold/5000.png",},
        ]
      },
      {
        key:"passes", label:"Пропуски",
        packages:[
     {name:"Strike Pass Elite", displayName:"<span class=\"topup-grid-main\">Strike pass elite</span>", price:1890, old:2190, grad:"linear-gradient(160deg,#8E2E3E,#240F14)", img:"images/bstrike/elite.png",
    info:"В состав Strike Pass Elite входит:\n— 1 Счастливый сундук Strike Pass\n— 1 Боец\n— 1 Оружие\nОблик на оружие: 2 Ультры, 1200 Монет славы, 200 Карт опыта оружия, 25 Очков улучшения\nОблик на бойца: 1 Ультра, 2 Эпических. Внимание: купить можно только 1 раз за сезон!"},
          {name:"Strike Pass Premium", displayName:"<span class=\"topup-grid-main\">Strike pass premium</span>", price:1890, old:2190, grad:"linear-gradient(160deg,#8E2E3E,#240F14)", img:"images/bstrike/prem.png",
    info:"В состав Strike Pass Premium входит:\n— Все награды Strike Pass Elite\n— Увеличение боевого пропуска на 20 уровней\n— 1 Ультра облик\n— 150 Карт опыта оружия\n— 2000 Монет славы\n— 50 Очков улучшения\n Внимание: купить можно только 1 раз за сезон!"},
          {name:"Пропуск повышения", displayName:"<span class=\"topup-grid-main\">Пропуск повышения</span>", price:590, old:690, grad:"linear-gradient(160deg,#8E2E3E,#240F14)", img:"images/bstrike/up.png",
    info:"Внимание: пропуск повышения можно купить только 1 раз."},
          {name:"Ультра скин «Счастливый сундук»", displayName:"<span class=\"topup-grid-main\">Ультра скин «Счастливый сундук»</span>", price:990, old:1150, grad:"linear-gradient(160deg,#8E2E3E,#240F14)", img:"images/bstrike/ultra.png",
    info:"Купить набор можно на 1 аккаунт только 2 раза в неделю."},
        ]
      }
    ]
  },
 marvelrivals: {
    name:"Marvel Rivals", grad:"linear-gradient(135deg,#5A1414,#160505)",img:"images/marvel/logo.png", icon:"🦸",
    idLabel:"UID", idPattern:/^\d+$/, idErrorText:"UID — только цифры",
    idHelp:{img:"images/marvel/help.png", text:"Откройте Marvel Rivals, зайдите в профиль — скопируйте Ваш UID (подсказка на фото). Проверьте все данные, чтобы не было ошибок. Удачной покупки!"},
    pkgLabel:"Покупайте латтисы и собирайте коллекции лимитированных образов. Пополнение по ID в течении 5-10 минут. Желаем приятной игры!",
    packages:[
      {name:"Pick-Up Bundle", displayName:"<span class=\"topup-grid-main\">Pick-Up Bundle", price:449, old:499,img:"images/marvel/pick.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)",
    info:"Cразу получате скин на Венома гипероранжевый. Все награды: жетон костюма, 200 хроножетонов, граффити: гипероранжевый, именная табличка: гипероранжевый. Отыгрывайте 3 матча в день и получайте награду."},
      {name:"100 lattices", displayName:"<span class=\"topup-grid-main\">100 lattices", price:449, old:499,img:"images/marvel/100.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
      {name:"500 lattices", displayName:"<span class=\"topup-grid-main\">500 lattices", price:849, old:949,img:"images/marvel/500.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
      {name:"1000 lattices", displayName:"<span class=\"topup-grid-main\">1000 lattices", price:1650, old:1890,img:"images/marvel/1000.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
      {name:"2180 lattices", displayName:"<span class=\"topup-grid-main\">2180 lattices", price:2690, old:3150,img:"images/marvel/2180.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
      {name:"5680 lattices", displayName:"<span class=\"topup-grid-main\">5680 lattices", price:3990, old:4720,img:"images/marvel/5680.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
      {name:"11680 lattices", displayName:"<span class=\"topup-grid-main\">11680 lattices", price:3990, old:4720,img:"images/marvel/11680.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
      ]
  },
  pubgpc: {
    name:"PUBG PC", grad:"linear-gradient(135deg,#274038,#0E1A16)", img:"images/pubgpc/logo.jpg",
    pkgLabel:"Покупайте G-Coins для PUBG на ПК и выделяйтесь на поле битвы. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем приятной игры и крупных побед!",
    // needsCode: true — вместо прямого зачисления по ID выдаётся код
    // (ключ активации), который покупатель сам вводит в Steam/клиенте.
    needsCode:true,
    packages:[
      {name:"100 G-Coins", displayName:"<span class=\"topup-grid-main\">100 G-Coins", price:890, old:990,img:"images/pubgpc/500.png", grad:"linear-gradient(160deg,#3E8E6E,#0F241C)"},
      {name:"500 + 10 G-Coins", displayName:"<span class=\"topup-grid-main\">500 + 10 G-Coins", price:2670, old:2970,img:"images/pubgpc/500.png", grad:"linear-gradient(160deg,#3E8E6E,#0F241C)"},
      {name:"1000 + 50 G-Coins", displayName:"<span class=\"topup-grid-main\">1000 + 50 G-Coins", price:5230, old:5940,img:"images/pubgpc/2500.png", grad:"linear-gradient(160deg,#3E8E6E,#0F241C)"},
      {name:"2500 + 200 G-Coins", displayName:"<span class=\"topup-grid-main\">2500 + 200 G-Coins", price:10190, old:11880,img:"images/pubgpc/2500.png", grad:"linear-gradient(160deg,#3E8E6E,#0F241C)"},
      {name:"5000 + 500 G-Coins", displayName:"<span class=\"topup-grid-main\">5000 + 500 G-Coins", price:16830, old:19800,img:"images/pubgpc/2500.png", grad:"linear-gradient(160deg,#3E8E6E,#0F241C)"},
      {name:"10000 + 1200 G-Coins", displayName:"<span class=\"topup-grid-main\">10000 + 1200 G-Coins", price:16830, old:19800,img:"images/pubgpc/11200.png", grad:"linear-gradient(160deg,#3E8E6E,#0F241C)"},
    ]
  },
  steam: {
    name:"Steam RU / KZ / СНГ", grad:"linear-gradient(135deg,#1B2838,#0A0E14)", icon:"🎮", img:"images/steam/logo.jpg",
    iconSvg:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.2 7.2h7.6c2.1 0 3.5 1.8 3.8 4.3.3 2.6-.6 5-2.3 5-1 0-1.5-.6-2.1-1.5-.6-.9-1.1-1.3-2.1-1.3h-1.4c-1 0-1.5.4-2.1 1.3-.6.9-1.1 1.5-2.1 1.5-1.7 0-2.6-2.4-2.3-5 .3-2.5 1.7-4.3 3.8-4.3Z"/><path d="M7.6 10.2v2M6.6 11.2h2"/><circle cx="15.1" cy="10" r=".55" fill="#fff" stroke="none"/><circle cx="16.6" cy="11.5" r=".55" fill="#fff" stroke="none"/></svg>',
    idLabel:"Ссылка на профиль Steam или SteamID64",
    idHelp:{
      img: "images/steam/help.png",
      text:"Введите логин от Вашего аккаунта Steam. Найти его можно в строке «Об аккаунте» (подсказки на фото). Проверьте данные, чтобы не было ошибок. Удачной покупки!"
    },
    pkgLabel:{
      ru:"Пополнение кошелька Steam для аккаунтов региона Россия по логину. Зачисление происходит в течение 5 минут после оплаты.",
      kz:"Пополнение кошелька Steam для аккаунтов региона Казахстан по логину. Зачисление происходит в течение 5 минут после оплаты."
    },
    /* customAmount — вместо сетки готовых номиналов показываем форму
       "логин + своя сумма" (см. renderTopupCustomForm). feeRate — наценка
       сервиса, добавляется к введённой сумме при расчёте итога. */
    customAmount:true,
    feeRate:0.06,
    /* variants — переключатель региона (RU/KZ), т.к. валюта пополнения
       разная. rate — курс единицы валюты варианта к рублю (для ₽ = 1).
       Курс тенге обновляй вручную по курсу ЦБ РФ (https://cbr.ru/currency_base/daily/) —
       сейчас взят курс на 01.09.2026: 1 ₸ ≈ 0.188 ₽. */
    variants:[
      {key:"ru", label:"Рубли (RUB)", currency:"₽", min:100, max:23000, rate:1},
      {key:"kz", label:"Тенге (KZT)", currency:"₸", min:262, max:75000, rate:0.188}
    ]
  },
minecraft: {
    name:"Minecraft", grad:"linear-gradient(135deg,#2E4A1E,#0E1A08)", icon:"🟩", img: "images/minecraft/logo.jpg",
    // Minecoins — не зачисляются напрямую по ID, а выдаются кодом,
    // который покупатель сам активирует в своём аккаунте Microsoft/Xbox.
    needsCode:true,
    pkgLabel:"Покупайте Minecoins для Minecraft и открывайте новые миры, скины и текстуры в Marketplace. Код придёт в раздел «Мои покупки» в течение 5-10 минут после оплаты. Желаем приятно провести время за любимой игрой!",
    packages:[
      {name:"Minecraft PC: Java Bedrock edition", price:249, old:289, img: "images/minecraft/jbed.png"},
      {name:"1720 Minecoins", price:1090, old:1250, img: "images/minecraft/1720.png"},
      {name:"3500 Minecoins", price:2190, old:2490, img: "images/minecraft/3500.png"},
    ]
  },


  /* ---------- Цифровые подписки ----------
     Отдельная категория сервисов внутри donateServices — те же поля
     (name/grad/icon/img/pkgLabel/packages), что и у обычного игрового
     доната, поэтому подписки открываются через тот же openTopup() и ту же
     страницу выбора тарифа/оплаты. Никакого idLabel не задаём — подпискам
     не нужен игровой ID, при оплате будет запрошена только почта для чека.
     Чтобы добавить ещё одну подписку — скопируйте один из блоков ниже и
     впишите свой key в список digitalSubscriptionKeys чуть ниже объекта. */
  netflix: {
    name:"Netflix", grad:"linear-gradient(135deg,#7A0C0C,#1A0000)", icon:"🎬", img: "images/netflix/logo.png",
    pkgLabel:"Покупайте карту пополнения Netflix нужного региона и номинала. Код придёт в раздел «Мои покупки» в течение 5-10 минут после оплаты. Желаем приятного просмотра любимых новинок!",
    /* variants — подкатегории по странам (карты пополнения Netflix), как у
       Identity V выше. key уходит в topupMode, label — подпись таба. */
    variants:[
      {
        key:"us", label:"США",
        packages:[
          {name:"Netflix Gift Card 15 USD (США)", price:1390, old:1550, img: "images/netflix/usa/15.png",},
          {name:"Netflix Gift Card 20 USD (США)", price:2290, old:2550, img: "images/netflix/usa/20.png",},
          {name:"Netflix Gift Card 30 USD (США)", price:4590, old:5100, img: "images/netflix/usa/30.png",},
          {name:"Netflix Gift Card 50 USD (США)", price:9190, old:10200, img: "images/netflix/usa/50.png",},
    {name:"Netflix Gift Card 60 USD (США)", price:9190, old:10200, img: "images/netflix/usa/60.png",},
    {name:"Netflix Gift Card 100 USD (США)", price:9190, old:10200, img: "images/netflix/usa/100.png",},
        ]
      },
      {
        key:"pl", label:"Польша",
        packages:[
          {name:"Netflix Gift Card 60 PLN (Польша)", price:1229, old:1300, img: "images/netflix/pln/60.png",},
          {name:"Netflix Gift Card 80 PLN (Польша)", price:2449, old:2600, img: "images/netflix/pln/80.png",},
          {name:"Netflix Gift Card 120 PLN (Польша)", price:4879, old:5200, img: "images/netflix/pln/120.png",},
        ]
      },
      {
        key:"br", label:"Бразилия",
        packages:[
          {name:"Netflix Gift Card 50 BRL (Бразилия)", price:429, old:480, img: "images/netflix/brl/50.png",},
          {name:"Netflix Gift Card 70 BRL (Бразилия)", price:849, old:950, img: "images/netflix/brl/70.png",},
          {name:"Netflix Gift Card 150 BRL (Бразилия)", price:1690, old:1890, img: "images/netflix/brl/150.png",},
        ]
      }
    ]
  },
  likee: {
    name:"Likee (алмазы)", grad:"linear-gradient(135deg,#1B1140,#050508)", icon:"💎", img: "images/likee/logo.jpg",
    idLabel:"Likee ID", idPattern:/^\d+$/, idErrorText:"Likee ID — только цифры",
    idHelp:{text:"Откройте приложение Likee, зайдите в профиль и скопируйте ваш ID. Проверьте все данные, чтобы не было ошибок. Удачной покупки!", img: "images/likee/help.png",},
    // needsCode: false — алмазы зачисляются напрямую на указанный Likee ID,
    // без выдачи кода в «Мои покупки».
    needsCode:false,
    pkgLabel:"Пополняйте баланс Likee по самым низким ценам и дари подарки любимым авторам. Пополнение происходит на указанный аккаунт в течение 5-10 минут после оплаты. Желаем хорошего дня и приятного времяпровождения!",
    packages:[
      {name:"100 алмазов", price:99, old:129, img: "images/likee/100.png",},
      {name:"200 алмазов", price:299, old:349, img: "images/likee/200.png",},
      {name:"500 алмазов", price:899, old:999, img: "images/likee/2000.png",},
      {name:"1000 алмазов", price:1790, old:1990, img: "images/likee/2000.png",},
      {name:"1500 алмазов", price:4290, old:4790, img: "images/likee/2000.png",},
      {name:"2000 алмазов", price:4290, old:4790, img: "images/likee/2000.png",},
      {name:"2500 алмазов", price:4290, old:4790, img: "images/likee/5000.png",},
      {name:"3000 алмазов", price:4290, old:4790, img: "images/likee/5000.png",},
      {name:"3500 алмазов", price:4290, old:4790, img: "images/likee/5000.png",},
      {name:"4000 алмазов", price:4290, old:4790, img: "images/likee/5000.png",},
      {name:"4500 алмазов", price:4290, old:4790, img: "images/likee/5000.png",},
      {name:"5000 алмазов", price:4290, old:4790, img: "images/likee/5000.png",},
    ]
  },
  discord: {
    name:"Discord Nitro", grad:"linear-gradient(135deg,#001E36,#31A8FF)", icon:"🎨", img: "images/discord/logo.jpg",
    pkgLabel:"Покупайте Nitro и насладитесь по максимуму всеми возможностями дискорда. Код придёт в раздел «Мои покупки» в течение 5-10 минут после оплаты. Желаем кайфово провести время за разговорами в любимом дискорде!",
    // Отдельный заметный блок под описанием на странице пополнения.
    regionWarning:"⚠️ Не подходит для Российских аккаунтов",
    packages:[
      {name:"Nitro Basic на месяц", price:899, old:1299, img: "images/discord/basic.png",},
      {name:"Nitro на месяц", price:2390, old:3390, img: "images/discord/1m.png",},
      {name:"Nitro на год", price:6990, old:9990, img: "images/discord/1y.png",},
    ]
  }
};

/* Ключи сервисов из donateServices выше, которые показываются в разделе
   "Цифровые подписки" на главной (а не в "Игровой донат"). */
const digitalSubscriptionKeys = ["netflix", "likee", "discord"];

function maxDiscountBadge(packages){
  let max = 0;
  (packages || []).forEach(p=>{
    if(p.old && p.old > p.price){
      max = Math.max(max, Math.round((1 - p.price / p.old) * 100));
    } else if(p.badge){
      const n = parseInt(String(p.badge).replace(/[^\d]/g,""), 10);
      if(!isNaN(n)) max = Math.max(max, n);
    }
  });
  return max > 0 ? `-${max}%` : null;
}

function donateCardHTML(key){
  const s = donateServices[key];
  const favId = `donate:${key}`;

  // Сервисы со своей суммой (customAmount, напр. Steam RU/KZ) не имеют
  // фиксированных пакетов — цену "от" считаем по минимальной сумме
  // пополнения в рублях (variant.min * variant.rate), а не по packages.
  let minPrice, badge = s.badge || null;
  if(s.customAmount){
    const minsRub = (s.variants || [])
      .map(v=> (typeof v.min === "number") ? v.min * (v.rate || 1) : null)
      .filter(n=> n !== null);
    minPrice = minsRub.length ? Math.round(Math.min(...minsRub)) : 0;
  } else {
    const allPkgs = s.variants ? s.variants.flatMap(v=>v.packages) : s.packages;
    minPrice = Math.min(...allPkgs.map(p=>p.price));
    badge = badge || maxDiscountBadge(allPkgs);
  }

  favoriteCandidates[favId] = {
    name: s.name, price: `от ${minPrice.toLocaleString("ru-RU")} ₽`, old:null,
    grad: s.grad, img: s.img || null, sub:null
  };
  return `<div class="donate-tile" data-donate="${key}">
    <div class="donate-tile-cover" style="background:${s.img ? `url('${s.img}') center/cover no-repeat` : s.grad};">
      ${heartHTML(favId)}
      ${badge ? `<div class="badge">${badge}</div>` : ""}
      ${s.img ? "" : `<div class="cov-label" style="position:absolute; top:${badge ? "44px" : "16px"}; left:16px; font-size:30px; z-index:1;">${s.icon}</div>`}
    </div>
    <div class="dt-name">${s.name}</div>
    <div class="dt-price">от ${minPrice.toLocaleString("ru-RU")} ₽</div>
  </div>`;
}

document.getElementById("donate-scroll").innerHTML = Object.keys(donateServices).filter(k=>k!=="steam" && !digitalSubscriptionKeys.includes(k)).map(donateCardHTML).join("");
bindHearts(document.getElementById("donate-scroll"));
document.querySelectorAll("#donate-scroll .donate-tile").forEach(card=>{
  card.addEventListener("click", ()=> openTopup(card.dataset.donate));
});

/* ---------- Карточки "Цифровые подписки" на главной ----------
   Визуально — те же карточки 150х150, что были у "Предзаказов" (класс
   game-card): обложка с сердечком избранного и красной плашкой скидки,
   под ней только название — без цены и без издания. Клик открывает ту же
   страницу выбора тарифа/пакета, что и у игрового доната (openTopup). */
function subscriptionCardHTML(key){
  const s = donateServices[key];
  const favId = `donate:${key}`;
  const allPkgs = s.variants ? s.variants.flatMap(v=>v.packages) : s.packages;
  const minPrice = Math.min(...allPkgs.map(p=>p.price));
  const badge = s.badge || maxDiscountBadge(allPkgs);

  favoriteCandidates[favId] = {
    name: s.name, price: `от ${minPrice.toLocaleString("ru-RU")} ₽`, old:null,
    grad: s.grad, img: s.img || null, sub:null
  };

  return `<div class="game-card" data-donate="${key}">
    <div class="cover" style="background:${s.img ? `url('${s.img}') center/cover no-repeat` : s.grad};">
      ${heartHTML(favId)}
      ${badge ? `<div class="badge">${badge}</div>` : ""}
      ${s.img ? "" : `<div class="cov-label" style="position:absolute; top:${badge ? "44px" : "16px"}; left:16px; font-size:30px; z-index:1;">${s.icon}</div>`}
    </div>
    <div class="game-name">${s.name}</div>
  </div>`;
}

document.getElementById("subscriptions").innerHTML = digitalSubscriptionKeys.map(subscriptionCardHTML).join("");
bindHearts(document.getElementById("subscriptions"));
document.querySelectorAll("#subscriptions .game-card[data-donate]").forEach(card=>{
  card.style.cursor = "pointer";
  card.addEventListener("click", ()=> openTopup(card.dataset.donate));
});

let currentTopup = null;
let topupMode = "direct";

/* Исходная разметка табов (Прямое зачисление / Коды) — запоминаем один раз,
   чтобы можно было восстановить её после показа динамических табов (см.
   donateServices.*.variants, например у Identity V — Эхо (печати) /
   Пакеты). */
const defaultModeTabsHTML = document.getElementById("topup-mode-tabs").innerHTML;

function openTopup(key){
  const s = donateServices[key];
  currentTopup = key;

  const modeTabs = document.getElementById("topup-mode-tabs");
  if(s.variants){
    topupMode = s.variants[0].key;
    modeTabs.innerHTML = s.variants.map(v=>`<div class="pill" data-mode="${v.key}">${v.label}</div>`).join("");
    modeTabs.style.display = "flex";
  } else {
    topupMode = "direct";
    modeTabs.innerHTML = defaultModeTabsHTML;
    modeTabs.style.display = s.codesCatalog ? "flex" : "none";
  }

  document.getElementById("topup-heading").textContent = s.name;

  // Логотип сервиса: фото, если задано, иначе градиент + эмодзи-иконка
  // (тот же стиль, что и у карточки сервиса на главной).
  const logoEl = document.getElementById("topup-info-logo");
  logoEl.style.background = s.img ? `url('${s.img}') center/cover no-repeat` : (s.grad || "var(--card-2)");
  logoEl.innerHTML = s.img ? "" : (s.iconSvg || `<span>${s.icon || ""}</span>`);

  // Бейдж скидки — максимальная скидка среди пакетов сервиса.
  // У сервисов со своей суммой (customAmount) фиксированных пакетов нет,
  // бейдж для них задаётся вручную через s.badge, если нужен.
  const badgeEl = document.getElementById("topup-info-badge");
  if(s.customAmount){
    if(s.badge){ badgeEl.textContent = s.badge; badgeEl.style.display = "block"; }
    else { badgeEl.style.display = "none"; }
  } else {
    const allPkgs = s.variants ? s.variants.flatMap(v=>v.packages) : s.packages;
    const badge = s.badge || maxDiscountBadge(allPkgs);
    if(badge){ badgeEl.textContent = badge; badgeEl.style.display = "block"; }
    else { badgeEl.style.display = "none"; }
  }

  updateTopupPkgLabel();
  renderTopupModeTabs();

  // Предупреждение о регионе (см. donateServices.discord) — отдельный
  // заметный блок сразу под описанием сервиса, если у сервиса задано поле.
  const warningEl = document.getElementById("topup-region-warning");
  if(s.regionWarning){
    warningEl.textContent = s.regionWarning;
    warningEl.style.display = "block";
  } else {
    warningEl.style.display = "none";
  }

  renderTopupPackages();
  showSubView("view-topup");
}

/* pkgLabel может быть строкой (один текст на все режимы) или объектом
   {direct:"...", codes:"..."} — тогда текст меняется вместе с табом. */
function updateTopupPkgLabel(){
  const s = donateServices[currentTopup];
  const label = s.pkgLabel;
  const text = (label && typeof label === "object") ? (label[topupMode] || "Выберите количество") : (label || "Выберите количество");
  document.getElementById("topup-pkg-label").textContent = text;
}

function renderTopupModeTabs(){
  document.querySelectorAll("#topup-mode-tabs .pill").forEach(el=>{
    el.classList.toggle("active", el.dataset.mode === topupMode);
  });
}

/* Делегирование клика на контейнер табов — работает и со статичной
   разметкой (Прямое зачисление / Коды), и с динамически подставленными
   табами вариантов (см. donateServices.*.variants). */
document.getElementById("topup-mode-tabs").addEventListener("click", (e)=>{
  const el = e.target.closest(".pill");
  if(!el) return;
  topupMode = el.dataset.mode;
  renderTopupModeTabs();
  updateTopupPkgLabel();
  renderTopupPackages();
});

/* Возвращает список пакетов для текущего сервиса/режима в едином формате
   {name, price, old, img, grad}. Для сервисов с variants (например,
   Identity V) пакеты берутся из нужного варианта. Для "коды" данные
   берутся из s.codesCatalog (см. donateServices.pubg). */
function getTopupPackages(){
  const svc = donateServices[currentTopup];
  if(svc.variants){
    const v = svc.variants.find(v=>v.key===topupMode) || svc.variants[0];
    return v.packages;
  }
  if(topupMode === "codes" && svc.codesCatalog){
    const cat = svc.codesCatalog;
    return cat.items.map(item => ({
      name: item.name,
      price: item.price,
      old: item.old,
      img: item.img || cat.img || null,
      grad: item.grad
    }));
  }
  return svc.packages;
}

function renderTopupPackages(){
  const s = donateServices[currentTopup];
  const gridEl = document.getElementById("topup-pkg-grid");
  const formEl = document.getElementById("topup-custom-form");

  if(s.customAmount){
    gridEl.style.display = "none";
    formEl.style.display = "block";
    renderTopupCustomForm();
    return;
  }
  gridEl.style.display = "";
  formEl.style.display = "none";

  const isCodes = topupMode === "codes" && s.codesCatalog;
  const cat = isCodes ? s.codesCatalog : null;
  const pkgs = getTopupPackages();

  // Сетка карточек с фото, как в каталоге подарочных карт (PS Store и т.п.):
  // клик по карточке сразу ведёт на страницу оплаты, без промежуточного шага.

  gridEl.innerHTML = pkgs.map((p, i) => {
    const pkgImg = p.img || (isCodes ? cat.img : s.img) || null;
    const favId = `topuppkg:${currentTopup}:${topupMode}:${i}`;
    favoriteCandidates[favId] = {
      name: isCodes ? p.name : `${s.name} — ${p.name}`,
      price: `${formatPrice(p.price)} ₽`, old: p.old ? `${formatPrice(p.old)} ₽` : null,
      grad: p.grad || s.grad, img: pkgImg || null, sub: null
    };
    return `
    <div class="giftcard" data-catalog-name="${(isCodes ? p.name : `${s.name} — ${p.name}`).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" data-idx="${i}">
      <div class="giftcard-cover" style="background:${pkgImg ? `url('${pkgImg}') center/cover no-repeat` : (p.grad || s.grad)};">
        ${heartHTML(favId)}
        ${p.info ? infoHTML(i) : ""}
        <div class="giftcard-inner">
          ${pkgImg ? "" : `<div class="giftcard-logo">${isCodes ? cat.logo : s.icon}</div>`}
        </div>
      </div>
      <div class="topup-grid-price">${formatPrice(p.price)} ₽${p.old ? `<span class="old">${formatPrice(p.old)} ₽</span>` : ""}</div>
      <div class="topup-grid-name">${p.displayName || p.name}</div>
    </div>`;
  }).join("");

  gridEl.querySelectorAll(".giftcard").forEach(el=>{
    el.addEventListener("click", (e)=>{
      if(e.target.closest(".card-heart") || e.target.closest(".card-info")) return;
      goToTopupPayment(parseInt(el.dataset.idx, 10));
    });
  });
  bindHearts(gridEl);
  bindInfoButtons(gridEl, pkgs);
}

/* Строит и открывает страницу оплаты для пакета с индексом idx текущего
   сервиса/режима. Вызывается кликом по карточке в сетке. */
function goToTopupPayment(idx){
  const s = donateServices[currentTopup];
  const isCodes = topupMode === "codes" && s.codesCatalog;
  const p = getTopupPackages()[idx];
  const cat = isCodes ? s.codesCatalog : null;
  const pkgImg = p.img || (isCodes ? cat.img : s.img) || null;
  const itemName = isCodes ? p.name : `${s.name} — ${p.name}`;

  openPaymentPage({
    title: isCodes ? cat.title : s.name,
    heading: p.name,
    itemIcon: isCodes ? cat.logo : s.icon,
    itemGrad: p.grad || s.grad,
    itemImg: pkgImg,
    itemName,
    itemPrice: p.price,
    itemOld: p.old || null,
    showId: !!s.idLabel,
    idLabel: s.idLabel,
    idPattern: s.idPattern || null,
    idErrorText: s.idErrorText || null,
    idHelpImg: (s.idHelp && s.idHelp.img) || null,
    idHelpText: (s.idHelp && s.idHelp.text) || null,
    showServer: !!s.serverOptions,
    serverLabel: s.serverLabel || null,
    serverOptions: s.serverOptions || null,
    showZoneId: !!s.zoneIdLabel,
    zoneIdLabel: s.zoneIdLabel || null,
    zoneIdPattern: s.zoneIdPattern || null,
    zoneIdErrorText: s.zoneIdErrorText || null,
    zoneIdHelpImg: (s.zoneIdHelp && s.zoneIdHelp.img) || null,
    zoneIdHelpText: (s.zoneIdHelp && s.zoneIdHelp.text) || null,
    showQty: false,
    onConfirm: (finalPrice, email, qty)=>{
      createOrder(
        [{name:itemName, price:`${formatPrice(finalPrice)} ₽`, qty:1, grad:p.grad || s.grad, img:pkgImg, needsCode: !!s.needsCode}],
        `${formatPrice(finalPrice)} ₽`,
        email
      );


    }
  });
}

/* ---------- Custom-amount форма (Steam RU/KZ: логин + сумма + комиссия) ---------- */

function getCurrentTopupVariant(){
  const s = donateServices[currentTopup];
  return (s.variants && s.variants.find(v=>v.key===topupMode)) || (s.variants && s.variants[0]) || null;
}

function renderTopupCustomForm(){
  const s = donateServices[currentTopup];
  const v = getCurrentTopupVariant();
  const currency = (v && v.currency) || "₽";

  document.getElementById("topup-custom-amount-label").textContent = `Сумма пополнения ${currency}`;
  const amountInput = document.getElementById("topup-custom-amount");
  amountInput.placeholder = v ? `От ${v.min} до ${v.max}` : "Введите сумму";
  amountInput.min = v ? v.min : "";
  amountInput.max = v ? v.max : "";
  amountInput.value = "";
  document.getElementById("topup-custom-login").value = "";
  setPaymentFieldError("topup-custom-login","topup-custom-login-error", false);
  setPaymentFieldError("topup-custom-amount","topup-custom-amount-error", false);
  document.querySelectorAll("#topup-custom-pay-methods .pay-method").forEach((el,i)=> el.classList.toggle("selected", i===0));

  // Вопросик у "Логин Steam" — та же подсказка, что и у обычного поля ID
  // на странице оплаты (см. s.idHelp), открывается тем же оверлеем.
  const helpBtn = document.getElementById("topup-custom-login-help-btn");
  if(s.idHelp && (s.idHelp.img || s.idHelp.text)){
    helpBtn.style.display = "flex";
    helpBtn.onclick = ()=> openIdHelp(s.idHelp.img, s.idHelp.text);
  } else {
    helpBtn.style.display = "none";
    helpBtn.onclick = null;
  }

  updateTopupCustomTotal();
}

/* Итог всегда считается и показывается в рублях: введённая сумма
   переводится в рубли по курсу variant.rate (для ₽ rate=1, для ₸ — курс
   ЦБ РФ, см. donateServices.steam), затем начисляется комиссия сервиса. */
function updateTopupCustomTotal(){
  const s = donateServices[currentTopup];
  const v = getCurrentTopupVariant();
  const currency = (v && v.currency) || "₽";
  const rate = (v && v.rate) || 1;
  const feeRate = s.feeRate || 0;

  const rawAmount = parseFloat(document.getElementById("topup-custom-amount").value);
  const amount = (!isNaN(rawAmount) && rawAmount > 0) ? rawAmount : 0;
  const rubAmount = amount * rate;
  const fee = Math.round(rubAmount * feeRate);
  const total = Math.round(rubAmount) + fee;

  document.getElementById("topup-custom-sum-val").textContent = `${formatPrice(amount)} ${currency}`;
  document.getElementById("topup-custom-fee-val").textContent = `${formatPrice(fee)} ₽`;
  document.getElementById("topup-custom-total-val").textContent = `${formatPrice(total)} ₽`;
  return {amount, rubAmount, fee, total, currency};
}

document.querySelectorAll("#topup-custom-pay-methods .pay-method").forEach(el=>{
  el.addEventListener("click", ()=>{
    document.querySelectorAll("#topup-custom-pay-methods .pay-method").forEach(x=>x.classList.remove("selected"));
    el.classList.add("selected");
  });
});

document.getElementById("topup-custom-amount").addEventListener("input", ()=>{
  const amountInput = document.getElementById("topup-custom-amount");
  /* Разрешаем вводить только цифры (это сумма пополнения) — любые
     другие символы (буквы, точки, минус, "e" и т.п.) сразу вырезаются. */
  const digitsOnly = amountInput.value.replace(/[^0-9]/g, "");
  if(digitsOnly !== amountInput.value) amountInput.value = digitsOnly;

  const v = getCurrentTopupVariant();
  if(v && amountInput.value !== "" && parseFloat(amountInput.value) > v.max){
    amountInput.value = v.max;
  }
  setPaymentFieldError("topup-custom-amount","topup-custom-amount-error", false);
  updateTopupCustomTotal();
});
document.getElementById("topup-custom-amount").addEventListener("keydown", (e)=>{
  /* Дополнительно блокируем ввод "e", "+", "-", "," и "." с клавиатуры —
     на случай мобильных клавиатур, где событие input срабатывает не сразу. */
  if(["e","E","+","-",".",","].includes(e.key)) e.preventDefault();
});
document.getElementById("topup-custom-login").addEventListener("input", ()=>{
  const val = document.getElementById("topup-custom-login").value.trim();
  if(val !== "" && !/[а-яА-ЯёЁ]/.test(val)){
    setPaymentFieldError("topup-custom-login","topup-custom-login-error", false);
  }
});

document.getElementById("topup-custom-buy-btn").addEventListener("click", ()=>{
  const s = donateServices[currentTopup];
  const v = getCurrentTopupVariant();
  const login = document.getElementById("topup-custom-login").value.trim();
  const {amount, total, currency} = updateTopupCustomTotal();

  let ok = true;
  if(!login){
    setPaymentFieldError("topup-custom-login","topup-custom-login-error", true, "Введите логин");
    ok = false;
  } else if(/[а-яА-ЯёЁ]/.test(login)){
    setPaymentFieldError("topup-custom-login","topup-custom-login-error", true, "Неверный логин");
    ok = false;
  }
  if(!amount || (v && (amount < v.min || amount > v.max))){
    const text = v ? `Сумма от ${v.min} до ${v.max} ${currency}` : "Укажите сумму";
    setPaymentFieldError("topup-custom-amount","topup-custom-amount-error", true, text);
    ok = false;
  }
  if(!ok) return;

  createOrder(
    [{
      name:`${s.name} — ${v ? v.label : ""} — ${login}`,
      price:`${formatPrice(total)} ₽`,
      qty:1, grad:s.grad, img:s.img || null, needsCode:false
    }],
    `${formatPrice(total)} ₽`,
    "",
    document.querySelector("#topup-custom-pay-methods .pay-method.selected")?.dataset.pay || "sbp"
  );


});


/* Support row is a real <a href="https://t.me/metracodehelp"> — no JS needed */

/* ---------- Generic payment page (used by donate + gift cards) ---------- */
let paymentConfig = null;

function formatPrice(num){
  return Number.isInteger(num) ? num.toLocaleString("ru-RU") : num.toLocaleString("ru-RU",{minimumFractionDigits:2, maximumFractionDigits:2});
}

function openIdHelp(img, text){
  const imgEl = document.getElementById("id-help-image");
  imgEl.style.display = img ? "block" : "none";
  imgEl.style.backgroundImage = img ? `url('${img}')` : "none";
  document.getElementById("id-help-text").textContent = text || "";
  document.getElementById("id-help-overlay").classList.add("show");
}
function closeIdHelp(){
  document.getElementById("id-help-overlay").classList.remove("show");
}
document.getElementById("id-help-close").addEventListener("click", closeIdHelp);
document.getElementById("id-help-overlay").addEventListener("click", (e)=>{
  if(e.target.id === "id-help-overlay") closeIdHelp();
});

/* ---------- Package info modal (состав пакета) — по центру экрана ---------- */
function openPkgInfo(title, text){
  document.getElementById("pkg-info-title").textContent = title || "";
  document.getElementById("pkg-info-text").textContent = text || "";
  document.getElementById("pkg-info-overlay").classList.add("show");
}
function closePkgInfo(){
  document.getElementById("pkg-info-overlay").classList.remove("show");
}
document.getElementById("pkg-info-close").addEventListener("click", closePkgInfo);
document.getElementById("pkg-info-overlay").addEventListener("click", (e)=>{
  if(e.target.id === "pkg-info-overlay") closePkgInfo();
});

function openPaymentPage(config){
  paymentConfig = config;
  const hint=document.getElementById("payment-email-hint"); if(hint) hint.textContent=(config.showId||config.showUsername)?"Ваш аккаунт пополнится в течение 5 минут.":"Код придет Вам прямо в чат и в раздел «Мои покупки» в течение 5 минут.";
  document.getElementById("payment-heading").textContent = config.heading || config.title;
  document.getElementById("payment-item-icon").style.background = config.itemImg
    ? `url('${config.itemImg}') center/cover no-repeat`
    : (config.itemGrad || "var(--accent-grad)");
  document.getElementById("payment-item-icon").textContent = config.itemImg ? "" : (config.itemIcon || "");
  // Если в названии товара страна указана в скобках в конце — убираем её
  // из названия и выводим отдельной строкой снизу (как регион у Mobile
  // Legends в разделе игрового доната).
  const paymentNameMatch = String(config.itemName || "").match(/^(.*)\s\(([^)]+)\)\s*$/);
  document.getElementById("payment-item-name").textContent = paymentNameMatch ? paymentNameMatch[1] : config.itemName;
  const paymentCountryEl = document.getElementById("payment-item-country");
  if(paymentNameMatch){
    paymentCountryEl.textContent = paymentNameMatch[2];
    paymentCountryEl.style.display = "block";
  } else {
    paymentCountryEl.style.display = "none";
  }
  document.getElementById("payment-item-price").textContent = `${formatPrice(config.itemPrice)} ₽`;

  const isMinimalForm = !config.showId && !config.showServer && !config.showZoneId && !config.showUsername;
  document.getElementById("view-payment").classList.toggle("spacious", isMinimalForm);

  paymentQty = 1;
  const qtyLabelEl = document.getElementById("payment-qty-label");
  const qtyStepperEl = document.getElementById("payment-qty-stepper");
  if(config.showQty){
    qtyLabelEl.style.display = "block";
    qtyStepperEl.style.display = "inline-flex";
    document.getElementById("payment-qty-value").textContent = "1";
  } else {
    qtyLabelEl.style.display = "none";
    qtyStepperEl.style.display = "none";
  }

  const idLabelEl = document.getElementById("payment-id-label");
  const idLabelTextEl = document.getElementById("payment-id-label-text");
  const idHelpBtnEl = document.getElementById("payment-id-help-btn");
  const idInputEl = document.getElementById("payment-id-input");
  if(config.showId){
    idLabelEl.style.display = "flex";
    idInputEl.style.display = "block";
    idLabelTextEl.textContent = config.idLabel || "ID персонажа";
    idInputEl.value = "";
    if(config.idHelpImg || config.idHelpText){
      idHelpBtnEl.style.display = "flex";
      idHelpBtnEl.onclick = ()=> openIdHelp(config.idHelpImg, config.idHelpText);
    } else {
      idHelpBtnEl.style.display = "none";
      idHelpBtnEl.onclick = null;
    }
  } else {
    idLabelEl.style.display = "none";
    idInputEl.style.display = "none";
  }

  const serverLabelEl = document.getElementById("payment-server-label");
  const serverDropdownEl = document.getElementById("payment-server-dropdown");
  const serverMenuEl = document.getElementById("payment-server-menu");
  const serverTriggerTextEl = document.getElementById("payment-server-trigger-text");
  selectedPaymentServer = "";
  serverDropdownEl.classList.remove("open", "error");
  document.getElementById("payment-server-trigger").classList.add("placeholder");
  if(config.showServer && config.serverOptions && config.serverOptions.length){
    serverLabelEl.textContent = config.serverLabel || "Выберите Ваш сервер";
    serverLabelEl.style.display = "block";
    serverDropdownEl.style.display = "block";
    serverTriggerTextEl.textContent = "Выберите сервер";
    serverMenuEl.innerHTML = config.serverOptions.map(opt=>`<div class="dropdown-select-option" data-server="${opt}">${opt}</div>`).join("");
  } else {
    serverLabelEl.style.display = "none";
    serverDropdownEl.style.display = "none";
    serverMenuEl.innerHTML = "";
  }

  const zoneLabelEl = document.getElementById("payment-zoneid-label");
  const zoneLabelTextEl = document.getElementById("payment-zoneid-label-text");
  const zoneHelpBtnEl = document.getElementById("payment-zoneid-help-btn");
  const zoneInputEl = document.getElementById("payment-zoneid-input");
  if(config.showZoneId){
    zoneLabelEl.style.display = "flex";
    zoneInputEl.style.display = "block";
    zoneLabelTextEl.textContent = config.zoneIdLabel || "Zone ID";
    zoneInputEl.value = "";
    if(config.zoneIdHelpImg || config.zoneIdHelpText){
      zoneHelpBtnEl.style.display = "flex";
      zoneHelpBtnEl.onclick = ()=> openIdHelp(config.zoneIdHelpImg, config.zoneIdHelpText);
    } else {
      zoneHelpBtnEl.style.display = "none";
      zoneHelpBtnEl.onclick = null;
    }
  } else {
    zoneLabelEl.style.display = "none";
    zoneInputEl.style.display = "none";
  }

  const usernameLabelEl = document.getElementById("payment-username-label");
  const usernameInputEl = document.getElementById("payment-username-input");
  if(config.showUsername){
    usernameLabelEl.style.display = "block";
    usernameInputEl.style.display = "block";
    usernameLabelEl.textContent = config.usernameLabel || "@username";
    usernameInputEl.placeholder = config.usernamePlaceholder || "@username";
    usernameInputEl.value = "";
  } else {
    usernameLabelEl.style.display = "none";
    usernameInputEl.style.display = "none";
  }

  document.getElementById("payment-email-input").value = "";
  setPaymentFieldError("payment-id-input","payment-id-error", false);
  setPaymentFieldError("payment-server-trigger","payment-server-error", false);
  setPaymentFieldError("payment-zoneid-input","payment-zoneid-error", false);
  setPaymentFieldError("payment-username-input","payment-username-error", false);
  setPaymentFieldError("payment-email-input","payment-email-error", false);
  paymentPayMethod = "sbp";
  document.querySelectorAll("#payment-pay-methods .pay-method").forEach((el,i)=> el.classList.toggle("selected", i===0));

  updatePaymentTotals();

  updatePaymentBuyButton();

  showSubView("view-payment");
}

let paymentQty = 1;
let selectedPaymentServer = "";

document.getElementById("payment-server-trigger").addEventListener("click", ()=>{
  document.getElementById("payment-server-dropdown").classList.toggle("open");
});

document.getElementById("payment-server-menu").addEventListener("click", (e)=>{
  const el = e.target.closest(".dropdown-select-option");
  if(!el) return;
  selectedPaymentServer = el.dataset.server;
  document.getElementById("payment-server-trigger-text").textContent = selectedPaymentServer;
  document.getElementById("payment-server-trigger").classList.remove("placeholder");
  document.querySelectorAll("#payment-server-menu .dropdown-select-option").forEach(o=>{
    o.classList.toggle("selected", o === el);
  });
  document.getElementById("payment-server-dropdown").classList.remove("open");
  setPaymentFieldError("payment-server-trigger","payment-server-error", false);
  document.getElementById("payment-server-dropdown").classList.remove("error");
});

document.addEventListener("click", (e)=>{
  const dropdown = document.getElementById("payment-server-dropdown");
  if(dropdown.classList.contains("open") && !dropdown.contains(e.target)){
    dropdown.classList.remove("open");
  }
});


document.getElementById("payment-qty-inc").addEventListener("click", ()=>{
  paymentQty = Math.min(20, paymentQty + 1);
  document.getElementById("payment-qty-value").textContent = paymentQty;
  updatePaymentTotals();
});
document.getElementById("payment-qty-dec").addEventListener("click", ()=>{
  paymentQty = Math.max(1, paymentQty - 1);
  document.getElementById("payment-qty-value").textContent = paymentQty;
  updatePaymentTotals();
});

/* Способ оплаты на странице "оплата сразу" (view-payment). По умолчанию СБП. */
let paymentPayMethod = "sbp";

/* Цена товара по СБП — это и есть config.itemPrice (уже посчитанная, "красивая"
   цена из прайса). Цена при оплате картой на 3% выше (комиссия эквайринга),
   округляем вниз до рубля. */
function getCardPrice(sbpPrice){
  return Math.floor(sbpPrice * 1.03);
}

/* Оплата криптовалютой на 2% дешевле цены по СБП. */
function getCryptoPrice(sbpPrice){
  return Math.floor(sbpPrice * 0.98);
}

function getPaymentUnitPrice(){
  const unitSbp = paymentConfig.itemPrice;
  if(paymentPayMethod === "card") return getCardPrice(unitSbp);
  if(paymentPayMethod === "crypto") return getCryptoPrice(unitSbp);
  return unitSbp;
}

function updatePaymentTotals(){
  if(!paymentConfig) return;
  const qty = paymentConfig.showQty ? paymentQty : 1;

  const unitCard = getCardPrice(paymentConfig.itemPrice);
  const unitBase = getPaymentUnitPrice();

  const base = unitBase * qty;
  const baseOld = (paymentConfig.itemOld || paymentConfig.itemPrice) * qty;
  const methodDiscountAmount = paymentPayMethod !== "card" ? (unitCard - unitBase) * qty : 0;

  const total = base;

  document.getElementById("payment-item-price").textContent = `${formatPrice(unitBase)} ₽`;
  document.getElementById("payment-sum").textContent = `${formatPrice(baseOld)} ₽`;

  const oldDiscountRow = document.getElementById("payment-old-discount-row");
  const totalDiscountAmount = paymentConfig.itemOld
    ? (paymentConfig.itemOld * qty) - base
    : methodDiscountAmount;
  if(totalDiscountAmount > 0){
    oldDiscountRow.style.display = "flex";
    document.getElementById("payment-old-discount-amount").textContent = `−${formatPrice(totalDiscountAmount)} ₽`;
  } else {
    oldDiscountRow.style.display = "none";
  }

  document.getElementById("payment-total").textContent = `${formatPrice(total)} ₽`;
}

function updatePaymentBuyButton(){
  const payBtn = document.getElementById("payment-buy-btn");
  payBtn.textContent = "Перейти к оплате";
  payBtn.style.background = "var(--accent-b)";
  payBtn.style.opacity = "";
  payBtn.style.cursor = "";
}

document.querySelectorAll("#payment-pay-methods .pay-method").forEach(el=>{
  el.addEventListener("click", ()=>{
    document.querySelectorAll("#payment-pay-methods .pay-method").forEach(x=>x.classList.remove("selected"));
    el.classList.add("selected");
    paymentPayMethod = el.dataset.pay;
    updatePaymentTotals();
  });
});

function setPaymentFieldError(inputId, errorId, show, text){
  document.getElementById(inputId).classList.toggle("error", show);
  const errorEl = document.getElementById(errorId);
  if(show && text) errorEl.textContent = text;
  errorEl.classList.toggle("show", show);
}

document.getElementById("payment-id-input").addEventListener("input", ()=>{
  if(document.getElementById("payment-id-input").value.trim() !== ""){
    setPaymentFieldError("payment-id-input","payment-id-error", false);
  }
});

document.getElementById("payment-zoneid-input").addEventListener("input", ()=>{
  if(document.getElementById("payment-zoneid-input").value.trim() !== ""){
    setPaymentFieldError("payment-zoneid-input","payment-zoneid-error", false);
  }
});

document.getElementById("payment-username-input").addEventListener("input", ()=>{
  if(document.getElementById("payment-username-input").value.trim() !== ""){
    setPaymentFieldError("payment-username-input","payment-username-error", false);
  }
});

document.getElementById("payment-email-input").addEventListener("input", ()=>{
  if(document.getElementById("payment-email-input").value.trim() !== ""){
    setPaymentFieldError("payment-email-input","payment-email-error", false);
  }
});

/* Telegram username: optional leading @, 5–32 chars, starts with letter, only a-z 0-9 _ */
function isValidTelegramUsername(raw){
  const v = String(raw || "").trim().replace(/^@+/, "");
  return /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(v);
}

document.getElementById("payment-buy-btn").addEventListener("click", ()=>{
  if(!paymentConfig) return;

  let firstInvalid = null;

  if(paymentConfig.showId){
    const idVal = document.getElementById("payment-id-input").value.trim();
    const idOk = idVal !== "" && (!paymentConfig.idPattern || paymentConfig.idPattern.test(idVal));
    const idErrText = idVal === "" ? "Заполните данные" : (paymentConfig.idErrorText || "Проверьте правильность ID");
    setPaymentFieldError("payment-id-input","payment-id-error", !idOk, idErrText);
    if(!idOk) firstInvalid = firstInvalid || "payment-id-input";
  }

  if(paymentConfig.showServer){
    const serverOk = selectedPaymentServer !== "";
    setPaymentFieldError("payment-server-trigger","payment-server-error", !serverOk, "Выберите сервер");
    if(!serverOk) firstInvalid = firstInvalid || "payment-server-trigger";
  }

  if(paymentConfig.showZoneId){
    const zoneVal = document.getElementById("payment-zoneid-input").value.trim();
    const zoneOk = zoneVal !== "" && (!paymentConfig.zoneIdPattern || paymentConfig.zoneIdPattern.test(zoneVal));
    const zoneErrText = zoneVal === "" ? "Заполните данные" : (paymentConfig.zoneIdErrorText || "Проверьте правильность Zone ID");
    setPaymentFieldError("payment-zoneid-input","payment-zoneid-error", !zoneOk, zoneErrText);
    if(!zoneOk) firstInvalid = firstInvalid || "payment-zoneid-input";
  }

  if(paymentConfig.showUsername){
    const userVal = document.getElementById("payment-username-input").value.trim();
    const userOk = userVal !== "" && isValidTelegramUsername(userVal);
    const userErrText = userVal === ""
      ? "Укажите @username"
      : (paymentConfig.usernameErrorText || "Некорректный @username (5–32 символа, латиница, цифры, _)");
    setPaymentFieldError("payment-username-input","payment-username-error", !userOk, userErrText);
    if(!userOk) firstInvalid = firstInvalid || "payment-username-input";
  }

  const emailVal = document.getElementById("payment-email-input").value.trim();
  const emailOk = !emailVal || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
  setPaymentFieldError("payment-email-input","payment-email-error", !emailOk);
  if(!emailOk) firstInvalid = firstInvalid || "payment-email-input";

  if(firstInvalid){
    document.getElementById(firstInvalid).scrollIntoView({block:"center", behavior:"smooth"});
    return;
  }

  if(paymentConfig.onConfirm){
    const qty = paymentConfig.showQty ? paymentQty : 1;
    // Сумма заказа = сумма, показанная покупателю для выбранного способа оплаты.
    paymentConfig.onConfirm(getPaymentUnitPrice() * qty, emailVal, qty);
  }
});



/* Синхронизируем иконки и % скидки сервисов в списке "Сервисы пополнения"
   на главной странице с реальными данными в giftCatalogs — если фото задано,
   показываем его вместо цветного кружка с эмодзи (бейдж со скидкой остаётся
   поверх фото), а текст скидки всегда считаем той же функцией
   (maxDiscountBadge), что и на странице конкретного сервиса. Раньше "-15%"
   на главной был просто захардкожен в HTML и не совпадал с реальной
   максимальной скидкой по товарам (например у PS Store она была -14%) —
   теперь это одно и то же число, посчитанное один раз из одних данных.  */
document.querySelectorAll(".list-row[data-catalog]").forEach(row=>{
  const cat = giftCatalogs[row.dataset.catalog];
  if(!cat) return;
  if(cat.img){
    const icon = row.querySelector(".list-icon");
    icon.style.background = `url('${cat.img}') center/cover no-repeat`;
    icon.childNodes.forEach(node=>{
      if(node.nodeType === Node.TEXT_NODE) node.textContent = "";
    });
  }
  const discountEl = row.querySelector(".list-discount");
  if(discountEl){
    const allItems = cat.countries ? cat.countries.flatMap(c=>c.items) : cat.items;
    const badge = maxDiscountBadge(allItems);
    if(badge){ discountEl.textContent = badge; discountEl.style.display = ""; }
    else { discountEl.style.display = "none"; }
  }
});

let giftCardState = {catKey:null, country:null};

function updateGiftcardLabel(){
  const cat = giftCatalogs[giftCardState.catKey];
  const labelEl = document.getElementById("giftcard-pkg-label");
  if(!labelEl) return;
  let text = cat.label || "Выберите номинал";
  if(cat.countries && giftCardState.country){
    const c = cat.countries.find(x=>x.code===giftCardState.country);
    if(c && c.label) text = c.label;
  }
  labelEl.textContent = text;
}

function openGiftCards(key){
  if(key==='tgstars'){showToast('Категория временно недоступна');return;}
  const cat = giftCatalogs[key];

  // Карточка с логотипом/названием/описанием сервиса — как у игрового доната.
  // Для Telegram (Stars/Premium) не показываем: там свой отдельный флоу без общего бренд-блока.
  const infoCard = document.getElementById("giftcard-info-card");
  if(key === "tgstars"){
    infoCard.style.display = "none";
  } else {
    infoCard.style.display = "block";
    const logoEl = document.getElementById("giftcard-info-logo");
    logoEl.style.background = cat.img ? `url('${cat.img}') center/cover no-repeat` : "var(--card-2)";
    logoEl.innerHTML = cat.img ? "" : `<span>${cat.logo || ""}</span>`;
    document.getElementById("giftcard-info-name").textContent = cat.title;

    const allItems = cat.countries ? cat.countries.flatMap(c=>c.items) : cat.items;
    const badge = maxDiscountBadge(allItems);
    const badgeEl = document.getElementById("giftcard-info-badge");
    if(badge){ badgeEl.textContent = badge; badgeEl.style.display = "block"; }
    else { badgeEl.style.display = "none"; }
  }

  const tabsWrap = document.getElementById("giftcard-country-tabs");
  if(cat.countries && cat.countries.length > 1){
    giftCardState = {catKey:key, country: cat.countries[0].code};
    tabsWrap.style.display = "flex";
    renderGiftCountryTabs();
  } else {
    giftCardState = {catKey:key, country: cat.countries ? cat.countries[0].code : null};
    tabsWrap.style.display = "none";
    tabsWrap.innerHTML = "";
  }

  updateGiftcardLabel();
  renderGiftGrid();
  showSubView("view-giftcards");
}

function renderGiftCountryTabs(){
  const cat = giftCatalogs[giftCardState.catKey];
  const wrap = document.getElementById("giftcard-country-tabs");
  wrap.innerHTML = cat.countries.map(c=>`<div class="pill ${c.code===giftCardState.country ? "active" : ""}" data-country="${c.code}">${c.name}</div>`).join("");
  wrap.querySelectorAll(".pill").forEach(el=>{
    el.addEventListener("click", ()=>{
      giftCardState.country = el.dataset.country;
      renderGiftCountryTabs();
      updateGiftcardLabel();
      renderGiftGrid();
    });
  });
}

function getCurrentGiftItems(){
  const cat = giftCatalogs[giftCardState.catKey];
  if(cat.countries){
    return cat.countries.find(c=>c.code===giftCardState.country).items;
  }
  return cat.items;
}

function isTgStarsMode(){
  return giftCardState.catKey === "tgstars" && giftCardState.country === "STARS";
}

function isTgPremMode(){
  return giftCardState.catKey === "tgstars" && giftCardState.country === "PREM";
}

function renderGiftGrid(){
  const cat = giftCatalogs[giftCardState.catKey];
  const grid = document.getElementById("giftcard-grid");
  const labelEl = document.getElementById("giftcard-pkg-label");
  const starsWrap = document.getElementById("tg-stars-buy");
  const premWrap = document.getElementById("tg-prem-buy");

  if(isTgStarsMode()){
    grid.style.display = "none";
    labelEl.style.display = "block";
    starsWrap.style.display = "block";
    premWrap.style.display = "none";
    renderTgStarsBuy();
    return;
  }
  if(isTgPremMode()){
    grid.style.display = "none";
    labelEl.style.display = "block";
    starsWrap.style.display = "none";
    premWrap.style.display = "block";
    renderTgPremBuy();
    return;
  }
  grid.style.display = "grid";
  labelEl.style.display = "block";
  starsWrap.style.display = "none";
  premWrap.style.display = "none";

  const items = getCurrentGiftItems();
  grid.innerHTML = items.map((item, idx) => {
    // Фото товара: сначала смотрим на `img` у конкретного номинала (item.img),
    // если его нет — берём общее фото сервиса (cat.img). Если фото нет нигде,
    // остаётся прежний вид с градиентом и логотипом.
    const itemImg = item.img || cat.img || null;
    const favId = `giftcard:${giftCardState.catKey}:${giftCardState.country || "_"}:${idx}`;
    favoriteCandidates[favId] = {
      name: item.name,
      price: `${item.price.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})} ₽`,
      old: `${item.old.toLocaleString("ru-RU")}.00 ₽`,
      grad: item.grad, img: itemImg, sub: item.amount
    };
    // Если в названии товара страна указана в скобках в конце (например
    // "Карта PS Store 250 TRY (Турция)") — убираем её из названия и
    // выводим отдельной строкой снизу, как регион у Mobile Legends
    // (topup-grid-region) в разделе игрового доната.
    const nameMatch = item.name.match(/^(.*)\s\(([^)]+)\)\s*$/);
    const displayName = nameMatch ? nameMatch[1] : item.name;
    const countryLabel = nameMatch ? nameMatch[2] : null;
    return `
    <div class="giftcard" data-catalog-name="${item.name.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}" data-idx="${idx}">
      <div class="giftcard-cover" style="background:${itemImg ? `url('${itemImg}') center/cover no-repeat` : item.grad};">
        ${heartHTML(favId)}
        <div class="giftcard-inner">
          ${itemImg ? "" : `<div class="giftcard-logo">${cat.logo}</div>
          <div class="giftcard-amount-box" style="background:rgba(0,0,0,.28);">
            <div class="giftcard-amount-region">${item.region}</div>
            <div class="giftcard-amount-value">${item.amount}</div>
          </div>`}
        </div>
      </div>
      <div class="giftcard-price">${item.price.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})} ₽<span class="giftcard-old">${item.old.toLocaleString("ru-RU")}.00 ₽</span></div>
      <div class="giftcard-name">${displayName}</div>
      ${countryLabel ? `<div class="giftcard-country">${countryLabel}</div>` : ""}
    </div>`;
  }).join("");
  bindHearts(grid);

  grid.querySelectorAll(".giftcard").forEach(el=>{
    el.addEventListener("click", ()=>{
      openGiftCardPayment(giftCardState.catKey, giftCardState.country, parseInt(el.dataset.idx,10));
    });
  });
}

function openGiftCardPayment(catKey, country, idx){
  const cat = giftCatalogs[catKey];
  const items = cat.countries ? cat.countries.find(c=>c.code===country).items : cat.items;
  const item = items[idx];
  const itemImg = item.img || cat.img || null;
  const isTelegram = catKey === "tgstars";
  openPaymentPage({
    title: cat.title,
    heading: `${item.amount} ${item.region}`,
    itemIcon: cat.logo,
    itemGrad: item.grad,
    itemImg: itemImg,
    itemName: item.name,
    itemPrice: item.price,
    itemOld: item.old || null,
    showId: false,
    showUsername: isTelegram,
    usernameLabel: "@username",
    usernamePlaceholder: "@username",
    usernameErrorText: "Некорректный @username (5–32 символа, латиница, цифры, _)",
    showQty: false,
    onConfirm: (finalPrice, email, qty)=>{
      createOrder(
        [{name:item.name, price:`${formatPrice(finalPrice)} ₽`, qty:1, grad:item.grad, img:itemImg, needsCode:!isTelegram}],
        `${formatPrice(finalPrice)} ₽`,
        email
      );


    }
  });
}

/* ---------- Telegram Stars buy screen (custom layout for the STARS tab) ---------- */
let tgStarsSelectedIdx = 0;

function getTgStarsItems(){
  return giftCatalogs.tgstars.countries.find(c=>c.code==="STARS").items;
}

function renderTgStarsBuy(){
  const items = getTgStarsItems();
  if(tgStarsSelectedIdx >= items.length) tgStarsSelectedIdx = 0;
  const listEl = document.getElementById("tgstars-pkg-list");

  listEl.innerHTML = items.map((item, idx) => {
    const selected = idx === tgStarsSelectedIdx;
    return `
    <div class="tg-pkg-cell ${selected ? "selected" : ""}" data-idx="${idx}">
      <svg class="tg-star-icon" viewBox="0 0 24 24" fill="${selected ? "#FFC107" : "#3AA1E8"}" width="16" height="16"><path d="M12 2.5l2.9 6.4 6.9.7-5.2 4.7 1.6 6.8L12 17.6 5.8 21.1l1.6-6.8-5.2-4.7 6.9-.7z"/></svg>
      <div class="tg-pkg-amount">${item.amount} ⭐</div>
      <div class="tg-pkg-cell-price">${formatPrice(item.price)} ₽</div>
      ${item.old ? `<div class="tg-pkg-cell-old">${formatPrice(item.old)} ₽</div>` : ""}
    </div>`;
  }).join("");

  listEl.querySelectorAll(".tg-pkg-cell").forEach(el=>{
    el.addEventListener("click", ()=>{
      tgStarsSelectedIdx = parseInt(el.dataset.idx, 10);
      renderTgStarsBuy();
    });
  });

  updateTgStarsTotals();
}

function getTgStarsFinalPrice(){
  const item = getTgStarsItems()[tgStarsSelectedIdx];
  return {base: item.price, total: item.price};
}

function updateTgStarsTotals(){
  const {base, total} = getTgStarsFinalPrice();
  const item = getTgStarsItems()[tgStarsSelectedIdx];
  document.getElementById("tgstars-sum").textContent = `${formatPrice(item.old || base)} ₽`;
  const oldDiscountRow = document.getElementById("tgstars-old-discount-row");
  if(item.old){
    oldDiscountRow.style.display = "flex";
    document.getElementById("tgstars-old-discount-amount").textContent = `−${formatPrice(item.old - base)} ₽`;
  } else {
    oldDiscountRow.style.display = "none";
  }
  document.getElementById("tgstars-total").textContent = `${formatPrice(total)} ₽`;
}

document.getElementById("tgstars-username-input").addEventListener("input", ()=>{
  if(document.getElementById("tgstars-username-input").value.trim() !== ""){
    setPaymentFieldError("tgstars-username-input","tgstars-username-error", false);
  }
});


/* Telegram username here must be entered WITH the leading @ (unlike the
   generic payment-username-input elsewhere, which accepts it optional). */
function isValidTelegramUsernameStrict(raw){
  return /^@[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(String(raw || "").trim());
}

function validateTgStarsUsername(){
  const input = document.getElementById("tgstars-username-input");
  const val = input.value.trim();
  const ok = isValidTelegramUsernameStrict(val);
  const errText = val === "" ? "Укажите @username" : "Введите @username с символом @ (5–32 символа, латиница, цифры, _)";
  setPaymentFieldError("tgstars-username-input","tgstars-username-error", !ok, errText);
  if(!ok) input.scrollIntoView({block:"center", behavior:"smooth"});
  return ok;
}

function completeTgStarsPurchase(payMethod){
  if(!validateTgStarsUsername()) return;
  const item = getTgStarsItems()[tgStarsSelectedIdx];
  const {total: finalPrice} = getTgStarsFinalPrice();
  const username = document.getElementById("tgstars-username-input").value.trim();
  createOrder(
    [{name:`Telegram Stars ${item.amount} ⭐ · ${username}`, price:`${formatPrice(finalPrice)} ₽`, qty:1, grad:"linear-gradient(160deg,#2AABEE,#1178B3)", needsCode:false}],
    `${formatPrice(finalPrice)} ₽`,
    null,
    payMethod || "sbp"
  );


}

document.getElementById("tgstars-sbp-btn").addEventListener("click", ()=> completeTgStarsPurchase("sbp"));
document.getElementById("tgstars-other-btn").addEventListener("click", ()=>{
  if(!validateTgStarsUsername()) return;
  showSubView("view-tg-other");
});

/* ---------- Telegram Premium buy screen (отдельный экран для вкладки PREM —
   вертикальный список тарифов вместо сетки, как у Stars, + краткое описание
   преимуществ Premium сверху). ---------- */
let tgPremSelectedIdx = -1;

function getTgPremItems(){
  return giftCatalogs.tgstars.countries.find(c=>c.code==="PREM").items;
}

function tgPremDiscountPercent(item){
  if(!item.old) return 0;
  return Math.round((1 - item.price / item.old) * 100);
}

/* По умолчанию выделяем тариф с наибольшей скидкой — обычно это самый
   долгий срок, он же самый выгодный по цене за месяц. */
function getTgPremDefaultIdx(items){
  let bestIdx = 0, bestDiscount = -1;
  items.forEach((item, idx)=>{
    const d = tgPremDiscountPercent(item);
    if(d > bestDiscount){ bestDiscount = d; bestIdx = idx; }
  });
  return bestIdx;
}

function renderTgPremBuy(){
  const items = getTgPremItems();
  if(tgPremSelectedIdx < 0 || tgPremSelectedIdx >= items.length) tgPremSelectedIdx = getTgPremDefaultIdx(items);
  const listEl = document.getElementById("tgprem-plan-list");

  listEl.innerHTML = items.map((item, idx) => {
    const selected = idx === tgPremSelectedIdx;
    const discount = tgPremDiscountPercent(item);
    return `
    <div class="tg-prem-plan ${selected ? "selected" : ""}" data-idx="${idx}">
      ${discount > 0 ? `<div class="tg-prem-plan-badge">−${discount}%</div>` : ""}
      <div class="tg-prem-radio"></div>
      <div class="tg-prem-plan-mid">
        <div class="tg-prem-plan-period">${item.amount}</div>
      </div>
      <div class="tg-prem-plan-right">
        <div class="tg-prem-plan-price">${formatPrice(item.price)} ₽</div>
        ${item.old ? `<div class="tg-prem-plan-old">${formatPrice(item.old)} ₽</div>` : ""}
      </div>
    </div>`;
  }).join("");

  listEl.querySelectorAll(".tg-prem-plan").forEach(el=>{
    el.addEventListener("click", ()=>{
      tgPremSelectedIdx = parseInt(el.dataset.idx, 10);
      renderTgPremBuy();
    });
  });

  updateTgPremTotals();
}

function getTgPremFinalPrice(){
  const item = getTgPremItems()[tgPremSelectedIdx];
  return {base: item.price, total: item.price};
}

function updateTgPremTotals(){
  const {base, total} = getTgPremFinalPrice();
  const item = getTgPremItems()[tgPremSelectedIdx];
  document.getElementById("tgprem-sum").textContent = `${formatPrice(item.old || base)} ₽`;
  const oldDiscountRow = document.getElementById("tgprem-old-discount-row");
  if(item.old){
    oldDiscountRow.style.display = "flex";
    document.getElementById("tgprem-old-discount-amount").textContent = `−${formatPrice(item.old - base)} ₽`;
  } else {
    oldDiscountRow.style.display = "none";
  }
  document.getElementById("tgprem-total").textContent = `${formatPrice(total)} ₽`;
}

document.getElementById("tgprem-username-input").addEventListener("input", ()=>{
  if(document.getElementById("tgprem-username-input").value.trim() !== ""){
    setPaymentFieldError("tgprem-username-input","tgprem-username-error", false);
  }
});

function validateTgPremUsername(){
  const input = document.getElementById("tgprem-username-input");
  const val = input.value.trim();
  const ok = isValidTelegramUsernameStrict(val);
  const errText = val === "" ? "Укажите @username" : "Введите @username с символом @ (5–32 символа, латиница, цифры, _)";
  setPaymentFieldError("tgprem-username-input","tgprem-username-error", !ok, errText);
  if(!ok) input.scrollIntoView({block:"center", behavior:"smooth"});
  return ok;
}

function completeTgPremPurchase(payMethod){
  if(!validateTgPremUsername()) return;
  const item = getTgPremItems()[tgPremSelectedIdx];
  const {total: finalPrice} = getTgPremFinalPrice();
  const username = document.getElementById("tgprem-username-input").value.trim();
  createOrder(
    [{name:`Telegram Premium ${item.amount} · ${username}`, price:`${formatPrice(finalPrice)} ₽`, qty:1, grad:"linear-gradient(160deg,#8B6CFF,#3A1FB0)", needsCode:false}],
    `${formatPrice(finalPrice)} ₽`,
    null,
    payMethod || "sbp"
  );


}

document.getElementById("tgprem-sbp-btn").addEventListener("click", ()=> completeTgPremPurchase("sbp"));
document.getElementById("tgprem-other-btn").addEventListener("click", ()=>{
  if(!validateTgPremUsername()) return;
  showSubView("view-tg-other");
});

/* Экран "Другие способы оплаты" общий для Stars и Premium — определяем,
   какую покупку завершать, по текущему режиму вкладки. */
document.getElementById("tgother-card").addEventListener("click", ()=>{
  if(isTgPremMode()) completeTgPremPurchase("card"); else completeTgStarsPurchase("card");
});
document.getElementById("tgother-crypto").addEventListener("click", ()=>{
  if(isTgPremMode()) completeTgPremPurchase("crypto"); else completeTgStarsPurchase("crypto");
});
document.getElementById("tgother-back").addEventListener("click", ()=> goBack());


/* ---------- Пользовательское соглашение / Политика конфиденциальности ----------
   Открываются как обычные под-экраны через showSubView, поэтому goBack()
   автоматически возвращает туда, откуда был совершён переход (корзина,
   профиль, страница оплаты и т.д.) — специальная логика по экранам не нужна,
   т.к. viewStack уже хранит историю переходов. */

document.getElementById("terms-row").addEventListener("click", ()=> showSubView("view-agree"));
document.getElementById("privacy-row").addEventListener("click", ()=> showSubView("view-privacy"));

/* Ссылки "Пользовательского соглашения" / "Политики конфиденциальности" внутри
   блока согласия перед оплатой (корзина, страница оплаты, Telegram Stars/Premium). */
document.querySelectorAll(".agree-row .agree-link").forEach(link=>{
  link.addEventListener("click", (e)=>{
    e.preventDefault();
    if(link.textContent.trim().startsWith("Пользовательского")){
      showSubView("view-agree");
    } else {
      showSubView("view-privacy");
    }
  });
});

document.querySelectorAll(".list-row[data-catalog]").forEach(row=>{
  row.style.cursor = "pointer";
  row.addEventListener("click", ()=>{
    const key = row.dataset.catalog;
    // Сервисы с пополнением по ID живут в donateServices (свой флоу
    // с полем ID), подарочные карты — в giftCatalogs. Ключ сам решает,
    // куда вести, поэтому строку списка не нужно вручную привязывать
    // к конкретному экрану.
    if(donateServices[key]) openTopup(key);
    else openGiftCards(key);
  });
});

/* ---------- Sub-view show/hide helpers ----------
   currentView всегда хранит id активного экрана, viewStack — историю
   экранов, через которые пользователь прошёл, чтобы попасть сюда.
   showSubView(id) кладёт текущий экран в стек и открывает новый —
   используется при переходе "вперёд" (открыть товар, оплату и т.д.).
   goBack() возвращает на предыдущий экран из стека (а не всегда на
   главную), и если стек пуст — идёт на главную.
   hideSubView() — это принудительный переход на главную (используется
   в кнопках "Открыть каталог" и после завершения покупки), он также
   сбрасывает стек. */
let currentView = "view-home";
let viewStack = [];
/* Назад: системная кнопка Telegram (с версии 6.1). В старых клиентах и вне
   Telegram показываем свою плавающую кнопку. Сначала закрываются открытые
   подсказки/списки, и только потом происходит переход назад. */
const tgWebApp = window.Telegram?.WebApp;
const tgBack = (tgWebApp?.initData && tgWebApp.isVersionAtLeast?.("6.1")) ? tgWebApp.BackButton : null;
const fallbackBack = tgBack ? null : (() => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "fallback-back";
  b.setAttribute("aria-label", "Назад");
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  b.hidden = true;
  document.getElementById("app").appendChild(b);
  return b;
})();

function closeTopLayer(){
  for(const id of ["pkg-info-overlay", "id-help-overlay"]){
    const el = document.getElementById(id);
    if(el && el.classList.contains("show")){ el.classList.remove("show"); return true; }
  }
  const dropdown = document.getElementById("payment-server-dropdown");
  if(dropdown && dropdown.classList.contains("open")){ dropdown.classList.remove("open"); return true; }
  return false;
}

let backLock = false;
function handleBack(){
  if(backLock) return;           // двойное срабатывание одного нажатия
  backLock = true;
  setTimeout(()=>{ backLock = false; }, 250);
  if(closeTopLayer()) return;
  if(viewStack.length || currentView !== "view-home") goBack();
  else syncBackButton();
}

function syncBackButton(){
  const visible = viewStack.length > 0;
  if(tgBack){ if(visible) tgBack.show(); else tgBack.hide(); }
  if(fallbackBack) fallbackBack.hidden = !visible;
}

if(tgBack){ tgBack.onClick(handleBack); tgBack.hide(); }
if(fallbackBack) fallbackBack.addEventListener("click", handleBack);

/* Кнопки «Перейти к оплате» живут вне прокручиваемой области, иначе
   в части WebView они уезжали вместе с контентом и пропадали. Показываются
   только на своём экране (см. #app[data-view] в styles.css). */
for(const id of ["payment-buy-btn", "topup-custom-buy-btn"]){
  const btn = document.getElementById(id);
  if(btn) document.getElementById("app").appendChild(btn);
}

function tabNameForView(id){
  const map = {"view-home":"home", "view-fav":"fav", "view-purchases":"purchases", "view-profile":"profile"};
  return map[id] || null;
}

function syncNavActiveTab(id){
  const tab = tabNameForView(id);
  document.querySelectorAll(".navitem").forEach(i=>i.classList.remove("active"));
  if(tab){
    const navEl = document.querySelector(`.navitem[data-view="${tab}"]`);
    if(navEl) navEl.classList.add("active");
  }
}

/* Экраны, на которых нижнюю таб-бар панель нужно скрывать, оставляя
   только кнопку "Перейти к оплате" и кнопку "Назад" сверху — сейчас это
   общая страница оплаты (сервисы пополнения + игровой товар). */
/* Экраны, на которых нижнюю таб-бар панель нужно скрывать, оставляя
   только кнопку "Перейти к оплате" и кнопку "Назад" сверху — общая
   страница оплаты (сервисы пополнения + игровой товар), а также форма
   "своя сумма" на экране пополнения (сейчас — Steam RU/KZ). */
function isCheckoutOnlyView(id){
  if(id === "view-agree" || id === "view-privacy"){
    /* Соглашение и Политика — это под-страницы поверх текущего экрана.
       Если их открыли со страницы оплаты "в один клик" (checkout-only),
       то и на них самих нужно скрыть нижнюю таб-бар панель, оставив
       только кнопку "Назад" — наследуем режим у экрана-источника,
       который лежит на вершине viewStack на момент открытия. */
    const origin = viewStack[viewStack.length - 1];
    return isCheckoutOnlyView(origin);
  }
  if(id === "view-payment") return true;
  if(id === "view-topup"){
    const s = donateServices[currentTopup];
    return !!(s && s.customAmount);
  }
  return false;
}

function syncCheckoutMode(id){
  const app = document.getElementById("app");
  app.classList.toggle("checkout-mode", isCheckoutOnlyView(id));
  app.dataset.view = id;
}

/* На страницах "Пользовательское соглашение" и "Политика конфиденциальности"
   (открываются из корзины по ссылкам в согласии) нижняя таб-бар панель прячется —
   там нечего делать, кроме чтения документа. Кнопка "Назад" в шапке этих страниц
   никак не связана с nav-панелью, поэтому остаётся на месте без изменений. */
function syncLegalMode(id){
  const isLegal = id === "view-agree" || id === "view-privacy";
  document.getElementById("app").classList.toggle("legal-mode", isLegal);
}

function showSubView(id){
  if(currentView !== id){
    viewStack.push(currentView);
  }
  currentView = id;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.getElementById("scrollarea").scrollTop = 0;
  syncNavActiveTab(id);
  syncCheckoutMode(id);
  syncLegalMode(id);
  syncBackButton();
}

function goBack(){
  const prev = viewStack.pop() || "view-home";
  currentView = prev;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById(prev).classList.add("active");
  document.getElementById("scrollarea").scrollTop = 0;
  syncNavActiveTab(prev);
  syncCheckoutMode(prev);
  syncLegalMode(prev);
  syncBackButton();
}

function hideSubView(){
  viewStack = [];
  syncBackButton();
  currentView = "view-home";
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById("view-home").classList.add("active");
  document.querySelectorAll(".navitem").forEach(i=>i.classList.remove("active"));
  document.querySelector('.navitem[data-view="home"]').classList.add("active");
  document.getElementById("scrollarea").scrollTop = 0;
  syncCheckoutMode("view-home");
  syncLegalMode("view-home");
}

const titles = {
  home: ["MetraCode", "магазин ключей и подписок"],
  fav: ["Избранное", "сохранённые товары"],
  purchases: ["Мои покупки", "история заказов"],
  profile: ["Профиль", "аккаунт и заказы"]
};

document.querySelectorAll(".navitem").forEach(item=>{
  item.addEventListener("click", ()=>{
    const view = item.dataset.view;
    /* Переход по нижней навигации — это переход на новую вкладку,
       а не "вперёд" внутри текущей, поэтому стек истории сбрасывается. */
    viewStack = [];
    currentView = "view-"+view;
    document.querySelectorAll(".navitem").forEach(i=>i.classList.remove("active"));
    item.classList.add("active");
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    document.getElementById("view-"+view).classList.add("active");
    document.getElementById("scrollarea").scrollTop = 0;
    syncCheckoutMode("view-"+view);
    syncLegalMode("view-"+view);
    syncBackButton();
  });
});


/* ---------- Цены из админки в прямом эфире ----------
   Раз в несколько секунд (и при возврате в приложение) берём актуальные
   цены из /api/products, обновляем данные каталога и сразу перерисовываем
   открытый экран — так же, как это делает stock-sync.js для наличия. */
(() => {
  const norm = value => String(value || '').normalize('NFKC').replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
  let busy = false;

  function applyPrices(products){
    const prices = new Map();
    for(const p of products){
      const price = Number(p.price);
      if(Number.isFinite(price) && price > 0) prices.set(norm(p.name), price);
    }
    let changed = false;
    const update = (item, ...names) => {
      for(const name of names){
        const price = prices.get(norm(name));
        if(price === undefined) continue;
        if(item.price !== price){ item.price = price; changed = true; }
        return;
      }
    };
    for(const cat of Object.values(giftCatalogs)){
      for(const group of cat.countries || [{items: cat.items || []}]){
        for(const item of group.items || []) if(item.name) update(item, item.name);
      }
    }
    for(const svc of Object.values(donateServices)){
      const packages = [...(svc.packages || []), ...(svc.variants || []).flatMap(v => v.packages || [])];
      for(const pkg of packages) update(pkg, `${svc.name} — ${pkg.name}`, pkg.name);
      for(const item of (svc.codesCatalog && svc.codesCatalog.items) || []) update(item, item.name);
    }
    if(!changed) return;

    if(currentView === 'view-giftcards' && giftCardState.catKey) renderGiftGrid();
    if(currentView === 'view-topup' && currentTopup && !donateServices[currentTopup].customAmount) renderTopupPackages();
    if(currentView === 'view-payment' && paymentConfig){
      const price = prices.get(norm(paymentConfig.itemName));
      if(price !== undefined && price !== paymentConfig.itemPrice){
        paymentConfig.itemPrice = price;
        updatePaymentTotals();
      }
    }
  }

  async function syncCatalogPrices(){
    if(busy) return;
    busy = true;
    try{
      const response = await fetch('/api/products', {cache:'no-store'});
      if(!response.ok) return;
      applyPrices(await response.json());
    }catch(e){
      console.warn('Не удалось обновить цены', e);
    }finally{
      busy = false;
    }
  }

  window.syncCatalogPrices = syncCatalogPrices;
  window.addEventListener('focus', syncCatalogPrices);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) syncCatalogPrices(); });
  setInterval(() => { if(!document.hidden) syncCatalogPrices(); }, 5000);
  syncCatalogPrices();
})();
