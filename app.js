(() => {
  "use strict";

  const TABLE_IDS = ["13","14","12","15","11","16","10","17","5","4","6","3","7","2","8","1","9"];
  const STORAGE_KEY = "vvain.app.v4";

  const screenHome = document.getElementById("screen-home");
  const screenTable = document.getElementById("screen-table");
  const tableButtons = Array.from(document.querySelectorAll("[data-table]"));
  const tipsTotalMain = document.getElementById("tips-total-main");
  const clearAllTipsBtn = document.getElementById("clear-all-tips");
  const backBtn = document.getElementById("back-btn");
  const tableTitle = document.getElementById("table-title");
  const tableClock = document.getElementById("table-clock");
  const dishForm = document.getElementById("dish-form");
  const dishInput = document.getElementById("dish-input");
  const ordersEl = document.getElementById("orders");
  const tipsTotalTable = document.getElementById("tips-total-table");
  const openTipModalBtn = document.getElementById("open-tip-modal");
  const sheetBackdrop = document.getElementById("sheet-backdrop");
  const closeTipModalBtn = document.getElementById("close-tip-modal");
  const sheetTitle = document.getElementById("sheet-title");
  const tipPresets = document.getElementById("tip-presets");
  const customTipInput = document.getElementById("custom-tip");
  const addTipBtn = document.getElementById("add-tip-btn");
  const toast = document.getElementById("toast");
  const sheetPanel = document.querySelector(".sheet");

  let activeTableId = null;
  let selectedTip = null;
  let toastTimer = null;
  let state = loadState();

  preventZoom();

  function preventZoom() {
    document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
    document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
    document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });
  }

  function createDefaultState() {
    return TABLE_IDS.reduce((acc, id) => {
      acc[id] = { orders: [], tips: [] };
      return acc;
    }, {});
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function isValidDate(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
  }

  function normalizeOrder(item) {
    if (!item || typeof item.name !== "string") return null;
    const name = item.name.trim().slice(0, 120);
    if (!name) return null;
    return {
      id: typeof item.id === "string" ? item.id : createId(),
      name,
      createdAt: isValidDate(item.createdAt) ? item.createdAt : new Date().toISOString(),
    };
  }

  function normalizeTip(item) {
    const amount = Number(item?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return {
      id: typeof item.id === "string" ? item.id : createId(),
      amount: Math.round(amount),
      createdAt: isValidDate(item.createdAt) ? item.createdAt : new Date().toISOString(),
    };
  }

  function sanitizeState(data) {
    const clean = createDefaultState();
    if (!data || typeof data !== "object") return clean;

    for (const id of TABLE_IDS) {
      const source = data[id];
      if (!source || typeof source !== "object") continue;
      clean[id].orders = Array.isArray(source.orders) ? source.orders.map(normalizeOrder).filter(Boolean) : [];
      clean[id].tips = Array.isArray(source.tips) ? source.tips.map(normalizeTip).filter(Boolean) : [];
    }
    return clean;
  }

  function migrateLegacy() {
    const migrated = createDefaultState();
    let changed = false;

    try {
      const legacy = localStorage.getItem("vvain.orders.v1");
      if (legacy) {
        const parsed = JSON.parse(legacy);
        for (const id of TABLE_IDS) {
          const raw = parsed[id];
          if (!Array.isArray(raw)) continue;
          const normalized = raw
            .map((item) => normalizeOrder({
              id: item.id,
              name: item.name,
              createdAt: convertLegacyTime(item.time),
            }))
            .filter(Boolean);
          if (normalized.length) {
            migrated[id].orders = normalized;
            changed = true;
          }
        }
      }
    } catch {}

    for (const id of TABLE_IDS) {
      try {
        const raw = localStorage.getItem(`table_${id}`);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        const normalized = parsed.map((item) => normalizeOrder({
          name: item.name,
          createdAt: convertLegacyTime(item.time),
        })).filter(Boolean);
        if (normalized.length) {
          migrated[id].orders = normalized;
          changed = true;
        }
      } catch {}
    }

    return changed ? migrated : createDefaultState();
  }

  function convertLegacyTime(time) {
    const date = new Date();
    if (typeof time === "string" && /^\d{2}:\d{2}$/.test(time)) {
      const [h, m] = time.split(":").map(Number);
      date.setHours(h, m, 0, 0);
    }
    return date.toISOString();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitizeState(JSON.parse(raw));
      const migrated = migrateLegacy();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {
      return createDefaultState();
    }
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

  function formatTime(value) {
    return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  }

  function formatMoney(amount) {
    return `${Math.round(amount).toLocaleString("ru-RU")} ₽`;
  }

  function tableData(id) { return state[id]; }
  function lastOrderTime(id) {
    const orders = tableData(id).orders;
    return orders.length ? orders[orders.length - 1].createdAt : null;
  }
  function tableTipsTotal(id) { return tableData(id).tips.reduce((sum, item) => sum + item.amount, 0); }
  function totalTips() { return TABLE_IDS.reduce((sum, id) => sum + tableTipsTotal(id), 0); }

  function renderHome() {
    tableButtons.forEach((btn) => {
      const id = btn.dataset.table;
      const orders = tableData(id).orders;
      const busy = orders.length > 0;
      btn.dataset.state = busy ? "busy" : "empty";
      const timeEl = btn.querySelector(".table__time");
      const badge = btn.querySelector(".table__badge");
      timeEl.textContent = busy ? formatTime(lastOrderTime(id)) : "";
      badge.textContent = String(orders.length);
      badge.hidden = !busy;
      btn.setAttribute("aria-label", busy ? `Стол ${id}, заказов ${orders.length}` : `Стол ${id}, пустой`);
    });
    const allTips = totalTips();
    tipsTotalMain.textContent = formatMoney(allTips);
    clearAllTipsBtn.disabled = allTips === 0;
  }

  function renderOrders() {
    if (!activeTableId) return;
    const orders = tableData(activeTableId).orders;
    const fragment = document.createDocumentFragment();

    orders.forEach((order) => {
      const li = document.createElement("li");
      li.className = "order";
      li.innerHTML = `
        <span class="order__name"></span>
        <time class="order__time"></time>
        <button class="order__del" type="button" data-id="${order.id}" aria-label="Удалить ${escapeHtml(order.name)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M7 7 8 20h8l1-13"/><path d="M9 7V5h6v2"/></svg>
        </button>`;
      li.querySelector(".order__name").textContent = order.name;
      const timeEl = li.querySelector(".order__time");
      timeEl.dateTime = order.createdAt;
      timeEl.textContent = formatTime(order.createdAt);
      fragment.appendChild(li);
    });

    ordersEl.replaceChildren(fragment);
    tipsTotalTable.textContent = formatMoney(tableTipsTotal(activeTableId));
    renderHome();
  }

  function openTable(id, pushHistory = true) {
    activeTableId = id;
    tableTitle.textContent = `Стол ${id}`;
    sheetTitle.textContent = `Чаевые к столику ${id}`;
    screenHome.hidden = true;
    screenTable.hidden = false;
    renderOrders();
    updateClock();
    if (pushHistory) {
      const url = new URL(location.href);
      url.hash = `table-${id}`;
      history.pushState({ tableId: id }, "", url);
    }
    requestAnimationFrame(() => dishInput.focus({ preventScroll: true }));
    window.scrollTo(0, 0);
  }

  function closeTable(replaceHistory = false) {
    activeTableId = null;
    closeTipSheet();
    screenTable.hidden = true;
    screenHome.hidden = false;
    if (replaceHistory) {
      const url = new URL(location.href);
      url.hash = "";
      history.replaceState({}, "", url);
    }
    renderHome();
    window.scrollTo(0, 0);
  }

  function updateClock() {
    tableClock.textContent = formatTime(new Date());
  }

  function addDish(name) {
    if (!activeTableId) return;
    const clean = name.trim().slice(0, 120);
    if (!clean) return;
    tableData(activeTableId).orders.push({ id: createId(), name: clean, createdAt: new Date().toISOString() });
    if (saveState()) {
      dishInput.value = "";
      renderOrders();
    }
  }

  function removeDish(id) {
    if (!activeTableId) return;
    const orders = tableData(activeTableId).orders;
    tableData(activeTableId).orders = orders.filter((item) => item.id !== id);
    if (saveState()) renderOrders();
  }

  function openTipSheet() {
    if (!activeTableId) return;
    selectedTip = null;
    customTipInput.value = "";
    tipPresets.querySelectorAll("button").forEach((btn) => btn.classList.remove("is-selected"));
    sheetTitle.textContent = `Чаевые к столику ${activeTableId}`;
    sheetBackdrop.hidden = false;
  }

  function closeTipSheet() {
    sheetBackdrop.hidden = true;
    selectedTip = null;
    customTipInput.value = "";
    tipPresets.querySelectorAll("button").forEach((btn) => btn.classList.remove("is-selected"));
  }

  function selectedTipAmount() {
    const custom = Number(customTipInput.value);
    if (Number.isFinite(custom) && custom > 0) return Math.round(custom);
    if (Number.isFinite(selectedTip) && selectedTip > 0) return selectedTip;
    return null;
  }

  function addTip() {
    if (!activeTableId) return;
    const amount = selectedTipAmount();
    if (!amount) {
      showToast("Введите сумму чаевых");
      return;
    }
    tableData(activeTableId).tips.push({ id: createId(), amount, createdAt: new Date().toISOString() });
    if (saveState()) {
      closeTipSheet();
      renderOrders();
      showToast("Чаевые добавлены");
    }
  }

  function clearAllTips() {
    if (!totalTips()) {
      showToast("Чаевых пока нет");
      return;
    }
    if (!window.confirm("Очистить все чаевые за сегодня?")) return;
    TABLE_IDS.forEach((id) => { tableData(id).tips = []; });
    if (saveState()) {
      renderHome();
      if (activeTableId) renderOrders();
      showToast("Чаевые очищены");
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  }

  tableButtons.forEach((btn) => btn.addEventListener("click", () => openTable(btn.dataset.table)));
  clearAllTipsBtn.addEventListener("click", clearAllTips);
  backBtn.addEventListener("click", () => {
    if (location.hash.startsWith("#table-")) history.back();
    else closeTable(true);
  });
  dishForm.addEventListener("submit", (e) => { e.preventDefault(); addDish(dishInput.value); });
  ordersEl.addEventListener("click", (e) => {
    const button = e.target.closest("[data-id]");
    if (button) removeDish(button.dataset.id);
  });
  openTipModalBtn.addEventListener("click", openTipSheet);
  closeTipModalBtn.addEventListener("click", closeTipSheet);
  sheetBackdrop.addEventListener("click", (e) => { if (e.target === sheetBackdrop) closeTipSheet(); });
  sheetPanel.addEventListener("click", (e) => e.stopPropagation());
  tipPresets.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-value]");
    if (!btn) return;
    tipPresets.querySelectorAll("button").forEach((item) => item.classList.remove("is-selected"));
    btn.classList.add("is-selected");
    selectedTip = Number(btn.dataset.value);
    customTipInput.value = "";
  });
  customTipInput.addEventListener("input", () => {
    if (customTipInput.value) {
      selectedTip = null;
      tipPresets.querySelectorAll("button").forEach((item) => item.classList.remove("is-selected"));
    }
  });
  addTipBtn.addEventListener("click", addTip);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheetBackdrop.hidden) closeTipSheet(); });
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = loadState();
    renderHome();
    if (activeTableId) renderOrders();
  });
  window.addEventListener("popstate", () => {
    const match = location.hash.match(/^#table-(\d{1,2})$/);
    if (match && TABLE_IDS.includes(match[1])) openTable(match[1], false);
    else closeTable();
  });

  const startMatch = location.hash.match(/^#table-(\d{1,2})$/);
  if (startMatch && TABLE_IDS.includes(startMatch[1])) {
    history.replaceState({ tableId: startMatch[1] }, "", location.href);
    openTable(startMatch[1], false);
  } else {
    history.replaceState({}, "", location.pathname + location.search);
    closeTable(true);
  }

  renderHome();
  updateClock();
  setInterval(updateClock, 30_000);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }
})();
