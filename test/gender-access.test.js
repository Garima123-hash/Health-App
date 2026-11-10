const assert = require('node:assert/strict');
const test = require('node:test');
const { requireFemalePatient } = require('../backend/middleware/auth.middleware');

function checkAccess(user) {
  const result = { status: null, body: null, continued: false };
  const req = { user };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    }
  };
  requireFemalePatient(req, res, () => { result.continued = true; });
  return result;
}

test('women’s health access is limited to authenticated female patient profiles', () => {
  assert.equal(checkAccess(null).status, 401);
  assert.equal(checkAccess({ role: 'admin', gender: 'female' }).status, 403);
  assert.equal(checkAccess({ role: 'patient', gender: 'male' }).status, 403);
  assert.equal(checkAccess({ role: 'patient', gender: 'non_binary' }).status, 403);
  assert.equal(checkAccess({ role: 'patient', gender: 'female' }).continued, true);
});
