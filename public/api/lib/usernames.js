const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 64;
const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/;
const USERNAME_RULE_MESSAGE = 'Username must be 3 to 64 characters, start and end with a letter or number, and use only letters, numbers, hyphens, or underscores.';

function normalizeUsername(value) {
  return String(value || '').trim();
}

function isValidUsername(value) {
  const username = normalizeUsername(value);
  return username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(username);
}

function getUsernameValidationError(value) {
  return isValidUsername(value) ? '' : USERNAME_RULE_MESSAGE;
}

function assertValidUsername(value) {
  const username = normalizeUsername(value);
  const message = getUsernameValidationError(username);

  if (message) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }

  return username;
}

function createUsernameCandidate(value, fallback = 'hunter') {
  const fallbackValue = normalizeUsername(fallback) || 'hunter';
  const candidate = normalizeUsername(value)
    .split('@')[0]
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/[^A-Za-z0-9]+$/g, '');

  if (isValidUsername(candidate)) return candidate;
  if (isValidUsername(fallbackValue)) return fallbackValue;
  return 'hunter';
}

module.exports = {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_RULE_MESSAGE,
  assertValidUsername,
  createUsernameCandidate,
  getUsernameValidationError,
  isValidUsername,
  normalizeUsername
};
