/**
 * sw.js - Service Worker для фитнес-трекера
 * Кэширует ресурсы и позволяет работать офлайн.
 */

const CACHE_NAME = 'workout-tracker-v1'; // Меняй версию при изменении статики

// Ресурсы, которые нужно кэшировать сразу
const ASSETS_TO_CACHE = [
    '/',
    'index.html',
    'js/app.js',
    'js/workouts.js',
    'https://cdn.jsdelivr.net/npm/chart.js' // Если используешь CDN
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    //console.log('Service Worker installing...');
    
    // Ждем завершения установки, пока не закэшируем файлы
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    //console.log('Service Worker activating...');

    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    // Удаляем старые кэши, если имя не совпадает с текущим
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    
    return self.clients.claim();
});

// Перехват сетевых запросов (Стратегия Cache First)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        // Сначала пробуем найти в кэше
        caches.match(event.request).then((response) => {
            // Если нашли в кэше - отдаем его
            if (response) return response;

            // Если нет в кэше - идем в сеть
            return fetch(event.request).then((networkResponse) => {
                // Клонируем ответ, чтобы сохранить его в кэш
                const responseClone = networkResponse.clone();
                
                caches.open(CACHE_NAME).then((cache) => {
                    // Сохраняем в кэш только GET запросы (не сохраняем POST формы)
                    if (event.request.method === 'GET') {
                        cache.put(event.request, responseClone);
                    }
                });
                return networkResponse;
            }).catch(() => {
                // Если нет ни в кэше, ни в сети - показываем заглушку (опционально)
                if (event.request.destination === 'document') {
                    return new Response(
                        '<h1>Нет интернета</h1><p>Вы можете просматривать сохраненные тренировки.</p>', 
                        { headers: { 'Content-Type': 'text/html' } }
                    );
                }
            });
        })
    );
});
