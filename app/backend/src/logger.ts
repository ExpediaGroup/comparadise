export const logEvent = (
  level: 'INFO' | 'WARN' | 'ERROR',
  payload: Record<string, unknown>
) => {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ timestamp: new Date().toISOString(), level, ...payload })
  );
};
