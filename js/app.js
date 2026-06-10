
const tablesData = {};
const tableCount = 17;

function formatTime(date) {
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function renderTables() {
    const container = document.querySelector('.tables');
    container.innerHTML = '';
    for (let i = 1; i <= tableCount; i++) {
        const table = document.createElement('div');
        table.classList.add('table');
        table.id = 'table-' + i;

        const h2 = document.createElement('h2');
        h2.textContent = 'Столик ' + i;
        table.appendChild(h2);

        const ordersDiv = document.createElement('div');
        ordersDiv.classList.add('orders');
        table.appendChild(ordersDiv);

        const btnClear = document.createElement('button');
        btnClear.textContent = 'Обнулить столик';
        btnClear.addEventListener('click', (e) => {
            e.stopPropagation();
            tablesData[i] = [];
            saveData();
            updateTable(i);
        });
        table.appendChild(btnClear);

        table.addEventListener('click', () => {
            const dish = prompt('Введите блюдо для столика ' + i);
            if (dish) {
                const time = formatTime(new Date());
                if (!tablesData[i]) tablesData[i] = [];
                tablesData[i].push({name: dish, time});
                saveData();
                updateTable(i);
            }
        });

        container.appendChild(table);
        updateTable(i);
    }
}

function updateTable(i) {
    const table = document.getElementById('table-' + i);
    const ordersDiv = table.querySelector('.orders');
    ordersDiv.innerHTML = '';
    const orders = tablesData[i] || [];
    if (orders.length === 0) {
        table.classList.add('empty');
        table.classList.remove('filled');
    } else {
        table.classList.add('filled');
        table.classList.remove('empty');
    }
    orders.forEach((order, idx) => {
        const div = document.createElement('div');
        div.classList.add('order');
        div.innerHTML = \`\${order.name} (\${order.time})\`;
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Удалить';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            tablesData[i].splice(idx, 1);
            saveData();
            updateTable(i);
        });
        div.appendChild(delBtn);
        ordersDiv.appendChild(div);
    });
}

function saveData() {
    localStorage.setItem('VVainData', JSON.stringify(tablesData));
}

function loadData() {
    const saved = localStorage.getItem('VVainData');
    if (saved) {
        Object.assign(tablesData, JSON.parse(saved));
    }
}

loadData();
renderTables();
