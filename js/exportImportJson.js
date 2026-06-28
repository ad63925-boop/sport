/**
 * Файл: exportImportJson.js
 * Функции для экспорта и импорта данных в формате JSON
 * DB_KEY: ключ для хранения данных в localStorage
 * 
 * Экспорт:
 * - Кнопка "Экспорт JSON" вызывает диалоговое окно подтверждения.
 * - Если пользователь подтверждает, данные из localStorage экспортируются в файл JSON.
 * fit-workouts-v1 - ключ для хранения данных в localStorage
 */

(function () {
    // Теперь все переменные внутри этой функции изолированы и не вызовут ошибок дублирования!
    const DB_KEY = 'fit-workouts-v1';

    // Функция для получения данных из хранилища
function getDB() {
        try {
            const data = localStorage.getItem(DB_KEY);
            // Возвращаем распарсенный объект, либо пустой объект, если данных нет
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Ошибка при получении данных:', error);
            return {};
        }
    }

    // Функция для сохранения данных
function saveDB(data) {
        try {
            localStorage.setItem(DB_KEY, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Ошибка при сохранении данных:', error);
            return false;
        }
    }

    // Инициализация данных при загрузке скрипта
  window.exercisesData = getDB();
    console.log(DB_KEY, 'инициализирована. Текущие данные:', window.exercisesData);

    // Инициализация обработчиков при полной загрузке страницы
    document.addEventListener('DOMContentLoaded', function() {
        const btnExport = document.getElementById('btn-export');
        const btnImport = document.getElementById('btn-import');
        const fileImport = document.getElementById('file-import');

        // --- ЛОГИКА ЭКСПОРТА ---
        if (btnExport) {
            btnExport.addEventListener('click', function() {
                Swal.fire({
                    title: 'Экспорт данных',
                    text: 'Вы хотите сохранить текущие данные в файл JSON?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Да, сохранить',
                    cancelButtonText: 'Отмена'
                }).then((result) => {
                    if (result.isConfirmed) {
                        performExport();
                    }
                });
            });
        }

        // --- ЛОГИКА ИМПОРТА ---
        if (btnImport && fileImport) {
            btnImport.addEventListener('click', function() {
                fileImport.click();
            });

            fileImport.addEventListener('change', function() {
                const file = fileImport.files[0];
                if (!file) return;

                performImport(file);
                fileImport.value = ''; // Сброс
            });
        }
    });

    // --- ФУНКЦИЯ ВЫПОЛНЕНИЯ ИМПОРТА ---
function performImport(file) {
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);

                // ПРОВЕРКА: Так как мы импортируем весь объект приложения, 
                // проверим наличие главного свойства workouts
                if (!importedData || !Array.isArray(importedData.workouts)) {
                    throw new Error('Файл должен содержать объект со списком тренировок.');
                }

                if (!saveDB(importedData)) {
                    throw new Error('Ошибка при сохранении данных.');
                }

                window.exercisesData = importedData;

                Swal.fire({
                    title: 'Успешно!',
                    text: 'Данные импортированы и обновлены.',
                    icon: 'success',
                    confirmButtonText: 'ОК'
                }).then(() => {
                    // Перезагружаем страницу, чтобы приложение подтянуло новые данные из localStorage
                    window.location.reload();
                });

            } catch (error) {
                console.error('Ошибка импорта:', error);
                Swal.fire('Ошибка', 'Не удалось распарсить JSON файл. Проверьте формат файла.', 'error');
            }
        };

        reader.onerror = function() {
            Swal.fire('Ошибка', 'Не удалось прочитать файл.', 'error');
        };

        reader.readAsText(file);
    }

    // --- ФУНКЦИЯ ВЫПОЛНЕНИЯ ЭКСПОРТА ---
    function performExport() {
        // Читаем данные напрямую из localStorage в момент нажатия кнопки
        const currentData = getDB(); 

        // Проверяем, есть ли тренировки внутри объекта приложения
        if (!currentData || !currentData.workouts || currentData.workouts.length === 0) {
            Swal.fire({
                title: 'Нет данных',
                text: 'Список упражнений пуст. Нечего экспортировать.',
                icon: 'warning',
                confirmButtonText: 'ОК'
            });
            return;
        }

        // Экспортируем весь объект целиком (включая историю веса и настройки)
        const jsonString = JSON.stringify(currentData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const date = new Date();
        const fileName = `exercises_export_${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}.json`;
        
        link.href = url;
        link.download = fileName;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        Swal.fire({
            title: 'Готово!',
            text: 'Файл успешно скачан.',
            icon: 'success',
            confirmButtonText: 'ОК'
        });
    }

} )(); // Конец капсулы ИИФЕ

