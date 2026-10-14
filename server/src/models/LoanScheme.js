import mongoose from 'mongoose';

const loanSchemeSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    annualInterestRate: {
      type: Number,
      required: true
    },
    maxLtv: {
      type: Number,
      required: true,
      max: 0.75, // Regulatory cap of 75%
      min: 0.01
    },
    tenure: {
      type: String,
      required: true,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
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

export const LoanScheme = mongoose.model('LoanScheme', loanSchemeSchema);
