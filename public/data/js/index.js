(function() {
  const CONFIG = {
    imagesPerPage: 6,
    totalImages: 66,
    // Using relative path from public/ root to access demo images
    imagesDir: '/data/images/demons/',
    thumbnailsDir: '/data/images/demons/thumbnails/',
    rarityTypes: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
    demonNames: [
      "Boof Nitza", "Gon G'ah", "Ma'Zga", "Tor Tza", "Vi'Zel", 
      "Goh Loomb", "Baobaw", "Ko Pak", "Chu Perk", "Ba Be'aga", 
      "Vee Scol"
    ]
  };

  // State
  const segments = window.location.pathname.split('/');
  let currentPage = parseInt(segments.pop(), 10) || 1;

  // Rarity function from PHP
  function getRarity(index) {
    const mod = index % CONFIG.imagesPerPage;
    if (mod === 0) return 'mythic';
    return CONFIG.rarityTypes[mod - 1];
  }

  // Demon name function from PHP
  function getTypeName(index) {
    if (index >= CONFIG.demonNames.length + 1) {
      return `Unknown`;
    }
    return CONFIG.demonNames[index - 1] || 'Unknown';
  }

  // Get current demon name for title
  (function() {
    const demonName = getTypeName(currentPage);
    const title = document.title;
    if (title.includes('Demon Type') && !title.includes(demonName)) {
      document.title = `${demonName} - Among Demons NFTs`;
    }
  })();

  // Update previous/next buttons
  function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (currentPage > 1) {
      prevBtn.innerHTML = `<a class="text-decoration-none" href="/demons/type/${currentPage - 1}">&laquo;</a>`;
    } else {
      prevBtn.innerHTML = '&nbsp;&nbsp;';
    }

    const totalPages = Math.ceil(CONFIG.totalImages / CONFIG.imagesPerPage);
    if (currentPage < totalPages) {
      nextBtn.innerHTML = `<a class="text-decoration-none" href="/demons/type/${currentPage + 1}">&raquo;</a>`;
    } else {
      nextBtn.innerHTML = '&nbsp;&nbsp;';
    }
  }

  // Update demon name display
  function updateDemonName() {
    document.getElementById('demonName').textContent = getTypeName(currentPage);
    document.getElementById('demonType').textContent = `demon type ${currentPage}`;
  }

  // Render demons grid
  function renderDemons() {
    const grid = document.getElementById('demonGrid');
    const offset = (currentPage - 1) * CONFIG.imagesPerPage;
    const startImage = offset + 1;
    const endImage = Math.min(offset + CONFIG.imagesPerPage, CONFIG.totalImages);
    
    if (startImage > CONFIG.totalImages) {
      grid.innerHTML = '<div class="col-12 text-center text-muted py-5">No more demons to display</div>';
      return;
    }

    const demonIds = [];
    for (let i = startImage; i <= endImage; i++) {
      demonIds.push(i);
    }

    grid.innerHTML = demonIds.map(id => {
      const rarity = getRarity(id);
      const title = `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${getTypeName(currentPage)}`;
      return `
        <div class="col">
          <div class="card h-100">
            <img src="${CONFIG.imagesDir}${id}.png" class="card-img-top" alt="${rarity} ${getTypeName(currentPage)}" title="${title}">
            <div class="card-body text-center">
              <h5 class="card-title m-0 ad-${rarity}">${rarity.charAt(0).toUpperCase() + rarity.slice(1)}</h5>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Generate pagination
  function renderPagination() {
    const totalPages = Math.ceil(CONFIG.totalImages / CONFIG.imagesPerPage);
    const pagination = document.getElementById('pagination');
    
    let html = '';

    if (currentPage > 1) {
      html += `<li class="page-item"><a class="page-link" href="/demons/type/${currentPage - 1}">&laquo;</a></li>`;
    }

    if (currentPage > 4) {
      html += `<li class="page-item"><a class="page-link" href="/demons/type/1">1</a></li>`;
      html += `<li class="m-2 text-secondary">&bull;</li>`;
    }

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      const activeClass = i === currentPage ? 'active' : '';
      html += `<li class="page-item"><a class="page-link ${activeClass}" href="/demons/type/${i}">${i}</a></li>`;
    }

    if (currentPage < totalPages - 1) {
      html += `<li class="m-2 text-secondary">&bull;</li>`;
      html += `<li class="page-item"><a class="page-link" href="/demons/type/${totalPages}">${totalPages}</a></li>`;
    }

    if (currentPage < totalPages) {
      html += `<li class="page-item"><a class="page-link" href="/demons/type/${totalPages}">&raquo;</a></li>`;
    }

    pagination.innerHTML = `<ul>${html}</ul>`;
  }

  // Initialize page
  function init() {
    updateNavigationButtons();
    renderDemons();
    renderPagination();
    updateDemonName();
  }
  // Run on load
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
})();