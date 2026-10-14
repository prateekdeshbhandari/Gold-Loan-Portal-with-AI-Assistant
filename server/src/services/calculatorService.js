import { DEFAULT_GOLD_RATE_24K, MAX_REGULATORY_LTV } from '../config/constants.js';

/**
 * Calculates pure gold, market valuation, and eligible loan per plan.
 * Follows strict RBI 75% LTV ceiling and whole-rupee floor rounding.
 *
 * @param {Object} params
 * @param {number} params.grossWeightGrams
 * @param {number} params.netWeightGrams
 * @param {number} params.karat
 * @param {Array} plans - Array of active loan schemes
 * @param {number} [rate24kPerGram] - Optional rate override
 * @returns {Object} Quote calculation summary
 */
export function calculateQuote({ grossWeightGrams, netWeightGrams, karat, plans = [], rate24kPerGram }) {
  const rate = Number(rate24kPerGram || process.env.GOLD_RATE_24K_PER_GRAM || DEFAULT_GOLD_RATE_24K);

  // Exact pure gold calculation: netWeightGrams * (karat / 24)
  // Round pure gold to 4 decimal places for floating accuracy
  const pureGoldGrams = Number((netWeightGrams * (karat / 24)).toFixed(4));

  // Market valuation in rupees
  const goldValue = Math.round(pureGoldGrams * rate);
  const goldValuePaise = Math.round(pureGoldGrams * rate * 100);

  // Calculate quote for each scheme
  const planQuotes = plans.map((plan) => {
    // Strictly cap maxLtv at 0.75 (75%)
    const effectiveLtv = Math.min(plan.maxLtv, MAX_REGULATORY_LTV);

    // Eligible loan in whole rupees: Math.floor(goldValue * effectiveLtv)
    const eligibleLoan = Math.floor(goldValue * effectiveLtv);
    const eligibleLoanPaise = eligibleLoan * 100;

    return {
      planId: plan.planId,
      name: plan.name,
      annualInterestRate: plan.annualInterestRate,
      maxLtv: plan.maxLtv,
      effectiveLtv,
      tenure: plan.tenure,
      eligibleLoan,
      eligibleLoanPaise
    };
  });

  return {
    grossWeightGrams,
    netWeightGrams,
    karat,
    rate24kPerGram: rate,
    pureGoldGrams,
    goldValue,
    goldValuePaise,
    plans: planQuotes
  };
}
