import { sanitizeForLogs } from '../utils/masking.js';

export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url } = req;

  // Mask sensitive information in logs
  const maskedBody = sanitizeForLogs(req.body);
  const maskedQuery = sanitizeForLogs(req.query);

  console.log(`[REQ] ${method} ${url} | Query: ${JSON.stringify(maskedQuery)} | Body: ${JSON.stringify(maskedBody)}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[RES] ${method} ${url} -> Status: ${res.statusCode} (${duration}ms)`);
  });

  next();
}
