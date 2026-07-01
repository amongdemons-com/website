(function() {
  'use strict';

  const USERNAME_MIN_LENGTH = 3;
  const USERNAME_MAX_LENGTH = 64;
  const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/;
  const USERNAME_RULE_MESSAGE = 'Username must be 3 to 64 characters, start and end with a letter or number, and use only letters, numbers, hyphens, or underscores.';

  function normalize(value) {
    return String(value || '').trim();
  }

  function isValid(value) {
    const username = normalize(value);
    return username.length >= USERNAME_MIN_LENGTH &&
      username.length <= USERNAME_MAX_LENGTH &&
      USERNAME_PATTERN.test(username);
  }

  function getValidationMessage(value) {
    return isValid(value) ? '' : USERNAME_RULE_MESSAGE;
  }

  window.AmongDemons = {
    ...(window.AmongDemons || {}),
    usernames: {
      USERNAME_MAX_LENGTH,
      USERNAME_MIN_LENGTH,
      USERNAME_RULE_MESSAGE,
      getValidationMessage,
      isValid,
      normalize
    }
  };
})();
