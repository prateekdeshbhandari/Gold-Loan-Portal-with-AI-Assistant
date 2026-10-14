import { describe, it, expect } from 'vitest';
import { calculateQuote } from '../services/calculatorService.js';
import { DEFAULT_LOAN_SCHEMES } from '../config/constants.js';

describe('Financial Math & Calculator Service', () => {
  const emiPlan = DEFAULT_LOAN_SCHEMES.find((p) => p.planId === 'PLAN_EMI_01');
  const bulletPlan = DEFAULT_LOAN_SCHEMES.find((p) => p.planId === 'PLAN_BULLET_01');

  // Test Case 1: 45 g net · 22K · EMI
  it('TestCase 1: 45g net, 22K gold under EMI plan should calculate pure 41.25g, ₹2,88,750 value, and ₹2,16,562 eligible loan', () => {
    const quote = calculateQuote({
      grossWeightGrams: 50,
      netWeightGrams: 45,
      karat: 22,
      plans: [emiPlan],
      rate24kPerGram: 7000
    });

    expect(quote.pureGoldGrams).toBe(41.25);
    expect(quote.goldValue).toBe(288750);

    const planQuote = quote.plans.find((p) => p.planId === 'PLAN_EMI_01');
    expect(planQuote).toBeDefined();
    // 288750 * 0.75 = 216562.5 -> floor is 216562
    expect(planQuote.eligibleLoan).toBe(216562);
    expect(planQuote.eligibleLoanPaise).toBe(21656200);
  });

  // Test Case 2: 45 g net · 22K · Bullet
  it('TestCase 2: 45g net, 22K gold under Bullet plan should calculate ₹2,88,750 value, and ₹2,02,125 eligible loan (70% LTV)', () => {
    const quote = calculateQuote({
      grossWeightGrams: 50,
      netWeightGrams: 45,
      karat: 22,
      plans: [bulletPlan],
      rate24kPerGram: 7000
    });

    expect(quote.goldValue).toBe(288750);

    const planQuote = quote.plans.find((p) => p.planId === 'PLAN_BULLET_01');
    expect(planQuote).toBeDefined();
    // 288750 * 0.70 = 202125
    expect(planQuote.eligibleLoan).toBe(202125);
  });

  // Test Case 3: 10 g net · 18K · EMI
  it('TestCase 3: 10g net, 18K gold under EMI plan should calculate pure 7.5g, ₹52,500 value, and ₹39,375 eligible loan', () => {
    const quote = calculateQuote({
      grossWeightGrams: 12,
      netWeightGrams: 10,
      karat: 18,
      plans: [emiPlan],
      rate24kPerGram: 7000
    });

    expect(quote.pureGoldGrams).toBe(7.5);
    expect(quote.goldValue).toBe(52500);

    const planQuote = quote.plans.find((p) => p.planId === 'PLAN_EMI_01');
    expect(planQuote).toBeDefined();
    // 52500 * 0.75 = 39375
    expect(planQuote.eligibleLoan).toBe(39375);
  });

  // Regulatory Cap Enforcement Test
  it('Should strictly cap LTV at 75% even if a plan specifies a higher maxLtv', () => {
    const roguePlan = {
      planId: 'ROGUE_PLAN',
      name: 'High Risk 85%',
      annualInterestRate: 15.0,
      maxLtv: 0.85, // 85% LTV attempted
      tenure: '12 months'
    };

    const quote = calculateQuote({
      grossWeightGrams: 50,
      netWeightGrams: 45,
      karat: 22,
      plans: [roguePlan],
      rate24kPerGram: 7000
    });

    const planQuote = quote.plans[0];
    expect(planQuote.effectiveLtv).toBe(0.75); // Capped at 75%
    expect(planQuote.eligibleLoan).toBe(216562);
  });
});
