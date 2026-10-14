/**
 * Masks a 10-digit Indian mobile number according to the specification: 9876XXXX10
 * (First 4 digits, four X's, last 2 digits).
 *
 * @param {string} mobileNumber
 * @returns {string} Masked mobile number
 */
export function maskMobile(mobileNumber) {
  if (!mobileNumber || typeof mobileNumber !== 'string') return mobileNumber;
  const cleaned = mobileNumber.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)}XXXX${cleaned.slice(-2)}`;
  }
  if (cleaned.length > 4) {
    return `${cleaned.slice(0, 2)}****${cleaned.slice(-2)}`;
  }
  return '******';
}

/**
 * Deep clones an object and masks any sensitive fields (like mobileNumber)
 * for safe logging and responses.
 *
 * @param {*} data
 * @returns {*} Sanitized data with masked sensitive fields
 */
export function sanitizeForLogs(data) {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLogs(item));
  }

  const sanitized = { ...data };
  for (const key of Object.keys(sanitized)) {
    if (['mobileNumber', 'mobile', 'phone', 'phoneNumber'].includes(key)) {
      sanitized[key] = maskMobile(String(sanitized[key]));
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLogs(sanitized[key]);
    }
  }
  return sanitized;
}
