
const tables = document.querySelectorAll('.table, .table-circle');
let data = JSON.parse(localStorage.getItem('VVainData')) || {};
tables.forEach(t => {
    const tableNum = t.dataset.table;
    if (!data[tableNum] || data[tableNum].length === 0) {
        t.classList.add('empty');
    } else {
        t.classList.add('has-orders');
    }
    t.addEventListener('click', () => {
        window.location.href = `table.html?table=${tableNum}`;
    });
});
