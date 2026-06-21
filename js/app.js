/**
 * js/app.js
 * Точка входа приложения. Связывает UI (HTML) с логикой (workouts.js).
 * Отвечает за рендеринг, обработку событий и инициализацию графиков.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Проверка наличия workoutsDB (если подключен через script tag)
    if (!window.workoutsDB) {
        console.error('Ошибка: workouts.js не загружен или не инициализирован!');
        showToast('Ошибка загрузки данных. Проверьте консоль.', 'error');
        return;
    }

    const { 
        addWorkout, 
        updateWorkout, 
        deleteWorkout, 
        getAllWorkouts, 
        searchWorkouts,
        filterWorkouts,
        calculateStats,
        getCustomExercises,
        getMuscleTags
    } = window.workoutsDB;

    // --- Элементы DOM ---
    const appContainer = document.getElementById('app');
    const nav = document.getElementById('nav');
    
    // Секции
    const sectionHome = document.getElementById('section-home');
    const sectionStats = document.getElementById('section-stats');
    const sectionAdd = document.getElementById('section-add');
    const sectionSettings = document.getElementById('section-settings');

    // Формы
    const formAddWorkout = document.getElementById('form-add-workout');
    const formEditWorkout = document.getElementById('form-edit-workout');
    
    // Фильтры и поиск
    const inputSearch = document.getElementById('input-search');
    const selectDateFilter = document.getElementById('select-date-filter');
    const checkboxesMuscle = document.querySelectorAll('.filter-muscle-checkbox');

    // Списки и графики
    const listWorkouts = document.getElementById('list-workouts');
    const canvasStats = document.getElementById('chart-stats');
    const canvasWeight = document.getElementById('chart-weight');

    // Модальные окна
    const modalEdit = document.getElementById('modal-edit');
    const modalAdd = document.getElementById('modal-add');
    const btnCloseEdit = document.querySelector('#modal-edit .close');
    const btnCloseAdd = document.querySelector('#modal-add .close');

    // Переменные состояния
    let chartStatsInstance = null;
    let chartWeightInstance = null;
    let currentEditId = null;

    // --- Инициализация ---
    init();

    function init() {
        renderNavigation();
        loadCustomExercisesToSelects();
        renderWorkoutsList();
        initCharts();
        setupEventListeners();
        
        // По умолчанию показываем главную страницу
        navigateTo('home');
    }

    // --- Навигация ---
    function renderNavigation() {
        if (!nav) return;
        nav.innerHTML = `
            <button onclick="app.navigateTo('home')" class="nav-btn ${getActiveClass('home')}">
                <i class="fas fa-home"></i> Главная
            </button>
            <button onclick="app.navigateTo('stats')" class="nav-btn ${getActiveClass('stats')}">
                <i class="fas fa-chart-line"></i> Статистика
            </button>
            <button onclick="app.navigateTo('add')" class="nav-btn btn-primary ${getActiveClass('add')}">
                <i class="fas fa-plus"></i> Новая тренировка
            </button>
        `;
    }

    function getActiveClass(page) {
        const current = getCurrentPage();
        return current === page ? 'active' : '';
    }

    function getCurrentPage() {
        if (sectionHome.style.display === 'block') return 'home';
        if (sectionStats.style.display === 'block') return 'stats';
        if (sectionAdd.style.display === 'block') return 'add';
        return 'home';
    }

    window.app = {
        navigateTo: (page) => {
            // Скрываем все секции
            [sectionHome, sectionStats, sectionAdd].forEach(el => el.style.display = 'none');
            
            // Показываем нужную
            if (page === 'home') sectionHome.style.display = 'block';
            if (page === 'stats') {
                sectionStats.style.display = 'block';
                renderStats(); // Обновляем графики при входе
            }
            if (page === 'add') sectionAdd.style.display = 'block';

            renderNavigation();
        }
    };

    // --- Работа с данными и рендеринг ---

    function loadCustomExercisesToSelects() {
        const exercises = getCustomExercises();
        const selects = [
            document.getElementById('exercise-select-add'),
            document.getElementById('exercise-select-edit')
        ];
        
        selects.forEach(select => {
            if (!select) return;
            select.innerHTML = '<option value="">Выберите упражнение</option>';
            exercises.forEach(ex => {
                const opt = document.createElement('option');
                opt.value = ex;
                opt.textContent = ex;
                select.appendChild(opt);
            });
        });

        // Заполняем чекбоксы мышц
        const tags = getMuscleTags();
        checkboxesMuscle.forEach(cb => {
            const label = cb.nextElementSibling;
            if (label && tags.includes(label.textContent)) {
                cb.disabled = false;
            } else {
                cb.disabled = true; // Или скрыть, если нужно
            }
        });
    }

    function renderWorkoutsList(filteredData = null) {
        if (!listWorkouts) return;
        
        const data = filteredData || getAllWorkouts();
        listWorkouts.innerHTML = '';

        if (data.length === 0) {
            listWorkouts.innerHTML = '<div class="empty-state">Тренировок пока нет. Добавьте первую!</div>';
            return;
        }

        data.forEach(w => {
            const li = document.createElement('li');
            li.className = 'workout-card';
            li.dataset.id = w.id;
            
            const durationText = w.startTime && w.endTime ? 
                `${calculateDurationText(w.startTime, w.endTime)}` : 'Без таймера';
            
            const muscleTagsHtml = w.muscleTags.map(t => `<span class="tag">${t}</span>`).join('');

            li.innerHTML = `
                <div class="card-header">
                    <h3>${escapeHtml(w.title)}</h3>
                    <small>${w.date} | ${durationText}</small>
                </div>
                <div class="card-body">
                    ${muscleTagsHtml}
                    <div class="sets-preview">
                        ${w.sets.slice(0, 3).map(s => `
                            <div class="set-item">${s.weight}кг × ${s.reps}</div>
                        `).join('')}
                        ${w.sets.length > 3 ? `<span class="more-sets">+${w.sets.length - 3}</span>` : ''}
                    </div>
                    ${w.notes ? `<p class="notes">${escapeHtml(w.notes)}</p>` : ''}
                </div>
                <div class="card-actions">
                    <button class="btn-sm btn-outline" onclick="app.openEditModal('${w.id}')">
                        <i class="fas fa-edit"></i> Изменить
                    </button>
                    <button class="btn-sm btn-danger" onclick="app.deleteWorkout('${w.id}')">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
            `;
            listWorkouts.appendChild(li);
        });
    }

    function calculateDurationText(start, end) {
        if (!start || !end) return '';
        const s = new Date(`1970-01-01T${start}`);
        const e = new Date(`1970-01-01T${end}`);
        if (isNaN(s) || isNaN(e)) return '';
        const diff = (e - s) / 60000; // минуты
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        return `${h}ч ${m}м`;
    }

    // --- Графики (Chart.js) ---
    function initCharts() {
        if (!canvasStats || !canvasWeight) return;

        // График статистики (столбчатый)
        chartStatsInstance = new Chart(canvasStats, {
            type: 'bar',
            data: {
                labels: ['Подходы', 'Повторы', 'Тоннаж', 'Калории'],
                datasets: [{
                    label: 'Общие показатели',
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(255, 206, 86, 0.6)'
                    ],
                    borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 99, 132, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 206, 86, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // График веса (линейный)
        chartWeightInstance = new Chart(canvasWeight, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Вес тела', data: [], borderColor: '#3b82f6', tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderStats() {
        const stats = calculateStats();
        
        // Обновляем цифры в DOM (если есть элементы с id)
        document.getElementById('stat-total')?.textContent = stats.totalWorkouts;
        document.getElementById('stat-weight')?.textContent = stats.totalWeightLifted;
        document.getElementById('stat-sets')?.textContent = stats.totalSets;
        document.getElementById('stat-calories')?.textContent = stats.totalCalories;
        document.getElementById('stat-streak')?.textContent = stats.streak;
        document.getElementById('stat-current-weight')?.textContent = stats.currentWeight ? `${stats.currentWeight} кг` : 'Нет данных';

        // Обновляем график статистики
        if (chartStatsInstance) {
            chartStatsInstance.data.datasets[0].data = [
                stats.totalSets, stats.totalReps, stats.totalWeightLifted, stats.totalCalories
            ];
            chartStatsInstance.update();
        }

        // Обновляем график веса
        if (chartWeightInstance && stats.weightHistory) {
             // weightHistory уже в формате {x, y} благодаря getWeightHistory()
             const history = stats.weightHistory;
             chartWeightInstance.data.labels = history.map(h => h.x);
             chartWeightInstance.data.datasets[0].data = history.map(h => h.y);
             chartWeightInstance.update();
        }
    }

    // --- Обработчики событий (Event Listeners) ---
    function setupEventListeners() {
        // Поиск
        if (inputSearch) {
            inputSearch.addEventListener('input', (e) => {
                const query = e.target.value;
                const filtered = searchWorkouts(query);
                renderWorkoutsList(filtered);
            });
        }

        // Фильтры даты
        if (selectDateFilter) {
            selectDateFilter.addEventListener('change', (e) => {
                applyFilters();
            });
        }

        // Фильтры мышц
        checkboxesMuscle.forEach(cb => {
            cb.addEventListener('change', () => applyFilters());
        });

        // Отправка формы добавления
        if (formAddWorkout) {
            formAddWorkout.addEventListener('submit', handleAddWorkout);
        }

        // Отправка формы редактирования
        if (formEditWorkout) {
            formEditWorkout.addEventListener('submit', handleEditWorkout);
        }

        // Закрытие модалок
        if (btnCloseEdit) btnCloseEdit.addEventListener('click', () => modalEdit.style.display = 'none');
        if (btnCloseAdd) btnCloseAdd.addEventListener('click', () => modalAdd.style.display = 'none');

        // Клик вне модалки для закрытия
        window.addEventListener('click', (e) => {
            if (e.target === modalEdit) modalEdit.style.display = 'none';
            if (e.target === modalAdd) modalAdd.style.display = 'none';
        });
    }

    function applyFilters() {
        const dateFilter = selectDateFilter ? selectDateFilter.value : null;
        const muscleFilters = Array.from(checkboxesMuscle)
            .filter(cb => cb.checked)
            .map(cb => cb.nextElementSibling.textContent);
        
        const filtered = filterWorkouts(dateFilter, muscleFilters.length ? muscleFilters : null);
        renderWorkoutsList(filtered);
    }

    // --- CRUD операции через UI ---

    window.app.deleteWorkout = (id) => {
        if(!confirm('Вы уверены, что хотите удалить эту тренировку?')) return;
        deleteWorkout(id);
        renderWorkoutsList(); // Перерисовать список
        if(getCurrentPage() === 'stats') renderStats(); // Обновить графики если мы в статистике
        showToast('Тренировка удалена', 'success');
    };

    window.app.openEditModal = (id) => {
        currentEditId = id;
        const workout = getAllWorkouts().find(w => w.id === id);
        if (!workout) return;

        // Заполнение полей
        document.getElementById('edit-title').value = workout.title;
        document.getElementById('edit-date').value = workout.date;
        document.getElementById('edit-start').value = workout.startTime || '';
        document.getElementById('edit-end').value = workout.endTime || '';
        document.getElementById('edit-notes').value = workout.notes || '';
        document.getElementById('edit-calories').value = workout.calories || '';
        
        // Чекбоксы мышц
        Array.from(checkboxesMuscle).forEach(cb => {
            const label = cb.nextElementSibling.textContent;
            cb.checked = workout.muscleTags.includes(label);
        });

        modalEdit.style.display = 'block';
    };

        function handleAddWorkout(e) {
        e.preventDefault();
        
        const formData = new FormData(formAddWorkout);
        const setsData = [];
        
        // --- ЛОГИКА СБОРА ПОДХОДОВ ---
        // Вариант А: Если у вас в HTML есть инпуты с именами вида "sets[0][weight]", "sets[1][reps]" (редко для простых форм)
        // Вариант Б (Самый частый): Вы генерируете инпуты динамически с уникальными ID или name, например: weight-0, reps-0, weight-1, reps-1...
        
        // Пример реализации для динамических полей с паттерном name="weight-0", "reps-0" и т.д.
        // Если у вас статическая форма с одним подходом, просто используйте код из предыдущего ответа.
        
        let i = 0;
        while (true) {
            const weightVal = formData.get(`weight-${i}`);
            const repsVal = formData.get(`reps-${i}`);
            const restVal = formData.get(`rest-${i}`);

            // Если поля нет или они пустые — выходим из цикла (значит, подходы закончились)
            if (!weightVal && !repsVal) break;

            const w = parseFloat(weightVal) || 0;
            const r = parseInt(repsVal) || 0;
            const rest = parseInt(restVal) || 60;

            if (w > 0 && r > 0) {
                setsData.push({ 
                    weight: w, 
                    reps: r, 
                    restSec: rest 
                });
            }
            i++;
        }

        // Фоллбэк: если динамических полей не найдено, берем статические (на случай простой формы)
        if (setsData.length === 0) {
            const w = parseFloat(formData.get('weight-add')) || 0;
            const r = parseInt(formData.get('reps-add')) || 0;
            const rest = parseInt(formData.get('rest-add')) || 60;
            if (w > 0 && r > 0) setsData.push({ weight: w, reps: r, restSec: rest });
        }
        // ------------------------------

        const newWorkout = {
            title: formData.get('title-add'),
            date: formData.get('date-add') || new Date().toISOString().split('T')[0], // По умолчанию сегодня
            startTime: formData.get('start-add'),
            endTime: formData.get('end-add'),
            notes: formData.get('notes-add'),
            calories: parseInt(formData.get('calories-add')) || 0,
            muscleTags: Array.from(checkboxesMuscle)
                .filter(cb => cb.checked)
                .map(cb => cb.nextElementSibling.textContent),
            sets: setsData,
            bodyWeight: parseFloat(formData.get('body-weight-add')) || null,
            type: formData.get('type-add') || 'strength' // 'strength' или 'cardio'
        };

        // Базовая валидация перед отправкой
        if (!newWorkout.title.trim()) {
            showToast('Название тренировки обязательно!', 'error');
            return;
        }
        if (newWorkout.sets.length === 0 && newWorkout.type === 'strength') {
             showToast('Добавьте хотя бы один силовой подход!', 'warning');
             // Можно разрешить создание пустой тренировки, если это кардио, но для силы нужен вес/повторы
        }

        try {
            addWorkout(newWorkout);
            formAddWorkout.reset();
            modalAdd.style.display = 'none';
            renderWorkoutsList();
            
            if (getCurrentPage() === 'stats') {
                renderStats();
            }
            
            showToast('Тренировка успешно добавлена!', 'success');
            
            // Перезагружаем списки упражнений и мышц, вдруг пользователь добавил новое прямо в форме
            loadCustomExercisesToSelects(); 
        } catch (error) {
            console.error('Ошибка при добавлении тренировки:', error);
            showToast('Не удалось сохранить. Проверьте консоль или место в LocalStorage.', 'error');
        }
    }

        function showToast(message, type = 'info') {
        // Создаем элемент уведомления
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 15px 25px; 
            border-radius: 8px; color: white; font-weight: bold; z-index: 9999;
            animation: slideIn 0.3s ease-out forwards;
        `;
        
        // Цвета
        if (type === 'success') toast.style.background = '#10b981'; // Зеленый
        else if (type === 'error') toast.style.background = '#ef4444'; // Красный
        else if (type === 'warning') toast.style.background = '#f59e0b'; // Оранжевый
        else toast.style.background = '#3b82f6'; // Синий

        document.body.appendChild(toast);

        // Удаляем через 3 секунды
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
});

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

    function handleEditWorkout(e) {
        e.preventDefault();
        
        if (!currentEditId) {
            showToast('Ошибка: ID тренировки не найден.', 'error');
            return;
        }

        const formData = new FormData(formEditWorkout);
        const setsData = [];
        
        // Сбор динамических подходов (аналогично добавлению)
        let i = 0;
        while (true) {
            const weightVal = formData.get(`edit-weight-${i}`);
            const repsVal = formData.get(`edit-reps-${i}`);
            const restVal = formData.get(`edit-rest-${i}`);

            if (!weightVal && !repsVal) break;

            const w = parseFloat(weightVal) || 0;
            const r = parseInt(repsVal) || 0;
            const rest = parseInt(restVal) || 60;

            if (w > 0 && r > 0) {
                setsData.push({ 
                    weight: w, 
                    reps: r, 
                    restSec: rest 
                });
            }
            i++;
        }

        // Фоллбэк для статической формы (если динамических нет)
        if (setsData.length === 0) {
            const w = parseFloat(formData.get('edit-weight-add')) || 0;
            const r = parseInt(formData.get('edit-reps-add')) || 0;
            const rest = parseInt(formData.get('edit-rest-add')) || 60;
            if (w > 0 && r > 0) setsData.push({ weight: w, reps: r, restSec: rest });
        }

        const updatedWorkout = {
            id: currentEditId, // Важно: передаем ID для обновления
            title: formData.get('edit-title'),
            date: formData.get('edit-date'),
            startTime: formData.get('edit-start'),
            endTime: formData.get('edit-end'),
            notes: formData.get('edit-notes'),
            calories: parseInt(formData.get('edit-calories')) || 0,
            muscleTags: Array.from(checkboxesMuscle)
                .filter(cb => cb.checked)
                .map(cb => cb.nextElementSibling.textContent),
            sets: setsData,
            bodyWeight: parseFloat(formData.get('edit-body-weight')) || null,
            type: formData.get('edit-type') || 'strength'
        };

        if (!updatedWorkout.title.trim()) {
            showToast('Название тренировки обязательно!', 'error');
            return;
        }

        try {
            updateWorkout(updatedWorkout);
            modalEdit.style.display = 'none';
            renderWorkoutsList();
            
            if (getCurrentPage() === 'stats') {
                renderStats();
            }
            
            showToast('Тренировка успешно обновлена!', 'success');
            loadCustomExercisesToSelects(); 
        } catch (error) {
            console.error('Ошибка при редактировании:', error);
            showToast('Не удалось обновить тренировку.', 'error');
        }
    }

        function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 15px 25px; 
            border-radius: 8px; color: white; font-weight: bold; z-index: 9999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); animation: slideIn 0.3s ease-out forwards;
        `;
        
        // Цвета
        if (type === 'success') toast.style.background = '#10b981';       // Зеленый
        else if (type === 'error') toast.style.background = '#ef4444';     // Красный
        else if (type === 'warning') toast.style.background = '#f59e0b';   // Оранжевый
        else toast.style.background = '#3b82f6';                           // Синий

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
