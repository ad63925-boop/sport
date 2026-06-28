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
    const sectionHome = document.getElementById('home');
    const sectionStats = document.getElementById('statistik');
    const sectionAdd = document.getElementById('addWorkout');
    const sectionSetting = document.getElementById('setting');
    // Формы
    const formAddWorkout = document.getElementById('form-add-workout');
    const formEditWorkout = document.getElementById('form-edit-workout');
    
    // Фильтры и поиск
    const inputSearch = document.getElementById('input-search');
    const selectDateFilter = document.getElementById('select-date-filter');
    const checkboxesMuscle = document.querySelectorAll('input[name="muscle-filter"]');

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
            <button onclick="app.navigateTo('setting')" class="nav-btn ${getActiveClass('setting')}">
                <i class="fas fa-cog"></i> Настройки
            </button>            
        `;
    }

    function getActiveClass(page) {
        const current = getCurrentPage();
        return current === page ? 'active' : '';
    }

    // Определяем текущую страницу по видимости секций
// Определяем текущую страницу по наличию класса visible
function getCurrentPage() {
    if (sectionHome && sectionHome.classList.contains('visible')) return 'home';
    if (sectionStats && sectionStats.classList.contains('visible')) return 'stats';
    if (sectionAdd && sectionAdd.classList.contains('visible')) return 'add';
    if (sectionSetting && sectionSetting.classList.contains('visible')) return 'setting';
}


    // Функция для переключения между страницами
// Функция для переключения между страницами
// Функция для переключения между страницами
function navigateTo(page) {

    // Убираем класс visible у ВСЕХ четырех секций
    [sectionHome, sectionStats, sectionAdd, sectionSetting].forEach(el => {
        if (el) el.classList.remove('visible');
    });
    
    // Добавляем класс visible нужной секции
    switch (page) {
        case 'home':
            if (sectionHome) {
                sectionHome.classList.add('visible');
                renderWorkoutsList();
            }
            break;

        case 'stats':
            if (sectionStats) {
                sectionStats.classList.add('visible');
                renderStats();
            }
            break;
        case 'add':
            if (sectionAdd) {
                sectionAdd.classList.add('visible');
                prefillFromLastWorkout();
            }
            break;
        case 'setting':
            if (sectionSetting) {
                sectionSetting.classList.add('visible');
            }
            break;
    }
    
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
            select.innerHTML = '<option value="">Выберите упражнение</option>';
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
            if (label && tags.includes(cb.value)) {
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

            const sets = w.sets || [];
            const maxWeight = sets.length > 0 ? Math.max(...sets.map(s => Number(s.weight) || 0)) : 0;
            const totalSets = sets.length;
            const totalReps = sets.reduce((sum, s) => sum + (Number(s.reps) || 0), 0);

            // Дата и время
            const dateStr = w.date || '—';
            const timeStr = (w.startTime && w.endTime)
                ? `${w.startTime} – ${w.endTime} (${calculateDurationText(w.startTime, w.endTime)})`
                : (w.startTime ? w.startTime : '');

            // Подходы
            const setsHtml = sets.map((s, i) => `
                <div class="wc-set-row">
                    <span class="wc-set-name">Подход ${i + 1}</span>
                    <span class="wc-set-reps">${s.reps} повт.</span>
                    <span class="wc-set-sep">|</span>
                    <span class="wc-set-weight">${s.weight} кг</span>
                    <input type="checkbox" class="set-status-checkbox" ${s.done ? 'checked' : ''}
                        onchange="app.toggleSetStatus('${w.id}', ${i}, this.checked)">
                </div>
            `).join('');

            // Итого
            const totalHtml = sets.length > 0 ? `
                <div class="wc-total-row">
                    <span class="wc-total-label">ИТОГО</span>
                    <span class="wc-total-stats">
                        <span class="wc-total-item"><i class="fas fa-dumbbell"></i> ${maxWeight} кг макс.</span>
                        <span class="wc-total-sep">|</span>
                        <span class="wc-total-item"><i class="fas fa-layer-group"></i> ${totalSets} подх. / ${totalReps} повт.</span>
                    </span>
                </div>
            ` : '';

            // Теги мышц
            const tagsHtml = (w.muscleTags && w.muscleTags.length > 0)
                ? w.muscleTags.map(t => `<span class="wc-tag">${t}</span>`).join('')
                : '<span class="wc-no-data">—</span>';

            li.innerHTML = `
                ${w.image ? `<img src="${w.image}" class="img-preview clickable-photo" alt="Фото" onerror="this.style.display='none'" onclick="app.openFullPhoto('${w.image}')">` : ''}

                <div class="wc-section">
                    <span class="wc-label">УПРАЖНЕНИЕ</span>
                    <h3 class="wc-title">${escapeHtml(w.title)}</h3>
                </div>

                <div class="wc-divider"></div>

                <div class="wc-sets">
                    ${setsHtml}
                    ${totalHtml}
                </div>

                <div class="wc-divider"></div>

                <div class="wc-section">
                    <span class="wc-label">ДАТА И ВРЕМЯ</span>
                    <span class="wc-value">${dateStr}${timeStr ? '&nbsp;&nbsp;' + timeStr : ''}</span>
                </div>

                <div class="wc-divider"></div>

                <div class="wc-section">
                    <span class="wc-label">ГРУППЫ МЫШЦ</span>
                    <div class="wc-tags">${tagsHtml}</div>
                </div>

                ${w.notes ? `
                <div class="wc-divider"></div>
                <div class="wc-section">
                    <span class="wc-label">КОММЕНТАРИЙ</span>
                    <div class="wc-notes">${escapeHtml(w.notes)}</div>
                </div>
                ` : ''}

                <div class="wc-actions">
                    <button type="button" class="wc-btn-copy" onclick="app.copyWorkoutToToday('${w.id}', this)" title="Скопировать упражнение на сегодня">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    <button class="wc-btn-edit" onclick="app.openEditModal('${w.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="wc-btn-delete" onclick="app.deleteWorkout('${w.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            listWorkouts.appendChild(li);
        });
    }

    // Функция быстрого копирования тренировки на сегодняшнюю дату
    window.app.copyWorkoutToToday = (id, buttonEl) => {
        const workouts = getAllWorkouts();
        const originalWorkout = workouts.find(w => w.id === id);

        if (!originalWorkout) {
            showToast('Не удалось найти данные упражнения для копирования.', 'error');
            return;
        }

        // Формируем сегодняшнюю дату в формате YYYY-MM-DD
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];

        // Глубокое копирование подходов с обнулением флага выполнения (done)
        const copiedSets = originalWorkout.sets ? originalWorkout.sets.map(s => ({
            weight: s.weight,
            reps: s.reps,
            restSec: s.restSec,
            done: false 
        })) : [];

        const newWorkout = {
            ...originalWorkout,
            id: 'copy_' + Date.now(), 
            date: dateStr,
            sets: copiedSets,
            isCopy: true,
            title: originalWorkout.title + ' (Копия от ' + today.toLocaleDateString('ru-RU') + ')'
        };

        try {
            if (addWorkout) {
                addWorkout(newWorkout);
                renderWorkoutsList();
                renderCalendar();
                if (getCurrentPage() === 'stats') renderStats();

                // Визуальный отклик на кнопке
                if (buttonEl) {
                    const originalText = buttonEl.innerHTML;
                    buttonEl.innerHTML = '<i class="fas fa-check"></i> Скопировано!';
                    buttonEl.classList.add('copied');
                    setTimeout(() => {
                        buttonEl.innerHTML = originalText;
                        buttonEl.classList.remove('copied');
                    }, 2000);
                }
                showToast('Упражнение скопировано на сегодня!', 'success');
            }
        } catch (error) {
            console.error('Ошибка копирования:', error);
            showToast('Не удалось скопировать упражнение.', 'error');
        }
    };

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

        // Слушатели изменений для списков шаблонов упражнений
        const selectAdd = document.getElementById('exercise-select-add');
        if (selectAdd) {
            selectAdd.addEventListener('change', (e) => {
                const titleInput = document.getElementById('title-add');
                if (titleInput && e.target.value) {
                    titleInput.value = e.target.value;
                    updateLastWorkoutHint(e.target.value);
                }
            });
        }

        const selectEdit = document.getElementById('exercise-select-edit');
        if (selectEdit) {
            selectEdit.addEventListener('change', (e) => {
                const titleInput = formEditWorkout.querySelector('input[name="edit-title"]');
                if (titleInput && e.target.value) {
                    titleInput.value = e.target.value;
                }
            });
        }

        if (formAddWorkout) formAddWorkout.addEventListener('submit', handleAddWorkout);
        if (formEditWorkout) formEditWorkout.addEventListener('submit', handleEditWorkout);

        // Подсказка прошлой тренировки по названию
        const titleAddInput = document.getElementById('title-add');
        if (titleAddInput) {
            titleAddInput.addEventListener('input', (e) => {
                updateLastWorkoutHint(e.target.value.trim());
            });
        }

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

    // --- Фильтры ---
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
        const muscleFilterCheckboxes = document.querySelectorAll('.filter-muscle-checkbox');
        const muscleFilters = Array.from(muscleFilterCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value); 
        
        if (muscleFilters.length > 0) {
            filtered = filtered.filter(w => 
                w.muscleTags && 
                w.muscleTags.some(tag => muscleFilters.includes(tag))
            );
        }
        
        // 4. Фильтр по выбранному дню в календаре
        if (selectedCalendarDateStr) {
            filtered = filtered.filter(w => w.date === selectedCalendarDateStr);
        }
        
        renderWorkoutsList(filtered);
    }

    // --- Чекбоксы фильтров мышц ---
    document.querySelectorAll('.filter-muscle-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
    });

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
            workout.sets[setIndex].done = isChecked;
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

    // --- Обработчики форм ---
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
                setsData.push({ weight: w, reps: r, restSec: rest, done: false });
            }
            i++;
        }

        if (setsData.length === 0) {
            const w = parseFloat(formData.get('weight-add')) || 0;
            const r = parseInt(formData.get('reps-add')) || 0;
            const rest = parseInt(formData.get('rest-add')) || 60;
            if (w > 0 && r > 0) setsData.push({ weight: w, reps: r, restSec: rest, done: false });
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
                .map(cb => cb.value), 
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
                const wasDone = originalWorkout && originalWorkout.sets[i] ? originalWorkout.sets[i].done : false;
                setsData.push({ 
                    weight: w, 
                    reps: r, 
                    restSec: rest,
                    done: wasDone 
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

        const selectedMuscles = formData.getAll('edit-muscleTags');

        const updatedWorkout = {
            id: currentEditId,
            image: formData.get('edit-image') || '', 
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
            updatedAt: new Date().toISOString() 
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

    // --- Подсказка последней тренировки (по текущему названию) ---
    function prefillFromLastWorkout() {
        const titleInput = document.getElementById('title-add');
        const currentTitle = titleInput ? titleInput.value.trim() : '';
        updateLastWorkoutHint(currentTitle);
    }

    function updateLastWorkoutHint(searchTitle) {
        const hintBlock = document.getElementById('last-workout-hint');
        const hintContent = document.getElementById('lwh-content');
        if (!hintBlock || !hintContent) return;

        if (!searchTitle) {
            hintBlock.style.display = 'none';
            return;
        }

        const workouts = getAllWorkouts ? getAllWorkouts() : [];
        if (!workouts || workouts.length === 0) {
            hintBlock.style.display = 'none';
            return;
        }

        const lowerSearch = searchTitle.toLowerCase();
        const matched = workouts
            .filter(w => w.title && w.title.toLowerCase() === lowerSearch)
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        if (matched.length === 0) {
            hintBlock.style.display = 'none';
            return;
        }

        const last = matched[0];
        const sets = last.sets || [];
        const maxWeight = sets.length > 0 ? Math.max(...sets.map(s => Number(s.weight) || 0)) : 0;
        const totalReps  = sets.reduce((sum, s) => sum + (Number(s.reps) || 0), 0);

        const setsPreview = sets.map((s, i) =>
            `<span class="lwh-set">П${i + 1}: ${s.weight}кг × ${s.reps}</span>`
        ).join('');

        const tagsHtml = (last.muscleTags && last.muscleTags.length > 0)
            ? last.muscleTags.map(t => `<span class="lwh-tag">${t}</span>`).join('')
            : '';

        hintContent.innerHTML = `
            <div class="lwh-row">
                <strong class="lwh-name">${escapeHtml(last.title)}</strong>
                <span class="lwh-date">${last.date || ''}</span>
            </div>
            ${tagsHtml ? `<div class="lwh-tags">${tagsHtml}</div>` : ''}
            ${sets.length > 0 ? `
            <div class="lwh-sets">${setsPreview}</div>
            <div class="lwh-totals">
                <span><i class="fas fa-dumbbell"></i> макс. ${maxWeight} кг</span>
                <span><i class="fas fa-sync-alt"></i> ${totalReps} повт.</span>
                <span><i class="fas fa-layer-group"></i> ${sets.length} подх.</span>
            </div>` : '<span class="lwh-empty">Подходы не записаны</span>'}
        `;

        hintBlock.style.display = 'block';
    }

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

    window.app.openFullPhoto = (imgSrc) => {
        const overlay = document.getElementById('photo-overlay');
        const fullImg = document.getElementById('fullscreen-image');
        
        if (overlay && fullImg) {
            fullImg.src = imgSrc; 
            overlay.classList.add('show'); 
        }
    };

    // Экспортируем глобальные методы
    window.app.reindexSets = reindexSets;
    window.app.renderCalendar = renderCalendar;
});

// --- Глобальные вспомогательные функции вне DOMContentLoaded ---
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

console.log(window.exercisesData);