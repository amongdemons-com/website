const crypto = require('crypto');

// Temporary hunter names read like "GuestHunter1234" / "LostHunter9281".
// The pattern always satisfies assertValidUsername (starts/ends alphanumeric).
const GUEST_NAME_PREFIXES = [
  'Guest',
  'Lost',
  'Nameless',
  'Wandering',
  'Hollow',
  'Ashen',
  'Forsaken',
  'Shrouded',
  'Wayward',
  'Fading',
  'Drifting',
  'Veiled'
];

function randomInt(maxExclusive) {
  return crypto.randomInt(maxExclusive);
}

// `attempt` widens the numeric suffix so repeated collisions still resolve
// quickly (4 digits → 6 digits) without ever producing an invalid username.
function generateGuestUsername(attempt = 0) {
  const prefix = GUEST_NAME_PREFIXES[randomInt(GUEST_NAME_PREFIXES.length)];
  const digits = attempt < 4 ? 4 : 6;
  const max = 10 ** digits;
  const min = 10 ** (digits - 1);
  const number = min + randomInt(max - min);
  return `${prefix}Hunter${number}`;
}

module.exports = {
  GUEST_NAME_PREFIXES,
  generateGuestUsername
};
