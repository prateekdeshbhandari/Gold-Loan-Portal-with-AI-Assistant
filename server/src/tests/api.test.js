import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { LoanScheme } from '../models/LoanScheme.js';
import { Lead } from '../models/Lead.js';
import { DEFAULT_LOAN_SCHEMES } from '../config/constants.js';

let app;
let mongoServer;

beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  } catch (err) {
    console.warn('MongoMemoryServer fallback to local test DB:', err.message);
    await mongoose.connect('mongodb://localhost:27017/gold_loan_portal_test');
  }

  // Seed default loan schemes
  await LoanScheme.deleteMany({});
  await LoanScheme.insertMany(DEFAULT_LOAN_SCHEMES);

  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Lead.deleteMany({});
});

describe('Backend API & Business Rules Integration Tests', () => {
  // Test Loan Schemes Endpoint
  it('GET /api/v1/loan-schemes returns active plans with capped maxLtv', async () => {
    const res = await request(app).get('/api/v1/loan-schemes');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);

    const emi = res.body.data.find((p) => p.planId === 'PLAN_EMI_01');
    expect(emi).toBeDefined();
    expect(emi.maxLtv).toBeLessThanOrEqual(0.75);
  });

  // Test Quote Calculation Endpoint (No DB write)
  it('POST /api/v1/quotes calculates pure gold, gold value and loan without DB write', async () => {
    const initialLeadCount = await Lead.countDocuments();

    const res = await request(app)
      .post('/api/v1/quotes')
      .send({
        grossWeightGrams: 50,
        netWeightGrams: 45,
        karat: 22
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pureGoldGrams).toBe(41.25);
    expect(res.body.data.goldValue).toBe(288750);

    const emiQuote = res.body.data.plans.find((p) => p.planId === 'PLAN_EMI_01');
    expect(emiQuote.eligibleLoan).toBe(216562);

    // Verify NO DB writes occurred
    const postLeadCount = await Lead.countDocuments();
    expect(postLeadCount).toBe(initialLeadCount);
  });

  // Test Case 1: 45g net · 22K · EMI -> 201 Created
  it('TestCase 1: POST /api/v1/leads creates a lead with status SUBMITTED and re-computed values', async () => {
    const res = await request(app)
      .post('/api/v1/leads')
      .send({
        fullName: 'Rahul Sharma',
        mobileNumber: '9876543210',
        grossWeightGrams: 50,
        netWeightGrams: 45,
        karat: 22,
        planId: 'PLAN_EMI_01'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.applicationId).toMatch(/^GL-\d+$/);
    expect(res.body.status).toBe('SUBMITTED');
    expect(res.body.lead.pureGoldGrams).toBe(41.25);
    expect(res.body.lead.goldValue).toBe(288750);
    expect(res.body.lead.eligibleLoan).toBe(216562);
    // Mobile in response must be masked!
    expect(res.body.lead.mobileNumber).toBe('9876XXXX10');
  });

  // Test Case 4: net 52g > gross 50g -> 400 with field error on netWeightGrams
  it('TestCase 4: Validation error when net weight exceeds gross weight', async () => {
    const res = await request(app)
      .post('/api/v1/leads')
      .send({
        fullName: 'Amit Patel',
        mobileNumber: '9876543211',
        grossWeightGrams: 50,
        netWeightGrams: 52,
        karat: 22,
        planId: 'PLAN_EMI_01'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    const netFieldErr = res.body.error.fields.find((f) => f.field === 'netWeightGrams');
    expect(netFieldErr).toBeDefined();
    expect(netFieldErr.message).toMatch(/cannot exceed gross weight/i);
  });

  // Test Case 5: mobile 5876543210 or 98765 -> 400 with field error on mobileNumber
  it('TestCase 5: Validation error for invalid Indian mobile numbers', async () => {
    // Starts with 5 (invalid Indian mobile)
    const res1 = await request(app)
      .post('/api/v1/leads')
      .send({
        fullName: 'Priya Singh',
        mobileNumber: '5876543210',
        grossWeightGrams: 30,
        netWeightGrams: 28,
        karat: 22,
        planId: 'PLAN_EMI_01'
      });

    expect(res1.status).toBe(400);
    expect(res1.body.error.fields.some((f) => f.field === 'mobileNumber')).toBe(true);

    // Too short (98765)
    const res2 = await request(app)
      .post('/api/v1/leads')
      .send({
        fullName: 'Priya Singh',
        mobileNumber: '98765',
        grossWeightGrams: 30,
        netWeightGrams: 28,
        karat: 22,
        planId: 'PLAN_EMI_01'
      });

    expect(res2.status).toBe(400);
    expect(res2.body.error.fields.some((f) => f.field === 'mobileNumber')).toBe(true);
  });

  // Test Case 6: Same mobile again within 7 days -> 409 Conflict with existing applicationId
  it('TestCase 6: Reject repeat applications for same mobile within 7 days with 409 Conflict', async () => {
    const payload = {
      fullName: 'Vikram Mehta',
      mobileNumber: '9812345678',
      grossWeightGrams: 40,
      netWeightGrams: 35,
      karat: 22,
      planId: 'PLAN_EMI_01'
    };

    // First submission -> 201
    const res1 = await request(app).post('/api/v1/leads').send(payload);
    expect(res1.status).toBe(201);
    const originalAppId = res1.body.applicationId;

    // Second submission within 7 days -> 409 Conflict
    const res2 = await request(app).post('/api/v1/leads').send(payload);
    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('DUPLICATE_APPLICATION');
    expect(res2.body.error.applicationId).toBe(originalAppId);
    expect(res2.body.error.message).toContain(originalAppId);
  });

  // Test Case 7: BONUS - Same request, same Idempotency-Key -> The original 201 response, replayed
  it('TestCase 7: Safe retries with Idempotency-Key replays original response', async () => {
    const idempotencyKey = 'req-key-12345';
    const payload = {
      fullName: 'Deepak Verma',
      mobileNumber: '9988776655',
      grossWeightGrams: 20,
      netWeightGrams: 18,
      karat: 24,
      planId: 'PLAN_EMI_01'
    };

    const res1 = await request(app)
      .post('/api/v1/leads')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res1.status).toBe(201);
    const firstAppId = res1.body.applicationId;

    // Resend same request with same idempotency key
    const res2 = await request(app)
      .post('/api/v1/leads')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res2.status).toBe(201);
    expect(res2.body.isReplay).toBe(true);
    expect(res2.body.applicationId).toBe(firstAppId);
  });

  // Test Case 8: BONUS - 2 parallel requests, same new mobile -> Exactly one 201 and one 409
  it('TestCase 8: Concurrent requests for same mobile yield exactly one 201 and one 409', async () => {
    const payload = {
      fullName: 'Ananya Roy',
      mobileNumber: '9765432109',
      grossWeightGrams: 25,
      netWeightGrams: 20,
      karat: 22,
      planId: 'PLAN_EMI_01'
    };

    const [res1, res2] = await Promise.all([
      request(app).post('/api/v1/leads').send(payload),
      request(app).post('/api/v1/leads').send(payload)
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  // Admin Leads Table Test: Masked mobiles & filter
  it('GET /api/v1/leads returns leads newest first with masked mobile numbers', async () => {
    await request(app).post('/api/v1/leads').send({
      fullName: 'Test User One',
      mobileNumber: '9123456780',
      grossWeightGrams: 15,
      netWeightGrams: 12,
      karat: 18,
      planId: 'PLAN_BULLET_01'
    });

    const res = await request(app).get('/api/v1/leads');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.leads.length).toBeGreaterThan(0);
    expect(res.body.leads[0].mobileNumber).toBe('9123XXXX80');
  });
});
