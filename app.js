(() => {
  "use strict";

  const TABLE_IDS = Array.from({ length: 17 }, (_, index) => String(index + 1));
  const STORAGE_KEY = "vvain.orders.v1";

  const tablesScreen = document.getElementById("tables-screen");
  const ordersScreen = document.getElementById("orders-screen");
  const tableButtons = Array.from(document.querySelectorAll("[data-table-id]"));
  const orderTitle = document.getElementById("order-title");
  const headerTime = document.getElementById("header-time");
  const backButton = document.getElementById("back-button");
  const dishForm = document.getElementById("dish-form");
  const dishInput = document.getElementById("dish-input");
  const orderList = document.getElementById("order-list");
  const resetButton = document.getElementById("reset-button");
  const headerClearButton = document.getElementById("header-clear-button");
  const toast = document.getElementById("toast");

  let state = loadState();
  let activeTableId = null;
  let toastTimer = null;

  function emptyState() {
    return TABLE_IDS.reduce((result, id) => {
      result[id] = [];
      return result;
    }, {});
  }

  function sanitizeState(candidate) {
    const clean = emptyState();
    if (!candidate || typeof candidate !== "object") return clean;

    for (const tableId of TABLE_IDS) {
      const maybeOrders = candidate[tableId];
      if (!Array.isArray(maybeOrders)) continue;
      clean[tableId] = maybeOrders
        .filter((order) => order && typeof order.name === "string" && order.name.trim())
        .map((order) => ({
          id: typeof order.id === "string" ? order.id : createId(),
          name: order.name.trim().slice(0, 120),
          createdAt: isValidDate(order.createdAt) ? order.createdAt : new Date().toISOString(),
        }));
    }
    return clean;
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return sanitizeState(JSON.parse(stored));

      const migrated = emptyState();
      let didMigrate = false;
      for (const tableId of TABLE_IDS) {
        const legacy = localStorage.getItem(`table_${tableId}`);
        if (!legacy) continue;
        const parsed = JSON.parse(legacy);
        if (!Array.isArray(parsed)) continue;
        migrated[tableId] = parsed
          .filter((order) => order && typeof order.name === "string" && order.name.trim())
          .map((order) => ({
            id: createId(),
            name: order.name.trim().slice(0, 120),
            createdAt: legacyTimeToIso(order.time),
          }));
        didMigrate = true;
      }
      if (didMigrate) localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch (error) {
      console.warn("VVain: не удалось прочитать локальные данные", error);
      return emptyState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn("VVain: не удалось сохранить локальные данные", error);
      showToast("Не удалось сохранить данные в браузере");
      return false;
    }
  }

  function isValidDate(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
  }

  function legacyTimeToIso(time) {
    const now = new Date();
    if (typeof time === "string" && /^\d{2}:\d{2}$/.test(time)) {
      const [hours, minutes] = time.split(":").map(Number);
      now.setHours(hours, minutes, 0, 0);
    }
    return now.toISOString();
  }

  function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatTime(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function renderTableStates() {
    for (const button of tableButtons) {
      const tableId = button.dataset.tableId;
      const orders = state[tableId] || [];
      button.dataset.state = orders.length > 0 ? "busy" : "empty";
      button.setAttribute(
        "aria-label",
        orders.length > 0
          ? `Стол ${tableId}: заказов ${orders.length}`
          : `Стол ${tableId}: пустой`,
      );
    }
  }

  function renderOrders() {
    if (!activeTableId) return;
    const orders = state[activeTableId] || [];
    const fragment = document.createDocumentFragment();

    for (const order of orders) {
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
      removeButton.setAttribute("aria-label", `Удалить: ${order.name}`);
      removeButton.dataset.orderId = order.id;
      removeButton.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14" /><path d="M10 11v6" /><path d="M14 11v6" />
          <path d="M7 7 8 20h8l1-13" /><path d="M9 7V5h6v2" />
        </svg>`;

      item.append(name, time, removeButton);
      fragment.append(item);
    }

    orderList.replaceChildren(fragment);
    const isEmpty = orders.length === 0;
    resetButton.disabled = isEmpty;
    headerClearButton.disabled = isEmpty;
    renderTableStates();
  }

  function openTable(tableId, { pushHistory = true } = {}) {
    if (!TABLE_IDS.includes(String(tableId))) return;
    activeTableId = String(tableId);
    orderTitle.textContent = `Стол ${activeTableId}`;
    tablesScreen.hidden = true;
    ordersScreen.hidden = false;
    renderOrders();
    updateClock();

    if (pushHistory) {
      const url = new URL(window.location.href);
      url.hash = `table-${activeTableId}`;
      history.pushState({ tableId: activeTableId }, "", url);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    requestAnimationFrame(() => dishInput.focus({ preventScroll: true }));
  }

  function showTables({ replaceHistory = false } = {}) {
    activeTableId = null;
    ordersScreen.hidden = true;
    tablesScreen.hidden = false;
    dishInput.value = "";
    renderTableStates();

    if (replaceHistory) {
      const url = new URL(window.location.href);
      url.hash = "";
      history.replaceState({}, "", url);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function addDish(rawName) {
    if (!activeTableId) return;
    const name = rawName.trim();
    if (!name) return;

    state[activeTableId].push({
      id: createId(),
      name: name.slice(0, 120),
      createdAt: new Date().toISOString(),
    });
    if (saveState()) {
      dishInput.value = "";
      renderOrders();
    }
  }

  function deleteDish(orderId) {
    if (!activeTableId) return;
    state[activeTableId] = state[activeTableId].filter((order) => order.id !== orderId);
    if (saveState()) renderOrders();
  }

  function clearActiveTable() {
    if (!activeTableId || state[activeTableId].length === 0) return;
    state[activeTableId] = [];
    if (saveState()) {
      renderOrders();
      showToast("Столик обнулён");
    }
  }

  function updateClock() {
    headerTime.textContent = formatTime();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 1800);
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

  resetButton.addEventListener("click", clearActiveTable);
  headerClearButton.addEventListener("click", clearActiveTable);

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
    renderOrders();
  });

  const hashMatch = window.location.hash.match(/^#table-(\d{1,2})$/);
  if (hashMatch && TABLE_IDS.includes(hashMatch[1])) {
    history.replaceState({ tableId: hashMatch[1] }, "", window.location.href);
    openTable(hashMatch[1], { pushHistory: false });
  } else {
    history.replaceState({}, "", window.location.pathname + window.location.search);
    showTables();
  }

  updateClock();
  window.setInterval(updateClock, 30_000);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.warn("VVain: service worker не зарегистрирован", error);
      });
    });
  }
})();
