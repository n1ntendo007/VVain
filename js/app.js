
const tables = document.querySelectorAll('.table, .table-circle');
tables.forEach(t => {
    const tableNum = t.dataset.table;
    let data = JSON.parse(localStorage.getItem('VVainData')) || {};
    if (!data[tableNum] || data[tableNum].length === 0) {
        t.classList.add('empty');
    } else {
        t.classList.add('has-orders');
    }
    t.addEventListener('click', () => {
        window.location.href = `table.html?table=${tableNum}`;
    });
});
