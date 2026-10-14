import { z } from 'zod';
import { VALID_KARATS, LEAD_STATUS } from '../config/constants.js';

export const quoteQuerySchema = z
  .object({
    grossWeightGrams: z.coerce
      .number({
        required_error: 'grossWeightGrams is required',
        invalid_type_error: 'grossWeightGrams must be a number'
      })
      .positive('grossWeightGrams must be greater than 0')
      .max(1000, 'grossWeightGrams cannot exceed 1000g'),
    netWeightGrams: z.coerce
      .number({
        required_error: 'netWeightGrams is required',
        invalid_type_error: 'netWeightGrams must be a number'
      })
      .positive('netWeightGrams must be greater than 0')
      .max(1000, 'netWeightGrams cannot exceed 1000g'),
    karat: z.coerce
      .number({
        required_error: 'karat is required',
        invalid_type_error: 'karat must be a number'
      })
      .refine((val) => VALID_KARATS.includes(val), {
        message: 'Karat must be one of 18, 22, or 24'
      }),
    planId: z.string().optional()
  })
  .refine((data) => data.netWeightGrams <= data.grossWeightGrams, {
    message: 'Net weight cannot exceed gross weight',
    path: ['netWeightGrams']
  });

export const createLeadSchema = z
  .object({
    fullName: z
      .string({
        required_error: 'fullName is required',
        invalid_type_error: 'fullName must be a string'
      })
      .trim()
      .min(2, 'Name must be between 2 and 60 characters')
      .max(60, 'Name must be between 2 and 60 characters')
      .regex(/^[a-zA-Z\s]+$/, 'Name must contain letters and spaces only'),
    mobileNumber: z
      .string({
        required_error: 'mobileNumber is required'
      })
      .trim()
      .regex(/^[6-9]\d{9}$/, 'mobileNumber must be a valid 10-digit Indian mobile number starting with 6-9'),
    grossWeightGrams: z.coerce
      .number({
        required_error: 'grossWeightGrams is required',
        invalid_type_error: 'grossWeightGrams must be a number'
      })
      .positive('grossWeightGrams must be greater than 0')
      .max(1000, 'grossWeightGrams cannot exceed 1000g'),
    netWeightGrams: z.coerce
      .number({
        required_error: 'netWeightGrams is required',
        invalid_type_error: 'netWeightGrams must be a number'
      })
      .positive('netWeightGrams must be greater than 0')
      .max(1000, 'netWeightGrams cannot exceed 1000g'),
    karat: z.coerce
      .number({
        required_error: 'karat is required'
      })
      .refine((val) => VALID_KARATS.includes(val), {
        message: 'Karat must be one of 18, 22, or 24'
      }),
    planId: z
      .string({
        required_error: 'planId is required'
      })
      .trim()
      .min(1, 'planId is required')
  })
  .refine((data) => data.netWeightGrams <= data.grossWeightGrams, {
    message: 'Net weight cannot exceed gross weight',
    path: ['netWeightGrams']
  });

export const updateLeadStatusSchema = z.object({
  status: z.enum([
    LEAD_STATUS.SUBMITTED,
    LEAD_STATUS.UNDER_REVIEW,
    LEAD_STATUS.APPROVED,
    LEAD_STATUS.REJECTED
  ], {
    required_error: 'status is required'
  }),
  notes: z.string().optional(),
  changedBy: z.string().default('ADMIN')
});
