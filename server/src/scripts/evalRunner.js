import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { runDeterministicAgent } from '../services/agentService.js';
import { LoanScheme } from '../models/LoanScheme.js';
import { Lead } from '../models/Lead.js';
import { DEFAULT_LOAN_SCHEMES } from '../config/constants.js';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

async function runEvaluation() {
  console.log(`\n${colors.bright}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bright}🤖 AI LOAN ASSIST AGENT - 5 CONVERSATION EVALUATION SUITE${colors.reset}`);
  console.log(`${colors.cyan}================================================================${colors.reset}\n`);

  let mongoServer;
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  } catch (err) {
    console.log(`${colors.gray}[Connecting to local MongoDB fallback...]${colors.reset}`);
    await mongoose.connect('mongodb://localhost:27017/gold_loan_portal_eval');
  }

  // Setup seed schemes
  await LoanScheme.deleteMany({});
  await LoanScheme.insertMany(DEFAULT_LOAN_SCHEMES);
  await Lead.deleteMany({});

  const results = [];

  // -------------------------------------------------------------
  // Conversation 1: Happy Path through to Submission
  // -------------------------------------------------------------
  console.log(`${colors.bright}Test 1: Happy path, through to submission${colors.reset}`);
  console.log(`${colors.gray}Scenario: User asks quote for 45g 22K, provides details, and confirms submission.${colors.reset}`);

  let state = {};
  // Turn 1
  const turn1 = await runDeterministicAgent({
    messages: [{ role: 'user', content: 'I have 45 grams of 22 carat jewellery, how much can I get?' }],
    sessionState: state
  });
  state = turn1.sessionState;

  // Turn 2
  const turn2 = await runDeterministicAgent({
    messages: [
      { role: 'user', content: 'I have 45 grams of 22 carat jewellery, how much can I get?' },
      { role: 'assistant', content: turn1.reply },
      { role: 'user', content: 'My name is Rohan Gupta and my mobile is 9876543210. I would like the EMI scheme.' }
    ],
    sessionState: state
  });
  state = turn2.sessionState;

  // Turn 3
  const turn3 = await runDeterministicAgent({
    messages: [
      { role: 'user', content: 'I have 45 grams of 22 carat jewellery, how much can I get?' },
      { role: 'assistant', content: turn1.reply },
      { role: 'user', content: 'My name is Rohan Gupta and my mobile is 9876543210. I would like the EMI scheme.' },
      { role: 'assistant', content: turn2.reply },
      { role: 'user', content: 'Yes, please proceed and submit my application.' }
    ],
    sessionState: state
  });

  const passed1 =
    turn1.toolCalls.some((t) => t.tool === 'calculate_quote') &&
    turn3.toolCalls.some((t) => t.tool === 'submit_application') &&
    turn3.reply.includes(turn3.sessionState.applicationId);

  console.log(`Outcome: ${passed1 ? colors.green + '✔ PASSED' : colors.red + '✖ FAILED'}${colors.reset}`);
  console.log(`Tools Invoked: ${colors.yellow}[calculate_quote, submit_application]${colors.reset}`);
  console.log(`Generated ID: ${colors.cyan}${turn3.sessionState.applicationId}${colors.reset}\n`);
  results.push({ test: 'Happy Path Submission', passed: passed1 });

  // -------------------------------------------------------------
  // Conversation 2: A missing field the agent asks for
  // -------------------------------------------------------------
  console.log(`${colors.bright}Test 2: Missing field detection${colors.reset}`);
  console.log(`${colors.gray}Scenario: User mentions weight only, without purity.${colors.reset}`);

  const eval2 = await runDeterministicAgent({
    messages: [{ role: 'user', content: 'Hi, I want a loan against my 35 grams gold chain.' }],
    sessionState: {}
  });

  const passed2 = /karat|purity/i.test(eval2.reply) && !eval2.sessionState.quoteCalculated;
  console.log(`Agent response: "${eval2.reply.split('\n')[0]}"`);
  console.log(`Outcome: ${passed2 ? colors.green + '✔ PASSED' : colors.red + '✖ FAILED'}${colors.reset}\n`);
  results.push({ test: 'Missing Field Prompting', passed: passed2 });

  // -------------------------------------------------------------
  // Conversation 3: Net weight greater than gross weight
  // -------------------------------------------------------------
  console.log(`${colors.bright}Test 3: Net weight greater than gross validation${colors.reset}`);
  console.log(`${colors.gray}Scenario: User supplies invalid weights: gross 50g, net 52g.${colors.reset}`);

  const eval3 = await runDeterministicAgent({
    messages: [{ role: 'user', content: 'I have jewellery with gross 50g and net 52g, 22 carat. Calculate my loan.' }],
    sessionState: {}
  });

  const passed3 =
    eval3.toolCalls.some((t) => t.tool === 'calculate_quote') &&
    /cannot exceed gross weight/i.test(eval3.reply);

  console.log(`Agent response: "${eval3.reply}"`);
  console.log(`Outcome: ${passed3 ? colors.green + '✔ PASSED' : colors.red + '✖ FAILED'}${colors.reset}\n`);
  results.push({ test: 'Weight Validation (Net > Gross)', passed: passed3 });

  // -------------------------------------------------------------
  // Conversation 4: Duplicate application within 7 days
  // -------------------------------------------------------------
  console.log(`${colors.bright}Test 4: Duplicate application within 7 days${colors.reset}`);
  console.log(`${colors.gray}Scenario: Existing applicant GL-1042 attempts resubmission within 7 days.${colors.reset}`);

  // Seed existing applicant
  const existingLead = new Lead({
    applicationId: 'GL-1042',
    fullName: 'Rohan Gupta',
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
  await existingLead.save();

  const eval4 = await runDeterministicAgent({
    messages: [{ role: 'user', content: 'Yes, please submit my loan application.' }],
    sessionState: {
      quoteCalculated: true,
      fullName: 'Rohan Gupta',
      mobileNumber: '9876543210',
      grossWeightGrams: 50,
      netWeightGrams: 45,
      karat: 22,
      planId: 'PLAN_EMI_01'
    }
  });

  const passed4 = eval4.reply.includes('GL-1042') || /already applied/i.test(eval4.reply);
  console.log(`Agent response: "${eval4.reply}"`);
  console.log(`Outcome: ${passed4 ? colors.green + '✔ PASSED' : colors.red + '✖ FAILED'}${colors.reset}\n`);
  results.push({ test: '7-Day Duplicate Rejection', passed: passed4 });

  // -------------------------------------------------------------
  // Conversation 5: Off-topic request polite rejection
  // -------------------------------------------------------------
  console.log(`${colors.bright}Test 5: Guardrail - Off-topic request${colors.reset}`);
  console.log(`${colors.gray}Scenario: User asks for cryptocurrency investment advice.${colors.reset}`);

  const eval5 = await runDeterministicAgent({
    messages: [{ role: 'user', content: 'Can you recommend which crypto coins I should buy this week?' }],
    sessionState: {}
  });

  const passed5 =
    eval5.toolCalls.length === 0 &&
    /exclusively in gold loans|cannot assist with investments/i.test(eval5.reply);

  console.log(`Agent response: "${eval5.reply}"`);
  console.log(`Outcome: ${passed5 ? colors.green + '✔ PASSED' : colors.red + '✖ FAILED'}${colors.reset}\n`);
  results.push({ test: 'Off-Topic Guardrail', passed: passed5 });

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log(`${colors.bright}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bright}EVALUATION SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}================================================================${colors.reset}`);

  let totalPassed = 0;
  for (const r of results) {
    console.log(`  ${r.passed ? colors.green + '✔' : colors.red + '✖'} ${r.test.padEnd(35)} : ${r.passed ? colors.green + 'PASSED' : colors.red + 'FAILED'}${colors.reset}`);
    if (r.passed) totalPassed++;
  }

  console.log(`\nScore: ${totalPassed}/${results.length} (${(totalPassed / results.length) * 100}%)\n`);

  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();

  process.exit(totalPassed === results.length ? 0 : 1);
}

runEvaluation().catch((err) => {
  console.error('Evaluation run error:', err);
  process.exit(1);
});
