const assert = require('node:assert/strict');
const test = require('node:test');
const { starterDoctorRosters } = require('../backend/config');

test('starter doctor rosters are distinct across seeded hospitals', () => {
  assert.equal(starterDoctorRosters.length, 5);
  const allNames = starterDoctorRosters.flat().map(([name]) => name);
  assert.equal(allNames.length, 30);
  assert.equal(new Set(allNames).size, allNames.length);
});
