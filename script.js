/* Включает срабатывание :active на тап пальцем в мобильном Safari/Telegram
   webview — без этого пустого обработчика iOS игнорирует :active на div'ах. */
document.addEventListener("touchstart", function(){}, true);

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

function toggleFavoriteById(id, el){
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
  const ids = Object.keys(favorites);

  if(ids.length === 0){
    view.innerHTML = `<div class="empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7.5-4.9-10-9.3C.5 8.1 2.3 4.5 6 4.1c2-.2 3.6.9 6 3.4 2.4-2.5 4-3.6 6-3.4 3.7.4 5.5 4 4 7.6-2.5 4.4-10 9.3-10 9.3z"/></svg>
      </div>
      <div class="empty-title">Пока пусто</div>
      <div class="empty-sub">Добавляйте игры и подписки в избранное, нажав на сердечко в карточке товара</div>
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
  if(type === "game"){
    openProduct(parts[1], parseInt(parts[2],10));
  } else if(type === "donate"){
    openTopup(parts[1]);
  } else if(type === "giftcard"){
    openGiftCardPayment(parts[1], parts[2] === "_" ? null : parts[2], parseInt(parts[3],10));
  } else if(type === "topuppkg"){
    currentTopup = parts[1];
    topupMode = parts[2];
    goToTopupPayment(parseInt(parts[3],10));
  }
}

/* ---------- Generic promo-code UI helpers (shared by cart / payment / tgstars / tgprem) ---------- */
function setPromoError(prefix, show, text){
  const errEl = document.getElementById(`${prefix}-promo-error`);
  if(text) errEl.textContent = text;
  errEl.classList.toggle("show", show);
  if(show) document.getElementById(`${prefix}-promo-success`).classList.remove("show");
}

function setPromoSuccess(prefix, text){
  const okEl = document.getElementById(`${prefix}-promo-success`);
  okEl.textContent = text;
  okEl.classList.add("show");
  setPromoError(prefix, false);
}

const countryNames = {IN:"Индия", TR:"Турция"};
/* Чтобы вместо флага-эмодзи показать фото рядом с "PS Store Индия/Турция"
   в корзине — впиши ссылку сюда. Оставь null, чтобы остался флаг. */
const countryGroupImg = {IN:null, TR:null};
const editionOrder = ["standard","deluxe","premium"];
const editionLabels = {standard:"Standard", deluxe:"Deluxe", premium:"Premium"};
const gameCountryCodes = ["IN","TR"];

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
  }
};


const games = {
  bestsellers: [
    {name:"GRAND THEFT AUTO VI", edition:null, price:"14 995 ₽", old: "18 000 ₽", img:"https://avatars.mds.yandex.net/get-mpic/16145913/2a0000019f32216e6e123875b004e19690c9/orig", grad:"linear-gradient(135deg,#3A1F5C,#1A0E2E)",editions:{standard:{price:2690, old:5990, byCountry:{IN:{price:1990, old:4490, native:14999}, TR:{price:2290, old:4990, native:1999}}}, ultimate:{price:2690, old:5990,label: "ultimote", byCountry:{IN:{price:1990, old:14490, native:7999}, TR:{price:2290, old:24990, native:8999}}}} },
    {name:"EA FC 26", edition:null, price:"745 ₽", old:"7 450 ₽", badge:"-90%", img:"https://avatars.mds.yandex.net/get-mpic/12300570/2a0000019ad0f74c28f4e0f842000c404c89/orig", grad:"linear-gradient(135deg,#1E1E1E,#0A0A0A)"},
    {name:"Steelbound Trilogy", edition:null, price:"1 310 ₽", old:"5 240 ₽", badge:"-75%", img:"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500'><rect width='400' height='500' fill='%232F6B2F'/><circle cx='200' cy='200' r='90' fill='%23fff' fill-opacity='0.15'/></svg>", grad:"linear-gradient(135deg,#1B3B1B,#0C1C0C)",countries:["IN"] /* доступна только для аккаунтов Индии */},
    {name:"Crimson Order: Origins", edition:"Gold", price:"160 ₽", old:"1 066 ₽", badge:"-85%", img:"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500'><rect width='400' height='500' fill='%23C29A3B'/><circle cx='200' cy='200' r='90' fill='%23fff' fill-opacity='0.15'/></svg>", grad:"linear-gradient(135deg,#8A6A1E,#3D2E0C)"},
    {name:"Ironclad Frontier", edition:"Standard", price:"2 690 ₽", old:"5 990 ₽", badge:"-55%", grad:"linear-gradient(135deg,#123049,#081522)", editions:{standard:{price:2690, old:5990}, ultimate:{price:3890, old:6490, label:"Ultimate"}} /* доступно только издание Standard */},
    {name:"Requiem: Blackout", edition:"Deluxe", price:"3 890 ₽", old:"6 490 ₽", badge:"-40%", grad:"linear-gradient(135deg,#4A1414,#1E0A0A)", editions:{gold:{price:2890, old:5490, label:"Gold"}, ultimate:{price:3890, old:6490, label:"Ultimate Edition"}} /* пример своих названий изданий вместо Standard/Deluxe/Premium */},
    {name:"Solace Drift Racing", edition:null, price:"1 990 ₽", old:"3 490 ₽", badge:"-43%", grad:"linear-gradient(135deg,#2B4A12,#12200A)"},
  ],
  newreleases: [
    {name:"Colony Two", edition:null, price:"3 490 ₽", grad:"linear-gradient(135deg,#2B4A12,#12200A)", editions:{standard:{price:3490, old:null}} /* доступно только издание Standard */},
    {name:"Reaper's Call: Black Ice", edition:null, price:"4 190 ₽", grad:"linear-gradient(135deg,#101018,#050508)"},
    {name:"Skyline Drift", edition:null, price:"2 990 ₽", grad:"linear-gradient(135deg,#123049,#081522)"},
  ]
};

/* Цена на карточке в каталоге (Хиты продаж/Новинки/Предзаказ) теперь не
   вписывается отдельно вручную — она берётся из той же функции, что считает
   цену на странице товара и в корзине (getProductPricing), для издания и
   страны по умолчанию. Так что если у игры задана цена карт пополнения
   (`native`), на главной сразу будет видна именно та сумма, которую реально
   спишут за нужные карты — а не отдельно вписанная цифра, которая могла
   разъехаться с корзиной. Поле `price` в объекте игры при этом используется
   только как запасной вариант, если `native` не задана. */
function cardHTML(g, listKey, idx){
  const favId = `game:${listKey}:${idx}`;
  const {price, old} = getCheapestPricing(g);

  favoriteCandidates[favId] = {
    name: g.name, price, old: old || null,
    grad: g.grad, img: g.img || null, sub: g.edition || null
  };
  return `<div class="game-card" data-list="${listKey}" data-idx="${idx}">
    <div class="cover" style="background:${g.img ? `url('${g.img}') center/cover no-repeat` : g.grad};">
      ${heartHTML(favId)}
      ${g.badge ? `<div class="badge">${g.badge}</div>` : ""}
    </div>
    <div class="game-name">${g.name}</div>
    <div class="price-row"><div class="price">${price}</div></div>
    ${old ? `<div class="old-price">${old}</div>` : ""}
    ${g.edition ? `<div class="game-sub">${g.edition}</div>` : ""}
  </div>`;
}

/* Сама отрисовка каталога (bestsellers/newreleases, если появятся на главной)
   вызывается ниже, в самом конце скрипта — после того как определены
   getGameEditions/getProductPricing и giftCatalogs, потому что cardHTML
   теперь считает "настоящую" цену товара (см. renderCatalogGrids()). */

/* ---------- Cart logic ---------- */
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

function generatePurchaseCode(){
  const seg = ()=> Math.random().toString(36).slice(2,7).toUpperCase();
  return `${seg()}-${seg()}-${seg()}`;
}

function createOrder(items, totalLabel, email){
  // Серверный тестовый заказ: код создаётся только после webhook оплаты
  fetch('/api/products?q='+encodeURIComponent(items[0]?.name||'' )).then(r=>r.json()).then(ps=>{
    return fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Id':window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'demo'},body:JSON.stringify({productId:ps[0]?.id,name:items[0]?.name,amount:parseFloat(String(totalLabel).replace(/[^0-9.,]/g,'').replace(',','.'))||0})}).then(r=>r.json()).then(o=>{if(o.paymentUrl) location.href=o.paymentUrl});
  }).catch(()=>{});
  return;
  /* Кодов пополнения на позицию — ровно столько, сколько реальных карт
     было куплено. Есть два пути:
     — presetCodes: готовый список {code, label} — используется для игр,
       оплаченных картами пополнения PS Store, чтобы под игрой сразу были
       видны все выпавшие карты и номинал каждой (см. чекаут корзины ниже);
     — codesCount: просто сколько одинаковых кодов сгенерировать, без
       подписи номинала. По умолчанию — 1 код на позицию: сервисы
       пополнения (донат-коды, услуги по UID) выдают один код на заказ
       независимо от количества/qty. */
  const itemsWithCodes = items.map(it=>{
    let codes = [];
    let codeLabels = null;
    if(it.needsCode !== false){
      if(it.presetCodes && it.presetCodes.length){
        codes = it.presetCodes.map(c=> c.code);
        codeLabels = it.presetCodes.map(c=> c.label);
      } else {
        codes = Array.from({length: it.codesCount || 1}, ()=> generatePurchaseCode());
      }
    }
    return {...it, codes, codeLabels};
  });
  const order = {
    id: orderIdSeq++,
    date: new Date(),
    items: itemsWithCodes,
    total: totalLabel,
    email: email || null,
    status: "processing"
  };
  orders.unshift(order);
  setTimeout(()=>{
    order.status = "paid";
    if(currentView === "view-purchases") renderPurchases();
  }, 6000 + Math.random()*4000);
  return order;
}

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
      : `<div class="po-note paid">Оплата подтверждена. По вопросам — <a href="https://t.me/metracodehelp" target="_blank" rel="noopener" class="po-support-link">обращаться в поддержку</a>.</div>`;
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

let cart = [];

/* Demo promo codes for the cart (percent off the grand total). Feel free to
   add more — key is matched case-insensitively against what the user types. */
const cartPromoCodes = {"METRA10":10, "STARS15":15, "WELCOME20":20};
let cartPromo = {code:"", discountPercent:0};
let cartFinalTotal = 0;

function isInCart(name){
  return cart.some(c => c.name === name);
}

function addToCart(game){
  const existing = cart.find(c => c.name === game.name);
  if(existing){
    existing.qty += 1;
  } else {
    cart.push({...game, qty:1});
  }
  renderCart();
  flashAdded(game);
}

function removeFromCart(idx){
  cart.splice(idx,1);
  renderCart();
}

function priceToNumber(str){
  if(typeof str !== "string") return Number(str) || 0;
  // Russian formatting uses a space as thousands separator and a comma as decimal separator.
  // Strip spaces/currency symbols, then convert the decimal comma to a dot before parsing,
  // so "503,74 ₽" becomes 503.74 instead of being read as 50374.
  const cleaned = str.replace(/\s|₽/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/* ---------- PS Store card math (used to figure out which recharge cards
   cover the games a person put in the cart) ----------
   Each game in the cart is bought on a specific PS Store account region
   (Индия / Турция). We don't sell the game directly — we sell recharge
   cards for that region's PS Store balance. So for every region present
   in the cart we:
   1) convert each game's ruble price into that region's native currency,
      using the exchange rate implied by the real card prices already
      defined in giftCatalogs.psstore (so it always matches what the
      cards actually cost);
   2) figure out, greedily from the largest denomination down, exactly
      which cards (and how many of each) are needed to cover that amount;
   3) show the leftover balance that will sit on the account afterwards. */
const nativeUnitLabel = {IN:"Rs", TR:"₺"};

function getPsCountryCatalog(code){
  return giftCatalogs.psstore.countries.find(c=>c.code===code);
}

function parseAmountNumber(amountStr){
  return parseInt(String(amountStr).replace(/[^\d]/g,""), 10);
}

/* ₽ per 1 unit of native currency, derived from the first (smallest) card
   in that region's catalog — every other denomination in the catalog is
   priced proportionally to this same rate. */
function getCountryRate(code){
  const cat = getPsCountryCatalog(code);
  const first = cat.items[0];
  return first.price / parseAmountNumber(first.amount);
}

/* Greedily picks cards (largest denomination first) to cover targetAmount
   in the region's native currency. Returns the chosen cards, the total
   native amount they add up to (>= targetAmount), their combined ₽ cost,
   and the leftover balance that stays on the account. */
function calcCardsForAmount(code, targetAmount){
  const cat = getPsCountryCatalog(code);
  const denoms = cat.items
    .map(it=>({amount:parseAmountNumber(it.amount), price:it.price, item:it}))
    .sort((a,b)=> b.amount - a.amount);

  let remaining = Math.max(0, Math.ceil(targetAmount));
  const picks = [];
  denoms.forEach(d=>{
    if(remaining <= 0) return;
    const qty = Math.floor(remaining / d.amount);
    if(qty > 0){
      picks.push({...d, qty});
      remaining -= qty * d.amount;
    }
  });
  if(remaining > 0){
    const smallest = denoms[denoms.length-1];
    const existing = picks.find(p=>p.amount === smallest.amount);
    if(existing) existing.qty += 1; else picks.push({...smallest, qty:1});
    remaining -= smallest.amount;
  }

  /* Греедный проход по убыванию номинала иногда даёт «несколько карт самого
     мелкого номинала» там, где эту же часть суммы закрывает ОДНА карта
     покрупнее почти за ту же цену (например для остатка 448 ₺: 500 ₺ card
     пропускается на первом проходе, т.к. floor(448/500)=0, и добавляются
     2× 250 ₺, хотя 1× 500 ₺ покрывает тот же остаток почти за ту же цену).
     Проверяем именно самый мелкий номинал в итоговом плане (а не только
     случай, когда план целиком состоит из одной позиции) — если он взят
     2+ раза, пробуем заменить эту пачку одной картой покрупнее. */
  const smallestDenom = denoms[denoms.length-1];
  const smallEntry = picks.find(p => p.amount === smallestDenom.amount);
  if(smallEntry && smallEntry.qty > 1){
    const subTotalCost = smallEntry.price * smallEntry.qty;
    const bigger = denoms
      .filter(d => d.amount > smallEntry.amount && d.amount >= smallEntry.amount * smallEntry.qty)
      .sort((a,b)=> a.amount - b.amount)[0];
    if(bigger && bigger.price <= subTotalCost * 1.1){
      picks.splice(picks.indexOf(smallEntry), 1);
      const existingBigger = picks.find(p => p.amount === bigger.amount);
      if(existingBigger) existingBigger.qty += 1; else picks.push({...bigger, qty:1});
    }
  }

  const totalAmount = picks.reduce((s,p)=> s + p.amount*p.qty, 0);
  const totalCost = picks.reduce((s,p)=> s + p.price*p.qty, 0);
  return {picks, totalAmount, totalCost, leftover: totalAmount - targetAmount};
}

function renderCart(){
  const container = document.getElementById("cart-items");
  const headSub = document.getElementById("cx-head-sub");
  const promoToggle = document.getElementById("cx-promo-toggle");
  const promoPanel = document.getElementById("cx-promo-panel");
  const promoApplied = document.getElementById("cx-promo-applied");
  const receipt = document.getElementById("cx-receipt");
  const checkoutCard = document.getElementById("cx-checkout-card");
  const emailInput = document.getElementById("cart-email-input");
  const buyBar = document.getElementById("cx-buybar");
  const totalCount = cart.reduce((s,c)=>s+c.qty,0);

  document.querySelector('.navitem[data-view="cart"] .nav-badge').textContent = totalCount;
  document.querySelector('.navitem[data-view="cart"] .nav-badge').style.display = totalCount>0 ? "flex" : "none";
  titles.cart = ["Корзина", totalCount>0 ? `${totalCount} товар(а)` : "пусто"];

  /* Кнопка "Назад" в шапке корзины нужна только тогда, когда в корзине
     что-то есть (то есть только что был добавлен товар и есть куда
     возвращаться) — если корзина пуста, скрывается весь верхний блок
     целиком (а не только кнопка), чтобы над "Корзина" не оставалось
     пустого отступа. */
  document.getElementById("cart-topbar").style.display = cart.length > 0 ? "flex" : "none";

  if(cart.length === 0){
    container.innerHTML = `<div class="empty-state" style="padding:60px 20px; text-align:center;">
      <div class="empty-title">Корзина пуста</div>
      <div class="empty-sub">Нажмите на товар в каталоге, чтобы добавить его сюда</div>
      <button class="empty-btn" onclick="hideSubView()">Открыть каталог</button>
    </div>`;
    headSub.textContent = "";
    promoToggle.style.display = "none";
    promoPanel.style.display = "none";
    promoApplied.style.display = "none";
    checkoutCard.style.display = "none";
    emailInput.value = "";
    setCartEmailError(false);
    setPromoError("cart", false);
    document.getElementById("cart-promo-success").classList.remove("show");
    buyBar.style.display = "none";
    cartFinalTotal = 0;
    syncCartBuyMode(currentView);
    return;
  }

  headSub.textContent = `${totalCount} ${totalCount===1 ? "товар" : "товара"} в корзине`;

  const withIdx = cart.map((g, idx)=> ({...g, idx}));
  /* Подписки (type "subscription") считаются в общей пачке с играми: обе
     покупаются через баланс PS Store нужного региона, поэтому обе попадают
     в один и тот же расчёт карт пополнения по стране (см. calcCardsForAmount
     ниже) — итоговая цена подписки в корзине тоже определяется картами. */
  const gameItems = withIdx.filter(g=> g.type === "game" || g.type === "subscription");
  const extraItems = withIdx.filter(g=> g.type !== "game" && g.type !== "subscription");
  const presentCountries = ["IN","TR"].filter(code=> gameItems.some(g=> g.country === code));
  const multiCountry = presentCountries.length > 1;
  const countryIcon = {IN:"🇮🇳", TR:"🇹🇷"};

  let grandTotal = 0;
  let html = "";

  const productRow = g => `
    <div class="cx-product">
      <div class="cx-product-cover" style="background:${g.img ? `url('${g.img}') center/cover no-repeat` : g.grad};"></div>
      <div class="cx-product-info">
        <div class="cx-product-name">${g.name}</div>
        <div class="cx-product-meta">${g.metaLine || ""}</div>
      </div>
      <div class="cx-product-right">
        <div class="cx-product-price">${g.price}${g.qty > 1 ? `<span class="cx-product-qty">× ${g.qty}</span>` : ""}</div>
        <button class="cx-remove-btn" data-remove="${g.idx}" aria-label="Убрать из корзины">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </div>
    </div>`;

  presentCountries.forEach(code=>{
    const countryName = countryNames[code];
    const unit = nativeUnitLabel[code];
    const rate = getCountryRate(code);
    const itemsForCountry = gameItems.filter(g=> g.country === code);
    itemsForCountry.forEach(it=> {
      it.nativeUnitAmount = (typeof it.nativePrice === "number") ? it.nativePrice : Math.round(it.priceNum / rate);
      it.metaLine = `Цена в PS Store ${formatPrice(it.nativeUnitAmount)} ${unit}`;
    });
    const totalNative = itemsForCountry.reduce((s,it)=> s + it.nativeUnitAmount*it.qty, 0);
    const {picks, totalAmount, totalCost, leftover} = calcCardsForAmount(code, totalNative);
    grandTotal += totalCost;

    const minDenom = Math.min(...getPsCountryCatalog(code).items.map(it=> parseAmountNumber(it.amount)));

    html += `<div class="cx-group">
      <div class="cx-group-head">
        <div class="cx-group-icon" style="${countryGroupImg[code] ? `background:url('${countryGroupImg[code]}') center/cover no-repeat;` : ""}">${countryGroupImg[code] ? "" : (countryIcon[code] || "🎮")}</div>
        <div class="cx-group-head-text">
          <div class="cx-group-title">PS Store ${multiCountry ? countryName : ""}</div>
          <div class="cx-group-sub">${formatPrice(totalCost)} ₽ · карты пополнения баланса</div>
        </div>
      </div>
      <div class="cx-note">Лучший набор карт для оплаты выбранного — номиналов ниже ${formatPrice(minDenom)} ${unit} нет.</div>
      ${picks.map(p=>{
        const badgeImg = p.item.img || giftCatalogs.psstore.img;
        return `
        <div class="cx-denomrow">
          <div class="cx-denom-badge" style="background:url('${badgeImg}') center/cover no-repeat;"></div>
          <div class="cx-denom-text">Номинал ${formatPrice(p.amount)} ${unit} × ${p.qty}</div>
          <div class="cx-denom-price">${formatPrice(p.price*p.qty)} ₽</div>
        </div>`;
      }).join("")}
      <div class="cx-confirm">
        <div class="cx-confirm-tick">✓</div>
        <div>Карт на ${formatPrice(totalAmount)} ${unit} хватит на все товары ниже.${leftover>0 ? ` Остаток ${formatPrice(leftover)} ${unit} останется на аккаунте.` : ""}</div>
      </div>
      ${itemsForCountry.map(productRow).join("")}
    </div>`;
  });

  if(extraItems.length){
    html += `<div class="cx-group">
      <div class="cx-group-head">
        <div class="cx-group-icon">🎁</div>
        <div class="cx-group-head-text">
          <div class="cx-group-title">Подписки и пополнения</div>
          <div class="cx-group-sub">Оплачиваются напрямую</div>
        </div>
      </div>
      ${extraItems.map(g=> {
        grandTotal += priceToNumber(g.price) * g.qty;
        return productRow(g);
      }).join("")}
    </div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll("[data-remove]").forEach(el=>{
    el.addEventListener("click",(e)=>{ e.stopPropagation(); removeFromCart(parseInt(el.dataset.remove,10)); });
  });

  const oldPriceDiscount = withIdx.reduce((s,g)=> s + (g.oldNum ? (g.oldNum - g.priceNum) * g.qty : 0), 0);

  const discountAmount = cartPromo.discountPercent ? Math.round(grandTotal * cartPromo.discountPercent / 100) : 0;
  const finalTotal = grandTotal - discountAmount;
  cartFinalTotal = finalTotal;

  /* Способ оплаты выбирается прямо здесь, в корзине (как и на странице
     "оплата сразу"), поэтому итоговая сумма чека сразу пересчитывается под
     выбранный способ — картой дороже на комиссию эквайринга, криптой дешевле. */
  const cardTotal = getCardPrice(finalTotal);
  const cryptoTotal = getCryptoPrice(finalTotal);
  const payTotal = cartPayMethod === "card" ? cardTotal : (cartPayMethod === "crypto" ? cryptoTotal : finalTotal);

  document.querySelectorAll("#cart-pay-methods .pay-method").forEach(el=>{
    el.classList.toggle("selected", el.dataset.pay === cartPayMethod);
  });

  if(cartPromo.code){
    promoToggle.style.display = "none";
    promoPanel.style.display = "none";
    promoApplied.style.display = "flex";
    document.getElementById("cx-promo-code-label").textContent = `${cartPromo.code} (−${cartPromo.discountPercent}%)`;
  } else {
    promoToggle.style.display = "flex";
    promoApplied.style.display = "none";
  }

  const goodsOldTotal = grandTotal + oldPriceDiscount;

  receipt.innerHTML = `<div class="cx-receipt-row"><span>Товары (${totalCount})</span><span>${formatPrice(goodsOldTotal)} ₽</span></div>
    ${oldPriceDiscount>0 ? `<div class="cx-receipt-row" style="color:var(--green);"><span>Скидка</span><span>−${formatPrice(oldPriceDiscount)} ₽</span></div>` : ""}
    ${discountAmount>0 ? `<div class="cx-receipt-row" style="color:var(--green);"><span>Промокод ${cartPromo.code}</span><span>−${formatPrice(discountAmount)} ₽</span></div>` : ""}
    <div class="cx-receipt-dash"></div>
    <div class="cx-receipt-total"><span>Итого к оплате</span><b>${formatPrice(payTotal)} ₽</b></div>`;

  checkoutCard.style.display = "block";
  buyBar.style.display = "block";
  syncCartBuyMode(currentView);
}

/* ---------- Cart checkout: promo code ---------- */
document.getElementById("cart-promo-input").addEventListener("input", ()=>{
  setPromoError("cart", false);
  document.getElementById("cart-promo-success").classList.remove("show");
});

document.getElementById("cart-promo-apply-btn").addEventListener("click", ()=>{
  const raw = document.getElementById("cart-promo-input").value.trim();
  const code = raw.toUpperCase();

  if(!code){
    cartPromo = {code:"", discountPercent:0};
    setPromoError("cart", true, "Введите промокод");
    renderCart();
    return;
  }

  if(cartPromoCodes[code]){
    cartPromo = {code, discountPercent: cartPromoCodes[code]};
    renderCart();
  } else {
    cartPromo = {code:"", discountPercent:0};
    setPromoError("cart", true, "Промокод недействителен");
  }
});

document.getElementById("cx-promo-toggle").addEventListener("click", ()=>{
  const toggle = document.getElementById("cx-promo-toggle");
  const panel = document.getElementById("cx-promo-panel");
  const willOpen = panel.style.display === "none";
  panel.style.display = willOpen ? "block" : "none";
  toggle.classList.toggle("open", willOpen);
  if(willOpen) setTimeout(()=> document.getElementById("cart-promo-input").focus(), 50);
});

document.getElementById("cx-promo-remove").addEventListener("click", ()=>{
  cartPromo = {code:"", discountPercent:0};
  document.getElementById("cart-promo-input").value = "";
  setPromoError("cart", false);
  document.getElementById("cart-promo-success").classList.remove("show");
  renderCart();
});

/* ---------- Cart checkout: email + agreement ---------- */
/* The agreement checkbox is always on and cannot be unchecked. */
function setCartEmailError(show){
  document.getElementById("cart-email-input").classList.toggle("error", show);
  document.getElementById("cart-email-error").classList.toggle("show", show);
}

document.getElementById("cart-email-input").addEventListener("input", ()=>{
  if(document.getElementById("cart-email-input").value.trim() !== ""){
    setCartEmailError(false);
  }
});

/* ---------- Cart checkout: способ оплаты (прямо в корзине, как и на
   странице "оплата сразу" — без перехода на отдельную страницу) ---------- */
let cartPayMethod = "sbp";

/* Цена корзины в cartFinalTotal — это цена по СБП (как и на странице
   "оплата сразу"). Оплата картой дороже на 3% комиссии эквайринга (getCardPrice),
   оплата криптой дешевле цены по СБП на 2% (getCryptoPrice). */
function getCartPayTotal(){
  const sbpTotal = cartFinalTotal || 0;
  if(cartPayMethod === "card") return getCardPrice(sbpTotal);
  if(cartPayMethod === "crypto") return getCryptoPrice(sbpTotal);
  return sbpTotal;
}

document.querySelectorAll("#cart-pay-methods .pay-method").forEach(el=>{
  el.addEventListener("click", ()=>{
    document.querySelectorAll("#cart-pay-methods .pay-method").forEach(x=>x.classList.remove("selected"));
    el.classList.add("selected");
    cartPayMethod = el.dataset.pay;
    renderCart();
  });
});

document.getElementById("cart-buy-btn").addEventListener("click", ()=>{
  const email = document.getElementById("cart-email-input").value.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if(!emailValid){
    setCartEmailError(true);
    document.getElementById("cart-email-input").scrollIntoView({block:"center", behavior:"smooth"});
    return;
  }
  setCartEmailError(false);

  /* Тот же расчёт "какими картами пополнения оплачивается покупка", что и
     в renderCart (группировка по стране + calcCardsForAmount). Позиция в
     заказе остаётся просто игрой — но из неё выпадает весь список карт,
     которыми она оплачена, с номиналом каждой. Если в одной стране куплено
     несколько игр сразу, карты (общие на всю группу) прикрепляются к
     последней игре группы, чтобы коды отображались одним блоком внизу
     под всеми играми группы, а не дублировались под каждой. */
  const withIdx = cart.map((c, idx)=> ({...c, idx}));
  const gameItems = withIdx.filter(g=> g.type === "game" || g.type === "subscription");
  const extraItems = withIdx.filter(g=> g.type !== "game" && g.type !== "subscription");
  const presentCountries = ["IN","TR"].filter(code=> gameItems.some(g=> g.country === code));

  const orderItems = [];

  presentCountries.forEach(code=>{
    const rate = getCountryRate(code);
    const itemsForCountry = gameItems.filter(g=> g.country === code);
    const totalNative = itemsForCountry.reduce((s,it)=>{
      const nativeUnitAmount = (typeof it.nativePrice === "number") ? it.nativePrice : Math.round(it.priceNum / rate);
      return s + nativeUnitAmount * it.qty;
    }, 0);
    const {picks} = calcCardsForAmount(code, totalNative);
    const cardCodes = buildCountryCardCodes(code, picks);

    itemsForCountry.forEach((it, i)=>{
      const isLast = i === itemsForCountry.length - 1;
      if(isLast){
        orderItems.push({name:it.name, price:it.price, qty:it.qty, img:it.img, grad:it.grad, presetCodes: cardCodes});
      } else {
        orderItems.push({name:it.name, price:it.price, qty:it.qty, img:it.img, grad:it.grad, needsCode:false});
      }
    });
  });

  extraItems.forEach(it=>{
    orderItems.push({name:it.name, price:it.price, qty:it.qty, img:it.img, grad:it.grad});
  });

  createOrder(
    orderItems,
    `${formatPrice(getCartPayTotal())} ₽`,
    email
  );
  showToast("Заказ оформлен");
  cart = [];
  cartPromo = {code:"", discountPercent:0};
  cartPayMethod = "sbp";
  renderCart();
  setTimeout(()=> hideSubView(), 900);
});

/* Строит список выпадающих карт пополнения под игрой: по одному коду на
   каждую физическую карту из picks, с подписью её номинала — это именно
   то, что показывалось в корзине как "Номинал X ₺/₹ × N". */
function buildCountryCardCodes(country, picks){
  const unit = nativeUnitLabel[country];
  const list = [];
  picks.forEach(p=>{
    for(let i=0;i<p.qty;i++){
      list.push({code: generatePurchaseCode(), label: `Номинал ${formatPrice(p.amount)} ${unit}`});
    }
  });
  return list;
}

let cartAddToastTimer = null;
function flashAdded(item){
  const toast = document.getElementById("cart-add-toast");
  const thumb = document.getElementById("cart-add-thumb");
  const nameEl = document.getElementById("cart-add-name");

  const name = typeof item === "string" ? item : item.name;
  const img = typeof item === "object" ? item.img : null;
  const grad = typeof item === "object" ? item.grad : null;

  thumb.style.background = img ? `url('${img}') center/cover no-repeat` : (grad || "var(--accent-grad)");
  nameEl.textContent = name;

  clearTimeout(cartAddToastTimer);
  toast.classList.remove("show");
  void toast.offsetWidth; // restart animation if triggered again quickly
  toast.classList.add("show");

  const badge = document.querySelector('.navitem[data-view="cart"] .nav-badge');
  badge.classList.remove("bump");
  void badge.offsetWidth;
  badge.classList.add("bump");

  cartAddToastTimer = setTimeout(()=> toast.classList.remove("show"), 1100);
}

document.getElementById("cart-add-card").addEventListener("click", ()=>{
  clearTimeout(cartAddToastTimer);
  document.getElementById("cart-add-toast").classList.remove("show");
  goToCart();
});

function showToast(text){
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = "position:fixed; left:50%; bottom:90px; transform:translateX(-50%); background:var(--green,#17A876); color:#0A0F1C; padding:10px 18px; border-radius:30px; font-size:13px; font-weight:700; z-index:999; box-shadow:0 6px 18px rgba(0,0,0,.4);";
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 1600);
}

