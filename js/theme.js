// Переключение темы
function initTheme() {
    const saved = localStorage.getItem('fit-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('fit-theme', next);
    showToast(`Тема: ${next === 'dark' ? 'Тёмная' : 'Светлая'}`);
}

// Экспорт для других модулей
window.initTheme = initTheme;
window.toggleTheme = toggleTheme;
