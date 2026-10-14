import express from 'express';
import { LoanScheme } from '../models/LoanScheme.js';
import { DEFAULT_LOAN_SCHEMES } from '../config/constants.js';

const router = express.Router();

/**
 * GET /api/v1/loan-schemes
 * Returns active gold loan plans seeded from the database.
 */
router.get('/', async (req, res, next) => {
  try {
    let schemes = await LoanScheme.find({ isActive: true }).lean();

    if (!schemes || schemes.length === 0) {
      // If DB has not been seeded yet, return default schemes
      schemes = DEFAULT_LOAN_SCHEMES;
    }

    return res.status(200).json({
      success: true,
      data: schemes.map((scheme) => ({
        id: scheme.planId,
        planId: scheme.planId,
        name: scheme.name,
        annualInterestRate: scheme.annualInterestRate,
        maxLtv: Math.min(scheme.maxLtv, 0.75), // Never above 75%
        tenure: scheme.tenure,
        isActive: scheme.isActive ?? true
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;
