(() => {
  "use strict";

  const TABLE_IDS = ["13","14","12","15","11","16","10","17","5","4","6","3","7","2","8","1","9"];
  const STORAGE_KEY = "vvain.data.v8";

  const homeScreen = document.getElementById("home-screen");
  const tableScreen = document.getElementById("table-screen");
  const tableButtons = [...document.querySelectorAll("[data-table-id]")];
  const tipsTotalHome = document.getElementById("tips-total-home");
  const clearTipsButton = document.getElementById("clear-tips-button");
  const backButton = document.getElementById("back-button");
  const tableTitle = document.getElementById("table-title");
  const tableClock = document.getElementById("table-clock");
  const clearTableButton = document.getElementById("clear-table-button");
  const dishForm = document.getElementById("dish-form");
  const dishInput = document.getElementById("dish-input");
  const orderList = document.getElementById("order-list");
  const tipsTotalTable = document.getElementById("tips-total-table");
  const openTipsButton = document.getElementById("open-tips-button");
  const toast = document.getElementById("toast");

  let state = loadState();
  let activeTableId = null;
  let toastTimer = null;
  let modalElement = null;

  installZoomProtection();
  installServiceWorker();
  initializeFromUrl();
  renderHome();
  updateClock();
  setInterval(updateClock, 30000);

  function createDefaultState() {
    return Object.fromEntries(TABLE_IDS.map((id) => [id, { orders: [], tips: [] }]));
  }

  function createId() {
    return window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function isDate(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
  }

  function cleanOrder(raw) {
    if (!raw || typeof raw.name !== "string") return null;
    const name = raw.name.trim().slice(0, 120);
    if (!name) return null;
    return { id: typeof raw.id === "string" ? raw.id : createId(), name, createdAt: isDate(raw.createdAt) ? raw.createdAt : new Date().toISOString() };
  }

  function cleanTip(raw) {
    const amount = Number(raw?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { id: typeof raw.id === "string" ? raw.id : createId(), amount: Math.round(amount), createdAt: isDate(raw.createdAt) ? raw.createdAt : new Date().toISOString() };
  }

  function sanitizeState(raw) {
    const safe = createDefaultState();
    if (!raw || typeof raw !== "object") return safe;
    for (const id of TABLE_IDS) {
      const source = raw[id];
      if (!source || typeof source !== "object") continue;
      safe[id].orders = Array.isArray(source.orders) ? source.orders.map(cleanOrder).filter(Boolean) : [];
      safe[id].tips = Array.isArray(source.tips) ? source.tips.map(cleanTip).filter(Boolean) : [];
    }
    return safe;
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return sanitizeState(JSON.parse(stored));
      const migrated = migrateOldData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {
      return createDefaultState();
    }
  }

  function migrateOldData() {
    const result = createDefaultState();
    const knownKeys = ["vvain.app.v4", "vvain.data.v3", "vvain.orders.v1"];
    for (const key of knownKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        for (const id of TABLE_IDS) {
          const source = parsed[id];
          if (Array.isArray(source)) {
            result[id].orders = source.map(cleanOrder).filter(Boolean);
          } else if (source && typeof source === "object") {
            if (Array.isArray(source.orders)) result[id].orders = source.orders.map(cleanOrder).filter(Boolean);
            if (Array.isArray(source.tips)) result[id].tips = source.tips.map(cleanTip).filter(Boolean);
          }
        }
      } catch {}
    }
    for (const id of TABLE_IDS) {
      try {
        const raw = localStorage.getItem(`table_${id}`);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        result[id].orders = parsed.map((item) => cleanOrder({ name: item?.name, createdAt: legacyTime(item?.time) })).filter(Boolean);
      } catch {}
    }
    return result;
  }

  function legacyTime(value) {
    const date = new Date();
    if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) {
      const [h, m] = value.split(":").map(Number);
      date.setHours(h, m, 0, 0);
    }
    return date.toISOString();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      showToast("Не удалось сохранить данные");
      return false;
    }
  }

  function table(id) { return state[id]; }
  function tableTips(id) { return table(id).tips.reduce((sum, item) => sum + item.amount, 0); }
  function allTips() { return TABLE_IDS.reduce((sum, id) => sum + tableTips(id), 0); }
  function lastOrder(id) { const orders = table(id).orders; return orders.length ? orders[orders.length - 1] : null; }
  function formatMoney(value) { return `${Math.round(value).toLocaleString("ru-RU")} ₽`; }
  function formatTime(value = new Date()) { return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }

  function renderHome() {
    for (const button of tableButtons) {
      const id = button.dataset.tableId;
      const orders = table(id).orders;
      const busy = orders.length > 0;
      button.dataset.state = busy ? "busy" : "empty";
      const badge = button.querySelector(".table__badge");
      const time = button.querySelector(".table__time");
      badge.hidden = !busy;
      badge.textContent = busy ? String(orders.length) : "0";
      time.textContent = busy ? formatTime(lastOrder(id).createdAt) : "";
      button.setAttribute("aria-label", busy ? `Стол ${id}, позиций ${orders.length}` : `Стол ${id}, свободен`);
    }
    const total = allTips();
    tipsTotalHome.textContent = formatMoney(total);
    clearTipsButton.disabled = total === 0;
  }

  function renderTable() {
    if (!activeTableId) return;
    const fragment = document.createDocumentFragment();
    for (const order of table(activeTableId).orders) {
      const item = document.createElement("li");
      item.className = "order-row";

      const name = document.createElement("span");
      name.className = "order-row__name";
      name.textContent = order.name;

      const time = document.createElement("time");
      time.className = "order-row__time";
      time.dateTime = order.createdAt;
      time.textContent = formatTime(order.createdAt);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "order-row__delete";
      remove.dataset.orderId = order.id;
      remove.setAttribute("aria-label", `Удалить ${order.name}`);
      remove.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M7 7 8 20h8l1-13"/><path d="M9 7V5h6v2"/></svg>`;

      item.append(name, time, remove);
      fragment.append(item);
    }
    orderList.replaceChildren(fragment);
    tipsTotalTable.textContent = formatMoney(tableTips(activeTableId));
    renderHome();
  }

  function openTable(id, pushHistory = true) {
    if (!TABLE_IDS.includes(String(id))) return;
    closeTipsModal();
    activeTableId = String(id);
    tableTitle.textContent = `Стол ${activeTableId}`;
    homeScreen.hidden = true;
    tableScreen.hidden = false;
    renderTable();
    updateClock();
    if (pushHistory) {
      const url = new URL(location.href);
      url.hash = `table-${activeTableId}`;
      history.pushState({ tableId: activeTableId }, "", url);
    }
    scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function showHome(replaceHistory = false) {
    closeTipsModal();
    activeTableId = null;
    tableScreen.hidden = true;
    homeScreen.hidden = false;
    dishInput.value = "";
    renderHome();
    if (replaceHistory) {
      const url = new URL(location.href);
      url.hash = "";
      history.replaceState({}, "", url);
    }
    scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function addDish(value) {
    if (!activeTableId) return;
    const name = value.trim().slice(0, 120);
    if (!name) return;
    table(activeTableId).orders.push({ id: createId(), name, createdAt: new Date().toISOString() });
    if (saveState()) {
      dishInput.value = "";
      renderTable();
    }
  }

  function deleteDish(orderId) {
    if (!activeTableId) return;
    table(activeTableId).orders = table(activeTableId).orders.filter((order) => order.id !== orderId);
    if (saveState()) renderTable();
  }

  function openTipsModal() {
    if (!activeTableId || modalElement) return;

    const backdrop = document.createElement("div");
    backdrop.className = "tips-modal-backdrop";
    backdrop.setAttribute("role", "presentation");
    backdrop.innerHTML = `
      <section class="tips-modal" role="dialog" aria-modal="true" aria-labelledby="tips-modal-title">
        <div class="tips-modal__header">
          <h3 class="tips-modal__title" id="tips-modal-title">Чаевые к столику ${activeTableId}</h3>
          <button class="tips-modal__close" type="button" data-action="close" aria-label="Закрыть">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12"/><path d="M18 6 6 18"/></svg>
          </button>
        </div>
        <div class="tips-modal__presets">
          <button class="tips-modal__preset" type="button" data-tip="50">50 ₽</button>
          <button class="tips-modal__preset" type="button" data-tip="100">100 ₽</button>
          <button class="tips-modal__preset" type="button" data-tip="200">200 ₽</button>
          <button class="tips-modal__preset" type="button" data-tip="500">500 ₽</button>
        </div>
        <label class="visually-hidden" for="tips-custom-input">Другая сумма</label>
        <input class="tips-modal__input" id="tips-custom-input" type="number" min="1" inputmode="numeric" placeholder="Другая сумма" />
        <button class="tips-modal__submit" type="button" data-action="add">Добавить чаевые</button>
      </section>`;

    let selected = null;
    const modal = backdrop.querySelector(".tips-modal");
    const customInput = backdrop.querySelector("#tips-custom-input");
    const presetButtons = [...backdrop.querySelectorAll("[data-tip]")];

    function choosePreset(button) {
      presetButtons.forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      selected = Number(button.dataset.tip);
      customInput.value = "";
    }

    function submit() {
      const custom = Number(customInput.value);
      const amount = Number.isFinite(custom) && custom > 0 ? Math.round(custom) : selected;
      if (!amount) {
        showToast("Введите сумму чаевых");
        return;
      }
      table(activeTableId).tips.push({ id: createId(), amount, createdAt: new Date().toISOString() });
      if (saveState()) {
        closeTipsModal();
        renderTable();
        showToast("Чаевые добавлены");
      }
    }

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeTipsModal();
      const close = event.target.closest('[data-action="close"]');
      if (close) closeTipsModal();
      const add = event.target.closest('[data-action="add"]');
      if (add) submit();
      const preset = event.target.closest("[data-tip]");
      if (preset) choosePreset(preset);
    });

    customInput.addEventListener("input", () => {
      if (customInput.value) {
        selected = null;
        presetButtons.forEach((item) => item.classList.remove("is-selected"));
      }
    });

    document.body.append(backdrop);
    modalElement = backdrop;
  }

  function closeTipsModal() {
    if (!modalElement) return;
    modalElement.remove();
    modalElement = null;
  }


  function clearTableOrders() {
    if (!activeTableId) return;
    if (!table(activeTableId).orders.length) {
      showToast("Столик уже пустой");
      return;
    }
    if (!confirm(`Очистить все блюда у стола ${activeTableId}?`)) return;
    table(activeTableId).orders = [];
    if (saveState()) {
      renderTable();
      showToast("Столик очищен");
    }
  }

  function clearTips() {
    if (!allTips()) {
      showToast("Чаевых пока нет");
      return;
    }
    if (!confirm("Очистить все чаевые за сегодня?")) return;
    for (const id of TABLE_IDS) table(id).tips = [];
    if (saveState()) {
      renderHome();
      if (activeTableId) renderTable();
      showToast("Чаевые очищены");
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
  }

  function updateClock() {
    tableClock.textContent = formatTime();
  }

  function initializeFromUrl() {
    const match = location.hash.match(/^#table-(\d{1,2})$/);
    if (match && TABLE_IDS.includes(match[1])) {
      history.replaceState({ tableId: match[1] }, "", location.href);
      openTable(match[1], false);
    } else {
      history.replaceState({}, "", location.pathname + location.search);
      showHome(false);
    }
  }

  function installZoomProtection() {
    document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
    document.addEventListener("gesturechange", (event) => event.preventDefault(), { passive: false });
    document.addEventListener("gestureend", (event) => event.preventDefault(), { passive: false });
  }

  async function installServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js");
      registration.update();
    } catch {}
  }

  tableButtons.forEach((button) => button.addEventListener("click", () => openTable(button.dataset.tableId)));
  clearTipsButton.addEventListener("click", clearTips);
  backButton.addEventListener("click", () => location.hash.startsWith("#table-") ? history.back() : showHome(true));
  dishForm.addEventListener("submit", (event) => { event.preventDefault(); addDish(dishInput.value); });
  orderList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-order-id]");
    if (button) deleteDish(button.dataset.orderId);
  });
  openTipsButton.addEventListener("click", openTipsModal);
  clearTableButton.addEventListener("click", clearTableOrders);
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") closeTipsModal(); });
  window.addEventListener("popstate", () => {
    const match = location.hash.match(/^#table-(\d{1,2})$/);
    if (match && TABLE_IDS.includes(match[1])) openTable(match[1], false);
    else showHome(false);
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = loadState();
    renderHome();
    if (activeTableId) renderTable();
  });
})();
