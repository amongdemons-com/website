import { RUN_KEY } from './config.js';
import { state } from './state.js';

export const api = window.AmongDemons.api;

export function runPath(runId, action = '') {
  const suffix = action ? `/${action}` : '';
  return `/api/runs/${encodeURIComponent(runId)}${suffix}`;
}

export function activeRunPath(action = '') {
  return runPath(state.run.runId, action);
}

export function storeCurrentRun(runId) {
  localStorage.setItem(RUN_KEY, runId);
}

export function clearCurrentRun() {
  localStorage.removeItem(RUN_KEY);
}
