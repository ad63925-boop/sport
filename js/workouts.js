
/**
 * js/workouts.js
 * Логика работы с данными тренировок: CRUD, валидация, расчеты.
 * Все данные хранятся в LocalStorage под ключом 'fit-workouts-v1'.
 * Структура данных масштабируема и готова к расширению.
 */

const DB_KEY = 'fit-workouts-v1';

/**
 * Инициализация базы данных, если она еще не создана.
 * Создает начальные списки упражнений и тегов мышц, чтобы интерфейс не был пустым.
 */
function initDB() {
    const defaultExercises = [
        'Жим штанги лежа',
        'Приседания со штангой',
        'Становая тяга',
        'Подтягивания на турнике',
        'Армейский жим штанги',
        'Подъем штанги на бицепс',
        'Французский жим',
        'Гиперэкстензия',
        'Скручивания на пресс',
        'Жим гантелей лежа',
        'Тяга гантели в наклоне',
        'Выпады с гантелями',
        'Разведение гантелей в стороны',
        'Отжимания на брусьях',
        'Бег на беговой дорожке',
        'Планка'
    ];

    if (!localStorage.getItem(DB_KEY)) {
        const initialData = {
            workouts: [], // Массив всех тренировок пользователя
            customExercises: defaultExercises,
            muscleTags: [ // Список тегов групп мышц
                'Грудь', 'Спина', 'Ноги', 'Руки', 'Плечи', 'Пресс', 'Кардио', 'Ягодицы'
            ],
            weightHistory: [], // История взвешиваний: [{date: 'YYYY-MM-DD', weight: 80}]
            settings: {
                units: 'kg', // Единицы измерения (kg/lb)
                theme: 'dark'
            }
        };
        localStorage.setItem(DB_KEY, JSON.stringify(initialData));
        //console.log('База данных инициализирована');
    } else {
        // Миграция: если база уже есть, но содержит старые данные (мышцы вместо упражнений),
        // заменяем список на корректный
        try {
            const db = JSON.parse(localStorage.getItem(DB_KEY));
            if (db && db.customExercises && db.customExercises.includes('икроножные')) {
                db.customExercises = defaultExercises;
                localStorage.setItem(DB_KEY, JSON.stringify(db));
                //console.log('Выполнена миграция списка упражнений');
            }
        } catch (e) {
            console.error('Ошибка миграции БД:', e);
        }
    }
}

/**
 * Получение полного объекта базы данных из LocalStorage.
 * @returns {Object} Объект с полями workouts, customExercises и т.д.
 */
function getDB() {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? JSON.parse(raw) : null;
}

/**
 * Сохранение обновленного объекта базы данных в LocalStorage.
 * @param {Object} data - Обновленный объект БД.
 */
function saveDB(data) {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Ошибка сохранения в LocalStorage:', e);
        // В случае ошибки (например, переполнен лимит) показываем пользователю ошибку через UI, если есть доступ
        if (typeof window !== 'undefined') {
            window.showToast && window.showToast('Ошибка сохранения данных! Возможно, место закончилось.', 'error');
        }
    }
}

/**
 * Добавление новой тренировки.
 * Автоматически генерирует ID, дату создания и нормализует структуру подходов.
 * @param {Object} workoutData - Объект тренировки из формы.
 * @returns {Object} Созданная тренировка.
 */
