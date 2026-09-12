(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const audio = window.AmongDemons.audio;
  const renderSharedDemonCard = window.AmongDemons.ui.renderDemonCard;
  const openDemonDetailsModal = window.AmongDemons.ui.openDemonDetailsModal;
  const renderIcon = window.AmongDemons.ui.renderIcon || (() => '');
  const renderSoulAmount = window.AmongDemons.ui.renderSoulAmount || ((value) => `${value} Souls`);
  const getRarityColor = window.AmongDemons.ui.getRarityColor || (() => '#d1d5d8');
  const updateNavAccount = window.AmongDemons.ui.updateNavAccount || (() => {});
  const clearNavAccount = window.AmongDemons.ui.clearNavAccount || (() => {});
  const TRAINING_STATS = [
    ['hp', 'HP', 'hp'],
    ['atk', 'Attack', 'attack'],
    ['speed', 'Speed', 'speed']
  ];
  const SUMMON_REVEAL_DELAY_MS = 3000;
  const TRAINING_REVEAL_DELAY_MS = 2850;
  const TRAINING_BURST_CLEANUP_MS = 5200;
  const EAGER_CARD_IMAGE_COUNT = 24;
  const HIGH_PRIORITY_CARD_IMAGE_COUNT = 6;
  const COLLECTION_LOCK_ICON = `
    <span class="collection-lock-indicator" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
        <rect x="5" y="10" width="14" height="10" rx="1.5"></rect>
        <circle cx="12" cy="15" r="1.1"></circle>
        <path d="M12 16.2v1.8"></path>
      </svg>
    </span>`;
  const RARITY_ORDER = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6
  };
  const RARITIES = Object.keys(RARITY_ORDER);
  const DEFAULT_ECHO_REQUIREMENTS = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 5,
    legendary: 8,
    mythic: 12
  };
  const state = {
    player: window.AmongDemons.getSession().player || null,
    collection: [],
    echoItems: new Map(),
    echoConfig: {},
    pendingEchoKey: null,
    pendingEchoAction: null,
    catalog: [],
    visibleSlots: [],
    types: {},
    isAuthenticated: Boolean(window.AmongDemons.getToken()),
    filters: {
      type: 'all',
      rarity: 'all',
      sort: 'default',
      hideMissing: false
    },
    filtersOpen: false,
    trainingDemonId: null,
    trainingResultTimer: null,
    autoTrainDemonId: null,
    autoTrainRunning: false
  };
  const elements = {};
  let gameCatalogPromise = null;

  onReady(init);

  async function init() {
    audio?.setScene({ music: 'music.default' });
    cacheElements();
    bindActions();
    // First-time visitors browse the collection as a guest rather than empty-handed.
    if (!window.AmongDemons.getToken()) {
      try {
        await window.AmongDemons.ensurePlayableSession();
      } catch (error) {
        // Fall back to the logged-out browse view if a guest cannot be opened.
      }
    }
    syncAuthenticatedUi();
    syncFiltersToggle();
    await refreshCollection();
  }

  function cacheElements() {
    [
      'navPlayerName',
      'collectionSummary',
      'collectionCount',
      'collectionGrid',
      'typeFilter',
      'rarityFilter',
      'sortOrder',
      'hideMissingFilter',
      'filtersToggleBtn',
      'collectionControlsPanel',
      'autoTrainModal',
      'autoTrainDemonRarity',
      'autoTrainDemonName',
      'autoTrainSoulBalance',
      'autoTrainSoulSlider',
      'autoTrainSoulSelected',
      'autoTrainBudgetHint',
      'autoTrainSubmitBtn',
      'autoTrainSummary',
      'autoTrainLog'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });

    elements.logoutBtn = document.getElementById('logoutBtn');
  }

  function bindActions() {
    elements.logoutBtn.addEventListener('click', () => {
      window.AmongDemons.clearSession();
      window.location.href = window.AmongDemons.appUrl('/login');
    });

    elements.filtersToggleBtn.addEventListener('click', () => {
      state.filtersOpen = !state.filtersOpen;
      syncFiltersToggle();
    });

    elements.typeFilter.addEventListener('change', () => {
      state.filters.type = elements.typeFilter.value;
      renderCollection();
    });

    elements.rarityFilter.addEventListener('change', () => {
      state.filters.rarity = elements.rarityFilter.value;
      renderCollection();
    });

    elements.sortOrder.addEventListener('change', () => {
      state.filters.sort = elements.sortOrder.value;
      renderCollection();
    });

    elements.hideMissingFilter.addEventListener('change', () => {
      state.filters.hideMissing = elements.hideMissingFilter.checked;
      renderCollection();
    });

    elements.autoTrainSoulSlider.addEventListener('input', syncAutoTrainBudget);
    elements.autoTrainModal.querySelectorAll('[data-auto-train-percent]').forEach((button) => {
      button.addEventListener('click', () => {
        const percentage = Math.max(0, Math.min(100, Number(button.dataset.autoTrainPercent) || 0));
        const availableSouls = Math.max(0, Number(elements.autoTrainSoulSlider.max) || 0);
        elements.autoTrainSoulSlider.value = String(Math.floor(availableSouls * percentage / 100));
        syncAutoTrainBudget();
      });
    });
    elements.autoTrainSubmitBtn.addEventListener('click', autoTrainDemon);
    elements.autoTrainModal.addEventListener('hide.bs.modal', (event) => {
      if (state.autoTrainRunning) event.preventDefault();
    });
    elements.autoTrainModal.addEventListener('hidden.bs.modal', () => {
      state.autoTrainDemonId = null;
    });

    elements.collectionGrid.addEventListener('click', (event) => {
      const card = event.target.closest('.collection-demon-card[data-demon-id]');
      if (!card) return;

      const demon = state.visibleSlots.find((item) => String(item.id) === card.dataset.demonId);
      if (!demon) return;

      openCollectionDemonDetails(demon);
    });

    elements.collectionGrid.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('.collection-demon-card[data-demon-id]');
      if (!card) return;

      event.preventDefault();
      card.click();
    });
  }

  async function refreshCollection() {
    state.isAuthenticated = Boolean(window.AmongDemons.getToken());
    syncAuthenticatedUi();

    try {
      if (state.isAuthenticated) {
        const [bootstrap] = await Promise.all([
          api('/api/collection/bootstrap'),
          loadDemonTypes(),
          loadDemonCatalog()
        ]);

        state.player = bootstrap.player;
        state.collection = bootstrap.demons || [];
        state.echoItems = new Map((bootstrap.echoes?.items || []).map((item) => [item.itemKey, item]));
        state.echoConfig = bootstrap.echoes?.config || {};
      } else {
        state.player = null;
        state.collection = [];
        state.echoItems = new Map();
        state.echoConfig = {};
        await Promise.all([
          loadDemonTypes(),
          loadDemonCatalog()
        ]);
      }

      populateFilters();
      renderCollection();
    } catch (error) {
      await handleCollectionError(error);
    }
  }

  function renderCollection() {
    const ownedDemons = getOwnedDemons();
    const totalSlots = getTotalSlots();
    const visibleSlots = getVisibleCollectionSlots(ownedDemons);
    const collectedCount = ownedDemons.length;
    const playerName = state.player?.username || '';

    state.visibleSlots = visibleSlots;
    elements.navPlayerName.textContent = playerName;
    if (state.player) {
      updateNavAccount(state.player);
    } else {
      clearNavAccount();
    }
    elements.collectionCount.textContent = totalSlots ? `${collectedCount}/${totalSlots}` : String(collectedCount);
    elements.collectionSummary.textContent = totalSlots
      ? renderSummary(visibleSlots.length, collectedCount, totalSlots)
      : 'Collected demons will appear here.';
    elements.collectionGrid.innerHTML = visibleSlots.length
      ? renderDemonCards(visibleSlots)
      : collectedCount
        ? renderNoMatchesState()
        : renderEmptyState();
    const trainingDemon = ownedDemons.find((demon) => {
      const cost = Number(demon.training?.cost);
      return !demon.training?.maxed
        && Number.isFinite(cost)
        && cost > 0;
    });
    const trainingCost = Number(trainingDemon?.training?.cost) || 0;
    const canAffordTraining = Boolean(trainingDemon && Number(state.player?.souls) >= trainingCost);
    const trainable = ownedDemons.find((demon) => {
      const cost = Number(demon.training?.cost);
      return !demon.training?.maxed
        && Number.isFinite(cost)
        && cost > 0
        && Number(state.player?.souls) >= cost;
    });
    window.AmongDemons?.tutorial?.emit?.('collection-ready', {
      trainingDemonId: trainingDemon?.id || null,
      trainingCost,
      canAffordTraining,
      trainableDemonId: trainable?.id || null,
      readyUnownedKey: [...state.echoItems.values()].find(item => item.summonReady)?.itemKey || ''
    });
  }

  function renderDemonCards(demons) {
    return demons.map((demon, index) => demon.isMissing
      ? renderMissingDemonCard(demon, index)
      : renderOwnedDemonCard(demon, index)
    ).join('');
  }

  function renderOwnedDemonCard(demon, index) {
    return `
      <div class="collection-grid-item">
        ${renderSharedDemonCard(withTypeName(demon), {
          className: 'collection-demon-card',
          ...getCollectionCardImageOptions(demon, index),
          overlayHtml: renderTrainingCardBadge(demon),
          statsOptions: {
            hideHpBar: true
          },
          attributes: {
            'data-demon-id': demon.id,
            role: 'button',
            tabindex: '0'
          }
        })}
      </div>
    `;
  }

  function renderMissingDemonCard(demon, index) {
    const typeName = getTypeName(demon.typeId);
    const rarity = capitalize(demon.rarity);
    const echo = getEchoItemForDemon(demon);
    const requirement = echo?.summonRequirement || DEFAULT_ECHO_REQUIREMENTS[String(demon.rarity || '').toLowerCase()] || '—';
    const progress = echo ? echo.summonProgress : 0;
    const footer = `<div class="collection-missing-label outline">${escapeHtml(`${progress} / ${requirement}`)}</div>`;

    return `
      <div class="collection-grid-item collection-grid-item-missing">
        ${renderSharedDemonCard(withTypeName(demon), {
          className: 'collection-demon-card collection-missing-card',
          ...getCollectionCardImageOptions(demon, index),
          showStats: false,
          footerHtml: footer,
          overlayHtml: COLLECTION_LOCK_ICON,
          attributes: {
            'data-demon-id': demon.id,
            'data-echo-key': echo?.itemKey || '',
            role: 'button',
            tabindex: '0',
            'aria-label': `View details for missing ${rarity} ${typeName}`,
            title: `Missing ${rarity} ${typeName}`
          }
        })}
      </div>
    `;
  }

  function getCollectionCardImageOptions(demon, index) {
    return {
      imageUrl: getCollectionCardImageUrl(demon),
      imageLoading: index < EAGER_CARD_IMAGE_COUNT ? 'eager' : 'lazy',
      imageFetchPriority: index < HIGH_PRIORITY_CARD_IMAGE_COUNT ? 'high' : 'auto'
    };
  }

  function getCollectionCardImageUrl(demon) {
    const sourceDemonId = Number(demon?.sourceDemonId || demon?.source_demon_id);
    if (Number.isInteger(sourceDemonId) && sourceDemonId > 0) {
      return `/app/images/demons/portrait/${sourceDemonId}.webp?v=art-570e7495b84f`;
    }

    const imageUrl = String(demon?.imageUrl || demon?.image_url || '');
    const sourceMatch = /^\/app\/images\/demons\/(\d+)\.png(?:[?#].*)?$/.exec(imageUrl);
    return sourceMatch
      ? `/app/images/demons/portrait/${sourceMatch[1]}.webp?v=art-570e7495b84f`
      : imageUrl;
  }

  function getVisibleCollectionSlots(ownedDemons = getOwnedDemons()) {
    const ownedBySlot = new Map(ownedDemons.map((demon) => [getSlotKeyForDemon(demon), demon]));

    return state.catalog
      .map((asset) => ownedBySlot.get(getSlotKey(asset.type, asset.rarity)) || createMissingDemon(asset))
      .filter((demon) => !state.filters.hideMissing || !demon.isMissing)
      .filter(matchesFilters)
      .sort(compareCollectionSlots);
  }

  function getOwnedDemons() {
    const ownedBySlot = new Map();

    state.collection.forEach((demon) => {
      const slotKey = getSlotKeyForDemon(demon);
      if (slotKey && !ownedBySlot.has(slotKey)) {
        ownedBySlot.set(slotKey, demon);
      }
    });

    return [...ownedBySlot.values()];
  }

  function createMissingDemon(asset) {
    const typeId = Number(asset.type);

    return {
      id: `missing-${asset.id}`,
      sourceDemonId: asset.id,
      typeId,
      species: getTypeName(typeId),
      rarity: asset.rarity,
      imageUrl: asset.image_url || asset.imageUrl,
      preferredPosition: asset.preferredPosition || state.types[String(typeId)]?.preferredPosition || '',
      role: state.types[String(typeId)]?.role || '',
      isMissing: true
    };
  }

  function withTypeName(demon) {
    const typeId = demon.typeId || demon.type;
    const type = state.types[String(typeId)] || {};
    return {
      ...demon,
      typeName: type.name || (typeId ? `Type ${typeId}` : ''),
      preferredPosition: demon.preferredPosition || type.preferredPosition || '',
      role: demon.role || type.role || ''
    };
  }

  async function loadDemonTypes() {
    if (Object.keys(state.types).length) return state.types;
    await loadGameCatalog();
    return state.types;
  }

  async function loadDemonCatalog() {
    if (state.catalog.length) return state.catalog;
    await loadGameCatalog();
    return state.catalog;
  }

  async function loadGameCatalog() {
    if (Object.keys(state.types).length && state.catalog.length) return;
    if (!gameCatalogPromise) {
      gameCatalogPromise = api('/api/game/catalog?v=20260722-request-optimization-v1')
        .then((payload) => {
          state.types = payload?.types || {};
          state.catalog = Array.isArray(payload?.demons) ? payload.demons : [];
        })
        .catch((error) => {
          gameCatalogPromise = null;
          throw error;
        });
    }
    await gameCatalogPromise;
  }

  function populateFilters() {
    elements.typeFilter.innerHTML = [
      '<option value="all">All Types</option>',
      ...getCatalogTypeIds().map((typeId) => {
        const typeName = getTypeName(typeId);
        return `<option value="${escapeHtml(typeId)}">${escapeHtml(typeName)}</option>`;
      })
    ].join('');
    elements.typeFilter.value = getSelectValue(elements.typeFilter, state.filters.type);
    state.filters.type = elements.typeFilter.value;

    elements.rarityFilter.innerHTML = [
      '<option value="all">All Rarities</option>',
      ...RARITIES.map((rarity) => (
        `<option value="${escapeHtml(rarity)}">${escapeHtml(capitalize(rarity))}</option>`
      ))
    ].join('');
    elements.rarityFilter.value = getSelectValue(elements.rarityFilter, state.filters.rarity);
    state.filters.rarity = elements.rarityFilter.value;
    elements.hideMissingFilter.checked = state.filters.hideMissing;
  }

  function matchesFilters(demon) {
    return (state.filters.type === 'all' || String(demon.typeId || demon.type) === state.filters.type)
      && (state.filters.rarity === 'all' || demon.rarity === state.filters.rarity);
  }

  function compareCollectionSlots(a, b) {
    if (state.filters.sort === 'default') {
      return compareNumber(a.typeId, b.typeId)
        || compareNumber(getRarityRank(a.rarity), getRarityRank(b.rarity));
    }

    if (a.isMissing !== b.isMissing) return a.isMissing ? 1 : -1;

    return compareNumber(b[state.filters.sort], a[state.filters.sort])
      || compareNumber(a.typeId, b.typeId)
      || compareNumber(getRarityRank(a.rarity), getRarityRank(b.rarity))
      || compareNumber(b.hp, a.hp)
      || compareNumber(b.id, a.id);
  }

  function renderSummary(shownCount, collectedCount, totalSlots) {
    if (!state.isAuthenticated) {
      return `Sign in to track your collection. All ${totalSlots} demon slots are shown as missing.`;
    }

    const collectedText = `${collectedCount} of ${totalSlots} demon slots collected.`;
    const shownText = shownCount === totalSlots && !state.filters.hideMissing
      ? ''
      : ` ${shownCount} shown.`;

    return `${collectedText}${shownText}`;
  }

  function getDemonDetailsActions(demon) {
    if (demon.isMissing) {
      const echo = getEchoItemForDemon(demon);
      return [
        {
          label: 'Get Echoes',
          variant: echo ? 'outline-light' : 'primary',
          href: '/dungeon'
        },
        ...(echo ? [
          {
            label: state.pendingEchoKey === echo.itemKey && state.pendingEchoAction === 'summon' ? 'Summoning...' : 'Summon',
            className: 'collection-summon-action',
            variant: 'primary',
            disabled: !echo.summonReady || Boolean(state.pendingEchoKey),
            onClick: () => performEchoAction(demon, 'summon')
          }
        ] : [])
      ];
    }

    return getTrainingActions(demon);
  }

  function getEchoItemForDemon(demon) {
    const typeId = Number(demon?.typeId || demon?.type);
    const rarity = String(demon?.rarity || '').toLowerCase();
    if (!typeId || !rarity) return null;
    const itemKey = `echo:${typeId}:${rarity}`;
    const requirement = state.echoConfig.summonRequirements?.[rarity] || DEFAULT_ECHO_REQUIREMENTS[rarity];
    return state.echoItems.get(itemKey) || (requirement ? {
      itemKey, itemType: 'echo', typeId, rarity, quantity: 0,
      summonProgress: 0, summonRequirement: requirement, summonReady: false
    } : null);
  }

  function renderEchoProgress(demon) {
    const echo = getEchoItemForDemon(demon);
    if (!echo) return '<p>Extract Echoes of this species and rarity to summon this demon.</p>';
    const percent = Math.round(echo.summonProgress / echo.summonRequirement * 100);
    return `<div class="collection-echo-progress" role="status">
      <div class="collection-echo-progress-heading"><strong>${echo.summonProgress} / ${echo.summonRequirement} Echoes</strong></div>
      <progress max="${echo.summonRequirement}" value="${echo.summonProgress}" aria-label="Echo progress: ${percent}%"></progress>
      <p>${echo.summonReady ? 'Ready to summon permanently.' : `Gather ${echo.summonRequirement} Echoes of this exact species and rarity to summon permanently.`}</p>
    </div>`;
  }

  async function performEchoAction(demon, action) {
    const echo = getEchoItemForDemon(demon);
    if (!echo || state.pendingEchoKey) return;
    state.pendingEchoKey = echo.itemKey;
    state.pendingEchoAction = action;
    openCollectionDemonDetails(demon);
    const summonDelay = action === 'summon' ? startSummonRitual(demon) : 0;
    if (action === 'summon') {
      audio?.play('sfx.progression.summonAttempt', { volume: 0.86 });
    }
    try {
      const request = api(`/api/collection/echoes/${action}`, {
        method: 'POST', body: { typeId: echo.typeId, rarity: echo.rarity }
      });
      const result = action === 'summon'
        ? (await Promise.all([request, wait(summonDelay)]))[0]
        : await request;
      if (action === 'summon') stopSummonRitual();
      state.echoItems = new Map((result.echoes?.items || []).map(item => [item.itemKey, item]));
      syncPlayer(result.player);
      if (result.demon) replaceCollectionDemon(result.demon);
      state.pendingEchoKey = null;
      state.pendingEchoAction = null;
      renderCollection();
      openCollectionDemonDetails(result.demon || demon);
      if (action === 'summon') {
        audio?.play('sfx.progression.summonSuccess', { volume: 0.92 });
        window.AmongDemons?.tutorial?.emit?.('demon-summoned', { demonId: result.demon.id });
      }
    } catch (error) {
      state.pendingEchoKey = null;
      state.pendingEchoAction = null;
      if (error.status === 409) await refreshCollection();
      openCollectionDemonDetails(state.collection.find(item => getSlotKeyForDemon(item) === getSlotKeyForDemon(demon)) || demon);
      await handleCollectionError(error);
    } finally {
      state.pendingEchoKey = null;
      state.pendingEchoAction = null;
      stopSummonRitual();
    }
  }

  function startSummonRitual(demon = {}) {
    stopSummonRitual();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;

    const target = document.querySelector('#demonDetailModal.show .demon-detail-art');
    if (!target) return 0;

    const targetRect = target.getBoundingClientRect();
    const viewportRect = { width: window.innerWidth, height: window.innerHeight };
    const coreX = targetRect.left + (targetRect.width / 2);
    const coreY = targetRect.top + (targetRect.height / 2);
    const ritual = document.createElement('div');
    ritual.className = 'collection-summon-ritual';
    ritual.setAttribute('aria-hidden', 'true');
    ritual.style.setProperty('--summon-rarity', getRarityColor(demon.rarity));
    ritual.style.setProperty('--summon-core-x', `${coreX.toFixed(1)}px`);
    ritual.style.setProperty('--summon-core-y', `${coreY.toFixed(1)}px`);
    ritual.innerHTML = `
      <div class="collection-summon-vortex">${renderSummonParticles(viewportRect)}</div>
      <div class="collection-summon-core"></div>
    `;

    target.classList.add('is-summoning');
    document.body.appendChild(ritual);
    return SUMMON_REVEAL_DELAY_MS;
  }

  function stopSummonRitual() {
    document.querySelectorAll('#demonDetailModal .demon-detail-art.is-summoning')
      .forEach((art) => art.classList.remove('is-summoning'));
    document.querySelectorAll('body > .collection-summon-ritual').forEach((ritual) => ritual.remove());
  }

  function renderSummonParticles(rect) {
    const width = Math.max(360, Number(rect?.width) || 480);
    const height = Math.max(440, Number(rect?.height) || 620);
    const count = 78;

    return Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const radius = randomBetween(0.52, 0.82);
      const sx = Math.cos(angle) * width * radius;
      const sy = Math.sin(angle) * height * radius;
      const delay = randomBetween(0, 560);
      const duration = (SUMMON_REVEAL_DELAY_MS - delay) / 0.68;
      const size = randomBetween(0.55, 1.18);
      const spin = randomBetween(-260, 260);
      return `<span class="collection-summon-particle" style="--sx:${sx.toFixed(1)}px;--sy:${sy.toFixed(1)}px;--delay:${delay.toFixed(0)}ms;--duration:${duration.toFixed(0)}ms;--size:${size.toFixed(2)};--spin:${spin.toFixed(0)}deg"></span>`;
    }).join('');
  }

  function getTrainingActions(demon) {
    const training = demon.training || {};
    const cost = Number(training.cost);
    if (training.maxed || !Number.isFinite(cost) || cost <= 0) return [];

    const canAfford = Number(state.player?.souls) >= cost;
    const deficit = Math.max(0, cost - (Number(state.player?.souls) || 0));
    const disabled = !canAfford || state.trainingDemonId === Number(demon.id);
    const chanceLabel = formatChance(training.successChance);
    const unavailableTitle = `Need ${formatNumber(deficit)} more Souls`;
    const attemptTitle = `Costs ${formatNumber(cost)} Souls${chanceLabel ? `. ${chanceLabel} success chance` : ''}`;

    return [
      {
        label: 'Auto Train',
        className: 'collection-train-action collection-train-max-action',
        variant: 'secondary',
        disabled,
        title: canAfford
          ? 'Auto-train keeps trying automatically.'
          : unavailableTitle,
        onClick: () => openAutoTrainModal(demon.id)
      },
      {
        label: 'Train',
        className: 'collection-train-action collection-train-once-action',
        variant: canAfford ? 'primary' : 'outline-danger',
        disabled,
        title: canAfford ? attemptTitle : unavailableTitle,
        onClick: (modalDemon, button) => trainDemon(demon.id, button, 'once')
      }
    ];
  }

  function openCollectionDemonDetails(demon) {
    openDemonDetailsModal(withTypeName(demon), {
      actionsLeadHtml: demon.isMissing ? renderEchoProgress(demon) : renderTrainingActionCost(demon),
      actions: getDemonDetailsActions(demon)
    });
    applyModalTrainingStats(demon);
  }

  function renderTrainingCardBadge(demon) {
    const training = demon.training || {};
    if (!training.stats) return '';

    if (training.maxed) return '';

    const cost = Number(training.cost);
    if (!Number.isFinite(cost) || cost <= 0) return '';

    return `
      <div class="collection-training-badge" aria-label="Training costs ${escapeHtml(formatNumber(cost))} Souls">
        <span>Train</span>
      </div>
    `;
  }

  function renderTrainingActionCost(demon) {
    const training = demon.training || {};
    const cost = Number(training.cost);
    if (training.maxed || !Number.isFinite(cost) || cost <= 0) return '';

    const playerSouls = Number(state.player?.souls) || 0;
    const canAfford = playerSouls >= cost;
    const deficit = Math.max(0, cost - playerSouls);
    const chanceLabel = formatChance(training.successChance);

    return `
      <div class="collection-training-action-cost" aria-label="Training costs ${escapeHtml(formatNumber(cost))} Souls per attempt${chanceLabel ? ` with a ${escapeHtml(chanceLabel)} success chance` : ''}. ${canAfford ? 'You have enough souls.' : `You need ${escapeHtml(formatNumber(deficit))} more souls.`}">
        <div class="collection-training-action-head">
          ${canAfford ? '' : `<span class="collection-training-disabled-reason">Not enough Souls</span>`}
        </div>
        <div class="collection-training-action-row">
          <span class="collection-training-cost-label">Cost</span>
          ${renderSoulAmount(formatNumber(cost), {
            className: 'soul-chip collection-training-action-souls',
            ariaLabel: `${formatNumber(cost)} Souls`
          })}
        </div>
        ${chanceLabel ? `
          <div class="collection-training-action-row collection-training-chance">
            <span class="collection-training-cost-label">Chance</span>
            <strong>${escapeHtml(chanceLabel)}</strong>
          </div>
        ` : ''}
      </div>
    `;
  }

  function formatTrainingStatValue(stat) {
    const current = Number(stat.current) || 0;
    const max = Math.max(current, Number(stat.max) || current || 1);
    return stat.maxed ? `${max}` : `${current} / ${max}`;
  }

  function openAutoTrainModal(demonId) {
    const demon = state.collection.find((item) => Number(item.id) === Number(demonId));
    if (!demon || demon.training?.maxed || state.autoTrainRunning) return;

    const availableSouls = Math.max(0, Math.floor(Number(state.player?.souls) || 0));
    state.autoTrainDemonId = Number(demon.id);
    elements.autoTrainDemonRarity.textContent = capitalize(demon.rarity || 'common');
    elements.autoTrainDemonName.textContent = demon.species || getTypeName(demon.typeId) || 'Demon';
    elements.autoTrainModal.style.setProperty('--auto-train-rarity-color', getRarityColor(demon.rarity));
    elements.autoTrainSoulBalance.innerHTML = renderSoulAmount(formatNumber(availableSouls), {
      className: 'soul-chip collection-auto-train-souls',
      ariaLabel: `${formatNumber(availableSouls)} Souls available`
    });
    elements.autoTrainSoulSlider.max = String(availableSouls);
    elements.autoTrainSoulSlider.value = '0';
    elements.autoTrainSummary.textContent = '';
    elements.autoTrainLog.innerHTML = '<p class="collection-auto-train-empty mb-0">Training attempts will appear here.</p>';
    syncAutoTrainBudget();

    const showAutoTrainModal = () => {
      bootstrap.Modal.getOrCreateInstance(elements.autoTrainModal).show();
    };
    const detailModal = document.getElementById('demonDetailModal');
    if (detailModal?.classList.contains('show')) {
      detailModal.addEventListener('hidden.bs.modal', showAutoTrainModal, { once: true });
      bootstrap.Modal.getOrCreateInstance(detailModal).hide();
      return;
    }

    showAutoTrainModal();
  }

  function syncAutoTrainBudget() {
    const demon = getAutoTrainDemon();
    const selectedSouls = Math.max(0, Math.floor(Number(elements.autoTrainSoulSlider.value) || 0));
    const availableSouls = Math.max(0, Math.floor(Number(elements.autoTrainSoulSlider.max) || 0));
    const cost = Math.max(0, Number(demon?.training?.cost) || 0);
    const canTrain = Boolean(demon) && !demon.training?.maxed && cost > 0 && selectedSouls >= cost;

    elements.autoTrainSoulSelected.textContent = formatNumber(selectedSouls);
    elements.autoTrainSubmitBtn.disabled = state.autoTrainRunning || !canTrain;
    elements.autoTrainSoulSlider.disabled = state.autoTrainRunning || !demon || demon.training?.maxed;
    elements.autoTrainBudgetHint.textContent = demon?.training?.maxed
      ? 'This demon has reached its maximum stats.'
      : selectedSouls < cost
        ? `Choose at least ${formatNumber(cost)} Souls for one attempt.`
        : `The server may spend up to ${formatNumber(selectedSouls)} Souls and will never exceed this amount.`;

    elements.autoTrainModal.querySelectorAll('[data-auto-train-percent]').forEach((button) => {
      const buttonSouls = Math.floor(availableSouls * (Number(button.dataset.autoTrainPercent) || 0) / 100);
      button.disabled = state.autoTrainRunning || availableSouls <= 0 || demon?.training?.maxed;
      button.classList.toggle('active', selectedSouls === buttonSouls);
      button.setAttribute('aria-pressed', String(selectedSouls === buttonSouls));
    });
  }

  function getAutoTrainDemon() {
    return state.collection.find((item) => Number(item.id) === Number(state.autoTrainDemonId)) || null;
  }

  async function autoTrainDemon() {
    const demon = getAutoTrainDemon();
    const maxSouls = Math.max(0, Math.floor(Number(elements.autoTrainSoulSlider.value) || 0));
    const cost = Math.max(0, Number(demon?.training?.cost) || 0);
    if (!demon || state.autoTrainRunning || demon.training?.maxed || maxSouls < cost) return;

    state.autoTrainRunning = true;
    state.trainingDemonId = Number(demon.id);
    elements.autoTrainSummary.textContent = 'Training in progress...';
    elements.autoTrainLog.innerHTML = '<p class="collection-auto-train-empty mb-0">The server is resolving each attempt...</p>';
    setAutoTrainRunning(true);

    try {
      const result = await api(`/api/demons/${encodeURIComponent(demon.id)}/train`, {
        method: 'POST',
        body: { mode: 'max', maxSouls }
      });

      replaceCollectionDemon(result.demon);
      syncPlayer(result.player);
      renderCollection();
      renderAutoTrainResult(result.training || {});
      audio?.play(
        Number(result.training?.succeededCount) > 0
          ? 'sfx.progression.trainingSuccess'
          : 'sfx.progression.trainingFailure',
        { volume: 0.88 }
      );
      syncAutoTrainBalance(result.player);
      window.AmongDemons?.tutorial?.emit?.('demon-trained', { demonId: demon.id, mode: 'max' });
    } catch (error) {
      if (error.status === 401) {
        await handleCollectionError(error);
      }
      renderAutoTrainError(error);
    } finally {
      state.autoTrainRunning = false;
      state.trainingDemonId = null;
      setAutoTrainRunning(false);
      syncAutoTrainBudget();
    }
  }

  function setAutoTrainRunning(running) {
    setTrainingButtonBusy(elements.autoTrainSubmitBtn, running);
    elements.autoTrainModal.querySelectorAll('[data-auto-train-close]').forEach((button) => {
      button.disabled = running;
    });
    syncAutoTrainBudget();
  }

  function syncAutoTrainBalance(player) {
    const availableSouls = Math.max(0, Math.floor(Number(player?.souls) || 0));
    elements.autoTrainSoulBalance.innerHTML = renderSoulAmount(formatNumber(availableSouls), {
      className: 'soul-chip collection-auto-train-souls',
      ariaLabel: `${formatNumber(availableSouls)} Souls available`
    });
    elements.autoTrainSoulSlider.max = String(availableSouls);
    elements.autoTrainSoulSlider.value = '0';
  }

  function renderAutoTrainResult(training = {}) {
    const attempts = Array.isArray(training.attemptLog) ? training.attemptLog : [];
    const succeededCount = Math.max(0, Number(training.succeededCount) || 0);
    const spent = Math.max(0, Number(training.spent) || 0);
    const attemptLabel = `${attempts.length} attempt${attempts.length === 1 ? '' : 's'}`;
    const successLabel = `${succeededCount} successful`;
    elements.autoTrainSummary.textContent = `${attemptLabel} · ${successLabel} · ${formatNumber(spent)} Souls spent · ${formatAutoTrainStopReason(training.stoppedReason)}`;

    elements.autoTrainLog.innerHTML = attempts.length
      ? attempts.map((attempt, index) => renderAutoTrainAttempt(attempt, index)).join('')
      : '<p class="collection-auto-train-empty mb-0">No attempts were completed.</p>';
    elements.autoTrainLog.scrollTop = 0;
  }

  function renderAutoTrainAttempt(attempt = {}, index = 0) {
    const succeeded = attempt.succeeded === true;
    const chance = formatChance(attempt.successChance);
    const stats = attempt.stats || {};
    const attemptNumber = Math.max(1, Number(attempt.number) || index + 1);

    return `
      <article class="collection-auto-train-attempt ${succeeded ? 'is-success' : 'is-failure'}">
        <div class="collection-auto-train-attempt-head">
          <strong>#${escapeHtml(attemptNumber)} ${succeeded ? 'Success' : 'Failed'}</strong>
          <span>-${escapeHtml(formatNumber(attempt.spent))} Souls</span>
        </div>
        <div class="collection-auto-train-attempt-info">
          <span>${succeeded ? renderAutoTrainIncreases(attempt.increases) : 'No stat gained'}</span>
          ${chance ? `<span>${escapeHtml(chance)} chance</span>` : ''}
        </div>
        <div class="collection-auto-train-attempt-stats" aria-label="Stats after attempt ${escapeHtml(attemptNumber)}">
          <span>HP ${escapeHtml(formatNumber(stats.hp))}</span>
          <span>ATK ${escapeHtml(formatNumber(stats.atk))}</span>
          <span>SPD ${escapeHtml(formatNumber(stats.speed))}</span>
        </div>
      </article>
    `;
  }

  function renderAutoTrainIncreases(increases = {}) {
    const labels = Object.entries(increases)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([key, amount]) => {
        const [, label] = TRAINING_STATS.find(([statKey]) => statKey === key) || [key, key];
        return `+${formatNumber(amount)} ${label}`;
      });
    return labels.length ? labels.map(escapeHtml).join(', ') : 'Ritual succeeded';
  }

  function formatAutoTrainStopReason(reason) {
    const labels = {
      maxed: 'Demon maxed out',
      budget_exhausted: 'Budget reached',
      out_of_souls: 'Soul balance reached',
      attempt_limit: 'Attempt limit reached'
    };
    return labels[reason] || 'Training complete';
  }

  function renderAutoTrainError(error) {
    const message = error?.message || error?.error || 'Auto training failed.';
    elements.autoTrainSummary.textContent = 'Auto training failed';
    elements.autoTrainLog.innerHTML = `<div class="collection-auto-train-error" role="alert">${escapeHtml(message)}</div>`;
  }

  async function trainDemon(demonId, button, mode = 'once') {
    const normalizedDemonId = Number(demonId);
    if (!normalizedDemonId || state.trainingDemonId) return;

    const demon = state.collection.find((item) => Number(item.id) === normalizedDemonId);
    if (!demon || demon.training?.maxed) return;

    state.trainingDemonId = normalizedDemonId;
    clearTrainingFeedbackArtifacts();
    syncModalTrainingAction(demon);
    setTrainingButtonBusy(button, true);
    audio?.play('sfx.progression.trainingAttempt', { volume: 0.75 });

    let revealPending = false;
    try {
      const result = await api(`/api/demons/${encodeURIComponent(normalizedDemonId)}/train`, {
        method: 'POST',
        body: { mode: mode === 'max' ? 'max' : 'once' }
      });
      revealPending = true;
      playTrainingFeedback(normalizedDemonId, result.training || {}, {
        updatedDemon: result.demon,
        player: result.player,
        button,
        mode
      });
    } catch (error) {
      if (error.status === 401) {
        await handleCollectionError(error);
      } else {
        console.error(error);
        window.AmongDemons.showGameAlert(error, { type: 'danger', context: 'training' });
      }
    } finally {
      if (!revealPending) {
        state.trainingDemonId = null;
        setTrainingButtonBusy(button, false);
        syncModalTrainingAction(demon);
      }
    }
  }

  function replaceCollectionDemon(demon) {
    if (!demon) return;

    const index = state.collection.findIndex((item) => Number(item.id) === Number(demon.id));
    if (index >= 0) {
      state.collection.splice(index, 1, demon);
      return;
    }

    state.collection.unshift(demon);
  }

  function syncPlayer(player) {
    if (!player) return;

    state.player = player;
    const session = window.AmongDemons.getSession();
    window.AmongDemons.setSession({
      ...session,
      player
    });
    updateNavAccount(player);
  }

  function setTrainingButtonBusy(button, busy) {
    if (!button) return;

    if (busy) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.classList.add('is-training');
      button.innerHTML = `
        <span class="collection-train-loading-dot" aria-hidden="true"></span>
        <span>Training...</span>
      `;
      return;
    }

    button.disabled = false;
    button.classList.remove('is-training');
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  function playTrainingFeedback(demonId, training, outcome = {}) {
    window.requestAnimationFrame(() => {
      const modal = document.getElementById('demonDetailModal');
      const art = modal?.querySelector('.demon-detail-art');

      if (modal?.classList.contains('show') && art && isModalShowingDemon(modal, outcome.updatedDemon?.id || demonId)) {
        attachTrainingBurst(art, training, 'modal', outcome);
        return;
      }

      revealTrainingOutcome(null, training, outcome);
    });
  }

  function attachTrainingBurst(target, training, variant, outcome = {}) {
    if (!target) {
      revealTrainingOutcome(null, training, outcome);
      return;
    }

    target.querySelectorAll('.collection-training-burst').forEach((burst) => burst.remove());
    const burst = document.createElement('div');
    burst.className = `collection-training-burst collection-training-burst-${variant}`;
    burst.setAttribute('aria-hidden', 'true');
    burst.innerHTML = `
      <div class="collection-training-vortex">
        ${renderTrainingConvergeParticles(target)}
      </div>
      <div class="collection-training-core"></div>
    `;

    target.appendChild(burst);
    target.classList.add('is-training-fed');
    state.trainingResultTimer = window.setTimeout(() => {
      revealTrainingOutcome(target, training, outcome);
    }, TRAINING_REVEAL_DELAY_MS);
    window.setTimeout(() => {
      burst.remove();
      target.classList.remove('is-training-fed');
    }, TRAINING_BURST_CLEANUP_MS);
  }

  function revealTrainingOutcome(target, training, outcome = {}) {
    state.trainingResultTimer = null;
    state.trainingDemonId = null;
    setTrainingButtonBusy(outcome.button, false);
    audio?.play(
      training.succeeded === false
        ? 'sfx.progression.trainingFailure'
        : 'sfx.progression.trainingSuccess',
      { volume: 0.88 }
    );

    if (outcome.updatedDemon) {
      replaceCollectionDemon(outcome.updatedDemon);
    }
    syncPlayer(outcome.player);
    if (outcome.updatedDemon) {
      renderCollection();
    }

    const modal = document.getElementById('demonDetailModal');
    if (
      modal?.classList.contains('show')
      && (!outcome.updatedDemon || isModalShowingDemon(modal, outcome.updatedDemon.id))
    ) {
      const resultTarget = target && document.body.contains(target)
        ? target
        : modal.querySelector('.demon-detail-art');

      if (outcome.updatedDemon) {
        syncModalTrainingStats(outcome.updatedDemon);
        syncModalTrainingAction(outcome.updatedDemon);
      }

      if (resultTarget && document.body.contains(resultTarget)) {
        showTrainingResult(resultTarget, training);
      }
    }
    window.AmongDemons?.tutorial?.emit?.('demon-trained', {
      demonId: outcome.updatedDemon?.id || null,
      mode: outcome.mode || 'once'
    });
  }

  function showTrainingResult(target, training) {
    state.trainingResultTimer = null;
    const modal = target.closest('#demonDetailModal');
    if (!modal?.classList.contains('show') || !document.body.contains(target)) return;

    target.querySelectorAll('.collection-training-result-pop').forEach((result) => result.remove());
    const result = document.createElement('button');
    result.type = 'button';
    result.className = 'collection-training-result-pop';
    result.setAttribute('aria-label', 'Dismiss training result');
    result.innerHTML = renderIncreaseChips(training);
    result.addEventListener('click', () => result.remove());
    modal.addEventListener('hidden.bs.modal', () => result.remove(), { once: true });
    target.appendChild(result);
  }

  function syncModalTrainingStats(demon) {
    const modal = document.getElementById('demonDetailModal');
    if (!modal?.classList.contains('show')) return;
    applyModalTrainingStats(demon, modal);
  }

  function setModalDetailStat(modal, statKey, value) {
    const statValue = modal.querySelector(`[data-detail-stat="${statKey}"] .demon-detail-stat-value`);
    if (statValue) statValue.textContent = value;
  }

  function applyModalTrainingStats(demon, modal) {
    const targetModal = modal || document.getElementById('demonDetailModal');
    if (!targetModal) return;

    const training = demon.training || {};
    if (!training.stats) return;

    TRAINING_STATS.forEach(([key]) => {
      const stat = training.stats[key];
      if (!stat) return;
      setModalDetailStat(targetModal, key, formatTrainingStatValue(stat));
    });

  }

  function syncModalTrainingAction(demon) {
    const modal = document.getElementById('demonDetailModal');
    const actions = modal?.querySelector('.demon-detail-actions');
    if (!modal) return;

    const training = demon.training || {};
    const cost = Number(training.cost);
    if (training.maxed || !Number.isFinite(cost) || cost <= 0) {
      actions?.remove();
      return;
    }

    if (!actions) return;
    const lead = actions.querySelector('.demon-detail-action-lead');
    if (lead) lead.innerHTML = renderTrainingActionCost(demon);

    getTrainingActions(demon).forEach((action, index) => {
      const button = actions.querySelector(`[data-demon-detail-action="${index}"]`);
      if (!button) return;

      button.disabled = Boolean(action.disabled);
      button.className = getTrainingButtonClass(action);
      button.title = action.title || '';
      button.innerHTML = renderTrainingButtonContent(action.label, action.helper);
    });
  }

  function getTrainingButtonClass(action = {}) {
    const variant = action.variant || 'outline-light';
    const normalized = String(variant || '').toLowerCase();
    const glassClass = normalized.includes('danger')
      ? 'btn-glass-danger'
      : normalized.startsWith('outline-') || normalized.includes('secondary') || normalized.includes('light')
        ? 'btn-glass-muted'
        : '';
    return ['btn', `btn-${variant}`, glassClass, action.className || 'collection-train-action'].filter(Boolean).join(' ');
  }

  function renderTrainingButtonContent(label, helper = '') {
    return `
      <span>${escapeHtml(label)}</span>
      ${helper ? `<small>${escapeHtml(helper)}</small>` : ''}
    `;
  }

  function isModalShowingDemon(modal, demonId) {
    if (!demonId) return false;

    const layout = modal.querySelector('.demon-detail-layout');
    return layout?.dataset.detailDemonId === String(demonId);
  }

  function clearTrainingFeedbackArtifacts() {
    if (state.trainingResultTimer) {
      window.clearTimeout(state.trainingResultTimer);
      state.trainingResultTimer = null;
    }

    document.querySelectorAll('.collection-training-burst, .collection-training-result-pop').forEach((item) => item.remove());
    document.querySelectorAll('.demon-detail-art.is-training-fed').forEach((item) => item.classList.remove('is-training-fed'));
  }

  function renderTrainingConvergeParticles(target) {
    const rect = target.getBoundingClientRect();
    const width = Math.max(240, rect.width || 320);
    const height = Math.max(240, rect.height || 320);
    const count = 56;

    return Array.from({ length: count }, (item, index) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = randomBetween(0.48, 0.74);
      const sx = Math.cos(angle) * width * radius;
      const sy = Math.sin(angle) * height * radius;
      const delay = randomBetween(0, 520);
      const duration = (TRAINING_REVEAL_DELAY_MS - delay) / 0.68;
      const size = randomBetween(0.42, 0.9);
      const spin = randomBetween(-220, 220);

      return `
        <span
          class="collection-training-particle"
          style="--sx: ${sx.toFixed(1)}px; --sy: ${sy.toFixed(1)}px; --delay: ${delay.toFixed(0)}ms; --duration: ${duration.toFixed(0)}ms; --size: ${size.toFixed(2)}; --spin: ${spin.toFixed(0)}deg;"
        ></span>
      `;
    }).join('');
  }

  function renderIncreaseChips(training = {}) {
    const spent = Math.max(0, Number(training.spent) || 0);
    if (training.succeeded === false) {
      return [
        '<span class="is-failure">Ritual failed</span>',
        renderTrainingSpentChip(spent)
      ].filter(Boolean).join('');
    }

    const increases = training.increases || {};
    const chips = Object.entries(increases)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([key, amount]) => {
        const [, label, icon] = TRAINING_STATS.find(([statKey]) => statKey === key) || [key, key, 'stars'];
        return `<span>${renderIcon(icon)}+${escapeHtml(amount)} ${escapeHtml(label)}</span>`;
      });

    const spentChip = renderTrainingSpentChip(spent);
    if (spentChip) chips.push(spentChip);

    return chips.length ? chips.join('') : '<span>Ritual complete</span>';
  }

  function renderTrainingSpentChip(spent) {
    const amount = Math.max(0, Number(spent) || 0);
    if (!amount) return '';

    return `
      <span class="collection-training-spent-pill" aria-label="${escapeHtml(formatNumber(amount))} Souls spent">
        <strong class="collection-training-spent-minus">-${escapeHtml(formatNumber(amount))}</strong>
        ${renderIcon('soul', { size: 18, className: 'collection-training-spent-icon' })}
      </span>
    `;
  }

  function formatChance(value) {
    const chance = Number(value);
    if (!Number.isFinite(chance) || chance <= 0) return '';

    const percent = chance <= 1 ? chance * 100 : chance;
    return `${Math.max(1, Math.min(100, Math.round(percent)))}%`;
  }

  function renderEmptyState() {
    return `
      <div class="collection-grid-full">
        <div class="empty-state collection-empty-state">
          <img src="/app/images/amongdemons_logo_250x250.png" alt="Among Demons logo" width="250" height="250" loading="lazy" decoding="async">
          <div>
            <h2 class="h5 mb-2">No demons bound yet</h2>
            <p class="text-muted mb-0">Extract from the dungeon with a demon to add it here.</p>
          </div>
          <a class="btn btn-primary" href="/dungeon">
            ${renderIcon('play')}
            Start Dungeon
          </a>
        </div>
      </div>
    `;
  }

  function renderNoMatchesState() {
    return `
      <div class="collection-grid-full">
        <div class="empty-state collection-empty-state">
          <img src="/app/images/amongdemons_logo_250x250.png" alt="Among Demons logo" width="250" height="250" loading="lazy" decoding="async">
          <div>
            <h2 class="h5 mb-2">No demons answer these filters</h2>
            <p class="text-muted mb-0">Choose another type or rarity to reveal more slots.</p>
          </div>
        </div>
      </div>
    `;
  }

  function getCatalogTypeIds() {
    const typeIds = [
      ...Object.keys(state.types).map(Number),
      ...state.catalog.map((demon) => Number(demon.type))
    ].filter(Boolean);

    return [...new Set(typeIds)].sort((a, b) => a - b);
  }

  function getTotalSlots() {
    return state.catalog.length;
  }

  function getTypeName(typeId) {
    return state.types[String(typeId)]?.name || `Type ${typeId}`;
  }

  function getSelectValue(select, preferredValue) {
    return [...select.options].some((option) => option.value === preferredValue)
      ? preferredValue
      : 'all';
  }

  function getSlotKeyForDemon(demon) {
    return getSlotKey(demon.typeId || demon.type, demon.rarity);
  }

  function getSlotKey(typeId, rarity) {
    const normalizedTypeId = Number(typeId);
    const normalizedRarity = String(rarity || '').toLowerCase();

    return normalizedTypeId && normalizedRarity
      ? `${normalizedTypeId}:${normalizedRarity}`
      : '';
  }

  function getRarityRank(rarity) {
    return RARITY_ORDER[rarity] || 0;
  }

  function compareNumber(a, b) {
    return (Number(a) || 0) - (Number(b) || 0);
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString() : String(value || '');
  }

  function wait(milliseconds) {
    const delay = Math.max(0, Number(milliseconds) || 0);
    return delay ? new Promise((resolve) => window.setTimeout(resolve, delay)) : Promise.resolve();
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function syncFiltersToggle() {
    elements.collectionControlsPanel.classList.toggle('is-mobile-open', state.filtersOpen);
    elements.filtersToggleBtn.setAttribute('aria-expanded', String(state.filtersOpen));
    const label = elements.filtersToggleBtn.querySelector('span');
    if (label) label.textContent = state.filtersOpen ? 'Hide Filters' : 'Show Filters';
  }

  function syncAuthenticatedUi() {
    if (!state.isAuthenticated) {
      state.filters = {
        type: 'all',
        rarity: 'all',
        sort: 'default',
        hideMissing: false
      };
      state.filtersOpen = false;
    }

    elements.collectionControlsPanel.classList.toggle('d-none', !state.isAuthenticated);
    elements.filtersToggleBtn.classList.toggle('d-none', !state.isAuthenticated);
  }

  async function handleCollectionError(error) {
    if (error.status === 401) {
      window.AmongDemons.clearSession();
      state.isAuthenticated = false;
      state.player = null;
      state.collection = [];
      state.echoItems = new Map();
      state.echoConfig = {};
      syncAuthenticatedUi();

      try {
        await Promise.all([
          loadDemonTypes(),
          loadDemonCatalog()
        ]);
        populateFilters();
        renderCollection();
      } catch (publicError) {
        console.error(publicError);
      }

      return;
    }

    console.error(error);
    window.AmongDemons.showGameAlert(error, { type: 'danger', context: 'collection' });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function capitalize(value) {
    if (!value) return '';
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();
