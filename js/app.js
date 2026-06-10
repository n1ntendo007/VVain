
const tableCount = 9;
const tablesContainer = document.querySelector('.tables');

// Загружаем данные из localStorage
let tableData = JSON.parse(localStorage.getItem('VVainData')) || {};

// Создаем столики
for (let i = 1; i <= tableCount; i++) {
    const tableDiv = document.createElement('div');
    tableDiv.classList.add('table');
    tableDiv.dataset.table = i;
    tableDiv.innerHTML = `<h2>Стол ${i}</h2>`;
    
    // Подсветка по статусу
    if (!tableData[i] || tableData[i].length === 0) {
        tableDiv.classList.add('empty');
    } else {
        tableDiv.classList.add('has-orders');
    }

    tableDiv.addEventListener('click', () => openTable(tableDiv.dataset.table));
    tablesContainer.appendChild(tableDiv);
}

function openTable(tableNumber) {
    const orders = tableData[tableNumber] || [];
    const tableDiv = document.querySelector(`.table[data-table='${tableNumber}']`);
    tableDiv.innerHTML = `<h2>Стол ${tableNumber}</h2>` +
                         `<div class="orders-container"></div>` +
                         `<input type="text" placeholder="Добавить блюдо и Enter">` +
                         `<button class="clear-btn">Обнулить столик</button>`;
    const ordersContainer = tableDiv.querySelector('.orders-container');
    const input = tableDiv.querySelector('input');
    const clearBtn = tableDiv.querySelector('.clear-btn');

    function renderOrders() {
        ordersContainer.innerHTML = '';
        orders.forEach((order, index) => {
            const div = document.createElement('div');
            div.classList.add('order-item');
            div.innerHTML = `<span>${order.name} (${order.time})</span>` +
                            `<button class="delete-btn">X</button>`;
            div.querySelector('.delete-btn').addEventListener('click', () => {
                orders.splice(index, 1);
                saveData();
                renderOrders();
                updateTableHighlight(tableNumber);
            });
            ordersContainer.appendChild(div);
        });
    }

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim() !== '') {
            const now = new Date();
            const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
            orders.push({name: input.value.trim(), time: timeStr});
            input.value = '';
            saveData();
            renderOrders();
            updateTableHighlight(tableNumber);
        }
    });

    clearBtn.addEventListener('click', () => {
        orders.length = 0;
        saveData();
        renderOrders();
        updateTableHighlight(tableNumber);
    });

    renderOrders();
}

function saveData() {
    localStorage.setItem('VVainData', JSON.stringify(tableData));
}

function updateTableHighlight(tableNumber) {
    const tableDiv = document.querySelector(`.table[data-table='${tableNumber}']`);
    if (!tableData[tableNumber]) tableData[tableNumber] = [];
    if (tableData[tableNumber].length === 0) {
        tableDiv.classList.remove('has-orders');
        tableDiv.classList.add('empty');
    } else {
        tableDiv.classList.remove('empty');
        tableDiv.classList.add('has-orders');
    }
}
