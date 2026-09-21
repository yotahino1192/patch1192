import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateOperationsConfig } from '../scripts/infra/operations-config.mjs';
function complete() {
  return { version: 1, environment: 'production',
    monitoring: { providerRef: 'ops/logs', destinationRef: 'ops/alerts', responderRef: 'ops/oncall', deliveryEvidenceRef: 'evidence/alert-delivery', statusIntervalMinutes: 5, statusHeartbeatMinutes: 15, structuredFieldsOnly: true },
    deletion: { schedulerRef: 'ops/scheduler', intervalSeconds: 60, heartbeatMinutes: 5, completionEvidenceRef: 'evidence/deletion' },
    backup: { storageRef: 'ops/storage', keyCustodyRef: 'vault/backup', keyId: 'v1', recoveryOwnerRef: 'ops/recovery', intervalHours: 6, maxSuccessAgeHours: 8, retentionDays: 7, rpoHours: 8, rtoHours: 4, restoreEvidenceRef: 'evidence/restore', reconciliationPlanRef: 'ops/reconciliation' } };
}
test('operational handoff accepts complete references without contacting any service', () => {
  const config = complete(); assert.equal(validateOperationsConfig(config), config);
});
test('blank checked-in handoff fails until actual values and evidence are supplied', async () => {
  const config = JSON.parse(await readFile('config/production-operations.json', 'utf8'));
  // This regression uses explicit blanks, so completing the real handoff later does not break it.
  config.monitoring.destinationRef = ''; config.backup.restoreEvidenceRef = '';
  assert.throws(() => validateOperationsConfig(config), /monitoring.destinationRef.*backup.restoreEvidenceRef/);
});
test('invalid operational values fail closed without disclosing their content', () => {
  for (const mutate of [
    c => { c.monitoring.destinationRef = 'https://private.invalid/?token=private-value'; },
    c => { c.monitoring.responderRef = 'private-email@invalid.test'; },
    c => { c.monitoring.structuredFieldsOnly = false; },
    c => { c.monitoring.statusIntervalMinutes = 10; },
    c => { c.monitoring.statusHeartbeatMinutes = 2; },
    c => { c.deletion.intervalSeconds = 0; },
    c => { c.deletion.heartbeatMinutes = 0.5; },
    c => { c.backup.rpoHours = 1; },
    c => { c.backup.retentionDays = 'seven'; },
    c => { c.backup.keyCustodyRef = c.backup.storageRef; },
    c => { c.backup.restoreEvidenceRef = 'TODO'; },
    c => { c.backup.privateValue = 'private-value'; },
    c => { c.environment = 'development'; },
    c => { c.monitoring = null; },
  ]) {
    const config = complete(); mutate(config);
    assert.throws(() => validateOperationsConfig(config), error => error.message.startsWith('OPERATIONS_CONFIG_INVALID:') && !error.message.includes('private-value') && !error.message.includes('private-email'));
  }
  for (const config of [null, [], {}, 'private-value']) assert.throws(() => validateOperationsConfig(config), /OPERATIONS_CONFIG_INVALID/);
});
