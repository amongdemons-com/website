(function() {
  'use strict';

  // API path for demon types data
  const TYPES_PATH = '/data/demon-types.json';

  /**
   * Load demon types and populate the dropdown navigation
   */
  async function loadDemonTypesDropdown() {
    try {
      const response = await fetch(TYPES_PATH);
      
      if (!response.ok) {
        throw new Error('Failed to load demon types data');
      }

      const typesData = await response.json();

      // Get the dropdown menu element
      const dropdownElement = document.getElementById('demonTypesDropdown');

      if (!dropdownElement) {
        console.warn('Démon Types dropdown element not found. Skipping population.');
        return;
      }

      // Build and populate dropdown items
      let html = '';

      // Iterate through types in order (convert keys to numbers for sorting)
      const typeKeys = Object.keys(typesData).map(Number).sort((a, b) => a - b);

      typeKeys.forEach(typeNum => {
        const demonType = typesData[typeNum];
        const href = `/demons/type/${typeNum}`;
        
        html += `
          <li><a class="dropdown-item" href="${href}">${demonType.name}</a></li>
        `;
      });

      dropdownElement.innerHTML = html;

    } catch (error) {
      console.error('Error loading demon types for navigation:', error);
      
      // Fallback: show default option if fetch fails
      const fallbackHtml = `
        <li><a class="dropdown-item" href="/demons/type/1">Boof Nitza</a></li>
        <li><a class="dropdown-item" href="/demons/type/2">Gon G'ah</a></li>
        <li><a class="dropdown-item" href="/demons/type/3">Ma'Zga</a></li>
        <li><a class="dropdown-item" href="/demons/type/4">Tor Tza</a></li>
        <li><a class="dropdown-item" href="/demons/type/5">Vi'Zel</a></li>
      `;
      
      dropdownElement.innerHTML = fallbackHtml;
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDemonTypesDropdown);
  } else {
    // Already in DOM, run immediately
    loadDemonTypesDropdown();
  }

})();