(() => {
  "use strict";

  const TABLE_IDS = ["13", "14", "12", "15", "11", "16", "10", "17", "5", "4", "6", "3", "7", "2", "8", "1", "9"];
  const STORAGE_KEY = "vvain.data.v3";
  const LEGACY_KEYS = ["vvain.orders.v1"];

  const tablesScreen = document.getElementById("tables-screen");
  const ordersScreen = document.getElementById("orders-screen");
  const tableButtons = Array.from(document.querySelectorAll("[data-table-id]"));
  const orderTitle = document.getElementById("order-title");
  const headerTime = document.getElementById("header-time");
  const backButton = document.getElementById("back-button");
  const dishForm = document.getElementById("dish-form");
  const dishInput = document.getElementById("dish-input");
  const orderList = document.getElementById("order-list");
  const tipsMainTotal = document.getElementById("tips-total-main");
  const clearTipsButton = document.getElementById("clear-tips-button");
  const tipsTableTotal = document.getElementById("tips-total-table");
  const openTipSheetButton = document.getElementById("open-tip-sheet-button");
  const tipSheetBackdrop = document.getElementById("tip-sheet-backdrop");
  const tipSheetTitle = document.getElementById("tip-sheet-title");
  const closeTipSheetButton = document.getElementById("close-tip-sheet-button");
  const tipPresets = document.getElementById("tip-presets");
  const customTipInput = document.getElementById("custom-tip-input");
  const submitTipButton = document.getElementById("submit-tip-button");
  const toast = document.getElementById("toast");

  let state = loadState();
  let activeTableId = null;
  let tipSelection = null;
  let toastTimer = null;

  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("gestureend", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("touchmove", (event) => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });

  let lastTouchEnd = 0;
  document.addEventListener("touchend", (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) event.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  function emptyState() {
    return TABLE_IDS.reduce((result, tableId) => {
      result[tableId] = {
        orders: [],
        tips: [],
        updatedAt: null,
      };
      return result;
    }, {});
  }

  function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function isValidDate(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
  }

  function createOrder(candidate) {
    if (!candidate || typeof candidate.name !== "string") return null;
    const name = candidate.name.trim().slice(0, 120);
    if (!name) return null;
    return {
      id: typeof candidate.id === "string" ? candidate.id : createId(),
      name,
      createdAt: isValidDate(candidate.createdAt) ? candidate.createdAt : new Date().toISOString(),
    };
  }

  function createTip(candidate) {
    const amount = Number(candidate?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return {
      id: typeof candidate.id === "string" ? candidate.id : createId(),
      amount: Math.round(amount),
      createdAt: isValidDate(candidate.createdAt) ? candidate.createdAt : new Date().toISOString(),
    };
  }

  function sanitizeState(candidate) {
    const clean = emptyState();
    if (!candidate || typeof candidate !== "object") return clean;

    for (const tableId of TABLE_IDS) {
      const source = candidate[tableId];
      if (Array.isArray(source)) {
        clean[tableId].orders = source.map(createOrder).filter(Boolean);
        clean[tableId].updatedAt = clean[tableId].orders.at(-1)?.createdAt ?? null;
        continue;
      }

      if (!source || typeof source !== "object") continue;
      clean[tableId].orders = Array.isArray(source.orders) ? source.orders.map(createOrder).filter(Boolean) : [];
      clean[tableId].tips = Array.isArray(source.tips) ? source.tips.map(createTip).filter(Boolean) : [];
      clean[tableId].updatedAt = isValidDate(source.updatedAt)
        ? source.updatedAt
        : clean[tableId].orders.at(-1)?.createdAt ?? null;
    }

    return clean;
  }

  function migrateLegacyOrders() {
    const migrated = emptyState();
    let didMigrate = false;

    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const sanitized = sanitizeState(parsed);
        for (const tableId of TABLE_IDS) {
          if (sanitized[tableId].orders.length) {
            migrated[tableId] = sanitized[tableId];
            didMigrate = true;
          }
        }
      } catch (error) {
        console.warn("VVain: ошибка миграции старых данных", error);
      }
    }

    for (const tableId of TABLE_IDS) {
      const legacy = localStorage.getItem(`table_${tableId}`);
      if (!legacy) continue;
      try {
        const parsed = JSON.parse(legacy);
        if (!Array.isArray(parsed)) continue;
        migrated[tableId].orders = parsed
          .filter((item) => item && typeof item.name === "string" && item.name.trim())
          .map((item) => ({
            id: createId(),
            name: item.name.trim().slice(0, 120),
            createdAt: legacyTimeToIso(item.time),
          }));
        migrated[tableId].updatedAt = migrated[tableId].orders.at(-1)?.createdAt ?? null;
        didMigrate = true;
      } catch (error) {
        console.warn("VVain: ошибка миграции table_*", error);
      }
    }

    return didMigrate ? migrated : emptyState();
  }

  function legacyTimeToIso(time) {
    const date = new Date();
    if (typeof time === "string" && /^\d{2}:\d{2}$/.test(time)) {
      const [hours, minutes] = time.split(":").map(Number);
      date.setHours(hours, minutes, 0, 0);
    }
    return date.toISOString();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitizeState(JSON.parse(raw));
      const migrated = migrateLegacyOrders();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch (error) {
      console.warn("VVain: не удалось прочитать данные", error);
      return emptyState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn("VVain: не удалось сохранить данные", error);
      showToast("Не удалось сохранить данные");
      return false;
    }
  }

  function formatTime(value) {
    const date = value ? new Date(value) : new Date();
    return new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function formatMoney(amount) {
    return `${Math.round(amount).toLocaleString("ru-RU")} ₽`;
  }

  function getTable(tableId) {
    return state[tableId];
  }

  function getTableTipsTotal(tableId) {
    return getTable(tableId).tips.reduce((sum, tip) => sum + tip.amount, 0);
  }

  function getAllTipsTotal() {
    return TABLE_IDS.reduce((sum, tableId) => sum + getTableTipsTotal(tableId), 0);
  }

  function updateMainTipsTotal() {
    tipsMainTotal.textContent = formatMoney(getAllTipsTotal());
  }

  function renderTableStates() {
    for (const button of tableButtons) {
      const tableId = button.dataset.tableId;
      const table = getTable(tableId);
      const isBusy = table.orders.length > 0;
      button.dataset.state = isBusy ? "busy" : "empty";
      const timeEl = button.querySelector(".table__time");
      const countEl = button.querySelector(".table__count");
      if (timeEl) timeEl.textContent = isBusy && table.updatedAt ? formatTime(table.updatedAt) : "";
      if (countEl) {
        if (isBusy) {
          countEl.hidden = false;
          countEl.textContent = String(table.orders.length);
        } else {
          countEl.hidden = true;
          countEl.textContent = "0";
        }
      }
      button.setAttribute(
        "aria-label",
        isBusy
          ? `Стол ${tableId}, заказов ${table.orders.length}, последнее изменение ${formatTime(table.updatedAt)}`
          : `Стол ${tableId}, пустой`,
      );
    }
    updateMainTipsTotal();
  }

  function renderOrders() {
    if (!activeTableId) return;
    const table = getTable(activeTableId);
    const fragment = document.createDocumentFragment();

    for (const order of table.orders) {
      const item = document.createElement("li");
      item.className = "order-item";

      const name = document.createElement("span");
      name.className = "order-item__name";
      name.textContent = order.name;
      name.title = order.name;

      const time = document.createElement("time");
      time.className = "order-item__time";
      time.dateTime = order.createdAt;
      time.textContent = formatTime(order.createdAt);

      const removeButton = document.createElement("button");
      removeButton.className = "order-item__delete";
      removeButton.type = "button";
      removeButton.dataset.orderId = order.id;
      removeButton.setAttribute("aria-label", `Удалить ${order.name}`);
      removeButton.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M7 7 8 20h8l1-13" />
          <path d="M9 7V5h6v2" />
        </svg>`;

      item.append(name, time, removeButton);
      fragment.append(item);
    }

    orderList.replaceChildren(fragment);
    tipsTableTotal.textContent = formatMoney(getTableTipsTotal(activeTableId));
    renderTableStates();
  }

  function updateClock() {
    headerTime.textContent = formatTime();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
  }

  function openTable(tableId, { pushHistory = true } = {}) {
    if (!TABLE_IDS.includes(String(tableId))) return;
    activeTableId = String(tableId);
    orderTitle.textContent = `Стол ${activeTableId}`;
    tipSheetTitle.textContent = `Чаевые к столику ${activeTableId}`;
    tablesScreen.hidden = true;
    ordersScreen.hidden = false;
    renderOrders();
    updateClock();

    if (pushHistory) {
      const url = new URL(window.location.href);
      url.hash = `table-${activeTableId}`;
      history.pushState({ tableId: activeTableId }, "", url);
    }

    requestAnimationFrame(() => dishInput.focus({ preventScroll: true }));
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function showTables({ replaceHistory = false } = {}) {
    activeTableId = null;
    ordersScreen.hidden = true;
    tablesScreen.hidden = false;
    closeTipSheet();
    if (replaceHistory) {
      const url = new URL(window.location.href);
      url.hash = "";
      history.replaceState({}, "", url);
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function addDish(name) {
    if (!activeTableId) return;
    const cleanName = name.trim().slice(0, 120);
    if (!cleanName) return;

    const now = new Date().toISOString();
    getTable(activeTableId).orders.push({
      id: createId(),
      name: cleanName,
      createdAt: now,
    });
    getTable(activeTableId).updatedAt = now;

    if (saveState()) {
      dishInput.value = "";
      renderOrders();
    }
  }

  function deleteDish(orderId) {
    if (!activeTableId) return;
    const table = getTable(activeTableId);
    table.orders = table.orders.filter((order) => order.id !== orderId);
    table.updatedAt = table.orders.length ? new Date().toISOString() : null;
    if (saveState()) renderOrders();
  }

  function openTipSheet() {
    if (!activeTableId) return;
    tipSelection = null;
    customTipInput.value = "";
    Array.from(tipPresets.querySelectorAll("button")).forEach((button) => button.classList.remove("is-selected"));
    tipSheetTitle.textContent = `Чаевые к столику ${activeTableId}`;
    tipSheetBackdrop.hidden = false;
    customTipInput.blur();
  }

  function closeTipSheet() {
    tipSheetBackdrop.hidden = true;
    tipSelection = null;
    customTipInput.value = "";
    Array.from(tipPresets.querySelectorAll("button")).forEach((button) => button.classList.remove("is-selected"));
  }

  function getSelectedTipAmount() {
    const custom = Number(customTipInput.value);
    if (Number.isFinite(custom) && custom > 0) return Math.round(custom);
    if (Number.isFinite(tipSelection) && tipSelection > 0) return tipSelection;
    return null;
  }

  function addTip() {
    if (!activeTableId) return;
    const amount = getSelectedTipAmount();
    if (!amount) {
      showToast("Введите сумму чаевых");
      return;
    }

    getTable(activeTableId).tips.push({
      id: createId(),
      amount,
      createdAt: new Date().toISOString(),
    });

    if (saveState()) {
      closeTipSheet();
      renderOrders();
      showToast("Чаевые добавлены");
    }
  }

  function clearAllTips() {
    const total = getAllTipsTotal();
    if (!total) {
      showToast("Чаевых пока нет");
      return;
    }
    if (!window.confirm("Очистить все чаевые за сегодня?")) return;

    for (const tableId of TABLE_IDS) {
      getTable(tableId).tips = [];
    }
    if (saveState()) {
      renderTableStates();
      if (activeTableId) renderOrders();
      showToast("Все чаевые очищены");
    }
  }

  tableButtons.forEach((button) => {
    button.addEventListener("click", () => openTable(button.dataset.tableId));
  });

  backButton.addEventListener("click", () => {
    if (window.location.hash.startsWith("#table-")) {
      history.back();
    } else {
      showTables({ replaceHistory: true });
    }
  });

  dishForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addDish(dishInput.value);
  });

  orderList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-order-id]");
    if (deleteButton) deleteDish(deleteButton.dataset.orderId);
  });

  clearTipsButton.addEventListener("click", clearAllTips);
  openTipSheetButton.addEventListener("click", openTipSheet);
  closeTipSheetButton.addEventListener("click", closeTipSheet);
  tipSheetBackdrop.addEventListener("click", (event) => {
    if (event.target === tipSheetBackdrop) closeTipSheet();
  });

  tipPresets.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-amount]");
    if (!button) return;
    Array.from(tipPresets.querySelectorAll("button")).forEach((item) => item.classList.remove("is-selected"));
    button.classList.add("is-selected");
    tipSelection = Number(button.dataset.amount);
    customTipInput.value = "";
  });

  customTipInput.addEventListener("input", () => {
    if (customTipInput.value) {
      tipSelection = null;
      Array.from(tipPresets.querySelectorAll("button")).forEach((item) => item.classList.remove("is-selected"));
    }
  });

  submitTipButton.addEventListener("click", addTip);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !tipSheetBackdrop.hidden) closeTipSheet();
  });

  window.addEventListener("popstate", () => {
    const match = window.location.hash.match(/^#table-(\d{1,2})$/);
    if (match && TABLE_IDS.includes(match[1])) {
      openTable(match[1], { pushHistory: false });
    } else {
      showTables();
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = loadState();
    renderTableStates();
    if (activeTableId) renderOrders();
  });

  const hashMatch = window.location.hash.match(/^#table-(\d{1,2})$/);
  if (hashMatch && TABLE_IDS.includes(hashMatch[1])) {
    history.replaceState({ tableId: hashMatch[1] }, "", window.location.href);
    openTable(hashMatch[1], { pushHistory: false });
  } else {
    history.replaceState({}, "", window.location.pathname + window.location.search);
    showTables();
  }

  renderTableStates();
  updateClock();
  window.setInterval(updateClock, 30000);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.warn("VVain: service worker не зарегистрирован", error);
      });
    });
  }
})();