/* Клик по карточкам bestsellers/newreleases теперь навешивается в самом
   конце скрипта — там же, где эти карточки отрисовываются (см. ниже). */

/* ---------- Product detail (game) ---------- */
const gameDescriptions = [
  "Погрузитесь в захватывающий мир игры с проработанным сюжетом, динамичным геймплеем и потрясающей графикой. Издание включает базовую игру и все объявленные дополнения.",
  "Одна из самых ожидаемых игр года. Исследуйте огромный открытый мир, выполняйте сюжетные задания и прокачивайте своего персонажа.",
  "Легендарная серия продолжается. Новая часть предлагает переработанный движок, улучшенную боевую систему и множество новых локаций.",
];

/* To limit a specific game to only certain account regions, add a `countries` array
   to that game in the `games` list above, e.g.:
   countries: ["IN"]
   Omit it entirely to keep the game available for every region in gameCountryCodes. */
function getGameCountries(g){
  return (g.countries && g.countries.length) ? g.countries : gameCountryCodes;
}

/* Edition tiers. Default multipliers are applied on top of each game's base price/old
   so every game gets Standard/Deluxe/Premium out of the box. To set a specific game's
   real prices per edition later, just add an `editions` object to that game in the
   `games` list above, e.g.:
   editions: { standard:{price:2990, old:null}, deluxe:{price:3990, old:null}, premium:{price:4990, old:null} }
   Any edition you omit from that object simply won't be offered for that game -
   e.g. editions: { standard:{price:2990, old:null} } makes the game Standard-only.
   The keys don't have to be standard/deluxe/premium — you can use any name you want,
   e.g. editions: { gold:{price:2990, old:null, label:"Gold"}, ultimate:{price:4990, old:null, label:"Ultimate"} }
   The `label` is what's shown to the user; without it, standard/deluxe/premium fall
   back to their default Russian-friendly names and any other key is shown as-is
   (capitalized). Object key order = the order the tabs are shown in. */
