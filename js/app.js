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
    let calendarCurrentDate = new Date();
    let selectedCalendarDateStr = null;

    // --- Инициализация ---
    init();

    function init() {
        renderNavigation();
        loadCustomExercisesToSelects();
        renderWorkoutsList();
        initCharts();
        setupEventListeners();
        resetAddSetsContainer();
        renderCalendar();
        
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

    // Определяем текущую страницу по видимости секций
    function getCurrentPage() {
        if (sectionHome && sectionHome.style.display === 'block') return 'home';
        if (sectionStats && sectionStats.style.display === 'block') return 'stats';
        if (sectionAdd && sectionAdd.style.display === 'block') return 'add';
        return 'home';
    }

    // Функция для переключения между страницами
    function navigateTo(page) {
        // Скрываем все секции
        [sectionHome, sectionStats, sectionAdd].forEach(el => {
            if (el) el.style.display = 'none';
        });
        
        // Показываем нужную
        if (page === 'home' && sectionHome) sectionHome.style.display = 'block';
        if (page === 'stats' && sectionStats) {
            sectionStats.style.display = 'block';
            renderStats(); // Обновляем графики при входе
        }
        if (page === 'add' && sectionAdd) sectionAdd.style.display = 'block';

        renderNavigation();
    }

    // Экспортируем навигацию в глобальную область видимости для onclick в HTML
    window.app = window.app || {};
    window.app.navigateTo = navigateTo;

    // --- Работа с данными и рендеринг ---
    function loadCustomExercisesToSelects() {
        const exercises = getCustomExercises ? getCustomExercises() : [];
        const selects = [
            document.getElementById('exercise-select-add'),
            document.getElementById('exercise-select-edit')
        ];
        
        selects.forEach(select => {
            if (!select) return;
            select.innerHTML = '<option value="">Выберите мышцу</option>';
            exercises.forEach(ex => {
                const opt = document.createElement('option');
                opt.value = ex;
                opt.textContent = ex;
                select.appendChild(opt);
            });
        });

        // Заполняем чекбоксы мышц
        const tags = getMuscleTags ? getMuscleTags() : [];
        checkboxesMuscle.forEach(cb => {
            const label = cb.nextElementSibling;
            if (label && tags.includes(label.textContent)) {
                cb.disabled = false;
            } else {
                cb.disabled = true;
            }
        });
    }

    function renderWorkoutsList(filteredData = null) {
        if (!listWorkouts) return;
        
        const data = filteredData || getAllWorkouts();
        listWorkouts.innerHTML = '';

        if (!data || data.length === 0) {
            listWorkouts.innerHTML = '<div class="empty-state">Тренировок пока нет. Добавьте первую!</div>';
            return;
        }

        data.forEach(w => {
            const li = document.createElement('li');
            li.className = 'workout-card';
            li.dataset.id = w.id;
            
            const durationText = w.startTime && w.endTime ? 
                `${calculateDurationText(w.startTime, w.endTime)}` : 'Время не было указано';
            
            const muscleTagsHtml = w.muscleTags ? w.muscleTags.map(t => `<span class="tag">${t}</span>`).join('') : '';

            li.innerHTML = `
                <div class="card-header">
                ${w.image ? `<img src="${w.image}" class="img-preview clickable-photo" alt="Фото упражнения" onerror="this.style.display='none'" onclick="app.openFullPhoto('${w.image}')">` : ''}
                    <h3>${escapeHtml(w.title)}</h3>
                    <small>${w.date} | ${durationText}</small>
                </div>
                <div class="card-body">
                    ${muscleTagsHtml}
<div class="sets-preview">
    ${(() => {
        // 1. Берем все подходы для отображения
        const visibleSets = w.sets || [];
        
        // 2. Считаем общий тоннаж по ВСЕМ подходам тренировки (Вес × Повторения)
        const totalWeight = w.sets.reduce((sum, s) => sum + (Number(s.weight) * Number(s.reps) || 0), 0);

        // 3. Рендерим подходы с нумерацией и чекбоксами
        let html = visibleSets.map((s, index) => `
            <div class="set-item">
                <span class="set-number">${index + 1}.</span>
                <span class="set-data">${s.weight}кг × ${s.reps}</span>
                <input type="checkbox" class="set-status-checkbox" ${s.done ? 'checked' : ''} onchange="app.toggleSetStatus('${w.id}', ${index}, this.checked)">
            </div>
        `).join('');

        // 4. Добавляем строку "Итого", если есть хотя бы один подход
        if (w.sets && w.sets.length > 0) {
            html += `
                <div class="set-item total-row" style="width: 100%;">
                    <span class="total-label">Итого тоннаж:</span>
                    <span class="total-value">${totalWeight} кг</span>
                </div>
            `;
        }

        return html;
    })()}
</div>
${w.notes ? `<p class="notes">${escapeHtml(w.notes)}</p>` : ''}
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
        return h > 0 ? `${h}ч ${m}м` : `${m}м`;
    }

    // --- Графики (Chart.js) ---
    function initCharts() {
        if (!canvasStats || !canvasWeight || typeof Chart === 'undefined') return;

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
        if (!calculateStats) return;
        const stats = calculateStats();
        
        // Обновляем цифры в DOM
        if (document.getElementById('stat-total')) document.getElementById('stat-total').textContent = stats.totalWorkouts;
        if (document.getElementById('stat-weight')) document.getElementById('stat-weight').textContent = stats.totalWeightLifted;
        if (document.getElementById('stat-sets')) document.getElementById('stat-sets').textContent = stats.totalSets;
        if (document.getElementById('stat-calories')) document.getElementById('stat-calories').textContent = stats.totalCalories;
        if (document.getElementById('stat-streak')) document.getElementById('stat-streak').textContent = stats.streak;
        if (document.getElementById('stat-current-weight')) {
            document.getElementById('stat-current-weight').textContent = stats.currentWeight ? `${stats.currentWeight} кг` : 'Нет данных';
        }

        // Обновляем график статистики
        if (chartStatsInstance) {
            chartStatsInstance.data.datasets[0].data = [
                stats.totalSets, stats.totalReps, stats.totalWeightLifted, stats.totalCalories
            ];
            chartStatsInstance.update();
        }

        // Обновляем график веса
        if (chartWeightInstance && stats.weightHistory) {
             const history = stats.weightHistory;
             chartWeightInstance.data.labels = history.map(h => h.x);
             chartWeightInstance.data.datasets[0].data = history.map(h => h.y);
             chartWeightInstance.update();
        }
    }

    // --- Обработчики событий ---
    function setupEventListeners() {
        if (inputSearch) {
            inputSearch.addEventListener('input', () => applyFilters());
        }

        if (selectDateFilter) {
            selectDateFilter.addEventListener('change', () => applyFilters());
        }

        checkboxesMuscle.forEach(cb => {
            cb.addEventListener('change', () => applyFilters());
        });

        if (formAddWorkout) formAddWorkout.addEventListener('submit', handleAddWorkout);
        if (formEditWorkout) formEditWorkout.addEventListener('submit', handleEditWorkout);

        const btnAddSet = document.getElementById('btn-add-set');
        if (btnAddSet) {
            btnAddSet.addEventListener('click', () => {
                const addSetsContainer = document.getElementById('add-sets-container');
                if (addSetsContainer) {
                    const index = addSetsContainer.querySelectorAll('.set-row').length;
                    const rowHtml = createSetRowHtml(index, '', '', 60, false);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = rowHtml.trim();
                    addSetsContainer.appendChild(tempDiv.firstChild);
                }
            });
        }

        const btnEditAddSet = document.getElementById('btn-edit-add-set');
        if (btnEditAddSet) {
            btnEditAddSet.addEventListener('click', () => {
                const editSetsContainer = document.getElementById('edit-sets-container');
                if (editSetsContainer) {
                    const index = editSetsContainer.querySelectorAll('.set-row').length;
                    const rowHtml = createSetRowHtml(index, '', '', 60, true);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = rowHtml.trim();
                    editSetsContainer.appendChild(tempDiv.firstChild);
                }
            });
        }

        if (btnCloseEdit) btnCloseEdit.addEventListener('click', () => modalEdit.style.display = 'none');
        if (btnCloseAdd) btnCloseAdd.addEventListener('click', () => modalAdd.style.display = 'none');

        window.addEventListener('click', (e) => {
            if (e.target === modalEdit) modalEdit.style.display = 'none';
            if (e.target === modalAdd) modalAdd.style.display = 'none';
        });
    }

    function applyFilters() {
        let filtered = getAllWorkouts();
        
        // 1. Фильтр поиска по тексту
        const query = inputSearch ? inputSearch.value.trim().toLowerCase() : '';
        if (query) {
            filtered = filtered.filter(w => w.title.toLowerCase().includes(query));
        }
        
        // 2. Фильтр по периоду (выпадающий список)
        const dateFilter = selectDateFilter ? selectDateFilter.value : null;
        if (dateFilter && filterWorkouts) {
            const periodFiltered = filterWorkouts(dateFilter, null);
            filtered = filtered.filter(w => periodFiltered.some(pf => pf.id === w.id));
        }
        
        // 3. Фильтр по группам мышц
        const muscleFilters = Array.from(checkboxesMuscle)
            .filter(cb => cb.checked)
            .map(cb => cb.nextElementSibling.textContent);
        if (muscleFilters.length > 0) {
            filtered = filtered.filter(w => w.muscleTags && w.muscleTags.some(tag => muscleFilters.includes(tag)));
        }
        
        // 4. Фильтр по выбранному дню в календаре
        if (selectedCalendarDateStr) {
            filtered = filtered.filter(w => w.date === selectedCalendarDateStr);
        }
        
        renderWorkoutsList(filtered);
    }

    // --- CRUD операции через UI ---
    window.app.deleteWorkout = (id) => {
        if (!confirm('Вы уверены, что хотите удалить эту тренировку?')) return;
        if (deleteWorkout) deleteWorkout(id);
        renderWorkoutsList();
        renderCalendar();
        if (getCurrentPage() === 'stats') renderStats();
        showToast('Тренировка удалена', 'success');
    };

    // --- Управление статусом подходов ---
    window.app.toggleSetStatus = (workoutId, setIndex, isChecked) => {
    const workouts = getAllWorkouts();
    const workout = workouts.find(w => w.id === workoutId);
    
    if (workout && workout.sets[setIndex]) {
        // Меняем статус выполнения конкретного подхода
        workout.sets[setIndex].done = isChecked;
        
        // Передаем обновленную тренировку в базу данных
        if (updateWorkout) {
            updateWorkout(workout.id, workout);
            showToast(isChecked ? 'Подход выполнен!' : 'Статус подхода изменен', 'info');
        }
    }
};

    window.app.openEditModal = (id) => {
        currentEditId = id;
        const workouts = getAllWorkouts ? getAllWorkouts() : [];
        const workout = workouts.find(w => w.id === id);
        if (!workout) return;

        // Заполнение полей
        document.getElementById('edit-image').value = workout.image || '';
        document.getElementById('edit-title').value = workout.title;
        document.getElementById('edit-date').value = workout.date;
        document.getElementById('edit-start').value = workout.startTime || '';
        document.getElementById('edit-end').value = workout.endTime || '';
        document.getElementById('edit-notes').value = workout.notes || '';
        document.getElementById('edit-calories').value = workout.calories || '';
        document.getElementById('edit-body-weight').value = workout.bodyWeight || '';

        // Заполнение подходов в модальном окне редактирования
        const editSetsContainer = document.getElementById('edit-sets-container');
        if (editSetsContainer) {
            editSetsContainer.innerHTML = '';
            if (workout.sets && workout.sets.length > 0) {
                workout.sets.forEach((set, index) => {
                    const rowHtml = createSetRowHtml(index, set.weight, set.reps, set.restSec, true);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = rowHtml.trim();
                    editSetsContainer.appendChild(tempDiv.firstChild);
                });
            } else {
                // Если подходов нет, добавляем один пустой
                const rowHtml = createSetRowHtml(0, '', '', 60, true);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = rowHtml.trim();
                editSetsContainer.appendChild(tempDiv.firstChild);
            }
        }
        
        // Чекбоксы мышц в модальном окне редактирования
        const editMuscleCheckboxes = document.querySelectorAll('input[name="edit-muscleTags"]');
        editMuscleCheckboxes.forEach(cb => {
            const label = cb.value;
            cb.checked = workout.muscleTags ? workout.muscleTags.includes(label) : false;
        });

        if (modalEdit) modalEdit.style.display = 'block';
    };

    function handleAddWorkout(e) {
        e.preventDefault();
        const formData = new FormData(formAddWorkout);
        const setsData = [];
        
        let i = 0;
        while (true) {
            const weightVal = formData.get(`weight-${i}`);
            const repsVal = formData.get(`reps-${i}`);
            const restVal = formData.get(`rest-${i}`);

            if (!weightVal && !repsVal) break;

            const w = parseFloat(weightVal) || 0;
            const r = parseInt(repsVal) || 0;
            const rest = parseInt(restVal) || 60;

            if (w > 0 && r > 0) {
                setsData.push({ weight: w, reps: r, restSec: rest });
            }
            i++;
        }

        if (setsData.length === 0) {
            const w = parseFloat(formData.get('weight-add')) || 0;
            const r = parseInt(formData.get('reps-add')) || 0;
            const rest = parseInt(formData.get('rest-add')) || 60;
            if (w > 0 && r > 0) setsData.push({ weight: w, reps: r, restSec: rest });
        }

        const newWorkout = {
            title: formData.get('title-add'),
            image: formData.get('image-add') || '',
            date: formData.get('date-add') || new Date().toISOString().split('T')[0],
            startTime: formData.get('start-add'),
            endTime: formData.get('end-add'),
            notes: formData.get('notes-add'),
            calories: parseInt(formData.get('calories-add')) || 0,
            muscleTags: Array.from(checkboxesMuscle)
                .filter(cb => cb.checked)
                .map(cb => cb.nextElementSibling.textContent),
            sets: setsData,
            bodyWeight: parseFloat(formData.get('body-weight-add')) || null,
            type: formData.get('type-add') || 'strength'
        };

        if (!newWorkout.title || !newWorkout.title.trim()) {
            showToast('Название тренировки обязательно!', 'error');
            return;
        }

        try {
            if (addWorkout) addWorkout(newWorkout);
            formAddWorkout.reset();
            resetAddSetsContainer();
            if (modalAdd) modalAdd.style.display = 'none';
            renderWorkoutsList();
            renderCalendar();
            
            if (getCurrentPage() === 'stats') renderStats();
            
            showToast('Тренировка успешно добавлена!', 'success');
            loadCustomExercisesToSelects(); 
        } catch (error) {
            console.error('Ошибка при добавлении тренировки:', error);
            showToast('Не удалось сохранить данные.', 'error');
        }
    }

        function handleEditWorkout(e) {
    e.preventDefault();
    
    if (!currentEditId) {
        showToast('Ошибка: ID тренировки не найден.', 'error');
        return;
    }

    const formData = new FormData(formEditWorkout);
    const setsData = [];
    
    // Получаем оригинальную тренировку, чтобы узнать старый статус чекбоксов подходов (done)
    const originalWorkout = typeof getAllWorkouts === 'function' 
        ? getAllWorkouts().find(w => w.id === currentEditId) 
        : null;

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
            // Проверяем, стоял ли у этого подхода флаг "выполнено" раньше
            const wasDone = originalWorkout && originalWorkout.sets[i] ? originalWorkout.sets[i].done : false;
            
            setsData.push({ 
                weight: w, 
                reps: r, 
                restSec: rest,
                done: wasDone // <-- Сохраняем статус чекбокса выполнения!
            });
        }
        i++;
    }

    if (setsData.length === 0) {
        const w = parseFloat(formData.get('edit-weight-add')) || 0;
        const r = parseInt(formData.get('edit-reps-add')) || 0;
        const rest = parseInt(formData.get('edit-rest-add')) || 60;
        if (w > 0 && r > 0) {
            const wasDone = originalWorkout && originalWorkout.sets[0] ? originalWorkout.sets[0].done : false;
            setsData.push({ weight: w, reps: r, restSec: rest, done: wasDone });
        }
    }

    // Собираем массив выбранных мышц из формы редактирования
    // В HTML у чекбоксов в модальном окне должен быть name="edit-muscleTags"
    const selectedMuscles = formData.getAll('edit-muscleTags');

    const updatedWorkout = {
        id: currentEditId,
        image: formData.get('edit-image') || '', // Сохраняем ссылку на фото
        title: formData.get('edit-title'),
        date: formData.get('edit-date'),
        startTime: formData.get('edit-start'),
        endTime: formData.get('edit-end'),
        notes: formData.get('edit-notes'),
        calories: parseInt(formData.get('edit-calories')) || 0,
        muscleTags: selectedMuscles,
        sets: setsData,
        bodyWeight: parseFloat(formData.get('edit-body-weight')) || null,
        type: formData.get('edit-type') || 'strength',
        updatedAt: new Date().toISOString() // Полезно для синхронизации Firebase
    };

    if (!updatedWorkout.title || !updatedWorkout.title.trim()) {
        showToast('Название тренировки обязательно!', 'error');
        return;
    }

    try {
        if (updateWorkout) updateWorkout(currentEditId, updatedWorkout);
        if (modalEdit) modalEdit.style.display = 'none';
        renderWorkoutsList();
        renderCalendar();
        
        if (getCurrentPage() === 'stats') renderStats();
        
        showToast('Тренировка успешно обновлена!', 'success');
        if (typeof loadCustomExercisesToSelects === 'function') loadCustomExercisesToSelects(); 
    } catch (error) {
        console.error('Ошибка при редактировании:', error);
        showToast('Не удалось обновить тренировку.', 'error');
    }
}

    // --- Функции динамического управления подходами ---
    function createSetRowHtml(index, weight = '', reps = '', rest = 60, isEdit = false) {
        const prefix = isEdit ? 'edit-' : '';
        return `
            <div class="set-row">
                <span class="set-index-label">Подход ${index + 1}</span>
                <div class="flex-1">
                    <input type="number" step="0.1" name="${prefix}weight-${index}" class="form-control set-weight" placeholder="Вес (кг)" value="${weight}" required>
                </div>
                <div class="flex-1">
                    <input type="number" name="${prefix}reps-${index}" class="form-control set-reps" placeholder="Повторы" value="${reps}" required>
                </div>
                <div class="flex-1">
                    <input type="number" name="${prefix}rest-${index}" class="form-control set-rest" placeholder="Отдых (с)" value="${rest}" required>
                </div>
                <button type="button" class="remove-set-btn btn-danger" onclick="this.closest('.set-row').remove(); app.reindexSets('${isEdit ? 'edit-sets-container' : 'add-sets-container'}', ${isEdit})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }

    function reindexSets(containerId, isEdit = false) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const rows = container.querySelectorAll('.set-row');
        rows.forEach((row, idx) => {
            const prefix = isEdit ? 'edit-' : '';
            const weightInput = row.querySelector('.set-weight');
            const repsInput = row.querySelector('.set-reps');
            const restInput = row.querySelector('.set-rest');
            
            if (weightInput) weightInput.name = `${prefix}weight-${idx}`;
            if (repsInput) repsInput.name = `${prefix}reps-${idx}`;
            if (restInput) restInput.name = `${prefix}rest-${idx}`;
            
            const numSpan = row.querySelector('.set-index-label');
            if (numSpan) numSpan.textContent = `Подход ${idx + 1}`;
        });
    }

    function resetAddSetsContainer() {
        const addSetsContainer = document.getElementById('add-sets-container');
        if (addSetsContainer) {
            addSetsContainer.innerHTML = '';
            const rowHtml = createSetRowHtml(0, '', '', 60, false);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = rowHtml.trim();
            addSetsContainer.appendChild(tempDiv.firstChild);
        }
    }

    // Экспортируем функции в глобальную область видимости
    window.app.reindexSets = reindexSets;

    // --- Календарь тренировок ---

    function renderCalendar() {
        const container = document.getElementById('calendar-container');
        if (!container) return;

        const workouts = getAllWorkouts();
        const workoutDates = new Set(workouts.map(w => w.date));

        const year = calendarCurrentDate.getFullYear();
        const month = calendarCurrentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let firstDayOfWeek = firstDayOfMonth.getDay();
        firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        const monthNames = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];

        let html = `
            <div class="workout-calendar">
                <div class="calendar-header">
                    <button type="button" class="calendar-nav-btn" id="calendar-prev-month">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span class="calendar-title">${monthNames[month]} ${year}</span>
                    <button type="button" class="calendar-nav-btn" id="calendar-next-month">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                <div class="calendar-grid">
                    <div class="calendar-day-name">Пн</div>
                    <div class="calendar-day-name">Вт</div>
                    <div class="calendar-day-name">Ср</div>
                    <div class="calendar-day-name">Чт</div>
                    <div class="calendar-day-name">Пт</div>
                    <div class="calendar-day-name">Сб</div>
                    <div class="calendar-day-name">Вс</div>
        `;

        for (let i = 0; i < firstDayOfWeek; i++) {
            html += `<div class="calendar-day empty-day"></div>`;
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            let classes = ['calendar-day'];
            if (dateStr === todayStr) classes.push('today');
            if (workoutDates.has(dateStr)) classes.push('has-workout');
            if (dateStr === selectedCalendarDateStr) classes.push('selected-day');

            html += `
                <div class="${classes.join(' ')}" data-date="${dateStr}">
                    ${day}
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;

        const prevBtn = container.querySelector('#calendar-prev-month');
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
                renderCalendar();
            });
        }

        const nextBtn = container.querySelector('#calendar-next-month');
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
                renderCalendar();
            });
        }

        const days = container.querySelectorAll('.calendar-day:not(.empty-day)');
        days.forEach(dayEl => {
            dayEl.addEventListener('click', () => {
                const clickedDate = dayEl.dataset.date;
                if (selectedCalendarDateStr === clickedDate) {
                    selectedCalendarDateStr = null;
                } else {
                    selectedCalendarDateStr = clickedDate;
                }
                renderCalendar();
                applyFilters();
            });
        });
    }

    // Экспортируем функции в глобальную область видимости
    window.app.reindexSets = reindexSets;
    window.app.renderCalendar = renderCalendar;
});

// --- Глобальные вспомогательные функции ---
function escapeHtml(text) {
    if (!text) return '';
    return text
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

window.app.openFullPhoto = (imgSrc) => {
    const overlay = document.getElementById('photo-overlay');
    const fullImg = document.getElementById('fullscreen-image');
    
    if (overlay && fullImg) {
        fullImg.src = imgSrc; // Подставляем путь к картинке
        overlay.classList.add('show'); // Показываем оверлей
    }
};