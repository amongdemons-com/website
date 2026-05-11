(function() {
  'use strict';

  const TYPES_API = '/api/game/demon-types';
  const dropdownElement = document.getElementById('demonTypesDropdown');

  if (!dropdownElement) return;

  onReady(init);

  async function init() {
    try {
      const types = await fetchJson(TYPES_API);
      dropdownElement.innerHTML = renderTypeLinks(types);
    } catch (error) {
      console.error('Error loading demon types for navigation:', error);
      dropdownElement.innerHTML = renderTypeLinks(getFallbackTypes());
    }
  }

  async function fetchJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Request failed: ${url}`);
    }

    return response.json();
  }

  function renderTypeLinks(types) {
    return Object.keys(types)
      .map(Number)
      .sort((a, b) => a - b)
      .map((typeNumber) => `<li><a class="dropdown-item" href="/demons/type/${typeNumber}">${types[typeNumber].name}</a></li>`)
      .join('');
  }

  function getFallbackTypes() {
    return {
      1: { name: 'Boof Nitza' },
      2: { name: "Gon G'ah" },
      3: { name: "Ma'Zga" },
      4: { name: 'Tor Tza' },
      5: { name: "Vi'Zel" }
    };
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();
