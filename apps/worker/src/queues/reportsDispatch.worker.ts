/**
 * Scheduled reports worker.
 *
 * Polls `scheduledReports` every minute, evaluates each `cron` against the
 * current minute (a minimal in-process matcher; production swaps to `node-cron`
 * or `croner` when the dependency drops). Matching schedules run via
 * `runReport()` and then the artefact is delivered through the notifications
 * outbox.
 */
import type IORedis from 'ioredis';
import type { Logger } from 'pino';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { ScheduledReport } from '../../../api/src/db/models/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import {
  deliverScheduledReport,
  runReport,
} from '../../../api/src/services/reports/reports.service.js';

interface CronTime {
  minute: number;
  hour: number;
  day: number;
  month: number;
  dow: number;
}

function matchField(value: number, expr: string): boolean {
  // Supports `*`, `*/n`, `a,b,c`, `a-b`, and bare numbers.
  if (expr === '*') return true;
  for (const part of expr.split(',')) {
    const slash = part.match(/^\*\/(\d+)$/);
    if (slash) {
      if (value % Number(slash[1]) === 0) return true;
      continue;
    }
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const lo = Number(range[1]);
      const hi = Number(range[2]);
      if (value >= lo && value <= hi) return true;
      continue;
    }
    if (Number(part) === value) return true;
  }
  return false;
}

function cronMatches(expr: string, t: CronTime): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return (
    matchField(t.minute, parts[0]!) &&
    matchField(t.hour, parts[1]!) &&
    matchField(t.day, parts[2]!) &&
    matchField(t.month, parts[3]!) &&
    matchField(t.dow, parts[4]!)
  );
}

export function startReportsDispatchWorker(_redis: IORedis, logger: Logger): { close: () => Promise<void> } {
  const tick = async (): Promise<void> => {
    const now = new Date();
    const t: CronTime = {
      minute: now.getUTCMinutes(),
      hour: now.getUTCHours(),
      day: now.getUTCDate(),
      month: now.getUTCMonth() + 1,
      dow: now.getUTCDay(),
    };
    const schedules = await ScheduledReport.find({ isActive: true }).lean();
    for (const sched of schedules) {
      if (!cronMatches(sched.cron, t)) continue;
      // Guard: don't re-run within the same minute.
      if (sched.lastRunAt && Math.floor(sched.lastRunAt.getTime() / 60_000) === Math.floor(now.getTime() / 60_000)) {
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop -- ordered run
        const artefact = await runReport({
          tenantId: String(sched.tenantId),
          actorId: sched.createdBy ? String(sched.createdBy) : undefined,
          reportKey: sched.reportKey,
          format: sched.format,
          windowSpec: sched.windowSpec,
          scheduledReportId: String(sched._id),
        });
        // eslint-disable-next-line no-await-in-loop
        await deliverScheduledReport({
          tenantId: String(sched.tenantId),
          scheduledReportId: String(sched._id),
          artefactId: artefact.artefactId,
          reportName: sched.name,
          recipients: {
            userIds: sched.recipients?.userIds?.map(String),
            addresses: sched.recipients?.addresses,
          },
        });
        // eslint-disable-next-line no-await-in-loop
        await ScheduledReport.updateOne(
          { _id: sched._id },
          { $set: { lastRunAt: now, lastRunStatus: 'ok', lastRunError: undefined } },
        );
        logger.info({ scheduleId: String(sched._id), reportKey: sched.reportKey }, 'scheduled report delivered');
      } catch (err) {
        logger.error({ err, scheduleId: String(sched._id) }, 'scheduled report failed');
        // eslint-disable-next-line no-await-in-loop
        await ScheduledReport.updateOne(
          { _id: sched._id },
          { $set: { lastRunAt: now, lastRunStatus: 'failed', lastRunError: (err as Error).message } },
        );
      }
    }
  };

  const interval = setInterval(() => {
    void tick().catch((err) => logger.error({ err }, 'reports tick failed'));
  }, 60_000);
  interval.unref();

  return {
    async close() {
      clearInterval(interval);
    },
  };
}
