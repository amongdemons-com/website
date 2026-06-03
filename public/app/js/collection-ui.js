(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const renderSharedDemonCard = window.AmongDemons.ui.renderDemonCard;
  const openDemonDetailsModal = window.AmongDemons.ui.openDemonDetailsModal;
  const renderIcon = window.AmongDemons.ui.renderIcon || (() => '');
  const renderSoulAmount = window.AmongDemons.ui.renderSoulAmount || ((value) => `${value} Souls`);
  const updateNavAccount = window.AmongDemons.ui.updateNavAccount || (() => {});
  const clearNavAccount = window.AmongDemons.ui.clearNavAccount || (() => {});
  const TRAINING_STATS = [
    ['hp', 'HP', 'hp'],
    ['atk', 'Attack', 'attack'],
    ['speed', 'Speed', 'speed']
  ];
  const TRAINING_REVEAL_DELAY_MS = 2850;
  const TRAINING_BURST_CLEANUP_MS = 5200;
  const RARITY_ORDER = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6
  };
  const RARITIES = Object.keys(RARITY_ORDER);
  const state = {
    player: window.AmongDemons.getSession().player || null,
    collection: [],
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
    trainingResultTimer: null
  };
  const elements = {};

  onReady(init);

  async function init() {
    cacheElements();
    bindActions();
    syncAuthenticatedUi();
    syncFiltersToggle();
    await refreshCollection();
  }

  function cacheElements() {
    [
      'navPlayerName',
      'collectionSummary',
      'collectionMessage',
      'collectionCount',
      'collectionGrid',
      'typeFilter',
      'rarityFilter',
      'sortOrder',
      'hideMissingFilter',
      'filtersToggleBtn',
      'collectionControlsPanel'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });

    elements.refreshBtn = document.getElementById('refreshBtn');
    elements.logoutBtn = document.getElementById('logoutBtn');
  }

  function bindActions() {
    elements.logoutBtn.addEventListener('click', () => {
      window.AmongDemons.clearSession();
      window.location.href = '/login';
    });

    elements.refreshBtn.addEventListener('click', refreshCollection);

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
    await withBusy(elements.refreshBtn, async () => {
      setMessage('', 'danger');
      state.isAuthenticated = Boolean(window.AmongDemons.getToken());
      syncAuthenticatedUi();

      try {
        if (state.isAuthenticated) {
          const [me, demons] = await Promise.all([
            api('/api/auth/me'),
            api('/api/demons'),
            loadDemonTypes(),
            loadDemonCatalog()
          ]);

          state.player = me.player;
          state.collection = demons.demons || [];
        } else {
          state.player = null;
          state.collection = [];
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
    });
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
  }

  function renderDemonCards(demons) {
    return demons.map((demon) => demon.isMissing
      ? renderMissingDemonCard(demon)
      : renderOwnedDemonCard(demon)
    ).join('');
  }

  function renderOwnedDemonCard(demon) {
    return `
      <div class="collection-grid-item">
        ${renderSharedDemonCard(withTypeName(demon), {
          className: 'collection-demon-card',
          overlayHtml: renderTrainingCardBadge(demon),
          attributes: {
            'data-demon-id': demon.id,
            role: 'button',
            tabindex: '0'
          }
        })}
      </div>
    `;
  }

  function renderMissingDemonCard(demon) {
    const typeName = getTypeName(demon.typeId);
    const rarity = capitalize(demon.rarity);

    return `
      <div class="collection-grid-item collection-grid-item-missing">
        ${renderSharedDemonCard(withTypeName(demon), {
          className: 'collection-demon-card collection-missing-card',
          showStats: false,
          footerHtml: '<div class="collection-missing-label">Missing</div>',
          attributes: {
            'data-demon-id': demon.id,
            role: 'button',
            tabindex: '0',
            'aria-label': `View details for missing ${rarity} ${typeName}`,
            title: `Missing ${rarity} ${typeName}`
          }
        })}
      </div>
    `;
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
    state.types = await api('/api/game/demon-types');
    return state.types;
  }

  async function loadDemonCatalog() {
    if (state.catalog.length) return state.catalog;
    state.catalog = await api('/api/game/demons');
    return state.catalog;
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
      return [
        {
          label: 'Enter Dungeon',
          icon: 'play',
          variant: 'primary',
          href: '/dungeon'
        }
      ];
    }

    const training = demon.training || {};
    const cost = Number(training.cost);
    if (training.maxed || !Number.isFinite(cost) || cost <= 0) return [];

    const canAfford = Number(state.player?.souls) >= cost;
    const deficit = Math.max(0, cost - (Number(state.player?.souls) || 0));
    return [
      {
        label: canAfford ? 'Train' : `Need ${formatNumber(deficit)} Souls`,
        variant: canAfford ? 'success' : 'outline-danger',
        disabled: !canAfford || state.trainingDemonId === Number(demon.id),
        title: canAfford ? `Costs ${formatNumber(cost)} Souls` : `Need ${formatNumber(deficit)} more Souls`,
        onClick: (modalDemon, button) => trainDemon(demon.id, button)
      }
    ];
  }

  function openCollectionDemonDetails(demon) {
    openDemonDetailsModal(withTypeName(demon), {
      detailHtml: renderTrainingDetail(demon),
      actionsLeadHtml: renderTrainingActionCost(demon),
      actions: getDemonDetailsActions(demon)
    });
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

  function renderTrainingDetail(demon) {
    if (demon.isMissing) return '';

    const training = demon.training || {};
    if (!training.stats) return '';

    const cost = Number(training.cost);
    return `
      <div class="collection-training-panel ${training.maxed ? 'is-maxed' : ''}" aria-live="polite">
        <div class="collection-training-panel-head">
          <span>${training.maxed ? 'Stats' : 'Training'}</span>
          ${training.maxed || !Number.isFinite(cost) || cost <= 0 ? `<strong>${renderIcon('stars')}Max</strong>` : ''}
        </div>
        <div class="collection-training-stat-list">
          ${TRAINING_STATS.map(([key, label, icon]) => renderTrainingStat(training.stats[key], key, label, icon)).join('')}
        </div>
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

    return `
      <div class="collection-training-action-cost" aria-label="Training costs ${escapeHtml(formatNumber(cost))} Souls. ${canAfford ? 'You have enough souls.' : `You need ${escapeHtml(formatNumber(deficit))} more souls.`}">
        <span class="collection-training-cost-label">Training Cost</span>
        ${renderSoulAmount(formatNumber(cost), {
          className: 'soul-chip collection-training-action-souls',
          ariaLabel: `${formatNumber(cost)} Souls`
        })}
      </div>
    `;
  }

  function renderTrainingStat(stat, key, label, icon) {
    if (!stat) return '';

    const current = Number(stat.current) || 0;
    const max = Math.max(current, Number(stat.max) || current || 1);
    const percent = Math.max(0, Math.min(100, Math.round((current / max) * 100)));

    return `
      <div class="collection-training-stat ${stat.maxed ? 'is-maxed' : ''}" data-training-stat="${escapeHtml(key)}">
        <div class="collection-training-stat-line">
          <span>${renderIcon(icon)}${escapeHtml(label)}</span>
          <strong class="collection-training-stat-value">${escapeHtml(current)} / ${escapeHtml(max)}</strong>
        </div>
        <div class="collection-training-stat-track" aria-hidden="true">
          <span class="collection-training-stat-fill" style="width: ${percent}%"></span>
        </div>
      </div>
    `;
  }

  async function trainDemon(demonId, button) {
    const normalizedDemonId = Number(demonId);
    if (!normalizedDemonId || state.trainingDemonId) return;

    const demon = state.collection.find((item) => Number(item.id) === normalizedDemonId);
    if (!demon || demon.training?.maxed) return;

    state.trainingDemonId = normalizedDemonId;
    clearTrainingFeedbackArtifacts();
    setTrainingButtonBusy(button, true);
    setMessage('', 'danger');

    let revealPending = false;
    try {
      const result = await api(`/api/demons/${encodeURIComponent(normalizedDemonId)}/train`, {
        method: 'POST'
      });
      revealPending = true;
      playTrainingFeedback(normalizedDemonId, result.training || {}, {
        updatedDemon: result.demon,
        player: result.player,
        button
      });
    } catch (error) {
      if (error.status === 401) {
        await handleCollectionError(error);
      } else {
        setMessage(error.message || 'Training failed.', 'danger');
      }
    } finally {
      if (!revealPending) {
        state.trainingDemonId = null;
        setTrainingButtonBusy(button, false);
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
      button.innerHTML = 'Training...';
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

    if (outcome.updatedDemon) {
      replaceCollectionDemon(outcome.updatedDemon);
    }
    syncPlayer(outcome.player);
    if (outcome.updatedDemon) {
      renderCollection();
    }

    const modal = document.getElementById('demonDetailModal');
    if (!modal?.classList.contains('show')) return;
    if (outcome.updatedDemon && !isModalShowingDemon(modal, outcome.updatedDemon.id)) return;

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

  function showTrainingResult(target, training) {
    state.trainingResultTimer = null;
    const modal = target.closest('#demonDetailModal');
    if (!modal?.classList.contains('show') || !document.body.contains(target)) return;

    target.querySelectorAll('.collection-training-result-pop').forEach((result) => result.remove());
    const result = document.createElement('button');
    result.type = 'button';
    result.className = 'collection-training-result-pop';
    result.setAttribute('aria-label', 'Dismiss training result');
    result.innerHTML = renderIncreaseChips(training.increases || {});
    result.addEventListener('click', () => result.remove());
    modal.addEventListener('hidden.bs.modal', () => result.remove(), { once: true });
    target.appendChild(result);
  }

  function syncModalTrainingStats(demon) {
    const modal = document.getElementById('demonDetailModal');
    if (!modal?.classList.contains('show')) return;

    const currentHp = Math.max(0, Number(demon.hp) || 0);
    const maxHp = Math.max(currentHp, Number(demon.maxHp) || currentHp || 1);
    const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));

    setModalDetailStat(modal, 'atk', demon.atk);
    setModalDetailStat(modal, 'speed', demon.speed);
    setModalDetailStat(modal, 'hp', `${currentHp} / ${maxHp}`);

    const hpBar = modal.querySelector('.demon-detail-hp');
    if (hpBar) hpBar.setAttribute('aria-label', `HP ${currentHp} of ${maxHp}`);

    const hpFill = modal.querySelector('.demon-detail-hp-fill');
    if (hpFill) hpFill.style.width = `${hpPercent}%`;

    syncModalTrainingPanel(demon);
  }

  function setModalDetailStat(modal, statKey, value) {
    const statValue = modal.querySelector(`[data-detail-stat="${statKey}"] .demon-detail-stat-value`);
    if (statValue) statValue.textContent = value;
  }

  function syncModalTrainingPanel(demon) {
    const modal = document.getElementById('demonDetailModal');
    const panel = modal?.querySelector('.collection-training-panel');
    if (!panel) return;

    const training = demon.training || {};
    const cost = Number(training.cost);
    const showMaxed = training.maxed || !Number.isFinite(cost) || cost <= 0;
    panel.classList.toggle('is-maxed', showMaxed);

    const head = panel.querySelector('.collection-training-panel-head');
    if (head) {
      head.innerHTML = `
        <span>${showMaxed ? 'Stats' : 'Training'}</span>
        ${showMaxed ? `<strong>${renderIcon('stars')}Maxed out</strong>` : ''}
      `;
    }

    TRAINING_STATS.forEach(([key]) => {
      const stat = training.stats?.[key];
      const row = panel.querySelector(`[data-training-stat="${key}"]`);
      if (!stat || !row) return;

      const current = Number(stat.current) || 0;
      const max = Math.max(current, Number(stat.max) || current || 1);
      const percent = getTrainingStatPercent(stat);
      row.classList.toggle('is-maxed', Boolean(stat.maxed));

      const value = row.querySelector('.collection-training-stat-value');
      if (value) value.textContent = `${current} / ${max}`;

      const fill = row.querySelector('.collection-training-stat-fill');
      if (fill) fill.style.width = `${percent}%`;
    });
  }

  function syncModalTrainingAction(demon) {
    const modal = document.getElementById('demonDetailModal');
    const actions = modal?.querySelector('.demon-detail-actions');
    if (!actions) return;

    const training = demon.training || {};
    const cost = Number(training.cost);
    if (training.maxed || !Number.isFinite(cost) || cost <= 0) {
      actions.remove();
      return;
    }

    const canAfford = Number(state.player?.souls) >= cost;
    const deficit = Math.max(0, cost - (Number(state.player?.souls) || 0));
    const lead = actions.querySelector('.demon-detail-action-lead');
    if (lead) lead.innerHTML = renderTrainingActionCost(demon);

    const button = actions.querySelector('[data-demon-detail-action]');
    if (!button) return;

    button.disabled = !canAfford || state.trainingDemonId === Number(demon.id);
    button.className = `btn btn-${canAfford ? 'success' : 'outline-danger'}`;
    button.title = canAfford ? `Costs ${formatNumber(cost)} Souls` : `Need ${formatNumber(deficit)} more Souls`;
    button.innerHTML = canAfford ? 'Train' : `Need ${formatNumber(deficit)} Souls`;
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

  function renderIncreaseChips(increases) {
    const chips = Object.entries(increases)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([key, amount]) => {
        const [, label, icon] = TRAINING_STATS.find(([statKey]) => statKey === key) || [key, key, 'stars'];
        return `<span>${renderIcon(icon)}+${escapeHtml(amount)} ${escapeHtml(label)}</span>`;
      });

    return chips.length ? chips.join('') : '<span>Trained</span>';
  }

  function getTrainingStatPercent(stat) {
    const current = Number(stat.current) || 0;
    const max = Math.max(current, Number(stat.max) || current || 1);
    return Math.max(0, Math.min(100, Math.round((current / max) * 100)));
  }

  function renderEmptyState() {
    return `
      <div class="collection-grid-full">
        <div class="empty-state collection-empty-state">
          <img src="/app/images/amongdemons_logo_250x250.png" alt="">
          <div>
            <h2 class="h5 mb-2">No demons collected yet</h2>
            <p class="text-muted mb-0">Earn and choose demons to bring them here.</p>
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
          <img src="/app/images/amongdemons_logo_250x250.png" alt="">
          <div>
            <h2 class="h5 mb-2">No demons match these filters</h2>
            <p class="text-muted mb-0">Try another type or rarity.</p>
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
      syncAuthenticatedUi();

      try {
        await Promise.all([
          loadDemonTypes(),
          loadDemonCatalog()
        ]);
        populateFilters();
        renderCollection();
      } catch (publicError) {
        setMessage(publicError.message || 'Something went wrong.', 'danger');
      }

      return;
    }

    setMessage(error.message || 'Something went wrong.', 'danger');
  }

  function setMessage(text, type) {
    elements.collectionMessage.textContent = text;
    elements.collectionMessage.className = text ? `alert alert-${type}` : 'alert d-none';
  }

  async function withBusy(button, task) {
    button.disabled = true;
    try {
      await task();
    } finally {
      button.disabled = false;
    }
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
