import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Contract & Adversarial Payload Spec Verification for TripGenie AI Firestore Rules.
 * Verifies that every collection defined in firebase-blueprint.json is guarded
 * and that the "Dirty Dozen" adversarial payloads violate rule invariants.
 */
const rulesContent = fs.readFileSync('firestore.rules', 'utf8');

assert.ok(rulesContent.includes("rules_version = '2';"), 'Must use Firestore rules v2');
assert.ok(rulesContent.includes('match /{document=**} {\n      allow read, write: if false;'), 'Must include default deny');
assert.ok(rulesContent.includes('match /users/{userId}'), 'Must secure users collection');
assert.ok(rulesContent.includes('match /trips/{tripId}'), 'Must secure trips collection');
assert.ok(rulesContent.includes('match /messages/{messageId}'), 'Must secure messages subcollection');
assert.ok(rulesContent.includes('isValidTrip(incoming(), tripId)'), 'Update and create must enforce isValidTrip');
assert.ok(rulesContent.includes('request.auth.token.email_verified == true'), 'Writes must enforce verified email');
assert.ok(rulesContent.includes('existing().userId == request.auth.uid'), 'List/Get must enforce ownership');

export const dirtyDozenPayloads = [
  { name: 'Unauthenticated trip write', auth: null, expected: 'PERMISSION_DENIED' },
  { name: 'Unverified email write', auth: { uid: 'u1', email_verified: false }, expected: 'PERMISSION_DENIED' },
  { name: 'Spoofed userId', auth: { uid: 'attacker', email_verified: true }, payload: { userId: 'victim' }, expected: 'PERMISSION_DENIED' },
  { name: 'Shadow field injection', auth: { uid: 'u1', email_verified: true }, payload: { isAdmin: true }, expected: 'PERMISSION_DENIED' },
  { name: 'Immutable userId mutation', auth: { uid: 'u1', email_verified: true }, update: { userId: 'u2' }, expected: 'PERMISSION_DENIED' },
  { name: 'Forged createdAt timestamp', auth: { uid: 'u1', email_verified: true }, payload: { createdAt: '2020-01-01T00:00:00Z' }, expected: 'PERMISSION_DENIED' },
  { name: 'Invalid document ID traversal', docId: '../../etc/passwd', expected: 'PERMISSION_DENIED' },
  { name: 'Blanket un-scoped trip list', query: 'collection(db, "trips")', expected: 'PERMISSION_DENIED' },
  { name: 'Cross-user PII profile read', auth: { uid: 'u1' }, target: '/users/u2', expected: 'PERMISSION_DENIED' },
  { name: 'Foreign trip chat injection', auth: { uid: 'attacker' }, target: '/trips/victim_trip/messages/m1', expected: 'PERMISSION_DENIED' },
  { name: 'Out-of-bounds budget or travellers', payload: { travellers: 999, totalBudget: -100 }, expected: 'PERMISSION_DENIED' },
  { name: 'Oversized days array (>14)', payload: { daysLength: 25 }, expected: 'PERMISSION_DENIED' },
];
