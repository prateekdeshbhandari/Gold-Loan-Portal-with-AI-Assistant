import express from 'express';
import { quoteQuerySchema } from '../validations/schemas.js';
import { calculateQuote } from '../services/calculatorService.js';
import { LoanScheme } from '../models/LoanScheme.js';
import { DEFAULT_LOAN_SCHEMES } from '../config/constants.js';

const router = express.Router();

/**
 * POST /api/v1/quotes
 * Pure calculation with NO DB write. Returns pure gold, gold value and eligible loan per plan.
 * Used identically by the UI calculator and the AI agent.
 */
router.post('/', async (req, res, next) => {
  try {
    // Validate payload with Zod
    const validatedData = quoteQuerySchema.parse(req.body);

    // Fetch active schemes from DB or fallback
    let plans = await LoanScheme.find({ isActive: true }).lean();
    if (!plans || plans.length === 0) {
      plans = DEFAULT_LOAN_SCHEMES;
    }

    // Filter by specific planId if requested
    if (validatedData.planId) {
      plans = plans.filter((p) => p.planId === validatedData.planId);
      if (plans.length === 0) {
        plans = DEFAULT_LOAN_SCHEMES.filter((p) => p.planId === validatedData.planId);
      }
    }

    const quote = calculateQuote({
      grossWeightGrams: validatedData.grossWeightGrams,
      netWeightGrams: validatedData.netWeightGrams,
      karat: validatedData.karat,
      plans
    });

    return res.status(200).json({
      success: true,
      data: quote
    });
  } catch (error) {
    next(error);
  }
});

export default router;
