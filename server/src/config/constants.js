export const DEFAULT_GOLD_RATE_24K = 7000; // Mock rate in ₹ per gram
export const MAX_REGULATORY_LTV = 0.75; // RBI guideline: Max 75% LTV for gold loans
export const VALID_KARATS = [18, 22, 24];

export const LEAD_STATUS = {
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

export const DEFAULT_LOAN_SCHEMES = [
  {
    planId: 'PLAN_BULLET_01',
    name: 'Bullet Repayment',
    annualInterestRate: 12.0,
    maxLtv: 0.70, // 70% LTV
    tenure: '12 months, interest + principal at maturity',
    isActive: true
  },
  {
    planId: 'PLAN_EMI_01',
    name: 'Monthly EMI',
    annualInterestRate: 10.5,
    maxLtv: 0.75, // 75% LTV
    tenure: '12 months, equal monthly instalments',
    isActive: true
  }
];
