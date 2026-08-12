(function() {
  'use strict';

  const API_PATH = '/api/account/tutorial';
  const TUTORIAL_ECHO_KEY = 'amongdemons-tutorial-echo-key-v1';
  const TUTORIAL_WORLD_SPOT = Object.freeze({ x: 0, y: -3 });
  const CHECKPOINTS = [
    'world-map',
    'world-team',
    'world-travel',
    'dungeon-prepare',
    'dungeon-extract',
    'bag-echo',
    'collection-training',
    'world-hunt-rewards'
  ];
  const TOTAL_MOMENTS = CHECKPOINTS.length + 1;
  const GAME_ROUTE_PATTERN = /^\/(?:camp|world|dungeon|bag|collection|skill-tree|settings|ranked|leaderboard|hunter)(?:\/|$)/;
  const model = {
    tutorial: null,
    loading: false,
    busy: false,
    initializedForToken: '',
    confirmSkip: false,
    renderQueued: false,
    localStepKey: '',
    localSteps: {
      worldTeam: 0,
      worldTravel: 0,
      dungeonExtract: 0,
      worldHuntRewards: 0,
      bag: 0
    },
    automaticUi: {
      worldMapPanelPrepared: false,
      worldTeamPanelPrepared: false,
      worldTravelSpotPrepared: false,
      worldHuntRewardsPanelPrepared: false,
      worldTeamCollectionStepPrepared: '',
      bagNavigationPrepared: false,
      collectionNavigationPrepared: false,
      collectionTrainingPrepared: false,
      skillTreeNavigationPrepared: false,
      routeNavigationPrepared: ''
    },
    eventState: {
      world: null,
      routePreviewed: false,
      worldTraveling: false,
      worldArrived: false,
      worldAmbush: null,
      worldOverlayOpen: false,
      worldHunt: { fought: false, lost: false, started: false, claimed: false },
      dungeon: null,
      bag: null,
      collection: null,
      skillTree: null
    },
    host: null,
    card: null,
    ring: null,
    target: null,
    currentView: null,
    renderKey: '',
    observer: null,
    resizeObserver: null,
    positionSettleTimer: null,
    pendingAmbushConfirmation: null,
    listenersBound: false
  };

  const tutorialApi = {
    emit,
    getState: () => model.tutorial,
    isCoreActive: () => model.loading || ['not_started', 'in_progress'].includes(model.tutorial?.status),
    canSaveWorldTeam: () => !isCurrentCheckpoint('world-team') || model.localSteps.worldTeam >= 3,
    waitForAmbushConfirmation,
    refresh,
    restart
  };
  window.AmongDemons = {
    ...(window.AmongDemons || {}),
    tutorial: tutorialApi
  };

  onReady(init);
  window.addEventListener('amongdemons:session-changed', (event) => {
    if (!event.detail?.authenticated) {
      resolvePendingAmbushConfirmation();
      destroyTutorialUi();
      model.tutorial = null;
      model.initializedForToken = '';
      return;
    }
    void init();
  });
  [
    'world-ready', 'world-map-explored', 'world-team-editor-changed', 'world-team-saved',
    'world-route-previewed', 'world-travel-started', 'world-ambush', 'world-arrived',
    'world-hunt-fight', 'world-hunt-started', 'world-hunt-claimed', 'world-overlay', 'dungeon-state',
    'dungeon-battle-start', 'dungeon-extracted', 'bag-ready', 'bag-item-opened',
    'demon-summoned', 'collection-ready', 'demon-trained', 'level-up',
    'skill-tree-ready', 'skill-tree-draft-changed', 'skill-tree-saved'
  ]
    .forEach((name) => window.addEventListener(`amongdemons:tutorial-${name}`, onTutorialEvent));

  async function init() {
    if (!isEligibleRoute() || !window.AmongDemons?.getToken?.()) return;
    ensureTutorialUi();
    bindPageObservers();
    await refresh();
  }

  async function refresh(options = {}) {
    const token = window.AmongDemons?.getToken?.() || '';
    if (!token || !isEligibleRoute()) return null;
    if (model.loading) return model.tutorial;
    if (!options.force && model.initializedForToken === token && model.tutorial) {
      render();
      return model.tutorial;
    }

    model.loading = true;
    try {
      const payload = await window.AmongDemons.api(API_PATH, { dedupe: false });
      model.tutorial = payload?.tutorial || null;
      model.initializedForToken = token;
      render();
      return model.tutorial;
    } catch (error) {
      if (error.status !== 401) console.error(error);
      return null;
    } finally {
      model.loading = false;
    }
  }

  async function restart(options = {}) {
    if (!window.AmongDemons?.getToken?.()) return null;
    const tutorial = await mutate('/restart', { method: 'POST', body: {} });
    if (!tutorial) return null;
    model.confirmSkip = false;
    resetLocalSteps();
    if (options.navigate !== false) navigate('/world');
    return tutorial;
  }

  function emit(name, detail = {}) {
    window.dispatchEvent(new CustomEvent(`amongdemons:tutorial-${name}`, { detail }));
  }

  function onTutorialEvent(event) {
    const name = event.type.replace('amongdemons:tutorial-', '');
    const detail = event.detail || {};

    if (name === 'world-ready') {
      model.eventState.world = detail;
      model.eventState.worldArrived = positionsEqual(detail.position, TUTORIAL_WORLD_SPOT);
    } else if (name === 'world-map-explored') {
      if (isCurrentCheckpoint('world-map')) {
        void advance('world-team');
        return;
      }
    } else if (name === 'world-team-editor-changed') {
      if (isCurrentCheckpoint('world-team') && detail.action === 'place') {
        if (model.localSteps.worldTeam === 0 && detail.demonPosition === 'front' && detail.slotPosition === 'front') {
          setLocalStep('worldTeam', 1, '[data-world-team-position="back"]');
        } else if (model.localSteps.worldTeam === 1 && detail.demonPosition === 'back' && detail.slotPosition === 'back') {
          setLocalStep('worldTeam', Number(detail.teamSize) >= 6 ? 3 : 2, Number(detail.teamSize) >= 6 ? '#worldTeamSaveButton' : '#worldTeamEditorCount');
        } else if (model.localSteps.worldTeam === 2 && Number(detail.teamSize) >= 6) {
          setLocalStep('worldTeam', 3, '#worldTeamSaveButton');
        }
      }
    } else if (name === 'world-team-saved') {
      model.eventState.world = { ...(model.eventState.world || {}), ...detail, ready: true };
      if (isCurrentCheckpoint('world-team') && detail.hasActiveTeam) {
        void advance('world-travel');
        return;
      }
    } else if (name === 'world-route-previewed') {
      model.eventState.routePreviewed = true;
    } else if (name === 'world-travel-started') {
      model.eventState.worldTraveling = true;
      model.eventState.worldAmbush = null;
    } else if (name === 'world-ambush') {
      model.eventState.worldAmbush = detail;
    } else if (name === 'world-arrived') {
      resolvePendingAmbushConfirmation();
      model.eventState.worldTraveling = false;
      model.eventState.worldAmbush = null;
      model.eventState.world = { ...(model.eventState.world || {}), position: detail.position, ready: true };
      model.eventState.worldArrived = positionsEqual(detail.position, TUTORIAL_WORLD_SPOT);
    } else if (name === 'world-hunt-fight') {
      model.eventState.worldHunt = { ...model.eventState.worldHunt, fought: true, lost: Boolean(detail.lost) };
    } else if (name === 'world-hunt-started') {
      model.eventState.worldHunt = { ...model.eventState.worldHunt, started: true };
    } else if (name === 'world-hunt-claimed') {
      model.eventState.worldHunt = { ...model.eventState.worldHunt, claimed: true };
      if (isCurrentCheckpoint('world-hunt-rewards')) {
        setLocalStep('worldHuntRewards', 2);
        return;
      }
    } else if (name === 'world-overlay') {
      model.eventState.worldOverlayOpen = Boolean(detail.open);
    } else if (name === 'dungeon-state') {
      model.eventState.dungeon = { ...detail, ready: true };
      if (
        isCurrentCheckpoint('dungeon-prepare')
        && detail.status === 'active'
        && detail.awaitingRecruit
        && Number(detail.currentFloor) >= 1
        && detail.canExtract
      ) {
        void advance('dungeon-extract');
        return;
      }
    } else if (name === 'dungeon-battle-start') {
      model.eventState.dungeon = { ...(model.eventState.dungeon || {}), battleActive: true, ready: true };
      if (isCurrentCheckpoint('dungeon-extract')) model.localSteps.dungeonExtract = 1;
    } else if (name === 'dungeon-extracted') {
      model.eventState.dungeon = {
        ...(model.eventState.dungeon || {}),
        battleActive: false,
        extraction: detail,
        ready: true
      };
      if (detail.echo?.itemKey) {
        try {
          sessionStorage.setItem(TUTORIAL_ECHO_KEY, detail.echo.itemKey);
        } catch (error) {
          // Storage is only a visual-target hint; tutorial progress remains server-backed.
        }
      }
      if (isCurrentCheckpoint('dungeon-extract') && detail.echo) {
        void advance('bag-echo');
        return;
      }
    } else if (name === 'bag-ready') {
      model.eventState.bag = { ...(model.eventState.bag || {}), ...detail, ready: true };
    } else if (name === 'bag-item-opened') {
      model.eventState.bag = { ...(model.eventState.bag || {}), itemOpen: true, ready: true };
    } else if (name === 'demon-summoned') {
      model.eventState.bag = { ...(model.eventState.bag || {}), summoned: true, ready: true };
      void completeContextualGuide('summon');
      return;
    } else if (name === 'collection-ready') {
      model.eventState.collection = { ...detail, ready: true };
    } else if (name === 'demon-trained') {
      if (isCurrentCheckpoint('collection-training')) {
        model.eventState.collection = {
          ...(model.eventState.collection || {}),
          trainingComplete: true,
          ready: true
        };
        scheduleRender();
        return;
      }
      void completeContextualGuide('training');
      return;
    } else if (name === 'level-up') {
      if (model.tutorial?.status !== 'skipped') {
        void triggerContextualGuide('skill-tree');
        return;
      }
    } else if (name === 'skill-tree-ready' || name === 'skill-tree-draft-changed') {
      model.eventState.skillTree = { ...(model.eventState.skillTree || {}), ...detail, ready: true };
    } else if (name === 'skill-tree-saved') {
      if (model.tutorial?.guides?.skillTree?.pending) {
        void completeContextualGuide('skill-tree');
        return;
      }
    }

    scheduleRender();
  }

  async function beginTutorial() {
    const tutorial = await mutate('', { method: 'PATCH', body: { action: 'start' } });
    if (tutorial) navigate('/world');
  }

  async function advance(checkpoint, options = {}) {
    if (model.busy || !isValidCheckpoint(checkpoint)) return null;
    const tutorial = await mutate('', {
      method: 'PATCH',
      body: { action: 'advance', checkpoint }
    });
    if (tutorial && options.navigate) navigate(options.navigate);
    return tutorial;
  }

  async function completeTutorial() {
    const tutorial = await mutate('', { method: 'PATCH', body: { action: 'complete' } });
    if (tutorial?.status === 'completed') {
      window.AmongDemons?.showGameAlert?.({
        type: 'success',
        title: 'Tutorial complete.',
        message: 'You are ready to explore, descend, collect Echoes, and train permanent demons.',
        action: 'You can replay the tutorial from Settings at any time.'
      }, { context: 'tutorial' });
    }
    return tutorial;
  }

  async function skipTutorial() {
    const tutorial = await mutate('', { method: 'PATCH', body: { action: 'skip' } });
    model.confirmSkip = false;
    resolvePendingAmbushConfirmation();
    return tutorial;
  }

  function waitForAmbushConfirmation(detail = {}) {
    if (!isCurrentCheckpoint('world-travel')) return Promise.resolve();
    if (model.pendingAmbushConfirmation) return model.pendingAmbushConfirmation.promise;

    let resolveConfirmation = null;
    const promise = new Promise((resolve) => {
      resolveConfirmation = resolve;
    });
    model.pendingAmbushConfirmation = { promise, resolve: resolveConfirmation };
    model.eventState.worldAmbush = {
      ...detail,
      awaitingConfirmation: true,
      confirmed: false
    };
    scheduleRender();
    return promise;
  }

  function resolvePendingAmbushConfirmation() {
    const pending = model.pendingAmbushConfirmation;
    model.pendingAmbushConfirmation = null;
    if (model.eventState.worldAmbush) {
      model.eventState.worldAmbush = {
        ...model.eventState.worldAmbush,
        awaitingConfirmation: false,
        confirmed: true
      };
    }
    pending?.resolve?.();
    scheduleRender();
  }

  async function completeContextualGuide(guide) {
    return mutate('', { method: 'PATCH', body: { action: 'complete-guide', guide } });
  }

  async function triggerContextualGuide(guide) {
    return mutate('', { method: 'PATCH', body: { action: 'trigger-guide', guide } });
  }

  async function mutate(suffix, options) {
    if (model.busy) return null;
    model.busy = true;
    render();
    try {
      const payload = await window.AmongDemons.api(`${API_PATH}${suffix}`, {
        ...options,
        dedupe: false
      });
      model.tutorial = payload?.tutorial || model.tutorial;
      render();
      return model.tutorial;
    } catch (error) {
      console.error(error);
      window.AmongDemons?.showGameAlert?.({
        type: 'error',
        title: 'Tutorial unavailable.',
        message: 'The guide could not be updated right now.',
        action: 'Refresh the page and try again.'
      }, { context: 'tutorial' });
      return null;
    } finally {
      model.busy = false;
      render();
    }
  }

  function render() {
    if (!model.host) return;
    clearTutorialHighlights();
    const tutorial = model.tutorial;
    if (!tutorial) {
      hideTutorialUi();
      return;
    }

    syncLocalSteps(tutorial);
    syncMobileTutorialSurfaces(tutorial);

    const coreActive = tutorial.status !== 'completed' && tutorial.status !== 'skipped';
    const view = coreActive
      ? tutorial.status === 'not_started'
        ? getWelcomeView()
        : getCheckpointView(tutorial.checkpoint)
      : tutorial.status === 'completed'
        ? getContextualView()
        : null;
    if (!view || view.hidden) {
      hideTutorialUi();
      return;
    }

    const target = resolveTarget(view.target);
    applyTutorialChoiceHighlights(view.choiceTargets);
    model.target = target;
    const displayView = model.confirmSkip ? getSkipConfirmationView(view) : view;
    model.currentView = displayView;
    const renderKey = getTutorialViewRenderKey(displayView);
    if (!model.card || !model.ring || model.renderKey !== renderKey) {
      renderCard(displayView, target);
      model.renderKey = renderKey;
    } else {
      model.host.hidden = false;
      model.host.classList.toggle('is-centered', Boolean(displayView.centered && !target));
    }
    positionTutorial(target);
    scheduleSettledPosition();
  }

  function getWelcomeView() {
    return {
      title: 'Welcome, Hunter',
      body: 'Take a quick journey through World, survive a Dungeon fight, and bring home your first Echo. You can skip whenever you like.',
      progress: `1 of ${TOTAL_MOMENTS}`,
      icon: 'map',
      centered: true,
      primaryLabel: 'Begin tutorial',
      onPrimary: beginTutorial
    };
  }

  function getCheckpointView(checkpoint) {
    const requiredRoute = getCheckpointRoute(checkpoint);
    if (requiredRoute && !isRoute(requiredRoute)) {
      return getRouteHandoffView(checkpoint, requiredRoute);
    }

    const progress = `${CHECKPOINTS.indexOf(checkpoint) + 2} of ${TOTAL_MOMENTS}`;
    if (checkpoint === 'world-map') return getWorldMapView(progress);
    if (checkpoint === 'world-team') return getWorldTeamView(progress);
    if (checkpoint === 'world-travel') return getActionDrivenWorldTravelView(progress);
    if (checkpoint === 'dungeon-prepare') return getDungeonPrepareView(progress);
    if (checkpoint === 'dungeon-extract') return getDungeonExtractView(progress);
    if (checkpoint === 'bag-echo') return getActionDrivenBagEchoView(progress);
    if (checkpoint === 'collection-training') return getCollectionTrainingView(progress);
    if (checkpoint === 'world-hunt-rewards') return getWorldHuntRewardsView(progress);
    return null;
  }

  function getWorldMapView(progress) {
    return {
      title: 'Explore the World',
      body: 'Pan around the map and wheel or pinch to zoom. You are only scouting for now—travel begins after you choose an Active Team.',
      progress,
      icon: 'map',
      target: '#worldCanvasHost'
    };
  }

  function getWorldTeamView(progress) {
    const world = model.eventState.world;
    if (!world?.ready) return { hidden: true };
    if (model.eventState.worldOverlayOpen) return { hidden: true };
    const modalOpen = Boolean(document.getElementById('worldTeamModal')?.classList.contains('show'));
    const compact = isCompactTutorialViewport();

    if (modalOpen) {
      const detailsOpen = Boolean(document.getElementById('demonDetailModal')?.classList.contains('show'));
      if (detailsOpen) {
        const detailsAction = findVisibleElement([
          '#demonDetailModal.show [data-demon-detail-action]:not(:disabled)',
          '#demonDetailModal.show [data-demon-detail-action]'
        ]);
        const actionLabel = detailsAction?.textContent?.trim() || 'Add to team';
        const roleStep = model.localSteps.worldTeam === 0
          ? { label: 'melee', position: 'front' }
          : model.localSteps.worldTeam === 1
            ? { label: 'ranged', position: 'back' }
            : null;
        return {
          title: /remove/i.test(actionLabel)
            ? 'Adjust this slot'
            : roleStep
              ? `Place this ${roleStep.label} demon`
              : 'Add this demon',
          body: /remove/i.test(actionLabel)
            ? 'This demon is already assigned. Remove it only if you want to replace it.'
            : roleStep
              ? `Add places it in the next open ${roleStep.position} slot automatically. You can drag it to another matching spot afterward.`
              : 'Add places this demon in its next open preferred slot. Drag from Collection when you want an exact spot.',
          progress,
          icon: 'shield-plus',
          target: detailsAction
        };
      }

      const teamCount = document.querySelectorAll('#worldTeamEditorGrid .world-team-editor-card').length;
      if (model.localSteps.worldTeam === 0) {
        const melee = applyWorldTeamRoleHighlights('front');
        return {
          title: 'Start with a melee demon',
          body: teamCount >= 6
            ? 'Your team is full. Open a melee card on the board and remove it, then add a glowing melee card to the front.'
            : compact
              ? 'Tap a glowing melee card above, then Add. It will enter the glowing front row automatically.'
              : `${melee.name ? `${melee.name} is one example. ` : ''}Choose any glowing melee card. Add places it in a glowing front slot, where it takes the pressure first.`,
          progress,
          icon: 'swords',
          target: melee.slot || melee.card || '#worldTeamEditorCollection',
          mobilePlacement: 'top',
          mobileDock: 'bottom',
          facts: compact ? null : [{ icon: 'shield', label: 'Melee', value: 'Glowing front line' }]
        };
      }

      if (model.localSteps.worldTeam === 1) {
        const ranged = applyWorldTeamRoleHighlights('back');
        return {
          title: 'Protect a ranged demon',
          body: teamCount >= 6
            ? 'Your team is full. Open a ranged card on the board and remove it, then add a glowing ranged card to the back.'
            : compact
              ? 'Tap a glowing ranged card above, then Add. It will enter one of the two protected back rows.'
              : `${ranged.name ? `${ranged.name} is one example. ` : ''}Choose any glowing ranged card. Add places it in a glowing back slot, protected behind your melee line.`,
          progress,
          icon: 'crosshair',
          target: ranged.slot || ranged.card || '#worldTeamEditorCollection',
          mobilePlacement: 'top',
          mobileDock: 'bottom',
          facts: compact ? null : [{ icon: 'crosshair', label: 'Ranged', value: 'Two glowing back lines' }]
        };
      }

      if (model.localSteps.worldTeam === 2) {
        document.getElementById('worldTeamEditorCount')?.classList.add('tutorial-team-counter');
        revealMobileWorldTeamCollection('fill');
        return {
          title: `${teamCount}/6 — duplicate demons are allowed`,
          body: compact
            ? 'Use the cards above until the team reaches 6/6. Copies of the same permanent demon are allowed.'
            : 'Fill all six Active Team slots. You can add the same permanent demon more than once, then drag copies into the exact formation you want.',
          progress,
          icon: 'users',
          target: '#worldTeamEditorCount',
          mobilePlacement: 'top',
          mobileDock: compact ? 'bottom' : null
        };
      }

      return {
        title: 'Save your Active Team',
        body: 'This formation travels with you, handles ambushes, and fights every Hunt. You can edit it whenever you return to World.',
        progress,
        icon: 'save',
        target: '#worldTeamSaveButton'
      };
    }

    return {
      title: world.hasActiveTeam ? 'Open Edit Team' : 'Choose an Active Team',
      body: world.hasActiveTeam
        ? 'Let\'s open the editor and see how this travel formation is built.'
        : 'World travel needs at least one demon. Your available demons are waiting in Collection.',
      progress,
      icon: 'shield-plus',
      target: '#worldEditTeamButton',
      mobilePlacement: 'top'
    };
  }

  function getWorldTravelView(progress) {
    const sideToggle = document.getElementById('worldSideToggle');
    const sideExpanded = sideToggle?.getAttribute('aria-expanded') === 'true';
    if (!sideExpanded) {
      return {
        title: 'Open the World activity panel',
        body: 'This panel shows what is waiting in your current area, including fights and unlocked Hunts.',
        progress,
        icon: 'map',
        target: sideToggle,
        primaryLabel: 'Open Panel',
        onPrimary: () => sideToggle?.click()
      };
    }

    if (model.localSteps.worldTravel <= 0) {
      return {
        title: 'Hunt defeated spots',
        body: 'Defeat a local spot once to unlock Hunt. Your Active Team then repeats that battle over time, banking reduced XP and Souls until you claim.',
        progress,
        icon: 'timer',
        target: [
          '.world-active-hunt-card',
          '[data-start-hunting]',
          '[data-try-hunt]',
          '#worldEncounterList'
        ],
        mobilePlacement: 'top',
        primaryLabel: 'Why Get Stronger?',
        onPrimary: () => setLocalStep('worldTravel', 1, '#worldCanvasHost')
      };
    }

    return {
      title: model.eventState.routePreviewed ? 'Route ready — prepare to push on' : 'Stronger areas need stronger demons',
      body: model.eventState.routePreviewed
        ? 'Follow the highlighted route when ready. Dungeons help you recruit and extract Echoes; permanent demons can then be trained with Souls in Collection.'
        : 'Threat rises farther from safety. Enter Dungeons to recruit better units and extract Echoes, then train permanent demons with Souls in Collection.',
      progress,
      icon: 'sparkles',
      target: model.eventState.routePreviewed
        ? ['#worldTargetTooltip:not(.d-none)', '#worldCanvasHost']
        : '#worldCanvasHost',
      facts: [
        { icon: 'sparkles', label: 'Events', value: 'Special opportunities', href: '/events' },
        { icon: 'crown', label: 'Bosses', value: 'Temporary victory buffs', href: '/bosses' }
      ],
      primaryLabel: 'Enter First Dungeon',
      onPrimary: () => advance('dungeon-prepare', { navigate: '/dungeon' })
    };
  }

  function getActionDrivenWorldTravelView(progress) {
    if (model.eventState.worldAmbush?.awaitingConfirmation) {
      return {
        title: 'You have been ambushed',
        body: 'Some routes spring an ambush. Your Active Team fights automatically, so formation and stronger demons matter even between marked spots.',
        progress,
        icon: 'swords',
        centered: true,
        primaryLabel: 'Got it',
        onPrimary: resolvePendingAmbushConfirmation
      };
    }
    const blockingModal = findVisibleElement(['.modal.show .modal-content']);
    if (model.eventState.worldTraveling || blockingModal || model.eventState.worldOverlayOpen) return { hidden: true };

    const atTarget = model.eventState.worldArrived || positionsEqual(model.eventState.world?.position, TUTORIAL_WORLD_SPOT);
    if (!atTarget && !model.eventState.worldHunt.lost) {
      prepareWorldTutorialSpot();
      return {
        title: 'Travel to Area 0, -3',
        body: 'Select the glowing demon spot, preview its route, then choose Travel. The guide waits until you arrive before explaining the activity panel.',
        progress,
        icon: 'map-pin',
        target: ['#worldTutorialSpotAnchor', '#worldTargetTooltip:not(.d-none)'],
        placement: 'top',
        mobilePlacement: 'top',
        placementGap: 36,
        suppressFocusRing: true
      };
    }

    clearWorldTutorialSpot();
    const sideToggle = document.getElementById('worldSideToggle');
    const sideExpanded = sideToggle?.getAttribute('aria-expanded') === 'true';
    if (!sideExpanded && !model.eventState.worldHunt.lost) {
      return {
        title: 'Open the World activity panel',
        body: 'This panel shows what is waiting in your current area, including fights and unlocked Hunts.',
        progress,
        icon: 'map',
        target: sideToggle,
        mobileDock: 'top',
        primaryLabel: 'Open Panel',
        onPrimary: () => sideToggle?.click()
      };
    }

    if (model.eventState.worldHunt.lost) {
      const dungeonLink = findVisibleElement(['[data-game-route="dungeon"]', 'a[href="/dungeon"]']);
      return {
        title: 'Get stronger in a Dungeon',
        body: 'This fight exposed a weak point. Dungeons let you recruit stronger units and extract Echoes; Summon permanent demons, then Train them with Souls before returning.',
        progress,
        icon: 'sparkles',
        target: dungeonLink || '#worldCanvasHost',
        facts: [
          { icon: 'sparkles', label: 'Events', value: 'Special opportunities', href: '/events' },
          { icon: 'crown', label: 'Bosses', value: 'Temporary victory buffs', href: '/bosses' }
        ],
        mobilePlacement: 'top',
        primaryLabel: 'Enter First Dungeon',
        onPrimary: () => advance('dungeon-prepare', { navigate: '/dungeon' })
      };
    }

    if (model.eventState.worldHunt.started) {
      return {
        title: 'While the Hunt gathers Souls',
        body: 'While we wait for those Souls to stack, let me show you how to collect demons. In a Dungeon, you can recruit during the run and extract an Echo to keep.',
        progress,
        icon: 'timer',
        target: ['.world-active-hunt-card', '[data-claim-hunt-rewards]'],
        mobilePlacement: 'top',
        primaryLabel: 'Enter Your First Dungeon',
        onPrimary: () => advance('dungeon-prepare', { navigate: '/dungeon' })
      };
    }

    const fightButton = findVisibleElement(['[data-try-hunt]']);
    if (fightButton) return {
      title: 'Fight to unlock this spot',
      body: 'Fight once with your Active Team. Victory proves it can handle this area and unlocks passive Hunt; defeat means it is time to seek stronger demons.',
      progress,
      icon: 'swords',
      target: fightButton,
      mobilePlacement: 'top'
    };

    const huntButton = findVisibleElement(['[data-start-hunting]']);
    if (huntButton) return {
      title: 'Hunt the defeated spot',
      body: 'Start Hunt to let your Active Team repeat this battle over time. It banks reduced XP and Souls while you are away.',
      progress,
      icon: 'timer',
      target: huntButton,
      mobilePlacement: 'top'
    };

    const claimButton = findVisibleElement(['[data-claim-hunt-rewards]']);
    return {
      title: 'While the Hunt gathers Souls',
      body: 'While we wait for those Souls to stack, let me show you how to collect demons. In a Dungeon, you can recruit during the run and extract an Echo to keep.',
      progress,
      icon: 'timer',
      target: claimButton || '.world-active-hunt-card',
      mobilePlacement: 'top',
      primaryLabel: 'Enter Your First Dungeon',
      onPrimary: () => advance('dungeon-prepare', { navigate: '/dungeon' })
    };
  }

  function getDungeonPrepareView(progress) {
    const dungeon = model.eventState.dungeon;
    if (!dungeon?.ready) return { hidden: true };
    const shortTeamModal = document.getElementById('shortTeamModal');
    if (shortTeamModal?.classList.contains('show')) {
      const skipButton = document.getElementById('confirmShortTeamBtn');
      const recruitButton = findVisibleElement(['#shortTeamModal.show [data-bs-dismiss="modal"].btn-primary']);
      return {
        title: 'Recruit now or fight as-is',
        body: 'Your team is below this floor’s limit. Recruit returns to formation so you can fill the open slot; Skip accepts the smaller team and starts the fight.',
        progress,
        icon: 'users',
        target: '#shortTeamCount',
        mobilePlacement: 'top',
        choiceTargets: [recruitButton, skipButton]
      };
    }
    if (dungeon.battleActive) {
      return { hidden: true };
    }
    if (dungeon.hasPendingPacts) {
      return {
        title: 'Choose a Demonic Pact',
        body: 'Pacts change the rules of the descent. Pick the trade-off that best suits your team, then continue.',
        progress,
        icon: 'sparkles',
        target: ['#demonicPactOverlay:not(.d-none)', '#dungeonHandBar:not(.d-none)']
      };
    }

    const startButton = findVisibleElement(['#startNewDungeonBtn', '#dungeonCenterStartBtn']);
    if (!dungeon.hasRun || dungeon.status === 'defeated') {
      return {
        title: dungeon.status === 'defeated' ? 'Every defeat teaches' : 'Begin your descent',
        body: dungeon.status === 'defeated'
          ? 'Adjust your formation and try again. The tutorial will continue after your first victory.'
          : 'Open a new Dungeon run to prepare your first team.',
        progress,
        icon: 'swords',
        target: startButton
      };
    }

    const teamCount = document.querySelectorAll('#teamGrid .dungeon-demon-card[data-instance-id]').length;
    const fightButton = teamCount > 0
      ? findVisibleElement(['#dungeonFightBtn:not(:disabled)', '#dungeonMobileFightBtn:not(:disabled)'])
      : null;
    const compact = isCompactTutorialViewport();
    return {
      title: fightButton ? 'Your team is ready' : 'Prepare your first team',
      body: fightButton
        ? 'Front-line demons protect the back line. You can add more demons from Hand, then start the fight when the formation looks right.'
        : 'Drag a Hand demon into formation. Tap it first to inspect its role and stats; put melee in front and keep ranged demons behind them.',
      progress,
      icon: 'swords',
      target: fightButton && !compact
        ? fightButton
        : ['#dungeonHandBar:not(.d-none)', '#teamGrid'],
      mobilePlacement: 'top',
      choiceTargets: fightButton ? [fightButton] : null,
      facts: fightButton ? null : [
        { icon: 'swords', label: 'Melee', value: 'Front' },
        { icon: 'crosshair', label: 'Ranged', value: 'Back' }
      ]
    };
  }

  function getDungeonExtractView(progress) {
    const dungeon = model.eventState.dungeon;
    if (!dungeon?.ready) return { hidden: true };
    if (dungeon.battleActive) {
      return { hidden: true };
    }

    const detailsOpen = Boolean(document.getElementById('demonDetailModal')?.classList.contains('show'));
    if (detailsOpen) {
      const extractAction = findVisibleElement([
        '#demonDetailModal.show [data-demon-detail-action]:not(:disabled)',
        '#demonDetailModal.show [data-demon-detail-action]'
      ]);
      return {
        title: extractAction ? 'Preserve this exact Echo' : 'Inspect your reward',
        body: extractAction
          ? 'Choose Extract to secure this demon as an Echo. You will confirm the choice before the run ends.'
          : 'Review the demon, then close this view and choose one of the defeated demons that can be extracted.',
        progress,
        icon: 'amphora',
        target: extractAction || '#demonDetailModal.show .modal-content',
        mobileDock: isCompactTutorialViewport() ? 'top' : null
      };
    }

    const cashoutOpen = Boolean(document.getElementById('cashoutModal')?.classList.contains('show'));
    if (cashoutOpen) {
      const confirm = document.getElementById('cashoutConfirmBtn');
      return {
        title: 'Confirm extraction',
        body: 'The chosen exact Echo will be secured in your Bag together with the XP and Souls earned during this run. Extraction ends the run.',
        progress,
        icon: 'amphora',
        target: confirm,
        mobileDock: isCompactTutorialViewport() ? 'top' : null
      };
    }

    const compact = isCompactTutorialViewport();
    const mobileExtractButton = findVisibleElement(['#dungeonMobileExtractBtn:not(:disabled)']);
    const mobileRewardOpen = Boolean(document.getElementById('dungeonBottomPanel')?.classList.contains('is-mobile-reward-open'));
    const selectedReward = findVisibleElement(['#dungeonRewardBox .dungeon-reward-demon-card']);
    const rewardExtractButton = findVisibleElement(['#getRewardBtn:not(:disabled)']);
    const continueFightButton = findVisibleElement([
      '#dungeonFightBtn:not(:disabled)',
      '#dungeonMobileFightBtn:not(:disabled)',
      '#dungeonFightBtn',
      '#dungeonMobileFightBtn'
    ]);
    const reviewFightOption = () => setLocalStep(
      'dungeonExtract',
      0,
      compact ? '#dungeonMobileFightBtn' : '#dungeonFightBtn'
    );

    if (model.localSteps.dungeonExtract <= 0) {
      return {
        title: 'Option 1 of 2: Fight another floor',
        body: 'Recruit a defeated demon if you want, then press Fight to continue deeper. More floors can bring more rewards, but you can choose to leave instead.',
        progress,
        icon: 'swords',
        target: continueFightButton || ['#dungeonHandBar:not(.d-none)', '#teamGrid'],
        mobileDock: compact ? 'top' : null,
        primaryLabel: 'Show Extraction Option',
        onPrimary: () => setLocalStep(
          'dungeonExtract',
          1,
          compact ? '#dungeonMobileExtractBtn' : '#dungeonRewardBox'
        ),
        choiceTargets: continueFightButton ? [continueFightButton] : null
      };
    }

    if (compact && mobileExtractButton && !mobileRewardOpen) {
      return {
        title: 'Option 2 of 2: Extract safely',
        body: 'The flag opens the extraction tray. Choose one eligible demon as an Echo, then Extract to secure it with your XP and Souls and end the run safely. You can close and reopen this tray at any time.',
        progress,
        icon: 'amphora',
        target: mobileExtractButton,
        mobileDock: 'top',
        secondaryLabel: 'Review Fight Option',
        onSecondary: reviewFightOption,
        primaryLabel: 'Open Extraction',
        onPrimary: () => mobileExtractButton.click()
      };
    }

    if (selectedReward && rewardExtractButton) {
      return {
        title: 'Extract this Echo',
        body: 'This exact demon is in the extraction slot. Review the payout, then choose Extract to confirm the Echo, keep your earned XP and Souls, and leave safely.',
        progress,
        icon: 'amphora',
        target: rewardExtractButton,
        mobileDock: compact ? 'top' : null,
        secondaryLabel: 'Review Fight Option',
        onSecondary: reviewFightOption
      };
    }

    if (!dungeon.hasRun && dungeon.endSummary?.outcome === 'extraction' && !dungeon.extraction?.echo) {
      const nextDungeon = findVisibleElement(['a[href="/dungeon"]', '#startNewDungeonBtn']);
      return {
        title: 'No Echo was preserved',
        body: 'You left safely with your run rewards, but the extraction slot was empty. Start another run when you are ready to secure an Echo.',
        progress,
        icon: 'amphora',
        target: nextDungeon
      };
    }

    const echoCandidate = findVisibleElement([
      '#dungeonHandBar:not(.d-none) .is-recruit-draggable',
      '#dungeonHandGrid .dungeon-demon-card[data-instance-id]',
      '#teamGrid .dungeon-demon-card[data-instance-id]'
    ]);
    return {
      title: 'Option 2 of 2: Extract safely',
      body: compact
        ? 'Tap an eligible demon and choose Extract from its details, or drag it into the open extraction slot. Confirming secures that Echo with your XP and Souls and ends the run.'
        : 'Click an eligible demon and choose Extract from its details, or drag it into the extraction slot. Confirming secures that Echo with your XP and Souls and ends the run.',
      progress,
      icon: 'amphora',
      target: echoCandidate || [
        '#dungeonRewardBox:not(.d-none)',
        '#dungeonHandBar:not(.d-none)'
      ],
      mobileDock: compact ? 'top' : null,
      secondaryLabel: 'Review Fight Option',
      onSecondary: reviewFightOption
    };
  }

  function getBagEchoView(progress) {
    const bag = model.eventState.bag;
    if (!bag?.ready) return { hidden: true };
    let storedKey = '';
    try {
      storedKey = sessionStorage.getItem(TUTORIAL_ECHO_KEY) || '';
    } catch (error) {
      storedKey = '';
    }
    const escapedKey = cssEscape(storedKey);
    const echoTarget = (escapedKey && document.querySelector(`[data-bag-key="${escapedKey}"]`))
      || document.querySelector('#bagGrid [data-bag-key]')
      || document.getElementById('bagGrid');

    const modalOpen = Boolean(document.getElementById('bagDetailModal')?.classList.contains('show'));
    if (!modalOpen) {
      return {
        title: 'Open your Echo',
        body: 'This is the exact Echo you carried out. Open it to see what it can become.',
        progress,
        icon: 'amphora',
        target: echoTarget,
        primaryLabel: echoTarget?.matches?.('[data-bag-key]') ? 'Inspect Echo' : 'Finish Tutorial',
        onPrimary: echoTarget?.matches?.('[data-bag-key]')
          ? () => {
            model.localSteps.bag = 1;
            echoTarget.click();
            scheduleRender();
          }
          : completeTutorial
      };
    }

    const progressTrack = findVisibleElement(['#bagDetailModal.show .bag-progress-track']);
    const effectiveStep = progressTrack ? Math.max(1, model.localSteps.bag) : Math.max(2, model.localSteps.bag);

    if (effectiveStep === 1) {
      return {
        title: 'Watch the summon meter',
        body: 'Matching Echoes fill this bar. Reach the requirement, then Summon to make that demon permanent.',
        progress,
        icon: 'sparkles',
        target: progressTrack,
        primaryLabel: 'Show Refinement',
        onPrimary: () => setLocalStep('bag', 2, '#bagDetailModal.show .bag-recipe')
      };
    }

    if (effectiveStep === 2) {
      return {
        title: 'Refine surplus Echoes',
        body: 'This recipe shows how lower-rarity Echoes combine into the next rarity.',
        progress,
        icon: 'combine',
        target: [
          '#bagDetailModal.show .bag-recipe',
          '#bagDetailModal.show [data-bag-action="refine"]',
          '#bagDetailModal.show .bag-detail-panel:last-of-type'
        ],
        primaryLabel: 'One Last Tip',
        onPrimary: () => setLocalStep('bag', 3, '#bagDetailModal.show .bag-detail-visual')
      };
    }

    return {
      title: 'Train permanent demons',
      body: 'After Summon, open that demon in Collection. Train and Auto Train spend Souls for chances to raise its combat stats.',
      progress,
      icon: 'book-plus',
      target: [
        '#bagDetailModal.show a[href="/collection"]',
        '#bagDetailModal.show [data-bag-action="summon"]',
        '#bagDetailModal.show .bag-detail-visual',
        '#bagDetailModal.show .modal-content'
      ],
      primaryLabel: 'Finish Tutorial',
      onPrimary: completeTutorial
    };
  }

  function getRouteHandoffView(checkpoint, route) {
    if (checkpoint === 'bag-echo' && isRoute('/dungeon')) {
      const viewBag = findVisibleElement([
        '.dungeon-result-actions a[href="/bag"]',
        '.dungeon-end-actions a[href="/bag"]'
      ]);
      return {
        title: 'Echo secured',
        body: 'Your Echo is safe. Choose View Bag on the extraction screen to see its summoning progress and refinement options.',
        progress: `${CHECKPOINTS.indexOf(checkpoint) + 2} of ${TOTAL_MOMENTS}`,
        icon: 'amphora',
        target: viewBag
      };
    }

    const routeMeta = {
      '/world': { label: 'World', icon: 'map' },
      '/dungeon': { label: 'Dungeon', icon: 'swords' },
      '/bag': { label: 'Bag', icon: 'amphora' },
      '/collection': { label: 'Collection', icon: 'grid-3x3' }
    }[route] || { label: 'Camp', icon: 'tent' };
    const label = routeMeta.label;
    prepareRouteNavigation(route);
    const routeTarget = findVisibleElement([`[data-game-route="${label.toLowerCase()}"]`, `a[href="${route}"]`]);
    return {
      title: `Continue in ${label}`,
      body: `Your progress is saved. Return to ${label} whenever you are ready for the next short step.`,
      progress: `${CHECKPOINTS.indexOf(checkpoint) + 2} of ${TOTAL_MOMENTS}`,
      icon: routeMeta.icon,
      target: routeTarget
    };
  }

  function getActionDrivenBagEchoView(progress) {
    const bag = model.eventState.bag;
    if (!bag?.ready) return { hidden: true };
    const summonResult = findVisibleElement(['#bagSummonModal.show .modal-content']);
    if (summonResult) {
      const viewCollection = findVisibleElement(['#bagSummonModal.show a[href="/collection"]']);
      return {
        title: 'Your permanent demon is ready',
        body: 'The Echo has finished summoning and become a permanent demon. Take a moment to review the result, then continue to Collection to learn how Training makes it stronger.',
        progress,
        icon: 'sparkles',
        target: viewCollection || summonResult,
        mobilePlacement: 'top',
        primaryLabel: 'Next',
        onPrimary: () => advance('collection-training', { navigate: '/collection' })
      };
    }
    const summonResultPrepared = Boolean(document.querySelector('#bagSummonModal #bagSummonTitle'));
    if (summonResultPrepared && !bag.summoned) return { hidden: true };
    if (bag.summoned) {
      return {
        title: 'Your permanent demon is ready',
        body: 'The Echo has become a permanent demon. Continue to Collection to find it and learn how Training makes it stronger.',
        progress,
        icon: 'sparkles',
        target: '#bagGrid',
        mobilePlacement: 'top',
        primaryLabel: 'Continue to Collection',
        onPrimary: () => advance('collection-training', { navigate: '/collection' })
      };
    }
    let storedKey = '';
    try {
      storedKey = sessionStorage.getItem(TUTORIAL_ECHO_KEY) || '';
    } catch (error) {
      storedKey = '';
    }
    const readyUnownedKey = cssEscape(bag.readyUnownedKey || '');
    const escapedKey = cssEscape(storedKey);
    const echoTarget = (readyUnownedKey && document.querySelector(`[data-bag-key="${readyUnownedKey}"]`))
      || (escapedKey && document.querySelector(`[data-bag-key="${escapedKey}"]`))
      || document.querySelector('#bagGrid [data-bag-key]')
      || document.getElementById('bagGrid');
    const modalOpen = Boolean(document.getElementById('bagDetailModal')?.classList.contains('show'));
    if (modalOpen) {
      const summonButton = findVisibleElement(['#bagDetailModal.show [data-bag-action="summon"]:not(:disabled)']);
      if (summonButton) {
        return {
          title: 'Summon a permanent demon',
          body: 'A Common Echo needs only one copy. Choose Summon Demon to turn this Echo into a permanent Collection demon.',
          progress,
          icon: 'sparkles',
          target: summonButton,
          mobilePlacement: 'top'
        };
      }
      const summonInProgress = Boolean(findVisibleElement([
        'body > .bag-summon-ritual',
        '#bagDetailModal.show [data-bag-action="summon"]:disabled'
      ]));
      if (summonInProgress) return { hidden: true };
    }
    return {
      title: 'Your Echo is in the Bag',
      body: 'Open the highlighted Echo. Echoes of the same demon stack here; when an unowned demon is ready to manifest, a short Summon tip will appear.',
      progress,
      icon: 'amphora',
      target: echoTarget,
      mobilePlacement: 'top'
    };
  }

  function getCollectionTrainingView(progress) {
    const collection = model.eventState.collection;
    if (!collection?.ready) return { hidden: true };

    if (collection.trainingComplete) {
      return {
        title: 'Training complete',
        body: 'Now that we\'re done training, let\'s go back to check on our Hunt results.',
        progress,
        icon: 'book-plus',
        centered: true,
        primaryLabel: 'Check Hunt Results',
        onPrimary: () => advance('world-hunt-rewards', { navigate: '/world' })
      };
    }

    const demonId = cssEscape(collection.trainingDemonId || '');
    const modalOpen = Boolean(document.getElementById('demonDetailModal')?.classList.contains('show'));
    const trainOnce = findVisibleElement(['#demonDetailModal.show .collection-train-once-action']);
    if (trainOnce) {
      if (trainOnce.classList.contains('is-training')) return { hidden: true };
      const cost = Number(collection.trainingCost) || 0;
      const affordable = !trainOnce.disabled;
      return {
        title: affordable ? 'Train once with Souls' : 'Training uses earned Souls',
        body: affordable
          ? `This first attempt costs ${cost || 'a few'} Souls. Training can raise Health, Attack, or Speed; success is not guaranteed. Auto Train repeats attempts within a budget you choose.`
          : `This demon's next attempt costs ${cost || 'more'} Souls. Hunts and Dungeons provide more; Auto Train can repeat attempts within a budget later.`,
        progress,
        icon: 'book-plus',
        target: trainOnce,
        mobilePlacement: 'top',
        mobileDock: 'top',
        primaryLabel: affordable ? null : 'Finish Tutorial',
        onPrimary: affordable ? null : completeTutorial
      };
    }

    if (modalOpen) {
      return {
        title: 'Choose a demon that can still grow',
        body: 'Close these details, then open the highlighted permanent demon. Fully trained demons no longer show Training actions.',
        progress,
        icon: 'book-plus',
        target: '#demonDetailModal.show [data-bs-dismiss="modal"]',
        mobilePlacement: 'top'
      };
    }

    const trainingCard = demonId
      ? findVisibleElement([`.collection-demon-card[data-demon-id="${demonId}"]`])
      : null;
    if (trainingCard) {
      revealCollectionTrainingCard(trainingCard);
      return {
        title: 'Click on a demon card',
        body: 'Collection holds the demons you own permanently. Open the highlighted demon to find Train and Auto Train.',
        progress,
        icon: 'grid-3x3',
        target: trainingCard,
        mobilePlacement: 'top',
        mobileDock: 'bottom'
      };
    }

    return {
      title: 'Your Collection is ready',
      body: 'Training raises permanent demon stats with Souls. Every visible demon here is already fully trained, so there is no attempt to make now.',
      progress,
      icon: 'book-plus',
      target: '#collectionGrid',
      mobilePlacement: 'top',
      primaryLabel: 'Finish Tutorial',
      onPrimary: completeTutorial
    };
  }

  function getContextualView() {
    const guides = model.tutorial?.guides || {};
    if (guides.skillTree?.pending && !guides.skillTree?.completed) return getSkillTreeGuideView();
    if (!guides.summon?.completed && isRoute('/bag') && model.eventState.bag?.readyUnownedKey) {
      return getSummonGuideView();
    }
    if (!guides.training?.completed && isRoute('/collection') && model.eventState.collection?.trainableDemonId) {
      return getTrainingGuideView();
    }
    return null;
  }

  function getSummonGuideView() {
    const key = cssEscape(model.eventState.bag?.readyUnownedKey || '');
    const summonAction = findVisibleElement(['#bagDetailModal.show [data-bag-action="summon"]']);
    return {
      contextGuide: 'summon',
      title: summonAction ? 'Summon this demon permanently' : 'A new demon is ready to Summon',
      body: summonAction
        ? 'These matching Echoes have filled the requirement. Summon consumes them and adds this demon to your permanent Collection.'
        : 'This glowing stack belongs to a demon you do not own yet. Open it to see the completed Summon meter.',
      progress: 'Summon tip',
      icon: 'sparkles',
      target: summonAction || (key ? `[data-bag-key="${key}"]` : '#bagGrid'),
      mobilePlacement: 'top'
    };
  }

  function getTrainingGuideView() {
    const id = cssEscape(model.eventState.collection?.trainableDemonId || '');
    const autoTrainSubmit = findVisibleElement(['#autoTrainModal.show #autoTrainSubmitBtn']);
    const trainingAction = findVisibleElement([
      '#demonDetailModal.show .collection-train-once-action',
      '#demonDetailModal.show .collection-train-max-action'
    ]);
    return {
      contextGuide: 'training',
      title: autoTrainSubmit ? 'Choose an Auto Train budget' : trainingAction ? 'Train with Souls' : 'Train a permanent demon',
      body: autoTrainSubmit
        ? 'Choose how many Souls this session may spend. Auto Train repeats attempts until the budget, stat cap, or attempt limit is reached.'
        : trainingAction
        ? 'Train spends Souls for one stat-growth attempt. Auto Train repeats attempts within the budget you choose; success is never guaranteed.'
        : 'Open this permanent demon to find Train and Auto Train. Training can raise Health, Attack, or Speed.',
      progress: 'Training tip',
      icon: 'book-plus',
      target: autoTrainSubmit || trainingAction || (id ? `.collection-demon-card[data-demon-id="${id}"]` : '#collectionGrid'),
      mobilePlacement: 'top'
    };
  }

  function getSkillTreeGuideView() {
    if (findVisibleElement(['[data-level-up-celebration]'])) return { hidden: true };
    if (!isRoute('/skill-tree')) {
      prepareHunterNavigation('skill-tree');
      return {
        contextGuide: 'skill-tree',
        title: 'Level up: spend a Skill Point',
        body: 'Each account level grants a point for permanent, account-wide bonuses. Open Skill Tree to choose where this level strengthens every team.',
        progress: 'Level-up tip',
        icon: 'stars',
        target: '[data-game-route="skill-tree"]'
      };
    }
    const skill = model.eventState.skillTree;
    if (!skill?.ready) return { hidden: true };
    const saveButton = findVisibleElement(['#skillTreeSaveButton:not(:disabled)']);
    return {
      contextGuide: 'skill-tree',
      title: saveButton ? 'Seal your Skill Tree choice' : 'Choose a permanent bonus',
      body: saveButton
        ? 'Your point is only a draft until you press Save. Sealing it activates the bonus across World, Dungeon, and Ranked teams.'
        : 'Choose any glowing unlocked node. Some branches unlock only after earlier ranks are filled.',
      progress: 'Level-up tip',
      icon: 'stars',
      target: saveButton || ['[data-stat-point-key]:not(.is-locked):not(.is-disabled)', '#skillTreeUnspentCard'],
      mobilePlacement: 'top'
    };
  }

  function getSkipConfirmationView(previousView) {
    return {
      ...previousView,
      title: 'Skip the tutorial?',
      body: 'The guide will stop for this account. You can replay it from Settings at any time.',
      primaryLabel: 'Keep Going',
      onPrimary: () => {
        model.confirmSkip = false;
        render();
      },
      secondaryLabel: 'Skip Tutorial',
      onSecondary: skipTutorial,
      confirming: true
    };
  }

  function renderCard(view, target) {
    model.host.hidden = false;
    model.host.classList.toggle('is-centered', Boolean(view.centered && !target));
    model.host.innerHTML = `
      <div class="tutorial-focus-ring" aria-hidden="true"></div>
      <section class="tutorial-coachmark${view.confirming ? ' is-confirming' : ''}" role="dialog" aria-modal="false" aria-labelledby="tutorialCoachmarkTitle" aria-describedby="tutorialCoachmarkBody">
        <span class="tutorial-progress-rail" aria-hidden="true"><span style="width:${getProgressPercent(view.progress)}%"></span></span>
        <header class="tutorial-coachmark-head">
          <span class="tutorial-coachmark-icon" aria-hidden="true"><i data-lucide="${escapeHtml(view.icon || 'map')}"></i></span>
          <span class="tutorial-coachmark-progress"><strong>Tutorial</strong><span>${escapeHtml(view.progress || '')}</span></span>
          ${view.confirming ? '' : `<button class="tutorial-skip-link" type="button" data-tutorial-skip>${view.contextGuide ? 'Dismiss tip' : 'Skip tutorial'}</button>`}
        </header>
        <div class="tutorial-coachmark-copy">
          <h2 id="tutorialCoachmarkTitle">${escapeHtml(view.title || '')}</h2>
          <p id="tutorialCoachmarkBody">${escapeHtml(view.body || '')}</p>
          ${renderTutorialFacts(view.facts)}
        </div>
        ${(view.primaryLabel || view.secondaryLabel) ? `
          <footer class="tutorial-coachmark-actions">
            ${view.secondaryLabel ? `<button class="btn btn-glass-muted" type="button" data-tutorial-secondary ${model.busy || view.secondaryDisabled ? 'disabled' : ''}>${escapeHtml(view.secondaryLabel)}</button>` : ''}
            ${view.primaryLabel ? `<button class="btn btn-primary" type="button" data-tutorial-primary ${model.busy || view.primaryDisabled ? 'disabled' : ''}>${model.busy ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>' : ''}<span>${escapeHtml(view.primaryLabel)}</span></button>` : ''}
          </footer>
        ` : ''}
      </section>
    `;

    model.card = model.host.querySelector('.tutorial-coachmark');
    model.ring = model.host.querySelector('.tutorial-focus-ring');
    model.host.querySelector('[data-tutorial-skip]')?.addEventListener('click', () => {
      if (model.currentView?.contextGuide) {
        void completeContextualGuide(model.currentView.contextGuide);
        return;
      }
      model.confirmSkip = true;
      render();
    });
    model.host.querySelector('[data-tutorial-primary]')?.addEventListener('click', () => model.currentView?.onPrimary?.());
    model.host.querySelector('[data-tutorial-secondary]')?.addEventListener('click', () => model.currentView?.onSecondary?.());
    window.AmongDemons?.ui?.replaceStaticIcons?.(model.host);
  }

  function getTutorialViewRenderKey(view) {
    return JSON.stringify({
      title: view.title || '',
      body: view.body || '',
      progress: view.progress || '',
      icon: view.icon || '',
      facts: Array.isArray(view.facts) ? view.facts : [],
      primaryLabel: view.primaryLabel || '',
      secondaryLabel: view.secondaryLabel || '',
      primaryDisabled: Boolean(view.primaryDisabled),
      secondaryDisabled: Boolean(view.secondaryDisabled),
      confirming: Boolean(view.confirming),
      contextGuide: view.contextGuide || '',
      centered: Boolean(view.centered),
      busy: Boolean(model.busy)
    });
  }

  function ensureTutorialUi() {
    if (model.host?.isConnected) return;
    model.host = document.createElement('div');
    model.host.id = 'tutorialCoachmarkHost';
    model.host.className = 'tutorial-coachmark-host';
    model.host.hidden = true;
    document.body.appendChild(model.host);
  }

  function bindPageObservers() {
    if (!model.observer && typeof MutationObserver === 'function') {
      model.observer = new MutationObserver((records) => {
        if (records.every((record) => model.host?.contains(record.target))) return;
        scheduleRender();
      });
      model.observer.observe(document.body, { childList: true, subtree: true });
    }
    if (!model.resizeObserver && typeof ResizeObserver === 'function') {
      model.resizeObserver = new ResizeObserver(() => schedulePosition());
      model.resizeObserver.observe(document.documentElement);
    }
    if (!model.listenersBound) {
      model.listenersBound = true;
      window.addEventListener('resize', schedulePosition, { passive: true });
      window.addEventListener('scroll', schedulePosition, { passive: true, capture: true });
      document.addEventListener('shown.bs.modal', scheduleRender);
      document.addEventListener('hidden.bs.modal', scheduleRender);
      document.addEventListener('click', onTutorialGameAction, true);
    }
  }

  function positionTutorial(target = model.target) {
    if (!model.card || !model.ring || model.host.hidden) return;
    const compact = window.matchMedia?.('(max-width: 767.98px)').matches;

    if (!target || !isVisible(target)) {
      model.ring.hidden = true;
      model.card.style.removeProperty('left');
      model.card.style.removeProperty('top');
      model.card.style.removeProperty('right');
      model.card.style.removeProperty('bottom');
      return;
    }

    const rect = getTutorialTargetRect(target);
    const ringLeft = clamp(rect.left - 5, 4, Math.max(4, window.innerWidth - 24));
    const ringTop = clamp(rect.top - 5, 4, Math.max(4, window.innerHeight - 24));
    const suppressFocusRing = Boolean(model.currentView?.suppressFocusRing);
    model.ring.hidden = suppressFocusRing;
    if (!suppressFocusRing) {
      model.ring.style.left = `${ringLeft}px`;
      model.ring.style.top = `${ringTop}px`;
      model.ring.style.width = `${Math.max(20, Math.min(window.innerWidth - ringLeft - 4, rect.width + 10))}px`;
      model.ring.style.height = `${Math.max(20, Math.min(window.innerHeight - ringTop - 4, rect.height + 10))}px`;
    }

    if (compact) {
      positionCompactTutorial(rect);
      return;
    }

    const gap = Math.max(0, Number(model.currentView?.placementGap) || 14);
    const margin = 12;
    const cardRect = model.card.getBoundingClientRect();
    const below = rect.bottom + gap;
    const above = rect.top - cardRect.height - gap;
    const preferred = model.currentView?.placement;
    const top = preferred === 'top'
      ? Math.max(margin, above)
      : preferred === 'bottom'
        ? Math.min(below, window.innerHeight - cardRect.height - margin)
        : below + cardRect.height <= window.innerHeight - margin
          ? below
          : Math.max(margin, above);
    const left = clamp(
      rect.left + rect.width / 2 - cardRect.width / 2,
      margin,
      window.innerWidth - cardRect.width - margin
    );
    model.card.style.left = `${Math.round(left)}px`;
    model.card.style.top = `${Math.round(top)}px`;
    model.card.style.right = 'auto';
    model.card.style.bottom = 'auto';
    model.card.dataset.placement = top < rect.top ? 'top' : 'bottom';
  }

  function getTutorialTargetRect(target) {
    const targetRect = target.getBoundingClientRect();
    if (!target.matches?.('.game-nav-link, .game-nav-dropdown-item')) return targetRect;

    const content = [...target.children].filter((element) => (
      element.matches('.game-nav-icon')
      || (element.matches('span') && !element.matches('.game-nav-caret'))
    ) && isVisible(element));
    if (!content.length) return targetRect;

    const contentRects = content.map((element) => element.getBoundingClientRect());
    const paddingX = 7;
    const paddingY = 6;
    const left = Math.max(targetRect.left, Math.min(...contentRects.map((rect) => rect.left)) - paddingX);
    const top = Math.max(targetRect.top, Math.min(...contentRects.map((rect) => rect.top)) - paddingY);
    const right = Math.min(targetRect.right, Math.max(...contentRects.map((rect) => rect.right)) + paddingX);
    const bottom = Math.min(targetRect.bottom, Math.max(...contentRects.map((rect) => rect.bottom)) + paddingY);
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top
    };
  }

  function positionCompactTutorial(targetRect) {
    const gap = Math.max(0, Number(model.currentView?.placementGap) || 10);
    const margin = 8;
    const cardRect = model.card.getBoundingClientRect();
    const maxTop = Math.max(margin, window.innerHeight - cardRect.height - margin);
    const candidates = [
      { placement: 'top', top: clamp(targetRect.top - cardRect.height - gap, margin, maxTop) },
      { placement: 'bottom', top: clamp(targetRect.bottom + gap, margin, maxTop) },
      { placement: 'top', top: margin },
      { placement: 'bottom', top: maxTop }
    ];
    const preferred = model.currentView?.mobilePlacement;
    const dock = model.currentView?.mobileDock;
    if (dock === 'top' || dock === 'bottom') {
      const dockedTop = dock === 'top' ? margin : maxTop;
      model.card.style.left = `${margin}px`;
      model.card.style.top = `${Math.round(dockedTop)}px`;
      model.card.style.right = 'auto';
      model.card.style.bottom = 'auto';
      model.card.dataset.placement = dock;
      return;
    }
    candidates.sort((a, b) => {
      const overlapDifference = getVerticalOverlap(a.top, a.top + cardRect.height, targetRect.top, targetRect.bottom)
        - getVerticalOverlap(b.top, b.top + cardRect.height, targetRect.top, targetRect.bottom);
      if (overlapDifference) return overlapDifference;
      if (preferred && a.placement !== b.placement) return a.placement === preferred ? -1 : 1;
      if (preferred === 'top') return a.top - b.top;
      if (preferred === 'bottom') return b.top - a.top;
      return Math.abs(a.top - targetRect.top) - Math.abs(b.top - targetRect.top);
    });
    const chosen = candidates[0];
    model.card.style.left = `${margin}px`;
    model.card.style.top = `${Math.round(chosen.top)}px`;
    model.card.style.right = 'auto';
    model.card.style.bottom = 'auto';
    model.card.dataset.placement = chosen.placement;
  }

  function getVerticalOverlap(aTop, aBottom, bTop, bBottom) {
    return Math.max(0, Math.min(aBottom, bBottom) - Math.max(aTop, bTop));
  }

  function hideTutorialUi() {
    if (!model.host) return;
    if (model.positionSettleTimer) window.clearTimeout(model.positionSettleTimer);
    model.positionSettleTimer = null;
    model.host.hidden = true;
    model.host.innerHTML = '';
    model.card = null;
    model.ring = null;
    model.target = null;
    model.currentView = null;
    model.renderKey = '';
  }

  function destroyTutorialUi() {
    if (model.positionSettleTimer) window.clearTimeout(model.positionSettleTimer);
    model.positionSettleTimer = null;
    model.observer?.disconnect();
    model.resizeObserver?.disconnect();
    model.observer = null;
    model.resizeObserver = null;
    model.host?.remove();
    model.host = null;
    model.card = null;
    model.ring = null;
    model.target = null;
    model.currentView = null;
    model.renderKey = '';
  }

  function scheduleRender() {
    if (model.renderQueued) return;
    model.renderQueued = true;
    window.requestAnimationFrame(() => {
      model.renderQueued = false;
      render();
    });
  }

  function schedulePosition() {
    window.requestAnimationFrame(() => positionTutorial());
  }

  function scheduleSettledPosition() {
    if (model.positionSettleTimer) window.clearTimeout(model.positionSettleTimer);
    model.positionSettleTimer = window.setTimeout(() => {
      model.positionSettleTimer = null;
      positionTutorial();
    }, 500);
  }

  function resolveTarget(target) {
    if (target instanceof Element) return isVisible(target) ? target : null;
    return findVisibleElement(Array.isArray(target) ? target : [target]);
  }

  function findVisibleElement(selectors = []) {
    for (const selector of selectors.filter(Boolean)) {
      if (selector instanceof Element) {
        if (isVisible(selector)) return selector;
        continue;
      }
      const element = document.querySelector(selector);
      if (element && isVisible(element)) return element;
    }
    return null;
  }

  function clickTarget(selector) {
    const target = resolveTarget(selector);
    target?.click();
  }

  function setLocalStep(name, value, revealSelector = '') {
    if (Object.prototype.hasOwnProperty.call(model.localSteps, name)) {
      model.localSteps[name] = value;
    }
    scheduleRender();
    if (!revealSelector) return;
    window.requestAnimationFrame(() => {
      const target = document.querySelector(revealSelector);
      target?.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      schedulePosition();
    });
  }

  function syncLocalSteps(tutorial) {
    const key = `${tutorial?.status || ''}:${tutorial?.checkpoint || ''}`;
    if (model.localStepKey === key) return;
    resetLocalSteps();
    model.localStepKey = key;
  }

  function resetLocalSteps() {
    model.localStepKey = '';
    model.localSteps.worldTeam = 0;
    model.localSteps.worldTravel = 0;
    model.localSteps.dungeonExtract = 0;
    model.localSteps.worldHuntRewards = 0;
    model.localSteps.bag = 0;
    model.automaticUi.worldMapPanelPrepared = false;
    model.automaticUi.worldTeamPanelPrepared = false;
    model.automaticUi.worldTravelSpotPrepared = false;
    model.automaticUi.worldHuntRewardsPanelPrepared = false;
    model.automaticUi.worldTeamCollectionStepPrepared = '';
    model.automaticUi.bagNavigationPrepared = false;
    model.automaticUi.collectionNavigationPrepared = false;
    model.automaticUi.collectionTrainingPrepared = false;
    model.automaticUi.skillTreeNavigationPrepared = false;
    model.automaticUi.routeNavigationPrepared = '';
  }

  function syncMobileTutorialSurfaces(tutorial) {
    if (
      tutorial?.status !== 'in_progress'
      || !isRoute('/world')
      || !isMobileWorldSheetViewport()
    ) return;

    const toggle = document.getElementById('worldSideToggle');
    if (!toggle) return;

    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (tutorial.checkpoint === 'world-map' && !model.automaticUi.worldMapPanelPrepared) {
      model.automaticUi.worldMapPanelPrepared = true;
      if (expanded) toggle.click();
      return;
    }

    if (tutorial.checkpoint === 'world-team' && !model.automaticUi.worldTeamPanelPrepared) {
      model.automaticUi.worldTeamPanelPrepared = true;
      if (!expanded) toggle.click();
      return;
    }

    if (tutorial.checkpoint === 'world-travel' && !model.automaticUi.worldTravelSpotPrepared) {
      model.automaticUi.worldTravelSpotPrepared = true;
      if (expanded && !positionsEqual(model.eventState.world?.position, TUTORIAL_WORLD_SPOT)) toggle.click();
      return;
    }

    if (
      tutorial.checkpoint === 'world-hunt-rewards'
      && !model.automaticUi.worldHuntRewardsPanelPrepared
    ) {
      model.automaticUi.worldHuntRewardsPanelPrepared = true;
      if (!expanded) toggle.click();
    }
  }

  function getWorldHuntRewardsView(progress) {
    if (!model.eventState.world?.ready) return { hidden: true };
    if (model.eventState.worldTraveling || model.eventState.worldOverlayOpen) return { hidden: true };
    const blockingModal = findVisibleElement(['.modal.show .modal-content']);
    if (blockingModal) return { hidden: true };

    if (model.localSteps.worldHuntRewards >= 2 || model.eventState.worldHunt.claimed) {
      return {
        title: 'Hunt rewards secured',
        body: 'The XP and Souls are yours, and the Hunt can keep running. You now know the full loop: explore, Hunt, collect Echoes, Summon, and Train.',
        progress,
        icon: 'hand-coins',
        centered: true,
        primaryLabel: 'Finish Tutorial',
        onPrimary: completeTutorial
      };
    }

    const sideToggle = document.getElementById('worldSideToggle');
    const sideExpanded = sideToggle?.getAttribute('aria-expanded') === 'true';
    if (!sideExpanded) {
      return {
        title: 'Return to your Hunt',
        body: 'Open the World activity panel to see what your Active Team earned while you were in the Dungeon.',
        progress,
        icon: 'timer',
        target: sideToggle,
        primaryLabel: 'Open Panel',
        onPrimary: () => sideToggle?.click()
      };
    }

    const claimButton = findVisibleElement(['[data-claim-hunt-rewards]']);
    if (claimButton && !claimButton.disabled) {
      return {
        title: 'Claim the Hunt rewards',
        body: 'Your Active Team kept working while you explored the Dungeon. Claim its banked XP and Souls; Hunt can continue afterward.',
        progress,
        icon: 'hand-coins',
        target: claimButton,
        mobilePlacement: 'top'
      };
    }

    if (claimButton) {
      return {
        title: 'Your Hunt is still building rewards',
        body: 'No need to wait here. The Hunt continues banking XP and Souls, and you can claim them later from this panel.',
        progress,
        icon: 'timer',
        centered: true,
        primaryLabel: 'Finish Tutorial',
        onPrimary: completeTutorial
      };
    }

    return {
      title: 'No Hunt rewards this time',
      body: 'There is no active Hunt to claim from this run. Defeat a World spot and start Hunt whenever you want passive XP and Souls.',
      progress,
      icon: 'hand-coins',
      centered: true,
      primaryLabel: 'Finish Tutorial',
      onPrimary: completeTutorial
    };
  }

  function renderTutorialFacts(facts) {
    if (!Array.isArray(facts) || !facts.length) return '';
    return `
      <div class="tutorial-facts" aria-label="Quick guide">
        ${facts.map((fact) => {
          const tag = fact.href ? 'a' : 'span';
          const href = fact.href
            ? ` href="${escapeHtml(window.AmongDemons?.appUrl?.(fact.href) || fact.href)}"`
            : '';
          return `
          <${tag} class="tutorial-fact${fact.href ? ' is-link' : ''}"${href}>
            <i data-lucide="${escapeHtml(fact.icon || 'sparkles')}" aria-hidden="true"></i>
            <span><strong>${escapeHtml(fact.label || '')}</strong><small>${escapeHtml(fact.value || '')}</small></span>
            ${fact.href ? '<i class="tutorial-fact-arrow" data-lucide="chevron-right" aria-hidden="true"></i>' : ''}
          </${tag}>
        `;
        }).join('')}
      </div>
    `;
  }

  function applyWorldTeamRoleHighlights(position) {
    const role = position === 'back' ? 'back' : 'front';
    const cards = [...document.querySelectorAll(`#worldTeamEditorCollection [data-world-team-position="${role}"]`)]
      .filter(isVisible);
    const slots = [...document.querySelectorAll(`#worldTeamEditorGrid .formation-slot-${role}`)]
      .filter(isVisible);
    cards.forEach((card) => card.classList.add('tutorial-role-candidate'));
    const grid = document.querySelector('#worldTeamEditorGrid .battle-formation-grid');
    grid?.classList.add(`tutorial-role-${role}-guide`);
    const card = cards[0] || null;
    const slot = slots[0] || null;
    revealMobileWorldTeamCollection(role, card);
    return {
      card,
      slot: grid || slot,
      name: card?.dataset.worldTeamSpecies?.trim() || ''
    };
  }

  function revealMobileWorldTeamCollection(step, preferredCard = null) {
    if (!isCompactTutorialViewport() || model.automaticUi.worldTeamCollectionStepPrepared === step) return;
    const collection = document.getElementById('worldTeamEditorCollection');
    const card = preferredCard || collection?.querySelector('.world-team-editor-collection-card');
    if (!collection || !card) return;
    model.automaticUi.worldTeamCollectionStepPrepared = step;
    const left = Math.max(0, card.offsetLeft - (collection.clientWidth - card.offsetWidth) / 2);
    collection.scrollTo?.({ left, behavior: 'smooth' });
  }

  function revealCollectionTrainingCard(card) {
    if (model.automaticUi.collectionTrainingPrepared) return;
    model.automaticUi.collectionTrainingPrepared = true;
    window.requestAnimationFrame(() => {
      card.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      schedulePosition();
    });
  }

  function clearTutorialHighlights() {
    document.querySelectorAll('.tutorial-role-candidate, .tutorial-role-slot, .tutorial-choice-highlight, .tutorial-team-counter, .tutorial-role-front-guide, .tutorial-role-back-guide').forEach((element) => {
      element.classList.remove(
        'tutorial-role-candidate',
        'tutorial-role-slot',
        'tutorial-choice-highlight',
        'tutorial-team-counter',
        'tutorial-role-front-guide',
        'tutorial-role-back-guide'
      );
    });
  }

  function applyTutorialChoiceHighlights(targets = []) {
    (Array.isArray(targets) ? targets : [targets]).filter(Boolean).forEach((target) => {
      const element = target instanceof Element ? target : resolveTarget(target);
      element?.classList.add('tutorial-choice-highlight');
    });
  }

  function prepareWorldTutorialSpot() {
    if (model.automaticUi.worldTravelSpotPrepared && document.getElementById('worldTutorialSpotAnchor')?.offsetWidth) return;
    model.automaticUi.worldTravelSpotPrepared = true;
    window.dispatchEvent(new CustomEvent('amongdemons:tutorial-focus-world-spot', {
      detail: { position: { ...TUTORIAL_WORLD_SPOT }, center: true }
    }));
  }

  function clearWorldTutorialSpot() {
    if (!document.getElementById('worldTutorialSpotAnchor') || document.getElementById('worldTutorialSpotAnchor').hidden) return;
    window.dispatchEvent(new CustomEvent('amongdemons:tutorial-focus-world-spot', { detail: { clear: true } }));
  }

  function prepareHunterNavigation(route) {
    const key = route === 'skill-tree'
      ? 'skillTreeNavigationPrepared'
      : route === 'collection'
        ? 'collectionNavigationPrepared'
        : 'bagNavigationPrepared';
    if (model.automaticUi[key]) return;
    model.automaticUi[key] = true;
    const collapse = document.querySelector('.navbar-collapse');
    if (collapse && !collapse.classList.contains('show')) {
      window.bootstrap?.Collapse?.getOrCreateInstance?.(collapse, { toggle: false })?.show?.();
    }
    const dropdown = document.querySelector(`[data-game-sections~="${route}"]`);
    window.bootstrap?.Dropdown?.getOrCreateInstance?.(dropdown)?.show?.();
    window.requestAnimationFrame(scheduleRender);
  }

  function prepareRouteNavigation(route) {
    if (model.automaticUi.routeNavigationPrepared === route) return;
    model.automaticUi.routeNavigationPrepared = route;
    const collapse = document.querySelector('.navbar-collapse');
    if (collapse && !collapse.classList.contains('show')) {
      window.bootstrap?.Collapse?.getOrCreateInstance?.(collapse, { toggle: false })?.show?.();
    }
    if (route === '/bag' || route === '/collection') {
      const section = route.slice(1);
      const dropdown = document.querySelector(`[data-game-sections~="${section}"]`);
      window.bootstrap?.Dropdown?.getOrCreateInstance?.(dropdown)?.show?.();
    }
    window.requestAnimationFrame(scheduleRender);
  }

  function onTutorialGameAction(event) {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (target?.closest?.('#dungeonMobileExtractBtn') && isCurrentCheckpoint('dungeon-extract')) {
      model.localSteps.dungeonExtract = 1;
      scheduleRender();
    }
    const summonedCollectionLink = target?.closest?.('#bagSummonModal a[href="/collection"]');
    if (summonedCollectionLink && isCurrentCheckpoint('bag-echo')) {
      event.preventDefault();
      event.stopPropagation();
      void advance('collection-training', { navigate: '/collection' });
      return;
    }
    const dungeonLink = target?.closest?.('[data-game-route="dungeon"], a[href="/dungeon"]');
    if (
      dungeonLink
      && isCurrentCheckpoint('world-travel')
      && (model.eventState.worldHunt.lost || model.eventState.worldHunt.claimed)
    ) {
      event.preventDefault();
      event.stopPropagation();
      void advance('dungeon-prepare', { navigate: '/dungeon' });
    }
  }

  function getProgressPercent(progress) {
    const match = String(progress || '').match(/(\d+)\s+of\s+(\d+)/i);
    if (!match) return 0;
    return clamp((Number(match[1]) / Math.max(1, Number(match[2]))) * 100, 0, 100);
  }

  function isVisible(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function isCompactTutorialViewport() {
    return Boolean(window.matchMedia?.('(max-width: 767.98px)').matches);
  }

  function isMobileWorldSheetViewport() {
    return Boolean(window.matchMedia?.('(max-width: 899.98px) and (orientation: portrait)').matches);
  }

  function isCurrentCheckpoint(checkpoint) {
    return model.tutorial?.status === 'in_progress' && model.tutorial.checkpoint === checkpoint;
  }

  function positionsEqual(left, right) {
    return Number(left?.x) === Number(right?.x) && Number(left?.y) === Number(right?.y);
  }

  function isValidCheckpoint(checkpoint) {
    return CHECKPOINTS.includes(checkpoint);
  }

  function getCheckpointRoute(checkpoint) {
    if (checkpoint.startsWith('world-')) return '/world';
    if (checkpoint.startsWith('dungeon-')) return '/dungeon';
    if (checkpoint === 'bag-echo') return '/bag';
    if (checkpoint === 'collection-training') return '/collection';
    return '';
  }

  function isEligibleRoute() {
    return GAME_ROUTE_PATTERN.test(normalizePath(window.location.pathname));
  }

  function isRoute(route) {
    return normalizePath(window.location.pathname) === normalizePath(route);
  }

  function normalizePath(value) {
    return `/${String(value || '').replace(/^\/+|\/+$/g, '')}`;
  }

  function navigate(path) {
    window.location.href = window.AmongDemons?.appUrl?.(path) || path;
  }

  function cssEscape(value) {
    if (!value) return '';
    return window.CSS?.escape ? window.CSS.escape(String(value)) : String(value).replace(/["\\]/g, '\\$&');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }
})();
