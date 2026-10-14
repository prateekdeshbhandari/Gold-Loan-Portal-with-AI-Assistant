import { Lead } from '../models/Lead.js';
import { LoanScheme } from '../models/LoanScheme.js';
import { calculateQuote } from './calculatorService.js';
import { AppError } from '../middleware/errorHandler.js';
import { maskMobile } from '../utils/masking.js';
import { DEFAULT_LOAN_SCHEMES, LEAD_STATUS } from '../config/constants.js';

/**
 * Format a Date object to "3 Oct" or "14 Oct 2026"
 */
function formatDateShort(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short'
  });
}

/**
 * Generates next sequential Application ID like GL-1001, GL-1042
 */
async function generateApplicationId() {
  const count = await Lead.countDocuments();
  const nextNumber = 1001 + count;
  return `GL-${nextNumber}`;
}

// In-memory mutex map to guarantee race-condition safety for concurrent requests (Bonus B1)
const mobileMutex = new Map();

async function acquireMobileLock(mobile) {
  while (mobileMutex.has(mobile)) {
    await mobileMutex.get(mobile);
  }
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  mobileMutex.set(mobile, promise);
  return () => {
    mobileMutex.delete(mobile);
    resolve();
  };
}

/**
 * Service to handle lead creation, validation, deduplication, and quotes
 */
export async function createLead(payload, { idempotencyKey } = {}) {
  const releaseLock = await acquireMobileLock(payload.mobileNumber);

  try {
    // 1. Idempotency Check (Bonus B1)
    if (idempotencyKey) {
      const existingByIdempotency = await Lead.findOne({ idempotencyKey });
      if (existingByIdempotency) {
        return {
          isReplay: true,
          applicationId: existingByIdempotency.applicationId,
          status: existingByIdempotency.status,
          lead: formatLeadResponse(existingByIdempotency)
        };
      }
    }

  // 2. 7-Day Duplicate Check (Core Requirement)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const existingRecentLead = await Lead.findOne({
    mobileNumber: payload.mobileNumber,
    createdAt: { $gte: sevenDaysAgo }
  }).sort({ createdAt: -1 });

  if (existingRecentLead) {
    const appliedDate = formatDateShort(existingRecentLead.createdAt);
    throw new AppError(
      `You already applied on ${appliedDate}, application ${existingRecentLead.applicationId}`,
      409,
      'DUPLICATE_APPLICATION',
      [],
      {
        applicationId: existingRecentLead.applicationId,
        existingApplicationId: existingRecentLead.applicationId,
        appliedAt: existingRecentLead.createdAt
      }
    );
  }

  // 3. Verify Plan Existence
  let plan = await LoanScheme.findOne({ planId: payload.planId, isActive: true });
  if (!plan) {
    // Check in default seeded fallback list if DB hasn't been seeded yet
    const defaultPlan = DEFAULT_LOAN_SCHEMES.find((p) => p.planId === payload.planId);
    if (!defaultPlan) {
      throw new AppError(`Loan scheme '${payload.planId}' was not found.`, 404, 'NOT_FOUND', [
        { field: 'planId', message: 'Selected plan does not exist or is inactive' }
      ]);
    }
    plan = defaultPlan;
  }

  // 4. Server-Side Recomputation (Never trust client calculations!)
  const calculation = calculateQuote({
    grossWeightGrams: payload.grossWeightGrams,
    netWeightGrams: payload.netWeightGrams,
    karat: payload.karat,
    plans: [plan]
  });

  const quote = calculation.plans[0];
  const applicationId = await generateApplicationId();

  // 5. Store Lead in MongoDB
  const newLead = new Lead({
    applicationId,
    fullName: payload.fullName,
    mobileNumber: payload.mobileNumber,
    grossWeightGrams: payload.grossWeightGrams,
    netWeightGrams: payload.netWeightGrams,
    karat: payload.karat,
    pureGoldGrams: calculation.pureGoldGrams,
    goldValue: calculation.goldValue,
    eligibleLoan: quote.eligibleLoan,
    eligibleLoanPaise: quote.eligibleLoanPaise,
    planId: plan.planId,
    planName: plan.name,
    annualInterestRate: plan.annualInterestRate,
    maxLtv: plan.maxLtv,
    status: LEAD_STATUS.SUBMITTED,
    idempotencyKey: idempotencyKey || undefined,
    auditLog: [
      {
        fromStatus: 'NONE',
        toStatus: LEAD_STATUS.SUBMITTED,
        timestamp: new Date(),
        changedBy: 'CUSTOMER',
        notes: 'Initial application submission'
      }
    ]
  });

  await newLead.save();

    return {
      applicationId: newLead.applicationId,
      status: newLead.status,
      lead: formatLeadResponse(newLead)
    };
  } finally {
    releaseLock();
  }
}

/**
 * Retrieves leads with masked mobile numbers, filtering, and pagination
 */
export async function getLeads({ planId, status, page = 1, limit = 50 } = {}) {
  const query = {};
  if (planId) query.planId = planId;
  if (status) query.status = status;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [leads, total] = await Promise.all([
    Lead.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Lead.countDocuments(query)
  ]);

  return {
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    leads: leads.map(formatLeadResponse)
  };
}

/**
 * Updates application status with audit logging (SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED)
 */
export async function updateLeadStatus(applicationId, { status, notes = '', changedBy = 'ADMIN' }) {
  const lead = await Lead.findOne({ applicationId });
  if (!lead) {
    throw new AppError(`Application ${applicationId} not found`, 404, 'NOT_FOUND');
  }

  const prevStatus = lead.status;
  lead.status = status;
  lead.auditLog.push({
    fromStatus: prevStatus,
    toStatus: status,
    timestamp: new Date(),
    changedBy,
    notes
  });

  await lead.save();
  return formatLeadResponse(lead);
}

/**
 * Formats lead for response, ALWAYS masking mobileNumber
 */
export function formatLeadResponse(lead) {
  const obj = lead.toObject ? lead.toObject() : { ...lead };
  return {
    applicationId: obj.applicationId,
    fullName: obj.fullName,
    mobileNumber: maskMobile(obj.mobileNumber),
    grossWeightGrams: obj.grossWeightGrams,
    netWeightGrams: obj.netWeightGrams,
    karat: obj.karat,
    pureGoldGrams: obj.pureGoldGrams,
    goldValue: obj.goldValue,
    eligibleLoan: obj.eligibleLoan,
    planId: obj.planId,
    planName: obj.planName,
    annualInterestRate: obj.annualInterestRate,
    maxLtv: obj.maxLtv,
    status: obj.status,
    auditLog: obj.auditLog,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
}
