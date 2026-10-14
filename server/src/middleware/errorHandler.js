import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'ERROR', fields = [], extra = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    this.extra = extra;
  }
}

export function errorHandler(err, req, res, next) {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const fields = err.errors.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));

    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data. Please check the input fields.',
        fields
      }
    });
  }

  // 2. Custom Application Errors (e.g. 400, 404, 409)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        fields: err.fields && err.fields.length > 0 ? err.fields : undefined,
        ...err.extra
      }
    });
  }

  // 3. Mongo Duplicate Key Error (code 11000)
  if (err.name === 'MongoServerError' && err.code === 11000) {
    const fieldName = Object.keys(err.keyPattern || {})[0] || 'record';
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_KEY',
        message: `A duplicate entry already exists for ${fieldName}.`,
        fields: [{ field: fieldName, message: `${fieldName} must be unique` }]
      }
    });
  }

  // 4. Fallback 500 Internal Server Error (Never expose stack trace)
  console.error('[Unhandled Server Error]:', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred. Please try again later.'
    }
  });
}
