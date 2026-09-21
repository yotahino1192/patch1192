// Offline operational handoff contract; references are opaque records, never credentials.
// A valid file proves completeness only, not service health or delivery of alerts/backups.
export function validateOperationsConfig(config) {
  const errors = [];
  const invalid = field => errors.push(field);
  const shape = (value, keys, path) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { invalid(path); return {}; }
    if (Object.keys(value).some(key => !keys.includes(key))) invalid(path + '.unexpected_field');
    return value;
  };
  const ref = (value, field) => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{1,127}$/.test(value) || /example|placeholder|changeme|(^|[./_-])(tbd|todo|dummy)([./_-]|$)/i.test(value) || /^(sk[-_]|eyJ)/.test(value)) invalid(field);
  };
  const number = (value, field, max) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) invalid(field);
  };
  const root = shape(config, ['version', 'environment', 'monitoring', 'deletion', 'backup'], 'config');
  if (root.version !== 1) invalid('version');
  if (root.environment !== 'production') invalid('environment');
  const monitoring = shape(root.monitoring, ['providerRef', 'destinationRef', 'responderRef', 'deliveryEvidenceRef', 'statusIntervalMinutes', 'statusHeartbeatMinutes', 'structuredFieldsOnly'], 'monitoring');
  for (const key of ['providerRef', 'destinationRef', 'responderRef', 'deliveryEvidenceRef']) ref(monitoring[key], 'monitoring.' + key);
  number(monitoring.statusIntervalMinutes, 'monitoring.statusIntervalMinutes', 5);
  number(monitoring.statusHeartbeatMinutes, 'monitoring.statusHeartbeatMinutes', 15);
  if (monitoring.statusHeartbeatMinutes <= monitoring.statusIntervalMinutes) invalid('monitoring.heartbeat_order');
  if (monitoring.structuredFieldsOnly !== true) invalid('monitoring.structuredFieldsOnly');
  const deletion = shape(root.deletion, ['schedulerRef', 'intervalSeconds', 'heartbeatMinutes', 'completionEvidenceRef'], 'deletion');
  for (const key of ['schedulerRef', 'completionEvidenceRef']) ref(deletion[key], 'deletion.' + key);
  number(deletion.intervalSeconds, 'deletion.intervalSeconds', 60);
  number(deletion.heartbeatMinutes, 'deletion.heartbeatMinutes', 5);
  if (deletion.heartbeatMinutes * 60 <= deletion.intervalSeconds) invalid('deletion.heartbeat_order');
  const backup = shape(root.backup, ['storageRef', 'keyCustodyRef', 'keyId', 'recoveryOwnerRef', 'intervalHours', 'maxSuccessAgeHours', 'retentionDays', 'rpoHours', 'rtoHours', 'restoreEvidenceRef', 'reconciliationPlanRef'], 'backup');
  for (const key of ['storageRef', 'keyCustodyRef', 'keyId', 'recoveryOwnerRef', 'restoreEvidenceRef', 'reconciliationPlanRef']) ref(backup[key], 'backup.' + key);
  for (const key of ['intervalHours', 'maxSuccessAgeHours', 'rpoHours', 'rtoHours']) number(backup[key], 'backup.' + key, 8760);
  number(backup.retentionDays, 'backup.retentionDays', 3650);
  if (backup.maxSuccessAgeHours < backup.intervalHours || backup.rpoHours < backup.maxSuccessAgeHours || backup.retentionDays * 24 < backup.intervalHours) invalid('backup.schedule_order');
  if (backup.storageRef && backup.storageRef === backup.keyCustodyRef) invalid('backup.separate_key_custody');
  if (errors.length) throw Error('OPERATIONS_CONFIG_INVALID:' + errors.join(','));
  return config;
}
