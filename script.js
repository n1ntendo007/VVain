
const tables = document.querySelectorAll('.table');
const modal = document.getElementById('order-modal');
const modalTitle = document.getElementById('modal-title');
const dishInput = document.getElementById('dish-input');
const orderList = document.getElementById('order-list');
const resetBtn = document.getElementById('reset-table');
const closeBtn = document.getElementById('close-modal');

let currentTable = null;

tables.forEach(table => {
    const num = table.dataset.table;
    const orders = JSON.parse(localStorage.getItem('table_' + num)) || [];
    updateTableColor(table, orders);
    table.addEventListener('click', () => openModal(num));
});

function updateTableColor(table, orders) {
    if(orders.length === 0) {
        table.classList.remove('has-orders');
        table.classList.add('empty');
    } else {
        table.classList.remove('empty');
        table.classList.add('has-orders');
    }
}

function openModal(num) {
    currentTable = num;
    modalTitle.textContent = 'Стол ' + num;
    dishInput.value = '';
    loadOrders();
    modal.style.display = 'flex';
    dishInput.focus();
}

function loadOrders() {
    orderList.innerHTML = '';
    const orders = JSON.parse(localStorage.getItem('table_' + currentTable)) || [];
    orders.forEach((order, i) => {
        const li = document.createElement('li');
        li.textContent = order.name + ' (' + order.time + ')';
        const btn = document.createElement('button');
        btn.textContent = '×';
        btn.addEventListener('click', () => deleteOrder(i));
        li.appendChild(btn);
        orderList.appendChild(li);
    });
    refreshTableColors();
}

dishInput.addEventListener('keydown', e => {
    if(e.key === 'Enter' && dishInput.value.trim()) {
        const orders = JSON.parse(localStorage.getItem('table_' + currentTable)) || [];
        const now = new Date();
        const time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
        orders.push({name: dishInput.value.trim(), time});
        localStorage.setItem('table_' + currentTable, JSON.stringify(orders));
        dishInput.value = '';
        loadOrders();
    }
});

function deleteOrder(i) {
    const orders = JSON.parse(localStorage.getItem('table_' + currentTable)) || [];
    orders.splice(i,1);
    localStorage.setItem('table_' + currentTable, JSON.stringify(orders));
    loadOrders();
}

resetBtn.addEventListener('click', () => {
    localStorage.removeItem('table_' + currentTable);
    loadOrders();
});

closeBtn.addEventListener('click', () => modal.style.display='none');

function refreshTableColors() {
    tables.forEach(table => {
        const num = table.dataset.table;
        const orders = JSON.parse(localStorage.getItem('table_' + num)) || [];
        updateTableColor(table, orders);
    });
}
