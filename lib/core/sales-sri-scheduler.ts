import "@/lib/security/server-only";

import { getDueSyncTenants, hasRunningSyncJob, createScheduledSyncJob } from "@/lib/core/sales-sync-adapter";
import { resolveEffectiveTenantAccessForTenant, featureEnabled } from "@/lib/core/tenant-features";

export async function runDailySriSyncScheduler(): Promise<{
  checked: number;
  created: number;
  skipped: number;
  errors: string[];
}> {
  const dueTenants = await getDueSyncTenants();
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const entry of dueTenants) {
    try {
      const access = await resolveEffectiveTenantAccessForTenant({ tenantId: entry.tenantId });
      if (!featureEnabled(access.features, "sales_auto_sync")) {
        skipped++;
        continue;
      }

      if (await hasRunningSyncJob(entry.tenantId)) {
        skipped++;
        continue;
      }

      await createScheduledSyncJob(entry.tenantId, entry.syncFrequency);
      created++;

      await jitter();
    } catch (err) {
      errors.push(`${entry.tenantId}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return { checked: dueTenants.length, created, skipped, errors };
}

function jitter(): Promise<void> {
  const ms = Math.floor(Math.random() * 500) + 100;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
