import mongoose from 'mongoose';
import { LEAD_STATUS } from '../config/constants.js';

const auditEntrySchema = new mongoose.Schema(
  {
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    changedBy: { type: String, default: 'SYSTEM' },
    notes: { type: String, default: '' }
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    mobileNumber: {
      type: String,
      required: true,
      index: true
    },
    grossWeightGrams: {
      type: Number,
      required: true
    },
    netWeightGrams: {
      type: Number,
      required: true
    },
    karat: {
      type: Number,
      required: true,
      enum: [18, 22, 24]
    },
    pureGoldGrams: {
      type: Number,
      required: true
    },
    goldValue: {
      type: Number,
      required: true
    },
    eligibleLoan: {
      type: Number,
      required: true
    },
    eligibleLoanPaise: {
      type: Number,
      required: true
    },
    planId: {
      type: String,
      required: true,
      ref: 'LoanScheme'
    },
    planName: {
      type: String,
      required: true
    },
    annualInterestRate: {
      type: Number,
      required: true
    },
    maxLtv: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(LEAD_STATUS),
      default: LEAD_STATUS.SUBMITTED,
      index: true
    },
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true
    },
    auditLog: [auditEntrySchema]
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound index for efficient 7-day de-duplication queries
leadSchema.index({ mobileNumber: 1, createdAt: -1 });

export const Lead = mongoose.model('Lead', leadSchema);
