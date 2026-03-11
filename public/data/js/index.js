// Demon Type Page - Client-side Data Loading
// Fetches data from demons.json and demon-types.json on client side

(function() {
  'use strict';

  // API paths relative to public/ root
  const DEMONS_PATH = '/data/demons.json';
  const TYPES_PATH = '/data/demon-types.json';

  // Server-provided values (currentPage is still passed via EJS)
  const currentPageElement = document.getElementById('type-number');
  const titleElement = document.getElementById('demon-title');
  const gridElement = document.getElementById('demons-grid');
  const paginationElement = document.getElementById('pagination');

  if (!currentPageElement || !gridElement || !paginationElement) {
    console.warn('Required DOM elements not found. Skipping client-side rendering.');
    return;
  }

  // Cache the current page number from server
  let currentPage = parseInt(currentPageElement.textContent.trim(), 10);

  /**
   * Fetch and merge demon data with type information
   */
  async function loadData() {
    try {
      const [demonsResponse, typesResponse] = await Promise.all([
        fetch(DEMONS_PATH),
        fetch(TYPES_PATH)
      ]);

      if (!demonsResponse.ok || !typesResponse.ok) {
        throw new Error('Failed to load data');
      }

      const demonsData = await demonsResponse.json();
      const typesData = await typesResponse.json();

      // Organize demons by type for efficient rendering
      const demonsByType = {};
      let maxType = 0;

      demonsData.forEach(demon => {
        const typeNum = demon.type;
        if (!demonsByType[typeNum]) {
          demonsByType[typeNum] = [];
        }
        demonsByType[typeNum].push(demon);

        // Track maximum type for pagination
        maxType = Math.max(maxType, typeNum);
      });

      // Populate title with demon type name
      const typeName = typesData[currentPage]?.name || 'Unknown';
      titleElement.textContent = typeName;

      // Render demons grid
      renderDemonsGrid(demonsByType);

      // Render pagination
      renderPagination(maxType);

    } catch (error) {
      console.error('Error loading data:', error);
      gridElement.innerHTML = '<div class="text-center text-danger">Failed to load demon data. Please try again later.</div>';
      paginationElement.innerHTML = '';
    }
  }

  /**
   * Render the demons grid showing only demons of the current type
   */
  function renderDemonsGrid(demonsByType) {
    // Filter demons to show only those matching the current page (type)
    const demonsOfType = demonsByType[currentPage] || [];
    
    let html = '';

    // Show all demons of the filtered type
    demonsOfType.forEach(demon => {
      html += `
        <div class="col">
          <div class="card h-100">
            <img src="${demon.image_url}" class="card-img-top" alt="${capitalize(demon.rarity)}" style="width: 100%; height: auto;">
            <div class="card-body text-center">
              <h5 class="card-title m-0 ad-${demon.rarity}">${capitalize(demon.rarity)}</h5>
            </div>
          </div>
        </div>
      `;
    });

    gridElement.innerHTML = html;
  }

  /**
   * Render pagination links
   */
  function renderPagination(totalPages) {
    let html = '';

    for (let p = 1; p <= totalPages && p <= 11; p++) {
      if (p === currentPage) {
        html += `
          <li class="page-item active" aria-current="page">
            <span class="page-link d-flex align-items-center justify-content-center">${p}</span>
          </li>
        `;
      } else {
        html += `
          <li class="page-item">
            <a class="page-link d-flex align-items-center justify-content-center" href="/demons/type/${p}">${p}</a>
          </li>
        `;
      }
    }

    paginationElement.innerHTML = html;
  }

  /**
   * Capitalize first letter of a string
   */
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadData);
  } else {
    loadData();
  }

})();