const editionMultiplier = {standard:1, deluxe:1.25, premium:1.6};

function getGameEditions(g){
  if(g.editions) return g.editions;
  const basePrice = priceToNumber(g.price);
  const baseOld = g.old ? priceToNumber(g.old) : null;
  const result = {};
  editionOrder.forEach(key=>{
    const mult = editionMultiplier[key];
    result[key] = {
      price: Math.round(basePrice * mult),
      old: baseOld ? Math.round(baseOld * mult) : null
    };
  });
  return result;
}

/* Which edition keys to actually offer for this game, in display order. If the game
   has a custom `editions` object, its own keys are used verbatim (any names, any
   order) — not filtered against the default standard/deluxe/premium list. */
function getEditionKeys(g){
  const editions = getGameEditions(g);
  return Object.keys(editions).filter(k=>editions[k]);
}

/* Display name for a given edition tier: uses the game's own `label` override
   if it set one, otherwise falls back to the default Standard/Deluxe/Premium name,
   otherwise shows the raw key capitalized. */
function getEditionLabel(g, key){
  const editions = getGameEditions(g);
  if(editions[key] && editions[key].label) return editions[key].label;
  if(editionLabels[key]) return editionLabels[key];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function renderProductDescription(g, listKey, idx){
  document.getElementById("product-desc").textContent = gameDescriptions[idx % gameDescriptions.length];
}

let productDetailState = {listKey:null, idx:null, country:"IN", edition:"standard"};

function openProduct(listKey, idx){
  const g = games[listKey][idx];
  const favId = `game:${listKey}:${idx}`;
  const defaultEdition = getEditionKeys(g)[0] || "standard";
  const defaultCountry = getGameCountries(g)[0];
  productDetailState = {listKey, idx, country:defaultCountry, edition:defaultEdition};

  document.getElementById("product-topbar-title").textContent = g.name;
  const cover = document.getElementById("product-cover");
  cover.style.background = g.img ? `url('${g.img}') center/cover no-repeat` : g.grad;
  cover.innerHTML = "";
  document.getElementById("product-name").textContent = g.name;
  const heartSlot = document.getElementById("product-heart-slot");
  heartSlot.innerHTML = heartHTML(favId, "inline");
  bindHearts(heartSlot);
  renderProductDescription(g, listKey, idx);

  renderProductEditionTabs();
  renderProductCountryTabs();
  updateProductPrice();

  showSubView("view-product");
}

function renderProductEditionTabs(){
  const g = games[productDetailState.listKey][productDetailState.idx];
  const keys = getEditionKeys(g);
  const wrap = document.getElementById("product-edition-tabs");
  wrap.innerHTML = keys.map(k=>`<div class="pill ${k===productDetailState.edition ? "active" : ""}" data-edition="${k}">${getEditionLabel(g,k)}</div>`).join("");
  wrap.querySelectorAll(".pill").forEach(el=>{
    el.addEventListener("click", ()=>{
      productDetailState.edition = el.dataset.edition;
      renderProductEditionTabs();
      updateProductPrice();
    });
  });
}

function renderProductCountryTabs(){
  const g = games[productDetailState.listKey][productDetailState.idx];
  const codes = getGameCountries(g);
  const wrap = document.getElementById("product-country-tabs");
  wrap.innerHTML = codes.map(c=>`<div class="pill ${c===productDetailState.country ? "active" : ""}" data-country="${c}">${countryNames[c]}</div>`).join("");
  wrap.querySelectorAll(".pill").forEach(el=>{
    el.addEventListener("click", ()=>{
      productDetailState.country = el.dataset.country;
      renderProductCountryTabs();
      updateProductPrice();
    });
  });
}

/* Цена берётся из `editions.price` / `editions.old` (или из авто-рассчитанных тиров
   Standard/Deluxe/Premium, если у игры нет своих `editions`) и показывается как есть,
   одинаково для всех стран — ЕСЛИ вы не зададите цену отдельно для страны.

   Чтобы у конкретного издания была своя цена в конкретной стране, добавьте в тир
   издания поле `byCountry` с кодом страны в качестве ключа:

   editions: {
     standard: {
       price: 2690, old: 5990,           // цена по умолчанию (для стран, для которых нет byCountry)
       byCountry: {
         IN: { price: 1990, old: 4490 }, // своя цена для Индии
         TR: { price: 2290, old: 4990 }  // своя цена для Турции
       }
     },
     ultimate: { price: 3890, old: 6490 } // у этого издания цена одна для всех стран
   }

   Страну для товара не нужно указывать отдельно в byCountry — достаточно, чтобы
   код страны совпадал с одним из кодов в `gameCountryCodes` / `countries` игры.

   ЦЕНА В PS STORE (Rs / ₺) — от неё в корзине считается, какие карты пополнения
   нужны покупателю. По умолчанию она пересчитывается автоматически из цены в ₽
   по курсу карт из каталога PS Store — но курс PS Store меняется, а ваша цена в ₽
   не обязана двигаться синхронно с ним. Поэтому лучше задавать её вручную: добавьте
   в тир издания (или в его `byCountry`) поле `native` с ценой в местной валюте:

   editions: {
     standard: {
       price: 2690, old: 5990,
       native: { IN: 7499 },             // цена в PS Store Индии, в Rs
       byCountry: {
         IN: { price: 1990, old: 4490, native: 7499 }, // если для страны своя ₽-цена — native тоже сюда
         TR: { price: 2290, old: 4990, native: 2999 }  // цена в PS Store Турции, в ₺
       }
     }
   }

   Если `native` не указана для страны — сумма для карт будет по-прежнему считаться
   автоматически из ₽-цены (как раньше), так что ничего не сломается, если вы
   заполните native только для части игр.

   ВАЖНО: если `native` задана, поле `price`/`byCountry.price` в рублях для этой
   страны использовать не для показа цены — реальная цена, которая показывается
   и на главной, и на странице товара, и попадает в корзину, теперь считается
   ОТ native: это стоимость карт пополнения, которые реально понадобятся, чтобы
   набрать нужную сумму в Rs/₺ (см. calcCardsForAmount). Так цена на витрине
   всегда совпадает с тем, что покупатель увидит в корзине. Поле `price` при
   этом используется только как запасной вариант для стран без `native`. */
function getProductPricing(g, edition, country){
  const editions = getGameEditions(g);
  const tier = editions[edition] || editions[Object.keys(editions)[0]];
  const override = tier.byCountry && tier.byCountry[country];
  const source = override || tier;
  const old = source.old ? `${formatPrice(source.old)} ₽` : null;
  const nativeOverride = (override && typeof override.native === "number") ? override.native
    : (tier.native && typeof tier.native[country] === "number") ? tier.native[country]
    : null;

  if(nativeOverride != null){
    // Реальная цена = стоимость карт пополнения, которые понадобятся на эту сумму.
    const realCost = calcCardsForAmount(country, nativeOverride).totalCost;
    return {
      price: `${formatPrice(realCost)} ₽`,
      old,
      priceNum: realCost,
      oldNum: source.old || null,
      nativePrice: nativeOverride
    };
  }

  const price = `${formatPrice(source.price)} ₽`;
  return {price, old, priceNum: source.price, oldNum: source.old || null, nativePrice: null};
}

/* Самая дешёвая цена по игре — перебирает все издания и все доступные страны
   (с учётом byCountry/native-переопределений) и возвращает пейлоад
   getProductPricing с наименьшим priceNum. Используется для карточек на
   главной (Хиты продаж/Предзаказ/Новинки), чтобы там сразу было видно
   минимальную цену за игру, а не цену первого попавшегося издания/страны. */
function getCheapestPricing(g){
  const editionKeys = getEditionKeys(g);
  const countries = getGameCountries(g);
  let best = null;
  editionKeys.forEach(ed=>{
    countries.forEach(c=>{
      const pricing = getProductPricing(g, ed, c);
      if(!best || pricing.priceNum < best.priceNum) best = pricing;
    });
  });
  return best;
}

function updateProductPrice(){
  const g = games[productDetailState.listKey][productDetailState.idx];
  const {price, old} = getProductPricing(g, productDetailState.edition, productDetailState.country);

  document.getElementById("product-price").textContent = price;
  document.getElementById("product-old").textContent = old || "";
  document.getElementById("product-old").style.display = old ? "block" : "none";

  updateProductBuyState();
}

function updateProductBuyState(){
  const g = games[productDetailState.listKey][productDetailState.idx];
  const countryName = countryNames[productDetailState.country];
  const editionLabel = getEditionLabel(g, productDetailState.edition);
  const {price, priceNum, oldNum, nativePrice} = getProductPricing(g, productDetailState.edition, productDetailState.country);
  const name = `${g.name} (${editionLabel}, ${countryName})`;

  const buyBtn = document.getElementById("product-buy-btn");
  if(isInCart(name)){
    buyBtn.classList.add("buy-btn-added");
    buyBtn.style.background = "var(--green)";
    buyBtn.textContent = "Перейти в корзину";
    buyBtn.onclick = ()=> goToCart();
  } else {
    buyBtn.classList.remove("buy-btn-added");
    buyBtn.style.background = "";
    buyBtn.textContent = "Добавить в корзину";
    buyBtn.onclick = ()=>{
      addToCart({
        name,
        edition: `${editionLabel} · ${countryName}`,
        price,
        grad: g.grad,
        img: g.img || null,
        type: "game",
        country: productDetailState.country,
        priceNum,
        oldNum,
        nativePrice
      });
      updateProductBuyState();
    };
  }
}

function goToCart(){
  clearTimeout(cartAddToastTimer);
  document.getElementById("cart-add-toast").classList.remove("show");
  showSubView("view-cart");
}

document.getElementById("product-back").addEventListener("click", ()=> goBack());
document.getElementById("cart-back").addEventListener("click", ()=> goBack());

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
    idHelp:{img:"images/pubg/pre.jpg", text:"Откройте PUBG Mobile, зайдите в профиль — ваш UID отображается под именем персонажа и состоит из 9–10 цифр."},
    pkgLabel:{direct:"Быстрое пополнение UC по UID по самым низким ценам. Пополнение происходит автоматически в течении 5-10 минут. Желаем удачной игры, друг!", codes:"Быстрое пополнение WOW Coins для Пабг Мобайл по UID. Пополнение происходит автоматически в течении 5-10 минут. Желаем приятной игры, друг!"},
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
    idHelp:{img:"images/mlbb/mbl.jpg", text:"Откройте Mobile Legends, нажмите на аватар в левом верхнем углу — там будут указаны User ID и Zone ID (через дефис)."},
    zoneIdLabel:"Zone ID", zoneIdPattern:/^\d+$/, zoneIdErrorText:"Zone ID — только цифры",
    zoneIdHelp:{img:"images/mlbb/mbl.jpg", text:"Zone ID — это цифры после дефиса рядом с User ID в профиле игры, например 1234-5678, где 5678 и есть Zone ID."},
    pkgLabel:"Покупайте алмазы Мобайл Легендс, стильные скины уже ждут Вас. Пополнение по Player ID и Zone ID — никакие данные не нужны. Пополнение в течении 5 минут. Покупай и наслаждайся. Удачной игры, друг!",
    img:"images/mlbb/mbl.jpg",
    packages:[
      {name:"Недельный пропуск", displayName:"<span class=\"topup-grid-main\">Недельный пропуск</span><span class=\"topup-grid-region\">РОССИЯ</span>", price:3190, old:3650, img:"images/mlbb/week.jpg"},
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
    idHelp:{img:"images/freefire/prev.jpg", text:"Откройте Free Fire, зайдите в профиль — ваш UID отображается под ником и состоит из 8–9 цифр."},
    pkgLabel:"Покупайте жетоны для Honor of Kings и наслаждайтесь любимой игрой блистая на поле боя. Пополнение проходит по ID, никакие данные не требуются. Пополнение в течении 5-10 минут. Удачной игры, друг!",
    img:"images/honor/logo.png",
    packages:[
      {name:"Недельная карта", displayName:"<span class=\"topup-grid-main\">Недельная карта</span>", price:4590, old:5490, img:"images/honor/week.png"},
      {name:"Недельная карта плюс", displayName:"<span class=\"topup-grid-main\">Недельная карта плюс</span>", price:4590, old:5490, img:"images/honor/plus.png"},
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
    idHelp:{img:"https://i.pinimg.com/474x/7d/56/3d/7d563d48cb47c3ff7ffeadb545697a4f.jpg", text:"Откройте Identity V и нажмите на иконку профиля слева от шестерёнки — под вашим именем отобразится ID, состоящий из 7–8 цифр."},
    serverLabel:"Выберите Ваш сервер", serverOptions:["NA and EU","Asia"],
    pkgLabel:{
      echoes:"БУ! Здесь для Вас Печати по самым низким ценам. Пополнение по ID в течении 5-10 минут. Желаем классно провести время за любимой игрой, друг!",
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
        packages:[
          {name:"Пакет сфера памяти", displayName:"<span class=\"topup-grid-main\">Пакет сфера памяти</span>", price:299, old:339,img:"images/identity/mem.png", grad:"linear-gradient(160deg,#5A2E4A,#1E0A16)"},
          {name:"Пакет вдохновения", displayName:"<span class=\"topup-grid-main\">Пакет вдохновения</span>", price:549, old:620,img:"images/identity/insp.png", grad:"linear-gradient(160deg,#5A2E4A,#1E0A16)"},
          {name:"Пакет пазлов", displayName:"<span class=\"topup-grid-main\">Пакет пазлов</span>", price:990, old:1120,img:"images/identity/clu.png", grad:"linear-gradient(160deg,#5A2E4A,#1E0A16)"},
        ]
      }
    ]
  },
  pubgpc: {
    name:"PUBG PC", grad:"linear-gradient(135deg,#274038,#0E1A16)", img:"images/pubgpc/logo.jpg",
    pkgLabel:"Покупайте G-Coins для PUBG на ПК и выделяйтесь на поле битвы. Код придет в раздел «Мои покупки» в течении 5-10 минут. Желаем приятной игры и крупных побед, друг!",
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
      img:null,
      text:"Откройте Steam → ваш профиль → скопируйте ссылку из адресной строки. Логин и пароль от аккаунта передавать не нужно."
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
  marvelrivals: {
    name:"Marvel Rivals", grad:"linear-gradient(135deg,#5A1414,#160505)",img:"images/marvel/logo.png", icon:"🦸",
    idLabel:"UID", idPattern:/^\d+$/, idErrorText:"UID — только цифры",
    idHelp:{img:"images/marvel/logo.png", text:"Откройте Marvel Rivals, зайдите в профиль — ваш UID отображается под именем персонажа."},
    pkgLabel:"Покупайте латтисы и собирайте коллекции лимитированных образов. Пополнение по ID в течении 5-10 минут. Желаем приятной игры, друг!",
    packages:[
      {name:"Pick-Up Bundle", displayName:"<span class=\"topup-grid-main\">Pick-Up Bundle", price:449, old:499,img:"images/marvel/pick.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
      {name:"100 lattices", displayName:"<span class=\"topup-grid-main\">100 lattices", price:449, old:499,img:"images/marvel/100.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
      {name:"500 lattices", displayName:"<span class=\"topup-grid-main\">500 lattices", price:849, old:949,img:"images/marvel/500.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
      {name:"1000 lattices", displayName:"<span class=\"topup-grid-main\">1000 lattices", price:1650, old:1890,img:"images/marvel/1000.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
      {name:"2180 lattices", displayName:"<span class=\"topup-grid-main\">2180 lattices", price:2690, old:3150,img:"images/marvel/2180.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
      {name:"5680 lattices", displayName:"<span class=\"topup-grid-main\">5680 lattices", price:3990, old:4720,img:"images/marvel/5680.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
      {name:"11680 lattices", displayName:"<span class=\"topup-grid-main\">11680 lattices", price:3990, old:4720,img:"images/marvel/11680.png", grad:"linear-gradient(160deg,#8E2E3E,#240F14)"},
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
    name:"Netflix", grad:"linear-gradient(135deg,#7A0C0C,#1A0000)", icon:"🎬",
    pkgLabel:"Выберите тариф подписки Netflix. Данные для входа придут в раздел «Мои покупки» в течение 5-10 минут после оплаты.",
    packages:[
      {name:"Standard — 1 месяц", price:499, old:699},
      {name:"Standard — 3 месяца", price:1390, old:1890},
      {name:"Premium — 1 месяц", price:699, old:999},
      {name:"Premium — 3 месяца", price:1890, old:2690},
    ]
  },
  capcut: {
    name:"CapCut", grad:"linear-gradient(135deg,#1B1140,#050508)", icon:"✂️",
    pkgLabel:"Выберите срок подписки CapCut Pro. Активация происходит на указанном аккаунте в течение 5-10 минут после оплаты.",
    packages:[
      {name:"CapCut Pro — 1 месяц", price:349, old:499},
      {name:"CapCut Pro — 3 месяца", price:890, old:1290},
      {name:"CapCut Pro — 12 месяцев", price:2490, old:3990},
    ]
  },
  photoshop: {
    name:"Adobe Photoshop", grad:"linear-gradient(135deg,#001E36,#31A8FF)", icon:"🎨",
    pkgLabel:"Выберите срок подписки Adobe Photoshop. Активация происходит на указанном аккаунте в течение 5-10 минут после оплаты.",
    packages:[
      {name:"Photoshop — 1 месяц", price:899, old:1299},
      {name:"Photoshop — 3 месяца", price:2390, old:3390},
      {name:"Photoshop — 12 месяцев", price:6990, old:9990},
    ]
  }
};

/* Ключи сервисов из donateServices выше, которые показываются в разделе
   "Цифровые подписки" на главной (а не в "Игровой донат"). */
const digitalSubscriptionKeys = ["netflix", "capcut", "photoshop"];

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
  const minPrice = Math.min(...s.packages.map(p=>p.price));
  const badge = s.badge || maxDiscountBadge(s.packages);

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

  document.getElementById("topup-topbar-title").textContent = s.name;
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
    <div class="giftcard" data-idx="${i}">
      <div class="giftcard-cover" style="background:${pkgImg ? `url('${pkgImg}') center/cover no-repeat` : (p.grad || s.grad)};">
        ${heartHTML(favId)}
        <div class="giftcard-inner">
          ${pkgImg ? "" : `<div class="giftcard-logo">${isCodes ? cat.logo : s.icon}</div>`}
        </div>
      </div>
      <div class="topup-grid-price">${formatPrice(p.price)} ₽${p.old ? `<span class="old">${formatPrice(p.old)} ₽</span>` : ""}</div>
      <div class="topup-grid-name">${p.displayName || p.name}</div>
    </div>`;
  }).join("");

  gridEl.querySelectorAll(".giftcard").forEach(el=>{
    el.addEventListener("click", ()=> goToTopupPayment(parseInt(el.dataset.idx, 10)));
  });
  bindHearts(gridEl);
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
      showToast("Заказ оформлен");
      setTimeout(()=> hideSubView(), 900);
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
    ""
  );
  showToast("Заказ оформлен");
  setTimeout(()=> hideSubView(), 900);
});

document.getElementById("topup-back").addEventListener("click", ()=> goBack());

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

function openPaymentPage(config){
  paymentConfig = config;
  document.getElementById("payment-topbar-title").textContent = config.title;
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

  paymentPromo = {code:"", discountPercent:0};
  document.getElementById("payment-promo-input").value = "";
  setPromoError("payment", false);
  document.getElementById("payment-promo-success").classList.remove("show");
  document.getElementById("payment-discount-row").style.display = "none";
  document.getElementById("payment-promo-toggle").style.display = "flex";
  document.getElementById("payment-promo-toggle").classList.remove("open");
  document.getElementById("payment-promo-panel").style.display = "none";
  document.getElementById("payment-promo-applied").style.display = "none";

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

/* ---------- Payment page: promo code ---------- */
let paymentPromo = {code:"", discountPercent:0};

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

function updatePaymentTotals(){
  if(!paymentConfig) return;
  const qty = paymentConfig.showQty ? paymentQty : 1;

  const unitSbp = paymentConfig.itemPrice;
  const unitCard = getCardPrice(unitSbp);
  const unitCrypto = getCryptoPrice(unitSbp);
  const unitBase = paymentPayMethod === "card" ? unitCard : (paymentPayMethod === "crypto" ? unitCrypto : unitSbp);

  const base = unitBase * qty;
  const baseOld = (paymentConfig.itemOld || paymentConfig.itemPrice) * qty;
  const methodDiscountAmount = paymentPayMethod !== "card" ? (unitCard - unitBase) * qty : 0;

  const promoBase = base;
  const discountAmount = paymentPromo.discountPercent ? Math.round(promoBase * paymentPromo.discountPercent / 100) : 0;
  const total = base - discountAmount;

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

  const discountRow = document.getElementById("payment-discount-row");
  if(discountAmount > 0){
    discountRow.style.display = "flex";
    document.getElementById("payment-discount-label").textContent = `Промокод ${paymentPromo.code} (−${paymentPromo.discountPercent}%)`;
    document.getElementById("payment-discount-amount").textContent = `−${formatPrice(discountAmount)} ₽`;
  } else {
    discountRow.style.display = "none";
  }
  document.getElementById("payment-total").textContent = `${formatPrice(total)} ₽`;
}

document.getElementById("payment-promo-input").addEventListener("input", ()=>{
  setPromoError("payment", false);
  document.getElementById("payment-promo-success").classList.remove("show");
});

document.getElementById("payment-promo-apply-btn").addEventListener("click", ()=>{
  const raw = document.getElementById("payment-promo-input").value.trim();
  const code = raw.toUpperCase();

  if(!code){
    paymentPromo = {code:"", discountPercent:0};
    setPromoError("payment", true, "Введите промокод");
    updatePaymentTotals();
    return;
  }

  if(cartPromoCodes[code]){
    paymentPromo = {code, discountPercent: cartPromoCodes[code]};
    setPromoSuccess("payment", `Промокод применён: скидка ${cartPromoCodes[code]}%`);
    document.getElementById("payment-promo-toggle").style.display = "none";
    document.getElementById("payment-promo-panel").style.display = "none";
    document.getElementById("payment-promo-applied").style.display = "flex";
    document.getElementById("payment-promo-code-label").textContent = `${code} (−${cartPromoCodes[code]}%)`;
  } else {
    paymentPromo = {code:"", discountPercent:0};
    setPromoError("payment", true, "Промокод недействителен");
  }
  updatePaymentTotals();
});

document.getElementById("payment-promo-toggle").addEventListener("click", ()=>{
  const toggle = document.getElementById("payment-promo-toggle");
  const panel = document.getElementById("payment-promo-panel");
  const willOpen = panel.style.display === "none";
  panel.style.display = willOpen ? "block" : "none";
  toggle.classList.toggle("open", willOpen);
  if(willOpen) setTimeout(()=> document.getElementById("payment-promo-input").focus(), 50);
});

document.getElementById("payment-promo-remove").addEventListener("click", ()=>{
  paymentPromo = {code:"", discountPercent:0};
  document.getElementById("payment-promo-input").value = "";
  setPromoError("payment", false);
  document.getElementById("payment-promo-success").classList.remove("show");
  document.getElementById("payment-promo-toggle").style.display = "flex";
  document.getElementById("payment-promo-applied").style.display = "none";
  updatePaymentTotals();
});

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
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
  setPaymentFieldError("payment-email-input","payment-email-error", !emailOk);
  if(!emailOk) firstInvalid = firstInvalid || "payment-email-input";

  if(firstInvalid){
    document.getElementById(firstInvalid).scrollIntoView({block:"center", behavior:"smooth"});
    return;
  }

  if(paymentConfig.onConfirm){
    const qty = paymentConfig.showQty ? paymentQty : 1;
    const base = paymentConfig.itemPrice * qty;
    const discountAmount = paymentPromo.discountPercent ? Math.round(base * paymentPromo.discountPercent / 100) : 0;
    const finalPrice = base - discountAmount;
    paymentConfig.onConfirm(finalPrice, emailVal, qty);
  }
});

document.getElementById("payment-back").addEventListener("click", ()=> goBack());


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
  const cat = giftCatalogs[key];
  document.getElementById("giftcards-topbar-title").textContent = cat.title;

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
  const titleEl = document.getElementById("giftcards-topbar-title");

  if(isTgStarsMode()){
    grid.style.display = "none";
    labelEl.style.display = "block";
    starsWrap.style.display = "block";
    premWrap.style.display = "none";
    titleEl.textContent = "Купить звёзды";
    resetTgStarsPromo();
    renderTgStarsBuy();
    return;
  }
  if(isTgPremMode()){
    grid.style.display = "none";
    labelEl.style.display = "block";
    starsWrap.style.display = "none";
    premWrap.style.display = "block";
    titleEl.textContent = "Telegram Premium";
    resetTgPremPromo();
    renderTgPremBuy();
    return;
  }
  grid.style.display = "grid";
  labelEl.style.display = "block";
  starsWrap.style.display = "none";
  premWrap.style.display = "none";
  titleEl.textContent = cat.title;

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
      showToast("Заказ оформлен");
      setTimeout(()=> hideSubView(), 900);
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

/* ---------- Telegram Stars: promo code (тот же список кодов, что и в
   корзине/на общей странице оплаты — см. cartPromoCodes) ---------- */
let tgStarsPromo = {code:"", discountPercent:0};

function resetTgStarsPromo(){
  tgStarsPromo = {code:"", discountPercent:0};
  document.getElementById("tgstars-promo-input").value = "";
  setPromoError("tgstars", false);
  document.getElementById("tgstars-promo-success").classList.remove("show");
}

function getTgStarsFinalPrice(){
  const item = getTgStarsItems()[tgStarsSelectedIdx];
  const base = item.price;
  const discountAmount = tgStarsPromo.discountPercent ? Math.round(base * tgStarsPromo.discountPercent / 100) : 0;
  return {base, discountAmount, total: base - discountAmount};
}

function updateTgStarsTotals(){
  const {base, discountAmount, total} = getTgStarsFinalPrice();
  const item = getTgStarsItems()[tgStarsSelectedIdx];
  document.getElementById("tgstars-sum").textContent = `${formatPrice(item.old || base)} ₽`;
  const oldDiscountRow = document.getElementById("tgstars-old-discount-row");
  if(item.old){
    oldDiscountRow.style.display = "flex";
    document.getElementById("tgstars-old-discount-amount").textContent = `−${formatPrice(item.old - base)} ₽`;
  } else {
    oldDiscountRow.style.display = "none";
  }
  const discountRow = document.getElementById("tgstars-discount-row");
  if(discountAmount > 0){
    discountRow.style.display = "flex";
    document.getElementById("tgstars-discount-label").textContent = `Промокод ${tgStarsPromo.code} (−${tgStarsPromo.discountPercent}%)`;
    document.getElementById("tgstars-discount-amount").textContent = `−${formatPrice(discountAmount)} ₽`;
  } else {
    discountRow.style.display = "none";
  }
  document.getElementById("tgstars-total").textContent = `${formatPrice(total)} ₽`;
}

document.getElementById("tgstars-promo-input").addEventListener("input", ()=>{
  setPromoError("tgstars", false);
  document.getElementById("tgstars-promo-success").classList.remove("show");
});

document.getElementById("tgstars-promo-apply-btn").addEventListener("click", ()=>{
  const raw = document.getElementById("tgstars-promo-input").value.trim();
  const code = raw.toUpperCase();

  if(!code){
    tgStarsPromo = {code:"", discountPercent:0};
    setPromoError("tgstars", true, "Введите промокод");
    updateTgStarsTotals();
    return;
  }

  if(cartPromoCodes[code]){
    tgStarsPromo = {code, discountPercent: cartPromoCodes[code]};
    setPromoSuccess("tgstars", `Промокод применён: скидка ${cartPromoCodes[code]}%`);
  } else {
    tgStarsPromo = {code:"", discountPercent:0};
    setPromoError("tgstars", true, "Промокод недействителен");
  }
  updateTgStarsTotals();
});

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

function completeTgStarsPurchase(){
  if(!validateTgStarsUsername()) return;
  const item = getTgStarsItems()[tgStarsSelectedIdx];
  const {total: finalPrice} = getTgStarsFinalPrice();
  const username = document.getElementById("tgstars-username-input").value.trim();
  createOrder(
    [{name:`Telegram Stars ${item.amount} ⭐ · ${username}`, price:`${formatPrice(finalPrice)} ₽`, qty:1, grad:"linear-gradient(160deg,#2AABEE,#1178B3)", needsCode:false}],
    `${formatPrice(finalPrice)} ₽`,
    null
  );
  showToast(`Оплачено: ${item.amount} звёзд для ${username}`);
  setTimeout(()=> hideSubView(), 900);
}

document.getElementById("tgstars-sbp-btn").addEventListener("click", ()=> completeTgStarsPurchase());
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

let tgPremPromo = {code:"", discountPercent:0};

function resetTgPremPromo(){
  tgPremPromo = {code:"", discountPercent:0};
  document.getElementById("tgprem-promo-input").value = "";
  setPromoError("tgprem", false);
  document.getElementById("tgprem-promo-success").classList.remove("show");
}

function getTgPremFinalPrice(){
  const item = getTgPremItems()[tgPremSelectedIdx];
  const base = item.price;
  const discountAmount = tgPremPromo.discountPercent ? Math.round(base * tgPremPromo.discountPercent / 100) : 0;
  return {base, discountAmount, total: base - discountAmount};
}

function updateTgPremTotals(){
  const {base, discountAmount, total} = getTgPremFinalPrice();
  const item = getTgPremItems()[tgPremSelectedIdx];
  document.getElementById("tgprem-sum").textContent = `${formatPrice(item.old || base)} ₽`;
  const oldDiscountRow = document.getElementById("tgprem-old-discount-row");
  if(item.old){
    oldDiscountRow.style.display = "flex";
    document.getElementById("tgprem-old-discount-amount").textContent = `−${formatPrice(item.old - base)} ₽`;
  } else {
    oldDiscountRow.style.display = "none";
  }
  const discountRow = document.getElementById("tgprem-discount-row");
  if(discountAmount > 0){
    discountRow.style.display = "flex";
    document.getElementById("tgprem-discount-label").textContent = `Промокод ${tgPremPromo.code} (−${tgPremPromo.discountPercent}%)`;
    document.getElementById("tgprem-discount-amount").textContent = `−${formatPrice(discountAmount)} ₽`;
  } else {
    discountRow.style.display = "none";
  }
  document.getElementById("tgprem-total").textContent = `${formatPrice(total)} ₽`;
}

document.getElementById("tgprem-promo-input").addEventListener("input", ()=>{
  setPromoError("tgprem", false);
  document.getElementById("tgprem-promo-success").classList.remove("show");
});

document.getElementById("tgprem-promo-apply-btn").addEventListener("click", ()=>{
  const raw = document.getElementById("tgprem-promo-input").value.trim();
  const code = raw.toUpperCase();

  if(!code){
    tgPremPromo = {code:"", discountPercent:0};
    setPromoError("tgprem", true, "Введите промокод");
    updateTgPremTotals();
    return;
  }

  if(cartPromoCodes[code]){
    tgPremPromo = {code, discountPercent: cartPromoCodes[code]};
    setPromoSuccess("tgprem", `Промокод применён: скидка ${cartPromoCodes[code]}%`);
  } else {
    tgPremPromo = {code:"", discountPercent:0};
    setPromoError("tgprem", true, "Промокод недействителен");
  }
  updateTgPremTotals();
});

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

function completeTgPremPurchase(){
  if(!validateTgPremUsername()) return;
  const item = getTgPremItems()[tgPremSelectedIdx];
  const {total: finalPrice} = getTgPremFinalPrice();
  const username = document.getElementById("tgprem-username-input").value.trim();
  createOrder(
    [{name:`Telegram Premium ${item.amount} · ${username}`, price:`${formatPrice(finalPrice)} ₽`, qty:1, grad:"linear-gradient(160deg,#8B6CFF,#3A1FB0)", needsCode:false}],
    `${formatPrice(finalPrice)} ₽`,
    null
  );
  showToast(`Оплачено: Telegram Premium (${item.amount}) для ${username}`);
  setTimeout(()=> hideSubView(), 900);
}

document.getElementById("tgprem-sbp-btn").addEventListener("click", ()=> completeTgPremPurchase());
document.getElementById("tgprem-other-btn").addEventListener("click", ()=>{
  if(!validateTgPremUsername()) return;
  showSubView("view-tg-other");
});

/* Экран "Другие способы оплаты" общий для Stars и Premium — определяем,
   какую покупку завершать, по текущему режиму вкладки. */
document.getElementById("tgother-card").addEventListener("click", ()=>{
  if(isTgPremMode()) completeTgPremPurchase(); else completeTgStarsPurchase();
});
document.getElementById("tgother-crypto").addEventListener("click", ()=>{
  if(isTgPremMode()) completeTgPremPurchase(); else completeTgStarsPurchase();
});
document.getElementById("tgother-back").addEventListener("click", ()=> goBack());

document.getElementById("giftcards-back").addEventListener("click", ()=> goBack());

/* ---------- Пользовательское соглашение / Политика конфиденциальности ----------
   Открываются как обычные под-экраны через showSubView, поэтому goBack()
   автоматически возвращает туда, откуда был совершён переход (корзина,
   профиль, страница оплаты и т.д.) — специальная логика по экранам не нужна,
   т.к. viewStack уже хранит историю переходов. */
document.getElementById("agree-back").addEventListener("click", ()=> goBack());
document.getElementById("privacy-back").addEventListener("click", ()=> goBack());

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

function tabNameForView(id){
  const map = {"view-home":"home", "view-fav":"fav", "view-cart":"cart", "view-profile":"profile"};
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
  document.getElementById("app").classList.toggle("checkout-mode", isCheckoutOnlyView(id));
}

/* На странице "Корзина", пока в ней есть товары, кнопка "Перейти к оплате"
   занимает место нижней таб-бар панели — панель скрывается, а кнопка
   становится сплошной полосой на всю ширину внизу экрана, как и на странице
   оплаты (единый стиль для всех этих экранов). */
function syncCartBuyMode(id){
  const isCartWithItems = id === "view-cart" && cart.length > 0;
  document.getElementById("app").classList.toggle("cart-buy-mode", isCartWithItems);
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
  syncCartBuyMode(id);
  syncLegalMode(id);
  if(id === "view-product") updateProductBuyState();
}

function goBack(){
  const prev = viewStack.pop() || "view-home";
  currentView = prev;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById(prev).classList.add("active");
  document.getElementById("scrollarea").scrollTop = 0;
  syncNavActiveTab(prev);
  syncCheckoutMode(prev);
  syncCartBuyMode(prev);
  syncLegalMode(prev);
  if(prev === "view-product") updateProductBuyState();
}

function hideSubView(){
  viewStack = [];
  currentView = "view-home";
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById("view-home").classList.add("active");
  document.querySelectorAll(".navitem").forEach(i=>i.classList.remove("active"));
  document.querySelector('.navitem[data-view="home"]').classList.add("active");
  document.getElementById("scrollarea").scrollTop = 0;
  syncCheckoutMode("view-home");
  syncCartBuyMode("view-home");
  syncLegalMode("view-home");
}

const titles = {
  home: ["MetraCode", "магазин ключей и подписок"],
  fav: ["Избранное", "сохранённые товары"],
  cart: ["Корзина", "1 товар"],
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
    syncCartBuyMode("view-"+view);
    syncLegalMode("view-"+view);
  });
});


/* ---------- Subscriptions ---------- */
const subs = [
  /* Optional per-subscription `img` field: set it to a photo URL to show that photo
     instead of the colored `label` text/badge, e.g.:
     img:"images/subsc/psplus.png"
     Leave `img` out (or null) to keep showing the `grad` + `label` badge as before.

     `brand` — короткое имя, которое показывается под карточкой на главной
     (по аналогии с "PS Plus" / "EA Play" на фото-референсе). Необязательное:
     если не задано, используется `name`.

     `tag` — бейдж поверх обложки на главной (как "500+ ИГР" на фото).

     ЦЕНА — теперь считается точно так же, как у игр (см. комментарий у
     getProductPricing/GRAND THEFT AUTO VI выше): вместо готовой цены в ₽ на
     страну задаётся `native` — сколько стоит сама подписка в PS Store нужного
     региона (Rs для Индии, ₺ для Турции) за выбранный период. Реальная цена,
     которая показывается на странице подписки и попадает в корзину, считается
     от этой суммы через calcCardsForAmount — то есть от того, какие карты
     пополнения реально понадобятся, чтобы купить подписку в PS Store. Поэтому
     итоговая цена всегда совпадает с раскладкой по картам в корзине.

     `old` — старая (зачёркнутая) цена в ₽, задаётся вручную по каждому периоду,
     как и в играх (см. getProductPricing). На саму цену (native/priceNum) не
     влияет — просто показывается рядом зачёркнутой. Если для периода стоит 0
     или поле не задано — зачёркнутая цена не показывается. */
  {
    key:"essential", name:"ESSENTIAL", brand:"PS Plus Essential", tierLabel:"Essential", grad:"linear-gradient(135deg,#4B4E9E,#2E3070)", label:"MC<br>ESSENTIAL", img:"images/subsc/essential.jpg",
    tag:"450+ ИГР",
    native:{
      IN:{1:749, 3:1999, 12:5999},
      TR:{1:175, 3:450, 12:1500}
    },
    old:{1:0, 3:0, 12:0}
  },
  {
    key:"extra", name:"EXTRA", brand:"PS Plus Extra", tierLabel:"Extra", grad:"linear-gradient(135deg,#E88A2B,#C4501E)", label:"MC<br>EXTRA", img:"images/subsc/extra.jpg",
    tag:"700+ ИГР",
    native:{
      IN:{1:1199, 3:3199, 12:9499},
      TR:{1:300, 3:800, 12:2500}
    },
    old:{1:0, 3:0, 12:0}
  },
  {
    key:"premium", name:"DELUXE", brand:"PS Plus Premium", tierLabel:"Deluxe", grad:"linear-gradient(135deg,#9B4DFF,#5B5FEF)", label:"MC<br>PREMIUM", img:"images/subsc/deluxe.png",
    tag:"1000+ ИГР",
    native:{
      IN:{1:1499, 3:3999, 12:11999},
      TR:{1:400, 3:1000, 12:3000}
    },
    old:{1:0, 3:0, 12:0}
  },
  {
    key:"eaplay", name:"EA Play", brand:"EA Play", tierLabel:"EA Play", grad:"linear-gradient(135deg,#0F6D3C,#083D22)", label:"EA<br>PLAY", img:"images/subsc/eaplay.jpg",
    tag:"40+ ИГР",
    native:{
      IN:{1:499, 12:2999},
      TR:{1:100, 12:600}
    },
    old:{1:0, 12:0}
  }
];

/* Группы на главной: 2 фото-карточки (PS Plus / EA Play), как на референсе.
   PS Plus объединяет тарифы essential/extra/premium — выбор тарифа появляется
   уже внутри карточки товара (см. renderSubDetailTiers). У EA Play всего один
   тариф, поэтому строка выбора тарифа для неё скрыта. */
const subGroups = [
  {
    key:"psplus", title:"PS Plus", tag:"1000+ ИГР", badge:"-18%",
    img:"images/subsc/psplus.png",
    grad:"linear-gradient(135deg,#4B4E9E,#2E3070)",
    tiers:["essential","extra","premium"]
  },
  {
    key:"eaplay", title:"EA Play", tag:"40+ ИГР", badge:"-15%",
    img:"images/subsc/eaplay.jpg",
    grad:"linear-gradient(135deg,#0F6D3C,#083D22)",
    tiers:["eaplay"]
  }
];



const periodLabel = {1:"1 месяц", 3:"3 месяца", 12:"12 месяцев"};

/* Карточки подписок на главной — просто обложка + бейдж + название бренда,
   без цены (по аналогии с фото-референсом). Выбор периода/региона и сама
   цена остаются внутри карточки товара (см. renderSubDetailPeriods /
   renderSubDetailCountries / updateSubDetailPrice ниже) — на главной их
   больше нет, только переход в неё по тапу. */
/* Реальная цена подписки для страны/периода — считается от суммы в PS Store
   (native, в Rs/₺) через calcCardsForAmount, ровно как у игр (см. комментарий
   в объекте subs выше и у getProductPricing). */
function getSubPricing(s, period, country){
  const nativeAmount = s.native[country][period];
  const {totalCost} = calcCardsForAmount(country, nativeAmount);
  const oldNum = (s.old && s.old[period]) ? s.old[period] : null;
  const old = oldNum ? `${formatPrice(oldNum)} ₽` : null;
  return {priceNum: totalCost, nativePrice: nativeAmount, old, oldNum};
}

/* ---------- Subscription detail: group (PS Plus / EA Play) + tier + country + period ----------
   PS Plus открывает карточку с выбором тарифа (Essential/Extra/Deluxe) — внутри
   неё уже выбираются период и регион, как и раньше. EA Play — тот же экран,
   но без строки выбора тарифа, т.к. тариф у неё один. */
let subDetailState = {groupKey:null, tier:null, period:1, country:"IN"};

function openSubGroup(groupKey, tier, period){
  const group = subGroups.find(x=>x.key===groupKey);
  const defaultTier = group.tiers.includes(tier) ? tier : group.tiers[0];
  const s = subs.find(x=>x.key===defaultTier);
  const periods = Object.keys(s.native.IN).map(Number);
  subDetailState = {groupKey, tier: defaultTier, period: periods.includes(period) ? period : periods[0], country:"IN"};

  document.getElementById("subdetail-topbar-title").textContent = group.title;

  renderSubDetailHeader();
  renderSubDetailTiers();
  renderSubDetailPeriods();
  renderSubDetailCountries();
  updateSubDetailPrice();
  showSubView("view-sub-detail");
}

function renderSubDetailHeader(){
  const s = subs.find(x=>x.key===subDetailState.tier);
  document.getElementById("subdetail-cover").style.background = s.img ? `url('${s.img}') center/cover no-repeat` : s.grad;
  document.getElementById("subdetail-name").textContent = s.name;
}

function renderSubDetailTiers(){
  const group = subGroups.find(x=>x.key===subDetailState.groupKey);
  const row = document.getElementById("subdetail-tier-row");
  const wrap = document.getElementById("subdetail-tier-tabs");

  if(group.tiers.length <= 1){
    row.style.display = "none";
    wrap.innerHTML = "";
    return;
  }
  row.style.display = "block";
  wrap.innerHTML = group.tiers.map(t=>{
    const s = subs.find(x=>x.key===t);
    return `<div class="pill ${t===subDetailState.tier ? "active" : ""}" data-tier="${t}">${s.tierLabel || s.name}</div>`;
  }).join("");
  wrap.querySelectorAll(".pill").forEach(el=>{
    el.addEventListener("click", ()=>{
      subDetailState.tier = el.dataset.tier;
      const s = subs.find(x=>x.key===subDetailState.tier);
      const periods = Object.keys(s.native.IN).map(Number);
      if(!periods.includes(subDetailState.period)) subDetailState.period = periods[0];
      renderSubDetailHeader();
      renderSubDetailTiers();
      renderSubDetailPeriods();
      updateSubDetailPrice();
    });
  });
}

function renderSubDetailPeriods(){
  const s = subs.find(x=>x.key===subDetailState.tier);
  const periods = Object.keys(s.native.IN).map(Number);
  const wrap = document.getElementById("subdetail-period-tabs");
  wrap.innerHTML = periods.map(p=>`<div class="pill ${p===subDetailState.period ? "active" : ""}" data-period="${p}">${periodLabel[p]}</div>`).join("");
  wrap.querySelectorAll(".pill").forEach(el=>{
    el.addEventListener("click", ()=>{
      subDetailState.period = parseInt(el.dataset.period,10);
      renderSubDetailPeriods();
      updateSubDetailPrice();
    });
  });
}

function renderSubDetailCountries(){
  const codes = ["IN","TR"];
  const wrap = document.getElementById("subdetail-country-tabs");
  wrap.innerHTML = codes.map(c=>`<div class="pill ${c===subDetailState.country ? "active" : ""}" data-country="${c}">${countryNames[c]}</div>`).join("");
  wrap.querySelectorAll(".pill").forEach(el=>{
    el.addEventListener("click", ()=>{
      subDetailState.country = el.dataset.country;
      renderSubDetailCountries();
      updateSubDetailPrice();
    });
  });
}

function updateSubDetailPrice(){
  const s = subs.find(x=>x.key===subDetailState.tier);
  const {priceNum, old} = getSubPricing(s, subDetailState.period, subDetailState.country);
  document.getElementById("subdetail-price").textContent = `${formatPrice(priceNum)} ₽`;
  const oldEl = document.getElementById("subdetail-old");
  oldEl.textContent = old || "";
  oldEl.style.display = old ? "block" : "none";
  updateSubDetailBuyButton();
}

function updateSubDetailBuyButton(){
  const s = subs.find(x=>x.key===subDetailState.tier);
  const {priceNum, oldNum, nativePrice} = getSubPricing(s, subDetailState.period, subDetailState.country);
  const countryName = countryNames[subDetailState.country];
  const name = `${s.name} (${periodLabel[subDetailState.period]}, ${countryName})`;
  const buyBtn = document.getElementById("subdetail-buy-btn");

  if(isInCart(name)){
    buyBtn.textContent = "Перейти в корзину";
    buyBtn.style.background = "var(--green)";
    buyBtn.onclick = ()=> goToCart();
  } else {
    buyBtn.textContent = "Добавить в корзину";
    buyBtn.style.background = "";
    buyBtn.onclick = ()=>{
      addToCart({
        name,
        edition: `${periodLabel[subDetailState.period]} · ${countryName}`,
        price: `${formatPrice(priceNum)} ₽`,
        grad: s.grad,
        img: s.img || null,
        type: "subscription",
        country: subDetailState.country,
        priceNum,
        oldNum,
        nativePrice
      });
      updateSubDetailBuyButton();
    };
  }
}

document.getElementById("subdetail-back").addEventListener("click", ()=> goBack());

/* Клик по карточкам каталога (Хиты продаж/Новинки, если появятся на
   главной) открывает страницу товара через cardHTML/openProduct — как и
   раньше. Сами "Цифровые подписки" рендерятся выше и используют отдельную
   разметку/обработчик (см. subscriptionCardHTML и openTopup). */
document.querySelectorAll(".game-card[data-list]").forEach(card=>{
  card.style.cursor = "pointer";
  card.addEventListener("click", ()=>{
    const list = card.dataset.list;
    const idx = parseInt(card.dataset.idx, 10);
    openProduct(list, idx);
  });
});

renderCart();
