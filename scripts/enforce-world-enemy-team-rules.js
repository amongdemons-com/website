'use strict';

const fs = require('fs');
const path = require('path');
const {
  enforceEncounterMeleeLimits,
  validateEncounterTeams
} = require('./generate-world-map');

const MAP_PATH = path.join(__dirname, '..', 'public', 'api', 'data', 'map.json');

function main() {
  const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  const positionsBefore = getEncounterPositions(map.encounters);
  const encounters = enforceEncounterMeleeLimits(map.encounters || []);

  validateEncounterTeams(encounters);
  if (getEncounterPositions(encounters) !== positionsBefore) {
    throw new Error('World encounter positions changed while enforcing enemy team rules.');
  }

  fs.writeFileSync(MAP_PATH, `${JSON.stringify({ ...map, encounters }, null, 2)}\n`);
  console.log(`Updated ${encounters.length} world encounter teams without changing their positions.`);
}

function getEncounterPositions(encounters = []) {
  return JSON.stringify(encounters.map((encounter) => [
    encounter.id,
    encounter.x,
    encounter.y
  ]));
}

main();
