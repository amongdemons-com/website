(function() {
  'use strict';

  const STORAGE_KEY = 'amongdemons-api-test-state';
  const renderIcon = window.AmongDemons?.ui?.renderIcon || (() => '');
  const state = loadState();
  const elements = {};

  const endpoints = [
    {
      group: 'publicEndpoints',
      title: 'Demon Types',
      method: 'GET',
      path: '/api/game/demon-types',
      auth: false
    },
    {
      group: 'publicEndpoints',
      title: 'Demon Catalog',
      method: 'GET',
      path: '/api/game/demons',
      auth: false
    },
    {
      group: 'publicEndpoints',
      title: 'Leaderboard',
      method: 'GET',
      path: '/api/leaderboard',
      auth: false
    },
    {
      group: 'authEndpoints',
      title: 'Register',
      method: 'POST',
      path: '/api/auth/register',
      auth: false,
      body: () => ({
        username: demoUsername(),
        password: 'demons123',
        email: `${demoUsername()}@amongdemons.local`
      })
    },
    {
      group: 'authEndpoints',
      title: 'Login',
      method: 'POST',
      path: '/api/auth/login',
      auth: false,
      body: () => ({
        username: state.username || demoUsername(),
        password: state.password || 'demons123'
      })
    },
    {
      group: 'authEndpoints',
      title: 'Current Player',
      method: 'GET',
      path: '/api/auth/me',
      auth: true
    },
    {
      group: 'accountEndpoints',
      title: 'Progression',
      method: 'GET',
      path: '/api/account/progression',
      auth: true
    },
    {
      group: 'accountEndpoints',
      title: 'Player Demons',
      method: 'GET',
      path: '/api/demons',
      auth: true
    },
    {
      group: 'accountEndpoints',
      title: 'Demon By ID',
      method: 'GET',
      path: () => `/api/demons/${encodeURIComponent(state.demonId || ':id')}`,
      auth: true,
      params: ['demonId']
    },
    {
      group: 'runEndpoints',
      title: 'Start Run',
      method: 'POST',
      path: '/api/runs/start',
      auth: true
    },
    {
      group: 'runEndpoints',
      title: 'Show Run',
      method: 'GET',
      path: () => `/api/runs/${encodeURIComponent(state.runId || ':id')}`,
      auth: true,
      params: ['runId']
    },
    {
      group: 'runEndpoints',
      title: 'Battle',
      method: 'POST',
      path: () => `/api/runs/${encodeURIComponent(state.runId || ':id')}/battle`,
      auth: true,
      params: ['runId']
    },
    {
      group: 'runEndpoints',
      title: 'Claim Reward',
      method: 'POST',
      path: () => `/api/runs/${encodeURIComponent(state.runId || ':id')}/reward`,
      auth: true,
      params: ['runId'],
      body: () => ({
        rewardId: Number(state.rewardId || 1)
      })
    },
    {
      group: 'runEndpoints',
      title: 'Recruit Reward',
      method: 'POST',
      path: () => `/api/runs/${encodeURIComponent(state.runId || ':id')}/recruit`,
      auth: true,
      params: ['runId'],
      body: () => ({
        rewardId: Number(state.rewardId || 1)
      })
    },
    {
      group: 'runEndpoints',
      title: 'End Run',
      method: 'POST',
      path: () => `/api/runs/${encodeURIComponent(state.runId || ':id')}/end`,
      auth: true,
      params: ['runId']
    }
  ];

  onReady(init);

  function init() {
    cacheElements();
    renderEndpoints();
    bindStateInputs();
    bindHeaderActions();
    syncStateInputs();
  }

  function cacheElements() {
    elements.token = document.getElementById('apiToken');
    elements.runId = document.getElementById('runId');
    elements.rewardId = document.getElementById('rewardId');
    elements.demonId = document.getElementById('demonId');
    elements.log = document.getElementById('api-log');
  }

  function renderEndpoints() {
    endpoints.forEach((endpoint, index) => {
      const container = document.getElementById(endpoint.group);
      if (!container) return;

      const column = document.createElement('div');
      column.className = 'col';
      column.innerHTML = renderEndpointCard(endpoint, index);
      container.appendChild(column);

      const card = column.querySelector('.api-card');
      const form = card.querySelector('form');
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        sendEndpoint(endpoint, card);
      });
    });
  }

  function renderEndpointCard(endpoint, index) {
    const path = getPath(endpoint);
    const body = endpoint.body ? formatJson(endpoint.body()) : '';
    const authBadge = endpoint.auth
      ? '<span class="badge text-bg-warning">auth</span>'
      : '<span class="badge text-bg-secondary">public</span>';

    return `
      <div class="card h-100 api-card" data-endpoint-index="${index}">
        <div class="card-header d-flex align-items-center justify-content-between gap-2">
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${methodClass(endpoint.method)} api-method">${endpoint.method}</span>
            <span>${escapeHtml(endpoint.title)}</span>
          </div>
          ${authBadge}
        </div>
        <div class="card-body">
          <form>
            <label class="form-label" for="path-${index}">Path</label>
            <input class="form-control stored-value mb-3 js-path" id="path-${index}" value="${escapeHtml(path)}">
            ${renderParamHelp(endpoint)}
            ${endpoint.body ? `
              <label class="form-label" for="body-${index}">JSON Body</label>
              <textarea class="form-control mb-3 js-body" id="body-${index}" spellcheck="false">${escapeHtml(body)}</textarea>
            ` : ''}
            <div class="d-flex justify-content-between align-items-center gap-2">
              <button class="btn btn-primary" type="submit">
                ${renderIcon('send')}
              </button>
              <small class="text-muted js-status">Not sent</small>
            </div>
          </form>
        </div>
        <div class="card-footer">
          <pre class="bg-black border rounded p-3 mb-0 js-result">No response yet.</pre>
        </div>
      </div>
    `;
  }

  function renderParamHelp(endpoint) {
    if (!endpoint.params || !endpoint.params.length) return '';
    return `<p class="small text-muted mb-3">Uses stored ${endpoint.params.map((param) => `<span class="stored-value">${param}</span>`).join(', ')}.</p>`;
  }

  async function sendEndpoint(endpoint, card) {
    refreshEndpointCard(endpoint, card);

    const pathInput = card.querySelector('.js-path');
    const bodyInput = card.querySelector('.js-body');
    const result = card.querySelector('.js-result');
    const status = card.querySelector('.js-status');
    const started = performance.now();

    const options = {
      method: endpoint.method,
      headers: {
        Accept: 'application/json'
      }
    };

    if (endpoint.auth) {
      const token = elements.token.value.trim();
      if (token) {
        options.headers.Authorization = `Bearer ${token}`;
      }
    }

    if (bodyInput) {
      try {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(JSON.parse(bodyInput.value || '{}'));
      } catch (error) {
        result.textContent = `Invalid JSON body:\n${error.message}`;
        status.textContent = 'Invalid JSON';
        return;
      }
    }

    status.textContent = 'Sending...';
    result.textContent = 'Waiting for response...';

    try {
      const response = await fetch(pathInput.value.trim(), options);
      const text = await response.text();
      const payload = parsePayload(text);
      const elapsed = Math.round(performance.now() - started);
      const output = {
        status: response.status,
        ok: response.ok,
        elapsedMs: elapsed,
        body: payload
      };

      rememberResponse(payload);
      syncStateInputs();
      refreshAllDynamicCards();

      status.textContent = `${response.status} in ${elapsed}ms`;
      result.textContent = formatJson(output);
      writeLog(endpoint, pathInput.value.trim(), output);
    } catch (error) {
      status.textContent = 'Failed';
      result.textContent = error.stack || error.message;
      elements.log.textContent = result.textContent;
    }
  }

  function parsePayload(text) {
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  }

  function rememberResponse(payload) {
    if (!payload || typeof payload !== 'object') return;

    if (payload.token) state.token = payload.token;
    if (payload.runId) state.runId = payload.runId;
    if (payload.rewards && Array.isArray(payload.rewards) && payload.rewards.length) {
      state.rewardId = payload.rewards[payload.rewards.length - 1].rewardId || state.rewardId;
    }
    if (payload.rewards && payload.rewards.rewardId) state.rewardId = payload.rewards.rewardId;
    if (payload.reward && payload.reward.rewardId) state.rewardId = payload.reward.rewardId;
    if (payload.demon && payload.demon.id) state.demonId = payload.demon.id;
    if (payload.demons && Array.isArray(payload.demons) && payload.demons.length) state.demonId = payload.demons[0].id;

    saveState();
  }

  function refreshAllDynamicCards() {
    document.querySelectorAll('.api-card').forEach((card) => {
      const index = Number(card.dataset.endpointIndex);
      const endpoint = endpoints[index];
      refreshEndpointCard(endpoint, card);
    });
  }

  function refreshEndpointCard(endpoint, card) {
    const pathInput = card.querySelector('.js-path');
    const bodyInput = card.querySelector('.js-body');

    pathInput.value = getPath(endpoint);
    if (bodyInput && endpoint.body) {
      bodyInput.value = formatJson(endpoint.body());
    }
  }

  function bindStateInputs() {
    [
      ['token', elements.token],
      ['runId', elements.runId],
      ['rewardId', elements.rewardId],
      ['demonId', elements.demonId]
    ].forEach(([key, input]) => {
      input.addEventListener('input', () => {
        state[key] = input.value.trim();
        saveState();
        refreshAllDynamicCards();
      });
    });
  }

  function bindHeaderActions() {
    document.getElementById('seedDemoUserBtn').addEventListener('click', () => {
      state.username = demoUsername();
      state.password = 'demons123';
      saveState();
      refreshAllDynamicCards();
      elements.log.textContent = `Demo credentials filled in auth request bodies:\nusername: ${state.username}\npassword: ${state.password}`;
    });

    document.getElementById('clearStateBtn').addEventListener('click', () => {
      Object.keys(state).forEach((key) => delete state[key]);
      localStorage.removeItem(STORAGE_KEY);
      syncStateInputs();
      refreshAllDynamicCards();
      elements.log.textContent = 'Stored API test state cleared.';
    });
  }

  function syncStateInputs() {
    elements.token.value = state.token || '';
    elements.runId.value = state.runId || '';
    elements.rewardId.value = state.rewardId || '';
    elements.demonId.value = state.demonId || '';
  }

  function writeLog(endpoint, path, output) {
    elements.log.textContent = `${endpoint.method} ${path}\n${formatJson(output)}`;
  }

  function getPath(endpoint) {
    return typeof endpoint.path === 'function' ? endpoint.path() : endpoint.path;
  }

  function formatJson(value) {
    return JSON.stringify(value, null, 2);
  }

  function methodClass(method) {
    return method === 'GET' ? 'text-bg-info' : 'text-bg-success';
  }

  function demoUsername() {
    if (state.username) return state.username;
    const suffix = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    return `api_tester_${suffix}`;
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();
