  document.addEventListener('DOMContentLoaded', function() {
    const toTopBtn = document.getElementById('href-to-top');
    
    // Проверка: если элемент все еще не найден, выходим, чтобы не было ошибки
    if (!toTopBtn) {
      console.error('Кнопка "Наверх" не найдена! Проверьте id="href-to-top".');
      return;
    }

    function toggleButton() {
      if (window.scrollY > 300) {
        toTopBtn.classList.add('visible');
      } else {
        toTopBtn.classList.remove('visible');
      }
    }
    
    window.addEventListener('scroll', toggleButton);
    
    toTopBtn.addEventListener('click', function(e) {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
    
    toggleButton();
  });