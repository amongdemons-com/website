// Server-side Steamworks Web API client. Requires the publisher key from the
// Steamworks partner site (Users & Permissions -> Manage Groups -> WebAPI Key);
// a regular user key cannot validate tickets or set achievements.
// STEAM_API_BASE_URL exists so tests can point at a local mock.
const STEAM_API_BASE_URL = (process.env.STEAM_API_BASE_URL || 'https://partner.steam-api.com').replace(/\/+$/, '');
// Must match the identity string the Electron wrapper passes to
// getAuthTicketForWebApi() in the steam repo's main.js.
const STEAM_TICKET_IDENTITY = process.env.STEAM_TICKET_IDENTITY || 'amongdemons';

function getSteamAppId() {
  return String(process.env.STEAM_APP_ID || '').trim();
}

function getSteamWebApiKey() {
  return String(process.env.STEAM_WEB_API_KEY || '').trim();
}

function isSteamConfigured() {
  return Boolean(getSteamAppId() && getSteamWebApiKey());
}

// Exchanges a wrapper auth ticket for a verified SteamID64.
// Throws a status-carrying error when the ticket is invalid or Steam is down.
async function authenticateUserTicket(ticketHex) {
  const ticket = String(ticketHex || '').trim();
  if (!/^[0-9a-f]{16,4096}$/i.test(ticket)) {
    throw createSteamError('Steam ticket is malformed.', 400);
  }

  requireSteamConfig();

  const url = new URL(`${STEAM_API_BASE_URL}/ISteamUserAuth/AuthenticateUserTicket/v1/`);
  url.searchParams.set('key', getSteamWebApiKey());
  url.searchParams.set('appid', getSteamAppId());
  url.searchParams.set('ticket', ticket);
  url.searchParams.set('identity', STEAM_TICKET_IDENTITY);

  const payload = await requestSteamJson(url, { method: 'GET' });
  const params = payload?.response?.params;
  const steamError = payload?.response?.error;

  if (steamError || !params || params.result !== 'OK' || !params.steamid) {
    throw createSteamError('Steam could not verify this session ticket.', 401);
  }

  return {
    steamId: String(params.steamid),
    ownerSteamId: String(params.ownersteamid || params.steamid),
    vacBanned: Boolean(params.vacbanned),
    publisherBanned: Boolean(params.publisherbanned)
  };
}

// Fetches the player's public profile so new accounts can be named after the
// Steam persona instead of the generic fallback. Returns null when the profile
// is missing rather than throwing; callers treat the name as best-effort.
async function getPlayerSummary(steamId) {
  requireSteamConfig();

  const url = new URL(`${STEAM_API_BASE_URL}/ISteamUser/GetPlayerSummaries/v2/`);
  url.searchParams.set('key', getSteamWebApiKey());
  url.searchParams.set('steamids', String(steamId));

  const payload = await requestSteamJson(url, { method: 'GET' });
  const player = (payload?.response?.players || []).find(
    (entry) => String(entry?.steamid) === String(steamId)
  );
  if (!player) return null;

  return {
    personaName: String(player.personaname || '').trim()
  };
}

// Unlocks achievements for a player by Steamworks API name. Steam treats
// re-setting an already unlocked achievement as a no-op, so retries are safe.
async function setUserAchievements(steamId, steamNames) {
  const names = (steamNames || []).map((name) => String(name || '').trim()).filter(Boolean);
  if (!names.length) return { count: 0 };

  requireSteamConfig();

  const body = new URLSearchParams({
    key: getSteamWebApiKey(),
    appid: getSteamAppId(),
    steamid: String(steamId),
    count: String(names.length)
  });
  names.forEach((name, index) => {
    body.set(`name[${index}]`, name);
    body.set(`value[${index}]`, '1');
  });

  const payload = await requestSteamJson(
    `${STEAM_API_BASE_URL}/ISteamUserStats/SetUserStatsForGame/v1/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    }
  );

  const result = payload?.response?.result;
  if (Number(result) !== 1) {
    throw createSteamError(`Steam rejected the achievement update (result ${result ?? 'missing'}).`, 502);
  }

  return { count: names.length };
}

async function requestSteamJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw createSteamError('Steam Web API is unreachable.', 503, error);
  }

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    throw createSteamError(`Steam Web API request failed with ${response.status}.`, 502);
  }

  return payload;
}

function requireSteamConfig() {
  if (!isSteamConfigured()) {
    throw createSteamError('Steam is not configured (set STEAM_APP_ID and STEAM_WEB_API_KEY).', 503);
  }
}

function createSteamError(message, status = 500, cause = undefined) {
  const error = new Error(message);
  error.status = status;
  if (cause) error.cause = cause;
  return error;
}

module.exports = {
  STEAM_TICKET_IDENTITY,
  authenticateUserTicket,
  getPlayerSummary,
  isSteamConfigured,
  setUserAchievements
};