function addWorkout(workoutData) {
    const db = getDB();
    if (!db) throw new Error('База данных не инициализирована');

    // Генерация уникального ID на основе времени и случайного числа
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Нормализация подходов: убеждаемся, что это массив
    const sets = Array.isArray(workoutData.sets) ? workoutData.sets : [workoutData.sets];

    const newWorkout = {
        id,
        image: workoutData.image || '',
        title: workoutData.title,
        muscleTags: workoutData.muscleTags || [],
        type: workoutData.type || 'strength', // 'strength' или 'cardio'
        isRunning: false, // Флаг для таймера
        
        // Данные для бега (если тип cardio)
        distanceKm: workoutData.distanceKm || null,
        runTime: workoutData.runTime || null, 
        
        sets: sets.map(set => ({
            weight: parseFloat(set.weight) || 0,
            reps: parseInt(set.reps) || 0,
            restSec: parseInt(set.restSec) || 60,
            done: !!set.done
        })),
        
        notes: workoutData.notes || '',
        date: workoutData.date, // Формат YYYY-MM-DD
        startTime: workoutData.startTime, // HH:mm
        endTime: workoutData.endTime, // HH:mm (может быть null при создании)
        photoUrl: workoutData.photoUrl || '',
        exercisePhotoUrl: workoutData.exercisePhotoUrl || '',
        calories: parseInt(workoutData.calories) || 0,
        bodyWeight: parseFloat(workoutData.bodyWeight) || null, // Вес тела перед тренировкой
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    db.workouts.push(newWorkout);
    saveDB(db);

    // Если указан вес тела, добавляем в историю весов
    if (newWorkout.bodyWeight) {
        addToWeightHistory(newWorkout.date, newWorkout.bodyWeight);
    }

    return newWorkout;
}

/**
 * Обновление существующей тренировки.
 * @param {string} id - ID тренировки.
 * @param {Object} updatedData - Частичные данные для обновления.
 * @returns {Object|null} Обновленная тренировка или null, если не найдена.
 */
function updateWorkout(id, updatedData) {
    // Если передан только один аргумент (объект тренировки)
    if (typeof id === 'object' && id !== null && !updatedData) {
        updatedData = id;
        id = updatedData.id;
    }

    const db = getDB();
    if (!db) return null;

    const index = db.workouts.findIndex(w => w.id === id);
    if (index === -1) return null;

    const existing = db.workouts[index];
    const updatedSets = Array.isArray(updatedData.sets) 
        ? updatedData.sets 
        : (updatedData.sets ? [updatedData.sets] : existing.sets);

    const mergedWorkout = {
        ...existing,
        ...updatedData,
        sets: updatedSets.map(set => {
            const weight = (set.weight === '' || set.weight === null || set.weight === undefined) 
                ? 0 
                : parseFloat(set.weight);
            
            const reps = (set.reps === '' || set.reps === null || set.reps === undefined) 
                ? 0 
                : parseInt(set.reps);
                
            const restSec = (set.restSec === '' || set.restSec === null || set.restSec === undefined) 
                ? 60 
                : parseInt(set.restSec);

            return {
                weight: isNaN(weight) ? 0 : weight,
                reps: isNaN(reps) ? 0 : reps,
                restSec: isNaN(restSec) ? 60 : restSec,
                done: !!set.done
            };
        }),
        updatedAt: new Date().toISOString()
    };

    db.workouts[index] = mergedWorkout;
    saveDB(db);

    if (mergedWorkout.bodyWeight) {
        addToWeightHistory(mergedWorkout.date, mergedWorkout.bodyWeight);
    }

    return mergedWorkout;
}


/**
 * Удаление тренировки по ID.
 * @param {string} id - ID тренировки.
 */
function deleteWorkout(id) {
    const db = getDB();
    if (!db) return;
    db.workouts = db.workouts.filter(w => w.id !== id);
    saveDB(db);
}

/**
 * Получение всех тренировок с сортировкой по дате (новые сверху).
 * @returns {Array} Отсортированный массив тренировок.
 */
function getAllWorkouts() {
    const db = getDB();
    if (!db || !db.workouts) return [];
    return [...db.workouts].sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Поиск тренировок по названию упражнения.
 * @param {string} query - Строка поиска.
 * @returns {Array} Отфильтрованный массив.
 */
function searchWorkouts(query) {
    if (!query) return getAllWorkouts();
    const lowerQuery = query.toLowerCase();
    return getAllWorkouts().filter(w => 
        w.title.toLowerCase().includes(lowerQuery)
    );
}

/**
 * Фильтрация тренировок по дате и группам мышц.
 * @param {string|null} dateFilter - 'today', 'week', 'month', 'year' или null.
 * @param {Array} muscleFilters - Массив выбранных тегов (например: ['Грудь', 'Руки']).
 * @returns {Array} Отфильтрованный массив.
 */
function filterWorkouts(dateFilter, muscleFilters) {
    let result = getAllWorkouts();

    // Фильтр по дате
    if (dateFilter) {
        const now = new Date();
        let startDate = new Date(now);
        
        switch(dateFilter) {
            case 'today':
                startDate.setHours(0,0,0,0);
                break;
            case 'week':
                startDate.setDate(now.getDate() - now.getDay()); // Понедельник
                startDate.setHours(0,0,0,0);
                break;
            case 'month':
                startDate.setDate(1);
                startDate.setHours(0,0,0,0);
                break;
            case 'year':
                startDate.setMonth(0, 1);
                startDate.setHours(0,0,0,0);
                break;
        }

        result = result.filter(w => new Date(w.date) >= startDate);
    }

    // Фильтр по мышцам
    if (muscleFilters && muscleFilters.length > 0) {
        result = result.filter(w => 
            w.muscleTags.some(tag => muscleFilters.includes(tag))
        );
    }

    return result;
}

/**
 * Расчет общей статистики по всем тренировкам.
 * Возвращает объект с агрегированными данными для графиков.
 * @returns {Object} Статистика.
 */
function calculateStats() {
    const workouts = getAllWorkouts();
    if (workouts.length === 0) return getEmptyStats();

    let totalWeightLifted = 0;
    let totalSets = 0;
    let totalReps = 0;
    let totalDurationHours = 0;
    let totalCalories = 0;
    
    // Используем Map для более надёжного хранения лучших результатов
    const bestResultsMap = new Map(); 

    const getDurationInHours = (start, end) => {
        if (!start || !end) return 0;
        // Простая валидация формата HH:mm
        if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return 0;
        
        const s = new Date(`1970-01-01T${start}`);
        const e = new Date(`1970-01-01T${end}`);
        
        if (isNaN(s) || isNaN(e)) return 0;
        return (e - s) / 3600000;
    };

    workouts.forEach(w => {
        if (w.startTime && w.endTime) {
            totalDurationHours += getDurationInHours(w.startTime, w.endTime);
        }
        totalCalories += w.calories;

        w.sets.forEach(set => {
            if (set.weight > 0 && set.reps > 0) {
                totalWeightLifted += set.weight * set.reps;
                totalSets++;
                totalReps += set.reps;
            }
            
            // Улучшенная логика лучшего результата
            // Ключом лучше брать название, приведённое к нижнему регистру и очищенное
            const key = w.title.trim().toLowerCase();
            const currentBest = bestResultsMap.get(key);
            
            if (!currentBest || set.weight > currentBest.weight) {
                bestResultsMap.set(key, { 
                    weight: set.weight, 
                    date: w.date,
                    exerciseName: w.title // Сохраняем оригинальное название
                });
            }
        });
    });

    // Преобразуем Map в обычный объект для возврата
    const bestResults = {};
    bestResultsMap.forEach((value, key) => {
        bestResults[value.exerciseName] = value;
    });

    // ... (остальной код со streak и весом без изменений) ...
    const dates = [...new Set(workouts.map(w => w.date))].sort();
    let streak = 0;
    if (dates.length > 0) {
        streak = 1;
        for (let i = dates.length - 1; i > 0; i--) {
            // Валидация дат перед вычитанием
            const d1 = new Date(dates[i]);
            const d2 = new Date(dates[i-1]);
            if (isNaN(d1) || isNaN(d2)) continue;
            
            const diffTime = Math.abs(d1 - d2);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays === 1) streak++;
            else break;
        }
    }

    const weightHistory = getWeightHistory();
    const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length-1].weight : null;

    return {
        totalWorkouts: workouts.length,
        totalWeightLifted: Math.round(totalWeightLifted),
        totalSets,
        totalReps,
        totalDurationHours: parseFloat(totalDurationHours.toFixed(2)),
        totalCalories,
        bestResults,
        streak,
        currentWeight,
        workoutsByMonth: groupWorkoutsByMonth(workouts),
        workoutsByDay: groupWorkoutsByDay(workouts)
    };
}


