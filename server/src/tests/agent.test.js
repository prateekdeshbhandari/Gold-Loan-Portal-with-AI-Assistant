import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { runDeterministicAgent, executeTool } from '../services/agentService.js';
import { LoanScheme } from '../models/LoanScheme.js';
import { Lead } from '../models/Lead.js';
import { DEFAULT_LOAN_SCHEMES } from '../config/constants.js';

let mongoServer;

beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  } catch (err) {
    await mongoose.connect('mongodb://localhost:27017/gold_loan_portal_test');
  }

  await LoanScheme.deleteMany({});
  await LoanScheme.insertMany(DEFAULT_LOAN_SCHEMES);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await Lead.deleteMany({});
});

describe('AI Loan Assist Agent - 5 Evaluated Conversations', () => {
  // Conversation 1: Happy path, through to submission
  it('Conversation 1: Happy path, conversational quote through to confirmed submission', async () => {
    // Step 1: User asks for quote
    const res1 = await runDeterministicAgent({
      messages: [{ role: 'user', content: 'I have 45 grams of 22 carat jewellery, how much can I get?' }]
    });

    expect(res1.toolCalls.some((tc) => tc.tool === 'calculate_quote')).toBe(true);
    expect(res1.reply).toContain('2,16,562'); // 75% LTV quote
    expect(res1.reply).toContain('2,02,125'); // 70% LTV bullet quote
    expect(res1.sessionState.quoteCalculated).toBe(true);

    // Step 2: User provides applicant details
    const res2 = await runDeterministicAgent({
      messages: [
        { role: 'user', content: 'I have 45 grams of 22 carat jewellery, how much can I get?' },
        { role: 'assistant', content: res1.reply },
        { role: 'user', content: 'My name is Rahul Sharma and my mobile is 9876543210. I want the EMI plan.' }
      ],
      sessionState: res1.sessionState
    });

    expect(res2.sessionState.fullName).toBe('Rahul Sharma');
    expect(res2.sessionState.mobileNumber).toBe('9876543210');
    expect(res2.reply).toMatch(/summary|confirm/i);

    // Step 3: User confirms submission
    const res3 = await runDeterministicAgent({
      messages: [
        { role: 'user', content: 'I have 45 grams of 22 carat jewellery, how much can I get?' },
        { role: 'assistant', content: res1.reply },
        { role: 'user', content: 'My name is Rahul Sharma and my mobile is 9876543210. I want the EMI plan.' },
        { role: 'assistant', content: res2.reply },
        { role: 'user', content: 'Yes, please submit my application.' }
      ],
      sessionState: res2.sessionState
    });

    expect(res3.toolCalls.some((tc) => tc.tool === 'submit_application')).toBe(true);
    expect(res3.sessionState.submitted).toBe(true);
    expect(res3.reply).toContain(res3.sessionState.applicationId);
    expect(res3.sessionState.applicationId).toMatch(/^GL-\d+$/);
  });

  // Conversation 2: A missing field the agent asks for
  it('Conversation 2: Agent identifies missing details and asks conversationally', async () => {
    // User only gives weight without karat
    const res = await runDeterministicAgent({
      messages: [{ role: 'user', content: 'I want a gold loan for my jewellery. I have 30 grams.' }]
    });

    expect(res.reply).toMatch(/karat|purity/i);
    expect(res.sessionState.quoteCalculated).toBeFalsy();
  });

  // Conversation 3: Net weight greater than gross
  it('Conversation 3: Rejects invalid gold weight (net 52g > gross 50g) and prompts for fix', async () => {
    const res = await runDeterministicAgent({
      messages: [
        { role: 'user', content: 'I have jewellery with gross 50g and net 52g, 22 carat gold. How much loan?' }
      ]
    });

    expect(res.toolCalls.some((tc) => tc.tool === 'calculate_quote')).toBe(true);
    expect(res.reply).toMatch(/cannot exceed gross weight/i);
    expect(res.sessionState.quoteCalculated).toBeFalsy();
  });

  // Conversation 4: A duplicate within 7 days
  it('Conversation 4: Catches duplicate application within 7 days and explains politely', async () => {
    // Pre-insert an existing lead
    const preLead = new Lead({
      applicationId: 'GL-1042',
      fullName: 'Sunil Kumar',
      mobileNumber: '9876543210',
      grossWeightGrams: 50,
      netWeightGrams: 45,
      karat: 22,
      pureGoldGrams: 41.25,
      goldValue: 288750,
      eligibleLoan: 216562,
      eligibleLoanPaise: 21656200,
      planId: 'PLAN_EMI_01',
      planName: 'Monthly EMI',
      annualInterestRate: 10.5,
      maxLtv: 0.75,
      status: 'SUBMITTED',
      createdAt: new Date()
    });
    await preLead.save();

    // User attempts repeat application with same mobile number
    const res = await runDeterministicAgent({
      messages: [
        { role: 'user', content: 'Yes, please submit my application.' }
      ],
      sessionState: {
        quoteCalculated: true,
        grossWeightGrams: 50,
        netWeightGrams: 45,
        karat: 22,
        fullName: 'Sunil Kumar',
        mobileNumber: '9876543210',
        planId: 'PLAN_EMI_01'
      }
    });

    expect(res.toolCalls.some((tc) => tc.tool === 'submit_application')).toBe(true);
    expect(res.reply).toContain('GL-1042');
    expect(res.reply).toMatch(/already applied/i);
  });

  // Conversation 5: An off-topic request
  it('Conversation 5: Politely declines off-topic questions (stocks, weather, general)', async () => {
    const res = await runDeterministicAgent({
      messages: [{ role: 'user', content: 'Should I invest in crypto or stock market today?' }]
    });

    expect(res.toolCalls.length).toBe(0);
    expect(res.reply).toMatch(/exclusively in gold loans|cannot assist with investments/i);
  });
});
