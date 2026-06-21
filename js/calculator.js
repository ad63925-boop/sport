/**
 * js/calculator.js
 * Утилиты для расчетов в трекере тренировок.
 * Подключается ПОСЛЕ workouts.js и app.js или работает автономно.
 */

const WorkoutCalculator = {
    /**
     * Считает тоннаж одного подхода: Вес (кг) * Повторы
     * @param {number} weight - Вес в кг
     * @param {number} reps - Количество повторов
     * @returns {number} Тоннаж в кг
     */
    calculateSetTonnage(weight, reps) {
        if (!weight || !reps) return 0;
        return parseFloat(weight) * parseInt(reps);
    },

    /**
     * Считает общий тоннаж тренировки (сумма всех подходов)
     * @param {Array} sets - Массив объектов [{weight, reps}, ...]
     * @returns {number} Общий тоннаж
     */
    calculateTotalTonnage(sets) {
        if (!Array.isArray(sets)) return 0;
        return sets.reduce((total, set) => {
            return total + this.calculateSetTonnage(set.weight, set.reps);
        }, 0);
    },

    /**
     * Считает объем работы (Volume Load): Вес * Повторы * Подходы
     * Часто используется в пауэрлифтинге/бодибилдинге для оценки нагрузки.
     * @param {number} weight 
     * @param {number} reps 
     * @param {number} setsCount 
     * @returns {number} Объем
     */
    calculateVolumeLoad(weight, reps, setsCount) {
        if (!weight || !reps || !setsCount) return 0;
        return parseFloat(weight) * parseInt(reps) * parseInt(setsCount);
    },

    /**
     * Конвертирует время из формата HH:MM в минуты
     */
    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            const h = parseInt(parts[0]) || 0;
            const m = parseInt(parts[1]) || 0;
            return h * 60 + m;
        }
        return 0;
    },

    /**
     * Вычисляет разницу во времени в минутах между Start и End
     */
    calculateDurationMinutes(start, end) {
        const startMin = this.timeToMinutes(start);
        const endMin = this.timeToMinutes(end);
        
        // Обработка случая, когда тренировка перешла за полночь
        if (endMin < startMin) {
            return (24 * 60 - startMin) + endMin;
        }
        return endMin - startMin;
    }
};

// Экспортируем для использования в других модулях (если сборщик поддерживает)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkoutCalculator;
}

// Делаем доступным глобально, если подключаешь через <script>
window.WorkoutCalculator = WorkoutCalculator;
