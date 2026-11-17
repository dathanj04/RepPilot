// Independent scheduler: no application/database credentials or third-party packages.
const url = process.env.REMINDER_ENDPOINT;
const secret = process.env.SCHEDULER_SECRET;
if (url !== 'https://reppilot.app/api/cron/reminders' || !secret) {
  console.error('scheduler.configuration_invalid');
  process.exit(1);
}
try {
  const response = await fetch(url, {
    method: 'POST', redirect: 'error',
    headers: {authorization: `Bearer ${secret}`},
    signal: AbortSignal.timeout(55000),
  });
  if (!response.ok) throw new Error('request_failed');
  const result = await response.json();
  if (!Number.isInteger(result.processed) || result.failed !== 0) throw new Error('invalid_result');
  console.log(JSON.stringify({event:'scheduler.completed',processed:result.processed,failed:0}));
} catch {
  // Do not log response bodies, request headers, addresses or tokens.
  console.error('scheduler.failed');
  process.exitCode=1;
}