/**
 * Вспомогательная функция: пустая статистика для случая, когда тренировок нет.
 */
function getEmptyStats() {
    return {
        totalWorkouts: 0, totalWeightLifted: 0, totalSets: 0, totalReps: 0,
        totalDurationHours: 0, totalCalories: 0, bestResults: {}, streak: 0,
        currentWeight: null, workoutsByMonth: [], workoutsByDay: []
    };
}

/**
 * Группировка тренировок по месяцам для графика.
 * @param {Array} workouts - Массив тренировок.
 * @returns {Array} Массив объектов {label: 'Янв 24', value: 5}
 */
function groupWorkoutsByMonth(workouts) {
    const map = {};
    workouts.forEach(w => {
        const date = new Date(w.date);
        const label = date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
        map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
}

/**
 * Группировка тренировок по дням (для календаря/графика последних 7 дней).
 */
function groupWorkoutsByDay(workouts) {
    const map = {};
    const today = new Date();
    // Берем только последние 7 дней для графика
    const limitDate = new Date(today);
    limitDate.setDate(limitDate.getDate() - 7);

    workouts.forEach(w => {
        const d = new Date(w.date);
        if (d >= limitDate) {
            const label = d.toLocaleDateString('ru-RU');
            map[label] = (map[label] || 0) + 1;
        }
    });
    // Сортируем по дате
    return Object.entries(map)
        .map(([dateStr, count]) => ({ date: dateStr, count }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Добавление записи в историю веса.
 * Предотвращает дублирование записей за один день (перезаписывает последнюю).
 * @param {string} date - Дата 'YYYY-MM-DD'.
 * @param {number} weight - Вес в кг.
 */
function addToWeightHistory(date, weight) {
    const db = getDB();
    if (!db) return;
    
    // Проверяем, есть ли уже запись за этот день
    const historyIndex = db.weightHistory.findIndex(h => h.date === date);
    
    if (historyIndex !== -1) {
        db.weightHistory[historyIndex].weight = weight;
    } else {
        db.weightHistory.push({ date, weight });
        // Сортируем историю по дате
        db.weightHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    saveDB(db);
}

/**
 * Получение истории веса для графика.
 * @returns {Array} Массив {x: '2024-01-01', y: 80}
 */
function getWeightHistory() {
    const db = getDB();
    if (!db) return [];
    // Преобразуем в формат, удобный для Chart.js
    return db.weightHistory.map(h => ({ x: h.date, y: h.weight }));
}

/**
 * Управление списком пользовательских упражнений.
 * Добавляет новое упражнение в общий список, если его там нет.
 * @param {string} exerciseName - Название упражнения.
 */
function addCustomExercise(exerciseName) {
    const db = getDB();
    if (!db) return;
    const name = exerciseName.trim();
    if (!name || db.customExercises.includes(name)) return;
    
    db.customExercises.push(name);
    // Сортируем для красивого выпадающего списка
    db.customExercises.sort();
    saveDB(db);
}

/**
 * Управление тегами мышц.
 * Добавляет новый тег в общий список, если его там нет.
 * @param {string} tagName - Название тега.
 */

function addMuscleTag(tagName) {
    const db = getDB();
    if (!db) return;
    const name = tagName.trim();
    if (!name || db.muscleTags.includes(name)) return;

    db.muscleTags.push(name);
    // Сортируем для красивого выпадающего списка
    db.muscleTags.sort();
    saveDB(db);
}


/**
 * Получение списка пользовательских упражнений.
 * @returns {Array<string>} Массив названий упражнений.
 */
function getCustomExercises() {
    const db = getDB();
    return db ? [...db.customExercises] : [];
}

/**
 * Получение списка тегов мышц.
 * @returns {Array<string>} Массив названий тегов.
 */
function getMuscleTags() {
    const db = getDB();
    return db ? [...db.muscleTags] : [];
}

/**
 * Очистка всех данных (для сброса/тестирования).
 * ВНИМАНИЕ: удаляет всё без возможности восстановления.
 */
function clearAllData() {
    if (typeof window === 'undefined' || confirm('Вы уверены? Это удалит ВСЕ тренировки и настройки!')) {
        localStorage.removeItem(DB_KEY);
        initDB();
        // Сообщаем UI о сбросе, если функция доступна
        if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast('Все данные сброшены', 'success');
        }
    }
}

// Инициализируем БД только если мы в браузере и это не повторный вызов с уже существующими данными
// (проверка внутри initDB уже есть, но явная проверка контекста полезна)
if (typeof window !== 'undefined') {
    initDB();
}

// Экспортируем публичные функции. 
// Примечание: Для современных проектов (Vite/Webpack) лучше использовать синтаксис export default { ... }
// и импортировать этот файл. Использование window - это подход для простых HTML проектов.
if (typeof window !== 'undefined') {
    window.workoutsDB = {
        initDB,
        addWorkout,
        updateWorkout,
        deleteWorkout,
        getAllWorkouts,
        searchWorkouts,
        filterWorkouts,
        calculateStats,
        addToWeightHistory,
        getWeightHistory,
        addCustomExercise,
        addMuscleTag,
        getCustomExercises,
        getMuscleTags,
        clearAllData
    };
}
