/**
 * Файл: exportImportJson.js
 * Функции для экспорта и импорта данных в формате JSON
 */

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const btnExport = document.getElementById('btn-export');
    const btnImport = document.getElementById('btn-import');
    const fileInput = document.getElementById('file-import');

    // --- ФУНКЦИЯ ЭКСПОРТА ---
    if (btnExport) {
        btnExport.addEventListener('click', function() {
            // 1. Подтверждение перед экспортом (SweetAlert2)
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

    // --- ФУНКЦИЯ ИМПОРТА ---
    if (btnImport) {
        btnImport.addEventListener('click', function() {
            // Открываем диалог выбора файла
            fileInput.click();
        });
    }

    // Обработка выбора файла
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // 2. Подтверждение перед импортом (SweetAlert2)
            Swal.fire({
                title: 'Импорт данных',
                text: `Вы собираетесь загрузить файл "${file.name}". Это действие перезапишет текущие данные!`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Да, импортировать',
                cancelButtonText: 'Отмена'
            }).then((result) => {
                if (result.isConfirmed) {
                    performImport(file);
                }
                // Сбрасываем input, чтобы можно было выбрать тот же файл снова
                fileInput.value = '';
            });
        });
    }

    // --- ЛОГИКА ЭКСПОРТА ---
    function performExport() {
        // ВАЖНО: Замените 'exercisesData' на имя вашей переменной с данными
        // Если данные хранятся в localStorage, используйте JSON.parse(localStorage.getItem('...'))
        const dataToExport = window.exercisesData || []; 

        if (!dataToExport || dataToExport.length === 0) {
            Swal.fire('Ошибка', 'Нет данных для экспорта.', 'error');
            return;
        }

        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `exercises_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Очистка
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Swal.fire('Готово', 'Файл успешно скачан!', 'success');
    }

    // --- ЛОГИКА ИМПОРТА ---
    function performImport(file) {
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);

                if (!Array.isArray(importedData)) {
                    throw new Error('Файл должен содержать массив данных.');
                }

                // ВАЖНО: Замените 'exercisesData' на имя вашей переменной
                // Здесь мы обновляем данные в памяти
                window.exercisesData = importedData;

                // Если у вас есть функция сохранения в localStorage, вызовите её здесь
                // localStorage.setItem('exercisesData', JSON.stringify(importedData));

                // Если у вас есть функция рендеринга списка, вызовите её здесь
                // renderExercisesList(); 

                Swal.fire({
                    title: 'Успешно!',
                    text: 'Данные импортированы и обновлены.',
                    icon: 'success',
                    confirmButtonText: 'ОК'
                }).then(() => {
                    // Перезагрузка страницы или обновление интерфейса
                    // location.reload(); 
                    if (typeof window.refreshUI === 'function') {
                        window.refreshUI();
                    }
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
});

console.log(window.exercisesData);