document.addEventListener('DOMContentLoaded', function() {
  const tabBtns = document.querySelectorAll('.binder-tab');
  const tabPanels = document.querySelectorAll('.binder-panel');

  // Function to activate a tab
  function activateTab(targetTab) {
    tabBtns.forEach(btn => {
      const isActive = btn.dataset.tab === targetTab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      
      // Move focus to activated tab for keyboard users
      if (isActive) {
        btn.focus();
      }
    });

    tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === 'panel-' + targetTab);
    });
  }

  tabBtns.forEach((btn, index) => {
    btn.addEventListener('click', function() {
      activateTab(this.dataset.tab);
    });
    
    // Keyboard navigation support (WAI-ARIA tabs pattern)
    btn.addEventListener('keydown', function(e) {
      let newIndex = index;
      
      switch(e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          newIndex = (index + 1) % tabBtns.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          newIndex = (index - 1 + tabBtns.length) % tabBtns.length;
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = tabBtns.length - 1;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          activateTab(this.dataset.tab);
          return;
        default:
          return;
      }
      
      activateTab(tabBtns[newIndex].dataset.tab);
    });
  });
});
