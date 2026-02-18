export const isCronAuthorized = (req: any): boolean => {
  const cronSecret = process.env.CRON_SECRET;

  // If no secret is configured, allow manual testing.
  if (!cronSecret) return true;

  const authHeader =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    "";
  const querySecret = req.query?.secret;

  if (authHeader === `Bearer ${cronSecret}`) return true;
  if (querySecret === cronSecret) return true;

  return false;
};
