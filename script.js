
const tablesContainer = document.getElementById('tables-container');
const modal = document.getElementById('order-modal');
const modalTitle = document.getElementById('modal-title');
const dishInput = document.getElementById('dish-input');
const orderList = document.getElementById('order-list');
const resetBtn = document.getElementById('reset-table');
const closeBtn = document.getElementById('close-modal');

const tableNumbers = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
let currentTable = null;

// Инициализация таблиц
function loadTables() {
    tablesContainer.innerHTML = '';
    tableNumbers.forEach(num => {
        const div = document.createElement('div');
        div.classList.add('table');
        const orders = JSON.parse(localStorage.getItem('table_'+num)) || [];
        div.classList.add(orders.length ? 'has-orders' : 'empty');
        div.textContent = num;
        div.addEventListener('click', () => openModal(num));
        tablesContainer.appendChild(div);
    });
}

// Открытие модального окна
function openModal(tableNum) {
    currentTable = tableNum;
    modalTitle.textContent = 'Стол ' + tableNum;
    loadOrders();
    modal.style.display = 'flex';
    dishInput.focus();
}

// Загрузка заказов столика
function loadOrders() {
    orderList.innerHTML = '';
    const orders = JSON.parse(localStorage.getItem('table_'+currentTable)) || [];
    orders.forEach((order, i) => {
        const li = document.createElement('li');
        li.textContent = order.name + ' (' + order.time + ')';
        const btn = document.createElement('button');
        btn.textContent = '×';
        btn.addEventListener('click', () => deleteOrder(i));
        li.appendChild(btn);
        orderList.appendChild(li);
    });
    updateTableColor();
}

// Добавление блюда
dishInput.addEventListener('keydown', e => {
    if(e.key === 'Enter' && dishInput.value.trim()) {
        const orders = JSON.parse(localStorage.getItem('table_'+currentTable)) || [];
        const now = new Date();
        const time = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
        orders.push({name: dishInput.value.trim(), time});
        localStorage.setItem('table_'+currentTable, JSON.stringify(orders));
        dishInput.value = '';
        loadOrders();
    }
});

// Удаление заказа
function deleteOrder(index) {
    const orders = JSON.parse(localStorage.getItem('table_'+currentTable)) || [];
    orders.splice(index,1);
    localStorage.setItem('table_'+currentTable, JSON.stringify(orders));
    loadOrders();
}

// Обнуление столика
resetBtn.addEventListener('click', () => {
    localStorage.removeItem('table_'+currentTable);
    loadOrders();
});

closeBtn.addEventListener('click', () => modal.style.display='none');

function updateTableColor() {
    loadTables();
}

window.onload = loadTables;
