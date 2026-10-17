import 'server-only';
import { authenticatedAdmin } from '@/lib/session';
import { AppError, dbCheck } from '@/lib/http';
import { object, text, uuid } from '@/domain/validation';
import { broadcastInput, guardianXp, systemSwitchInput } from '@/domain/guardian-suite';
import { guardianAdminClient, auditSecurityEvent } from '@/services/guardian-admin';
import { clearSystemSwitchCache } from '@/services/system-state';
import { configuredGateSecret } from '@/services/gatekeeper';
import { postGuardianBroadcast, guardianDiscordHealth } from '@/services/discord';
import { fetchGuardianDatabaseHardware } from '@/services/guardian-hardware';
import { formatVercelRegion, hardwareNumber, hardwarePercent } from '@/domain/guardian-hardware';
export { formatVercelRegion } from '@/domain/guardian-hardware';

let telemetryInvocations = 0;

export async function changeGuardianBroadcast(raw: unknown) {
  const admin = await authenticatedAdmin();
  const input = broadcastInput(raw);
  const result = await guardianAdminClient().rpc('guardian_broadcast', {
    p_message: input.message,
    p_category: input.category,
    p_active: input.active,
    p_actor: admin.id,
  });
  dbCheck(result.error);
  let discord: 'skipped' | 'sent' | 'failed' = 'skipped';
  if (input.notifyDiscord && result.data) {
    try {
      await postGuardianBroadcast(result.data, input.message, input.category);
      discord = 'sent';
    } catch {
      discord = 'failed';
      await auditSecurityEvent('broadcast_discord_failed', {
        actor_id: admin.id,
        broadcast_id: result.data,
      });
    }
  }
  return { id: result.data, active: input.active, discord };
}
export async function changeGuardianSwitch(raw: unknown) {
  const admin = await authenticatedAdmin();
  const input = systemSwitchInput(raw);
  const db = guardianAdminClient();
  if (input.key === 'gatekeeper_enabled' && input.value === true) {
    configuredGateSecret();
    const readiness = await db.rpc('claim_gatekeeper_attempt', {
      p_key_hash: crypto.randomUUID().replaceAll('-', '').repeat(2),
    });
    dbCheck(readiness.error);
  }
  dbCheck(
    (
      await db.rpc('guardian_set_switch', {
        p_key: input.key,
        p_value: input.value,
        p_actor: admin.id,
      })
    ).error,
  );
  clearSystemSwitchCache();
  return input;
}
export async function guardianTelemetry() {
  await authenticatedAdmin();
  const db = guardianAdminClient();
  const start = performance.now();
  const cpuStart = process.cpuUsage();
  const warm = telemetryInvocations++ > 0;
  const [database, discord, hardware] = await Promise.all([
    (async () => {
      const queryStart = performance.now();
      const snapshot = await db.rpc('guardian_telemetry', {});
      dbCheck(snapshot.error);
      return { snapshot, latencyMs: Math.round(performance.now() - queryStart) };
    })(),
    guardianDiscordHealth(),
    fetchGuardianDatabaseHardware(),
  ]);
  const snapshot = database.snapshot;
  const snap = snapshot.data;
  const memory = process.memoryUsage();
  const limitMB = hardwareNumber(Number(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE)) || null;
  const cpu = process.cpuUsage(cpuStart);
  const region = process.env.VERCEL_REGION?.trim();
  return {
    database: {
      status: 'ok',
      latencyMs: database.latencyMs,
      host: process.env.GUARDIAN_DB_NODE?.trim() || null,
      region: process.env.GUARDIAN_DB_REGION?.trim() || null,
      ...hardware,
      diskSizeBytes: hardwareNumber(snap?.db_size_bytes),
      cacheHitRatio: hardwareNumber(snap?.db_cache_hit_ratio),
      connections: {
        active: hardwareNumber(snap?.db_connections_active),
        max: hardwareNumber(snap?.db_connections_max),
      },
    },
    vercel: {
      region: region || null,
      regionLabel: formatVercelRegion(region),
      computeMs: Math.round((cpu.user + cpu.system) / 1000),
      elapsedMs: Math.round(performance.now() - start),
      memory: {
        heapUsedMB: Math.round(memory.heapUsed / 1048576),
        rssMB: Math.round(memory.rss / 1048576),
        limitMB,
        percent: hardwarePercent(memory.rss, limitMB === null ? null : limitMB * 1048576),
      },
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
      env: process.env.VERCEL_ENV || (process.env.VERCEL ? 'unknown' : 'local'),
      uptimeSec: Math.floor(process.uptime()),
      warm,
    },
    storage: { bytes: snapshot.data?.storage_bytes ?? 0, source: 'vault_metadata' },
    users: { total: snapshot.data?.users_total ?? 0, recent: snapshot.data?.users_recent ?? 0 },
    discord,
    measuredAt: new Date().toISOString(),
    requestMs: Math.round(performance.now() - start),
  };
}
export async function guardianSecurityLogs() {
  await authenticatedAdmin();
  const db = guardianAdminClient();
  const [logs, attempts] = await Promise.all([
    db.from('security_audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
    db
      .from('gatekeeper_attempts')
      .select('*')
      .order('window_start', { ascending: false })
      .limit(50),
  ]);
  dbCheck(logs.error);
  dbCheck(attempts.error);
  return { logs: logs.data ?? [], attempts: attempts.data ?? [] };
}
export async function rewardGuardianPlayer(targetId: string, raw: unknown) {
  const admin = await authenticatedAdmin();
  const id = uuid(targetId).toLowerCase();
  const input = object(raw);
  const db = guardianAdminClient();
  if ('xp' in input) {
    if ('badge_id' in input) throw new AppError('Envía solo un tipo de premio.', 400);
    const xp = guardianXp(input.xp);
    const result = await db.rpc('grant_player_xp', { p_target_id: id, p_amount: xp });
    dbCheck(result.error);
    await auditSecurityEvent('operator_reward', { actor_id: admin.id, target_id: id, xp });
    return result.data?.[0];
  }
  const badgeId = text(input.badge_id, 'Insignia', 80);
  if (input.action !== 'grant' && input.action !== 'revoke')
    throw new AppError('Acción de insignia no válida.', 400);
  const [target, badge] = await Promise.all([
    db.from('profiles').select('id').eq('id', id).maybeSingle(),
    db.from('badges').select('id').eq('id', badgeId).maybeSingle(),
  ]);
  dbCheck(target.error);
  dbCheck(badge.error);
  if (!target.data || !badge.data) throw new AppError('Jugador o insignia no encontrado.', 404);
  const result =
    input.action === 'grant'
      ? await db
          .from('user_badges')
          .upsert(
            { user_id: id, badge_id: badgeId },
            { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
          )
      : await db.from('user_badges').delete().eq('user_id', id).eq('badge_id', badgeId);
  dbCheck(result.error);
  await auditSecurityEvent('operator_badge', {
    actor_id: admin.id,
    target_id: id,
    badge_id: badgeId,
    action: input.action,
  });
  return { badge_id: badgeId, action: input.action };
}
