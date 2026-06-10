
const urlParams = new URLSearchParams(window.location.search);
const tableNum = urlParams.get('table');
document.getElementById('table-header').innerText = 'Стол ' + tableNum;
let data = JSON.parse(localStorage.getItem('VVainData')) || {};
if (!data[tableNum]) data[tableNum] = [];
const ordersList = document.getElementById('orders-list');
const input = document.getElementById('order-input');
const clearBtn = document.getElementById('clear-btn');
const backBtn = document.getElementById('back-btn');

function render() {
    ordersList.innerHTML = '';
    data[tableNum].forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'order-item';
        div.innerHTML = `<span>${item.name}</span> <span>${item.time}</span> <button data-idx="${idx}">X</button>`;
        div.querySelector('button').addEventListener('click', e => {
            const index = e.target.dataset.idx;
            data[tableNum].splice(index, 1);
            localStorage.setItem('VVainData', JSON.stringify(data));
            render();
        });
        ordersList.appendChild(div);
    });
}

input.addEventListener('keypress', e => {
    if (e.key === 'Enter' && input.value.trim() !== '') {
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
        data[tableNum].push({name: input.value.trim(), time: timeStr});
        localStorage.setItem('VVainData', JSON.stringify(data));
        input.value = '';
        render();
    }
});

clearBtn.addEventListener('click', () => {
    data[tableNum] = [];
    localStorage.setItem('VVainData', JSON.stringify(data));
    render();
});

backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
});

render();
