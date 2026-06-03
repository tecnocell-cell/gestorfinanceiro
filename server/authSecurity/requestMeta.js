export function getRequestMeta(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? String(forwarded).split(',')[0].trim()
    : req.socket?.remoteAddress || req.ip || null;
  const userAgent = req.headers['user-agent'] || null;
  return { ip, userAgent };
}
