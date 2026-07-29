(function() {
  'use strict';

  const KEY = 'amongdemons-session';
  const inFlightReads = new Map();
  const GAME_ALERT_HOST_ID = 'gameAlertToastHost';
  const ALERT_TYPE_MAP = {
    danger: 'error',
    error: 'error',
    warning: 'warning',
    success: 'success',
    info: 'info',
    secondary: 'info',
    neutral: 'info'
  };
  const ALERT_ICON_MAP = {
    error: 'badge-alert',
    warning: 'shield-alert',
    success: 'sparkles',
    info: 'info'
  };
  const ALERT_ICON_RULES = [
    { icon: 'timer', pattern: /\b(cooldown|timer|wait|later)\b|daily reset|return after/ },
    { icon: 'log-in', pattern: /sign in|sign-in|password|username|hunter name|gate|provider|google|discord/ },
    { icon: 'wind', pattern: /connection|shadows did not answer|did not answer|world map stayed dark/ },
    { icon: 'flame', pattern: /not enough souls|ritual|training|train|pact|recast|constellation|bindings|summon|power|sealed/ },
    { icon: 'user-plus', pattern: /recruit|join|bound/ },
    { icon: 'trophy', pattern: /reward|claimed|earned|won|xp|rankings|board|cache|spoils/ },
    { icon: 'skull', pattern: /defeat|defeated|dragged back|anchored shrine/ },
    { icon: 'swords', pattern: /battle|fight|vanguard|challenge|opponent/ },
    { icon: 'shield-plus', pattern: /team ready|team updated|formation|hunting team|saved|profile|name changed|choose your team/ },
    { icon: 'map', pattern: /world|wilds|travel|route|path|tile|hunt|hunting|shrine|exploring/ },
    { icon: 'castle', pattern: /camp|dungeon|descent|floor|chamber/ },
    { icon: 'flask-conical', pattern: /potion/ },
    { icon: 'search', pattern: /not found|found|hidden|veiled|load|loading|choose another/ },
    { icon: 'settings', pattern: /setting|adjust|change a field/ }
  ];
  const ALERT_DEMON_RARITY_PATTERN = /\b(Common|Uncommon|Rare|Epic|Legendary|Mythic)\b(\s+(?:[^\s.!?<>]+\s+){0,3}demons?\b)/gi;
  const DEFAULT_ALERTS = {
    error: {
      title: 'The ritual misfired.',
      message: 'The game could not complete that action.',
      action: 'Try again in a moment.'
    },
    warning: {
      title: 'Action needed.',
      message: 'Something must be adjusted before you continue.',
      action: 'Check your choice and try again.'
    },
    success: {
      title: 'Done.',
      message: 'Your progress was saved.',
      action: 'Continue when ready.'
    },
    info: {
      title: 'Notice.',
      message: 'The camp has new information for you.',
      action: 'Continue when ready.'
    }
  };

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function setSession(nextSession) {
    localStorage.setItem(KEY, JSON.stringify(nextSession));
  }

  function clearSession() {
    localStorage.removeItem(KEY);
  }

  function getToken() {
    return getSession().token || '';
  }

  function getPlayer() {
    return getSession().player || null;
  }

  function isGuest() {
    return Boolean(getPlayer()?.isGuest);
  }

  // Open (or reuse) a guest hunter so a brand-new visitor can play with no
  // sign-up. The row is a full player flagged is_guest = 1; every gameplay
  // endpoint works unchanged and progress persists in this browser via the
  // stored session token until the hunter is saved.
  async function playAsGuest() {
    const existing = getSession();
    if (existing.token) return existing;

    const payload = await api('/api/auth/guest', { method: 'POST', body: {} });
    const session = { token: payload.token, player: payload.player };
    setSession(session);
    return session;
  }

  // Guarantee a playable session for pages that should never bounce a first-time
  // visitor to the login gate (/world, /collection, /dungeon): reuse the current
  // session if any, otherwise open a guest hunter.
  async function ensurePlayableSession() {
    if (getToken()) return getSession();
    return playAsGuest();
  }

  // Convert the current guest hunter into a saved account without losing any
  // progress. The session token is unchanged, so the player stays logged in.
  async function claimGuest({ username, password, email } = {}) {
    const payload = await api('/api/auth/claim', {
      method: 'POST',
      body: { username, password, ...(email ? { email } : {}) }
    });
    const session = { token: payload.token, player: payload.player };
    setSession(session);
    return session;
  }

  function api(path, options = {}) {
    const toApiUrl = window.AmongDemons?.apiUrl || ((value) => value);
    const url = toApiUrl(path);
    const method = (options.method || 'GET').toUpperCase();
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {})
    };
    const token = getToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const hasBody = options.body !== undefined && options.body !== null;
    const shouldSendEmptyJson = !hasBody && isMutationMethod(method);
    const requestBody = shouldSendEmptyJson ? {} : options.body;

    if ((hasBody || shouldSendEmptyJson) && !hasHeader(headers, 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }

    const body = requestBody !== undefined && requestBody !== null && typeof requestBody !== 'string'
      ? JSON.stringify(requestBody)
      : requestBody;
    const canShareRead = (method === 'GET' || method === 'HEAD')
      && !body
      && !options.signal
      && options.dedupe !== false;

    if (!canShareRead) {
      return executeApiRequest(path, url, options, headers, body, method);
    }

    const key = createReadRequestKey(method, url, headers);
    const pending = inFlightReads.get(key);
    if (pending) return pending;

    let sharedRequest;
    sharedRequest = executeApiRequest(path, url, options, headers, body, method)
      .finally(() => {
        if (inFlightReads.get(key) === sharedRequest) inFlightReads.delete(key);
      });
    inFlightReads.set(key, sharedRequest);
    return sharedRequest;
  }

  async function executeApiRequest(path, url, options, headers, body, method) {
    const progressionAnimation = options.progressionAnimation;
    const fetchOptions = { ...options, headers, body };
    delete fetchOptions.dedupe;
    delete fetchOptions.progressionAnimation;
    delete fetchOptions.retryOpaqueBadRequest;

    if (shouldUseNativeHttp()) {
      return nativeApi(url, fetchOptions, headers, body, path, { progressionAnimation });
    }

    let response = await fetchApiResponse(url, fetchOptions, path);

    // The hosting CDN rate-limits request bursts (fast page navigation) with
    // 429s; one delayed retry absorbs the blip for idempotent reads instead
    // of surfacing a generic error.
    if (response.status === 429 && (method === 'GET' || method === 'HEAD')) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 5000)
        : 1500;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      response = await fetchApiResponse(url, fetchOptions, path);
    }

    let text = await response.text();
    let payload = text ? parsePayload(text) : null;

    // Every application-level API error is JSON. A bare or HTML 400 therefore
    // came from request parsing or an upstream edge before a route could run,
    // making one retry safe even for mutations. Normalizing empty mutations to
    // `{}` above also avoids browser/proxy differences around bodyless POSTs.
    if (
      response.status === 400
      && isMutationMethod(method)
      && options.retryOpaqueBadRequest !== false
      && !hasApiErrorPayload(payload)
    ) {
      response = await fetchApiResponse(url, fetchOptions, path);
      text = await response.text();
      payload = text ? parsePayload(text) : null;
    }

    return handleApiResponse(
      response.ok,
      response.status,
      payload,
      path,
      {
        progressionAnimation,
        responseContentType: response.headers.get('Content-Type') || ''
      }
    );
  }

  async function fetchApiResponse(url, fetchOptions, path) {
    try {
      return await fetch(url, fetchOptions);
    } catch (error) {
      throw createNetworkError(error, path);
    }
  }

  function isMutationMethod(method) {
    return !['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase());
  }

  function hasApiErrorPayload(payload) {
    return Boolean(payload && typeof payload === 'object' && payload.error);
  }

  function hasHeader(headers, expectedName) {
    const normalizedName = String(expectedName || '').toLowerCase();
    return Object.keys(headers || {}).some((name) => name.toLowerCase() === normalizedName);
  }

  function createReadRequestKey(method, url, headers) {
    const normalizedHeaders = Object.keys(headers)
      .sort()
      .map((name) => `${name.toLowerCase()}:${headers[name]}`)
      .join('|');
    return `${method}:${url}:${normalizedHeaders}`;
  }

  async function nativeApi(url, options, headers, body, path = url, responseOptions = {}) {
    let response;
    try {
      response = await window.Capacitor.Plugins.CapacitorHttp.request({
        url,
        method: (options.method || 'GET').toUpperCase(),
        headers,
        data: body,
        responseType: 'text'
      });
    } catch (error) {
      throw createNetworkError(error, url);
    }

    const status = Number(response.status || 0);
    return handleApiResponse(
      status >= 200 && status < 300,
      status,
      normalizePayload(response.data),
      path,
      responseOptions
    );
  }

  function shouldUseNativeHttp() {
    return Boolean(
      window.AmongDemons?.isPackagedRuntime?.()
      && window.Capacitor?.isNativePlatform?.()
      && window.Capacitor?.Plugins?.CapacitorHttp?.request
    );
  }

  function handleApiResponse(ok, status, payload, path = '', options = {}) {
    if (!ok) {
      const message = payload && payload.error ? payload.error : 'Something went wrong.';
      const error = new Error(message);
      error.status = status;
      error.payload = payload;
      error.path = path;
      error.responseContentType = options.responseContentType || '';
      throw error;
    }

    notifyProgressionPayload(payload, path, options);
    return payload;
  }

  function notifyProgressionPayload(payload, path = '', requestOptions = {}) {
    if (!payload || typeof payload !== 'object') return;

    const ui = window.AmongDemons?.ui;
    if (!ui) return;

    const candidate = getProgressionCandidate(payload, path);
    if (!candidate) return;

    const animationOverride = requestOptions.progressionAnimation;
    const options = {
      animate: animationOverride === undefined
        ? shouldAnimateProgressionPayload(path)
        : animationOverride !== false
    };

    if (candidate.kind === 'player' && typeof ui.updateNavAccount === 'function') {
      ui.updateNavAccount(candidate.data, options);
      return;
    }

    if (typeof ui.updateNavProgression === 'function') {
      ui.updateNavProgression(candidate.data, options);
      return;
    }

    if (typeof ui.updateNavXpProgress === 'function') {
      ui.updateNavXpProgress(candidate.data, options);
    }
  }

  function shouldAnimateProgressionPayload(path = '') {
    const pathname = getPayloadPathname(path);
    return !['/api/auth/me', '/api/account/progression'].includes(pathname);
  }

  function getPayloadPathname(path = '') {
    try {
      return new URL(String(path), window.location.origin).pathname.replace(/\/+$/, '');
    } catch (error) {
      return String(path).replace(/\/+$/, '');
    }
  }

  function getProgressionCandidate(payload, path = '') {
    // Future XP-granting endpoints should return updated `player` or `progression`.
    // Top-level `xp` is ignored because run payout responses use it as earned XP, not total account XP.
    if (hasProgressionShape(payload.progression)) {
      return { kind: 'progression', data: payload.progression };
    }

    if (hasProgressionShape(payload.player)) {
      return { kind: 'player', data: payload.player };
    }

    if (isProgressionEndpoint(path) && hasProgressionShape(payload)) {
      return { kind: 'progression', data: payload };
    }

    if (payload.levelProgress && hasProgressionShape(payload)) {
      return { kind: 'progression', data: payload };
    }

    return null;
  }

  function hasProgressionShape(value) {
    if (!value || typeof value !== 'object') return false;
    return Boolean(
      value.levelProgress ||
      Number.isFinite(Number(value.xp)) ||
      Number.isFinite(Number(value.level))
    );
  }

  function isProgressionEndpoint(path = '') {
    return getPayloadPathname(path) === '/api/account/progression';
  }

  function normalizePayload(data) {
    if (!data) return null;
    return typeof data === 'string' ? parsePayload(data) : data;
  }

  function parsePayload(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  }

  function createNetworkError(cause, path = '') {
    const error = new Error('Network error');
    error.code = 'NETWORK_ERROR';
    error.path = path;
    error.cause = cause;
    return error;
  }

  function showGameAlert(input, options = {}) {
    const alert = normalizeGameAlert(input, options);
    const element = document.createElement('div');
    element.setAttribute('role', 'alert');
    element.setAttribute('aria-live', getAlertLiveMode(alert.type));
    element.setAttribute('aria-atomic', 'true');
    setGameAlert(element, alert, { forceVisible: true });
    ensureGameAlertHost().replaceChildren(element);
    return element;
  }

  function setGameAlert(element, input, options = {}) {
    if (!element) return null;

    if (!input) {
      element.innerHTML = '';
      element.className = options.emptyClassName || 'alert d-none';
      return null;
    }

    const alert = isNormalizedAlert(input) ? input : normalizeGameAlert(input, options);
    const bootstrapType = toBootstrapAlertType(alert.type);
    const baseClasses = options.inline
      ? ['game-alert', `game-alert-${alert.type}`, options.className || '']
      : ['alert', `alert-${bootstrapType}`, 'game-alert', `game-alert-${alert.type}`, options.className || ''];

    element.className = baseClasses.filter(Boolean).join(' ');
    element.innerHTML = renderGameAlertHtml(alert, options);
    if (options.forceVisible) element.classList.remove('d-none');
    element.setAttribute('role', options.role || (alert.type === 'error' || alert.type === 'warning' ? 'alert' : 'status'));
    element.setAttribute('aria-live', getAlertLiveMode(alert.type));
    element.setAttribute('aria-atomic', 'true');
    return alert;
  }

  function normalizeGameAlert(input, options = {}) {
    if (isExplicitAlert(input)) {
      const type = normalizeAlertType(input.type || options.type || 'info');
      const alert = {
        type,
        title: sanitizeAlertText(input.title || DEFAULT_ALERTS[type].title),
        message: sanitizeAlertText(input.message || input.body || DEFAULT_ALERTS[type].message),
        action: sanitizeAlertText(input.action || DEFAULT_ALERTS[type].action)
      };
      return {
        ...alert,
        icon: input.icon || pickGameAlertIcon(alert)
      };
    }

    const type = normalizeAlertType(options.type || input?.type || 'info');
    const rawText = getAlertText(input);
    const status = Number(input?.status || options.status || 0);
    const path = String(input?.path || options.path || '');
    const mapped = mapGameAlert(rawText, {
      type,
      status,
      path,
      code: input?.code || '',
      context: options.context || '',
      payload: input?.payload || null
    });

    if (mapped) {
      const mappedType = normalizeAlertType(mapped.type || type);
      const alert = {
        type: mappedType,
        title: mapped.title,
        message: mapped.message,
        action: mapped.action
      };
      return {
        ...alert,
        icon: mapped.icon || pickGameAlertIcon(alert)
      };
    }

    return buildDefaultGameAlert(rawText, type);
  }

  function mapGameAlert(rawText, meta = {}) {
    const text = String(rawText || '').trim();
    const lower = text.toLowerCase();
    const path = String(meta.path || '').toLowerCase();
    const status = Number(meta.status) || 0;
    const requestedType = normalizeAlertType(meta.type || 'info');

    if (status === 401 || /unauthorized|invalid token|session expired|sign-in session expired/.test(lower)) {
      return {
        type: 'error',
        title: 'The gate is sealed.',
        message: 'Your sign-in has expired.',
        action: 'Sign in again to continue.'
      };
    }

    if (meta?.payload?.cooldownUntil || /cooldown/.test(lower)) {
      return {
        type: 'warning',
        title: 'The challenge must wait.',
        message: 'This opponent is still on cooldown.',
        action: 'Try again when the timer ends.'
      };
    }

    if (isNetworkErrorText(lower) || meta.code === 'NETWORK_ERROR') {
      return {
        type: 'error',
        title: 'The shadows did not answer.',
        message: 'Your connection broke before the game could respond.',
        action: 'Check your connection and try again.'
      };
    }

    if (/pixijs failed to load|world map failed to load/.test(lower)) {
      return {
        type: 'error',
        title: 'The world map stayed dark.',
        message: 'The wilds could not be drawn on this device.',
        action: 'Refresh the page or return to camp.'
      };
    }

    if (/username and password are required|name and password|required/.test(lower) && path.includes('/auth/')) {
      return {
        type: 'warning',
        title: 'Name and password required.',
        message: 'The gate needs both before it opens.',
        action: 'Enter your username and password.'
      };
    }

    if (/email\/password login is disabled|password login is disabled/.test(lower)) {
      const provider = text.match(/use\s+([a-z]+)\s+sign-in/i)?.[1] || '';
      const providerLabel = provider ? provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase() : 'the linked provider';
      return {
        type: 'warning',
        title: 'Use the marked gate.',
        message: `This account uses ${providerLabel} sign-in.`,
        action: `Continue with ${providerLabel} to enter.`
      };
    }

    if (/invalid (?:username|email) or password|password reset/.test(lower)) {
      return {
        type: 'error',
        title: 'The gate refused your name.',
        message: 'Those sign-in details did not match a hunter.',
        action: 'Check your name and password, then try again.'
      };
    }

    if (/username must be 3 to 64/.test(lower)) {
      return {
        type: 'warning',
        title: 'Choose a valid hunter name.',
        message: 'Use 3 to 64 letters, numbers, hyphens, or underscores.',
        action: 'Start and end the name with a letter or number.'
      };
    }

    if (/username is already taken/.test(lower)) {
      return {
        type: 'warning',
        title: 'That name is claimed.',
        message: 'Another hunter already bears it.',
        action: 'Choose a different username.'
      };
    }

    if (/provider.*not configured|sign-in provider is not configured|not configured yet/.test(lower)) {
      return {
        type: 'warning',
        title: 'That gate is dormant.',
        message: 'This sign-in path is not ready yet.',
        action: 'Use username and password instead.'
      };
    }

    if (/sign-in was cancelled|access_denied/.test(lower)) {
      return {
        type: 'warning',
        title: 'Sign-in cancelled.',
        message: 'The outside gate was closed before it opened.',
        action: 'Try again or use username and password.'
      };
    }

    if (/provider could not sign you in|oauth_failed|sign-in could not continue/.test(lower)) {
      return {
        type: 'error',
        title: 'The sign-in ritual failed.',
        message: 'The outside gate could not return your hunter.',
        action: 'Try again or use username and password.'
      };
    }

    if (/dungeon refused|unable to start dungeon|failed to start run|start run/.test(lower)) {
      return {
        type: 'error',
        title: 'The dungeon refused your call.',
        message: 'A new descent could not begin.',
        action: 'Try again in a moment.'
      };
    }

    if (/run not found|no active run|run is not active/.test(lower)) {
      return {
        type: 'warning',
        title: 'No dungeon run is active.',
        message: 'The last descent can no longer be found.',
        action: 'Return to camp and begin a new descent.'
      };
    }

    if (/choose a demonic pact|pact.*before|pending.*pact/.test(lower)) {
      return {
        type: 'warning',
        title: 'A pact awaits.',
        message: 'The next fight is sealed until a Demonic Pact is chosen.',
        action: 'Choose a Demonic Pact before continuing.'
      };
    }

    if (/no recruitable demons available|no recruit choice is pending/.test(lower)) {
      return {
        type: 'info',
        title: 'No recruits found.',
        message: 'No demon is waiting to join this team.',
        action: 'Win more battles and check again.'
      };
    }

    if (/demon already recruited/.test(lower)) {
      return {
        type: 'info',
        title: 'Recruit already bound.',
        message: 'That demon has already joined your run.',
        action: 'Choose your next move.'
      };
    }

    if (/keep at least one demon/.test(lower)) {
      return {
        type: 'warning',
        title: 'Choose your vanguard.',
        message: 'Your team needs at least 1 demon before the descent continues.',
        action: 'Place a demon on your team.'
      };
    }

    const teamLimit = text.match(/choose up to ([\d,]+) demons/i);
    if (teamLimit) {
      return {
        type: 'warning',
        title: 'Too many demons chosen.',
        message: `Your team can hold up to ${teamLimit[1]} demons.`,
        action: 'Remove extras before continuing.'
      };
    }

    if (/select 2 demons|choose 2 demons/.test(lower)) {
      return {
        type: 'warning',
        title: 'Choose your vanguard.',
        message: 'Select 2 demons before entering.',
        action: 'Pick both demons, then begin the fight.'
      };
    }

    if (/not enough souls|need [\d,]+ more souls|training costs [\d,]+ souls|recast costs [\d,]+ souls/.test(lower)) {
      const costAmount = text.match(/costs\s+([\d,]+)\s+souls/i)?.[1] || '';
      const deficitAmount = text.match(/need\s+([\d,]+)\s+more\s+souls/i)?.[1] || '';
      return {
        type: 'warning',
        title: 'Not enough Souls.',
        message: costAmount
          ? `This ritual costs ${costAmount} Souls.`
          : deficitAmount
            ? `This ritual needs ${deficitAmount} more Souls.`
            : 'You do not have enough Souls for this ritual.',
        action: 'Gather more Souls before trying again.'
      };
    }

    if (/already maxed|maxed out/.test(lower)) {
      return {
        type: 'info',
        title: 'This demon has reached its peak.',
        message: 'Training cannot raise its stats any further.',
        action: 'Choose another demon to train.'
      };
    }

    if (/unable to train|training failed|train this demon/.test(lower)) {
      return {
        type: 'error',
        title: 'The ritual failed.',
        message: 'Your Souls were not spent.',
        action: 'Try again.'
      };
    }

    if (/demon not found|that demon is not in your collection|choose a valid collection demon/.test(lower)) {
      return {
        type: 'warning',
        title: 'No demon found.',
        message: 'That collection demon could not be found.',
        action: 'Return to Collection and choose another demon.'
      };
    }

    if (/hunter not found|no public record/.test(lower)) {
      return {
        type: 'warning',
        title: 'No hunter found.',
        message: 'That name has no public record.',
        action: 'Check the spelling or return to the Leaderboard.'
      };
    }

    if (/could not load rankings|load rankings/.test(lower)) {
      return {
        type: 'error',
        title: 'The Leaderboard is veiled.',
        message: 'The hunter board could not be loaded.',
        action: 'Try again in a moment.'
      };
    }

    if (/loading team/.test(lower)) {
      return {
        type: 'info',
        title: 'Summoning your team.',
        message: 'Your hunting roster is being gathered.',
        action: 'Wait a moment.'
      };
    }

    if (/saving team/.test(lower)) {
      return {
        type: 'info',
        title: 'Sealing the formation.',
        message: 'Your hunting team is being saved.',
        action: 'Wait a moment.'
      };
    }

    if (/hunting team editor is unavailable/.test(lower)) {
      return {
        type: 'error',
        title: 'Team editor unavailable.',
        message: 'The formation panel could not open.',
        action: 'Try again in a moment.'
      };
    }

    if (/could not load hunting team|unable to load hunting team/.test(lower)) {
      return {
        type: 'error',
        title: 'The team roster is hidden.',
        message: 'Your hunting team could not be loaded.',
        action: 'Try again in a moment.'
      };
    }

    if (/could not save hunting team|save hunting team|world team cannot exceed ([\d,]+) demons|hunting team can hold up to ([\d,]+) demons/.test(lower)) {
      const limit = text.match(/(?:cannot exceed|hold up to) ([\d,]+) demons/i)?.[1] || '';
      return {
        type: 'warning',
        title: 'The team could not be saved.',
        message: limit ? `Your hunting team can hold up to ${limit} demons.` : 'The formation could not be saved.',
        action: 'Adjust the team and try again.'
      };
    }

    if (/dangerous to travel alone|choose a hunting team|assign a team/.test(lower)) {
      return {
        type: 'warning',
        title: 'It is dangerous to travel alone.',
        message: 'The wilds require an active demon team.',
        action: 'Assign a team before moving.'
      };
    }

    if (/no passable route/.test(lower)) {
      return {
        type: 'warning',
        title: 'No path through the dark.',
        message: 'The route is blocked from here.',
        action: 'Choose another tile.'
      };
    }

    if (/fight failed|battle failed|hunting remains locked/.test(lower)) {
      return {
        type: 'warning',
        title: 'The hunt held firm.',
        message: 'Your team was not strong enough to unlock this area.',
        action: 'Train or change your team, then try again.'
      };
    }

    if (/you are strong enough/.test(lower)) {
      return {
        type: 'success',
        title: 'Hunting unlocked.',
        message: 'Your team can handle this area.',
        action: 'Start hunting when ready.'
      };
    }

    const startedHunt = text.match(/you started hunting (.+)\./i);
    if (startedHunt) {
      return {
        type: 'success',
        title: 'Hunt begun.',
        message: `Your team is hunting ${startedHunt[1]}.`,
        action: 'Return later to claim the spoils.'
      };
    }

    const huntRewards = text.match(/^earned ([\d,]+) xp and ([\d,]+) souls?\.\s*lost ([\d,]+) souls?\.?$/i);
    if (huntRewards) {
      return {
        type: 'success',
        title: `Earned ${huntRewards[1]} XP and ${huntRewards[2]} Souls.`,
        message: `Lost ${huntRewards[3]} Souls.`,
        action: 'Return later for more rewards.'
      };
    }

    const huntEnded = text.match(/hunting (?:ended|stopped).*earned ([\d,]+) xp and ([\d,]+) souls/i);
    if (huntEnded) {
      const soulsLost = text.match(/lost ([\d,]+) souls?/i);
      return {
        type: 'success',
        title: 'Hunt ended.',
        message: `You earned ${huntEnded[1]} XP and ${huntEnded[2]} Souls.${soulsLost ? ` Lost ${soulsLost[1]} Souls.` : ''}`,
        action: soulsLost
          ? 'Expand your Soul Vessel in the skill tree to bank more.'
          : 'Choose another hunt or return to camp.'
      };
    }

    if (/hunting already stopped/.test(lower)) {
      return {
        type: 'info',
        title: 'Hunt already ended.',
        message: 'No active hunt is running now.',
        action: 'Travel or choose another hunt.'
      };
    }

    if (/soul anchored/.test(lower)) {
      return {
        type: 'success',
        title: 'Soul anchored.',
        message: 'This Forsaken Shrine is now your return point.',
        action: 'Continue exploring.'
      };
    }

    const receivedReward = text.match(/^(quest reward|daily cache)\.\s*earned ([\d,]+) (xp|souls?)\.?$/i);
    if (receivedReward) {
      const source = receivedReward[1].toLowerCase() === 'daily cache'
        ? 'Daily cache.'
        : 'Quest reward.';
      const unit = receivedReward[3].toLowerCase() === 'xp'
        ? 'XP'
        : (receivedReward[3].toLowerCase() === 'soul' ? 'Soul' : 'Souls');
      return {
        type: 'success',
        title: source,
        message: `Earned ${receivedReward[2]} ${unit}.`,
        action: receivedReward[1].toLowerCase() === 'daily cache'
          ? 'Return after the daily reset for more.'
          : 'Keep pushing for the next mark.'
      };
    }

    if (/quest reward claimed/.test(lower)) {
      return {
        type: 'success',
        title: 'Reward claimed.',
        message: 'The quest payout was added to your hunter.',
        action: 'Keep pushing for the next mark.'
      };
    }

    if (/lost souls claimed/.test(lower)) {
      return {
        type: 'success',
        title: 'Lost Souls claimed.',
        message: 'The campfire cache is yours for today.',
        action: 'Return after the daily reset for more.'
      };
    }

    if (/^username updated\.?$/.test(lower)) {
      return {
        type: 'success',
        title: 'Name changed.',
        message: 'Other hunters will see the new name.',
        action: 'Continue when ready.'
      };
    }

    if (/choose a profile setting to update/.test(lower)) {
      return {
        type: 'warning',
        title: 'No setting chosen.',
        message: 'Nothing changed on your hunter profile.',
        action: 'Change a field before saving.'
      };
    }

    if (/already up to date/.test(lower)) {
      return {
        type: 'info',
        title: 'Already up to date.',
        message: 'Your hunter name is unchanged.',
        action: 'Choose a new name before saving.'
      };
    }

    if (/constellation sealed/.test(lower)) {
      return {
        type: 'success',
        title: 'Constellation sealed.',
        message: 'Your skill bonuses are active.',
        action: 'Return to camp or keep refining your build.'
      };
    }

    if (/draft constellation cleared/.test(lower)) {
      return {
        type: 'info',
        title: 'Draft cleared.',
        message: 'Your unsaved constellation changes were removed.',
        action: 'Spend points again or leave them unspent.'
      };
    }

    const resetCost = text.match(/released for ([\d,]+) souls?/i);
    if (resetCost) {
      return {
        type: 'success',
        title: 'Bindings released.',
        message: `${resetCost[1]} Souls were spent to reset your constellation.`,
        action: 'Assign your points again.'
      };
    }

    const battleWon = text.match(/battle won!?\s*(?:gained\s+)?([\d,]+)\s+xp(?:\s+and\s+([\d,]+)\s+souls?)?/i);
    if (battleWon) {
      return {
        type: 'success',
        title: 'Battle won.',
        message: battleWon[2]
          ? `You gained ${battleWon[1]} XP and ${battleWon[2]} Souls.`
          : `You gained ${battleWon[1]} XP.`,
        action: 'Adjust your hand, then continue.'
      };
    }

    const teamHuntEnded = text.match(/hunting team updated\..*earned ([\d,]+) xp and ([\d,]+) souls/i);
    if (teamHuntEnded) {
      return {
        type: 'success',
        title: 'Hunting team ready.',
        message: `Your active hunt ended; you earned ${teamHuntEnded[1]} XP and ${teamHuntEnded[2]} Souls.`,
        action: 'Choose a new hunt or continue exploring.'
      };
    }

    if (/hunting team updated/.test(lower)) {
      return {
        type: 'success',
        title: 'Hunting team ready.',
        message: /hunting spots reset/.test(lower)
          ? 'Your world formation is saved and hunting spots were reset.'
          : 'Your world formation is saved.',
        action: 'Continue exploring.'
      };
    }

    if (/team updated|team ready/.test(lower)) {
      return {
        type: 'success',
        title: 'Team ready.',
        message: 'Your formation is set for the next floor.',
        action: 'Continue the descent.'
      };
    }

    if (/extraction complete/.test(lower)) {
      return {
        type: 'success',
        title: 'Extraction complete.',
        message: 'You left the dungeon with your rewards.',
        action: 'Return to camp or begin another descent.'
      };
    }

    if (/continuing to the next floor/.test(lower)) {
      return {
        type: 'success',
        title: 'Descent continues.',
        message: 'Your team moves to the next floor.',
        action: 'Prepare for the next fight.'
      };
    }

    if (/demonic pacts recast for ([\d,]+) souls/.test(lower)) {
      const cost = text.match(/for ([\d,]+) souls/i)?.[1] || '';
      return {
        type: 'success',
        title: 'Pacts recast.',
        message: `${cost} Souls were spent to summon new choices.`,
        action: 'Choose one before continuing.'
      };
    }

    if (/^pact accepted\.?$/.test(lower)) {
      return {
        type: 'success',
        title: 'Pact sealed.',
        message: 'A new power now shapes this run.',
        action: 'Enter the next chamber when ready.'
      };
    }

    if (/sealed\.$/.test(lower) && /pact|blood|demonic|curse|boon|shadow|terror/.test(lower)) {
      const pactName = stripTrailingPeriod(text).replace(/\s+sealed$/i, '');
      return {
        type: 'success',
        title: 'Pact sealed.',
        message: `${pactName} now shapes this run.`,
        action: 'Continue when ready.'
      };
    }

    if (/potions are not available yet/.test(lower)) {
      return {
        type: 'info',
        title: 'No potions in this camp.',
        message: 'That tool is not ready for this run.',
        action: 'Use your demons and formation instead.'
      };
    }

    if (/save your hunter/.test(lower) || meta?.payload?.guestBlocked) {
      return {
        type: 'warning',
        title: 'Save your hunter first.',
        message: /change its name/.test(lower)
          ? 'Guest hunters rename themselves by saving.'
          : 'Guest hunters cannot use this feature yet.',
        action: 'Save your hunter to keep it forever.'
      };
    }

    if (requestedType !== 'success' && /you were defeated|your team was defeated|run ended in defeat|dragged back|anchored shrine/.test(lower)) {
      return {
        type: 'warning',
        title: 'You were defeated.',
        message: 'Your hunter returned to the Anchored Shrine.',
        action: 'Regroup and choose your next move.'
      };
    }

    if (isTechnicalText(lower)) {
      return DEFAULT_ALERTS[normalizeAlertType(meta.type || 'error')];
    }

    return null;
  }

  function buildDefaultGameAlert(rawText, type) {
    const normalizedType = normalizeAlertType(type);
    const defaults = DEFAULT_ALERTS[normalizedType];
    const text = sanitizeAlertText(rawText);

    if (!text) {
      const alert = {
        type: normalizedType,
        ...defaults
      };
      return {
        ...alert,
        icon: pickGameAlertIcon(alert)
      };
    }

    if (normalizedType === 'success') {
      const alert = {
        type: normalizedType,
        title: stripTrailingPeriod(text),
        message: defaults.message,
        action: defaults.action
      };
      return {
        ...alert,
        icon: pickGameAlertIcon(alert)
      };
    }

    if (normalizedType === 'info') {
      const alert = {
        type: normalizedType,
        title: stripTrailingPeriod(text),
        message: defaults.message,
        action: defaults.action
      };
      return {
        ...alert,
        icon: pickGameAlertIcon(alert)
      };
    }

    const alert = {
      type: normalizedType,
      title: defaults.title,
      message: text,
      action: defaults.action
    };
    return {
      ...alert,
      icon: pickGameAlertIcon(alert)
    };
  }

  function renderGameAlertHtml(alert, options = {}) {
    const icon = options.icon === false ? '' : renderAlertIcon(alert.icon, alert.type);
    return `
      ${icon ? `<span class="game-alert-icon" aria-hidden="true">${icon}</span>` : ''}
      <span class="game-alert-copy">
        <strong class="game-alert-title">${renderGameAlertText(alert.title)}</strong>
        ${alert.message ? `<span class="game-alert-message">${renderGameAlertText(alert.message)}</span>` : ''}
        ${alert.action ? `<span class="game-alert-action">${renderGameAlertText(alert.action)}</span>` : ''}
      </span>
    `;
  }

  function renderGameAlertText(text) {
    const rewardText = escapeHtml(text).replace(
      /([+-]?\d[\d,]*(?:\.\d+)?)\s*(XP|Souls?)\b/gi,
      (match, amount, unit) => {
        if (String(unit).toLowerCase() === 'xp') {
          return `<span class="game-alert-reward-amount game-alert-xp-amount">${amount} XP</span>`;
        }

        return `<span class="game-alert-reward-amount game-alert-souls-amount"><img src="/app/images/assets/soul.svg" class="soul-icon" alt="" width="16" height="16" aria-hidden="true"><span class="game-alert-souls-value">${amount}</span> <span class="game-alert-souls-label">${unit}</span></span>`;
      }
    );

    return rewardText.replace(
      ALERT_DEMON_RARITY_PATTERN,
      (match, rarity, demonLabel) => `<span class="game-alert-demon-identity"><span class="game-alert-demon-rarity ad-${String(rarity).toLowerCase()}">${rarity}</span> <span class="game-alert-demon-name">${demonLabel.trimStart()}</span></span>`
    );
  }

  function renderAlertIcon(icon, type) {
    const renderIcon = window.AmongDemons?.ui?.renderIcon;
    if (typeof renderIcon !== 'function') return '';
    return renderIcon(icon || ALERT_ICON_MAP[type] || 'info', {
      size: 20,
      className: 'game-alert-lucide'
    });
  }

  function pickGameAlertIcon(alert) {
    const combinedText = `${alert?.title || ''} ${alert?.message || ''} ${alert?.action || ''}`.toLowerCase();
    const rule = ALERT_ICON_RULES.find((item) => item.pattern.test(combinedText));
    return rule?.icon || ALERT_ICON_MAP[normalizeAlertType(alert?.type)] || 'info';
  }

  function ensureGameAlertHost() {
    let host = document.getElementById(GAME_ALERT_HOST_ID);
    if (host) return host;

    host = document.createElement('div');
    host.id = GAME_ALERT_HOST_ID;
    host.className = 'game-alert-host';
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-atomic', 'true');
    document.body.appendChild(host);
    return host;
  }

  function getAlertText(input) {
    if (typeof input === 'string') return input;
    if (!input) return '';
    if (input.playerMessage) return input.playerMessage;
    if (input.message) return input.message;
    return String(input);
  }

  function isExplicitAlert(input) {
    return Boolean(input && typeof input === 'object' && !(input instanceof Error) && (
      Object.prototype.hasOwnProperty.call(input, 'title') ||
      Object.prototype.hasOwnProperty.call(input, 'action') ||
      Object.prototype.hasOwnProperty.call(input, 'body') ||
      (
        Object.prototype.hasOwnProperty.call(input, 'type') &&
        Object.prototype.hasOwnProperty.call(input, 'message') &&
        !Object.prototype.hasOwnProperty.call(input, 'status') &&
        !Object.prototype.hasOwnProperty.call(input, 'path') &&
        !Object.prototype.hasOwnProperty.call(input, 'code')
      )
    ));
  }

  function isNormalizedAlert(input) {
    return Boolean(input && typeof input === 'object' && input.title && input.message && input.action && input.type);
  }

  function normalizeAlertType(type) {
    return ALERT_TYPE_MAP[String(type || '').toLowerCase()] || 'info';
  }

  function toBootstrapAlertType(type) {
    return normalizeAlertType(type) === 'error' ? 'danger' : normalizeAlertType(type);
  }

  function getAlertLiveMode(type) {
    const normalizedType = normalizeAlertType(type);
    return normalizedType === 'error' || normalizedType === 'warning' ? 'assertive' : 'polite';
  }

  function sanitizeAlertText(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return isTechnicalText(text.toLowerCase()) ? '' : text;
  }

  function isNetworkErrorText(lower) {
    return /network error|failed to fetch|load failed|request failed|the network connection was lost|could not connect/.test(lower);
  }

  function isTechnicalText(lower) {
    return /http\s*\d+|status\s*\d+|\/api\/|unexpected api error|database|sql|json|syntaxerror|typeerror|stack trace|request failed|\{.*\}/.test(lower);
  }

  function stripTrailingPeriod(value) {
    return String(value || '').replace(/\.+$/, '');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.AmongDemons = {
    ...(window.AmongDemons || {}),
    api,
    claimGuest,
    clearSession,
    ensurePlayableSession,
    getPlayer,
    getSession,
    getToken,
    isGuest,
    playAsGuest,
    setSession,
    normalizeGameAlert,
    renderGameAlertHtml,
    setGameAlert,
    showGameAlert
  };
  window.AmongDemons.ui = {
    ...(window.AmongDemons.ui || {}),
    normalizeGameAlert,
    renderGameAlertHtml,
    setGameAlert,
    showGameAlert
  };
})();
