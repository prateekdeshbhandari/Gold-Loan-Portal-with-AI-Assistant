import express from 'express';
import { createLeadSchema, updateLeadStatusSchema } from '../validations/schemas.js';
import { createLead, getLeads, updateLeadStatus } from '../services/leadService.js';

const router = express.Router();

/**
 * POST /api/v1/leads
 * Validates, re-computes quote server-side, de-duplicates within 7 days,
 * stores lead with status SUBMITTED, and returns 201 with applicationId.
 * Supports Idempotency-Key header for safe retries.
 */
router.post('/', async (req, res, next) => {
  try {
    const validatedData = createLeadSchema.parse(req.body);
    const idempotencyKey = req.headers['idempotency-key'];

    const result = await createLead(validatedData, { idempotencyKey });

    return res.status(201).json({
      success: true,
      applicationId: result.applicationId,
      status: result.status,
      isReplay: result.isReplay || false,
      lead: result.lead
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/leads
 * Returns all leads, newest first. Mobile numbers are ALWAYS masked in responses.
 * Supports filter by planId and status, plus pagination.
 */
router.get('/', async (req, res, next) => {
  try {
    const { planId, status, page, limit } = req.query;
    const data = await getLeads({ planId, status, page, limit });

    return res.status(200).json({
      success: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/leads/:id/status
 * Updates lead status with audit log (SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED)
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const validated = updateLeadStatusSchema.parse(req.body);
    const updatedLead = await updateLeadStatus(req.params.id, validated);

    return res.status(200).json({
      success: true,
      lead: updatedLead
    });
  } catch (error) {
    next(error);
  }
});

export default router;
