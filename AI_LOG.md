# AI Engineering & Development Log (`AI_LOG.md`)

This log documents the AI engineering process, prompts used, AI assistance lifecycle, and critical debugging insights during the development of the **Gold Loan Portal with AI Agent** for the T Global Full Stack Developer Technical Assignment.

---

## 1. AI Tools Used & Purpose

| AI Tool / Framework | Purpose |
| :--- | :--- |
| **Google Gemini API (`gemini-2.5-flash`)** | Core LLM engine for borrower conversational intake, reasoning, and tool/function calling (`get_loan_schemes`, `calculate_quote`, `submit_application`). |
| **Antigravity AI Pair Programmer** | Full-stack scaffolding, schema design, cross-field validation synthesis, and Vitest / Supertest suite generation. |
| **Deterministic Fallback Agent Engine** | Fail-safe zero-dependency execution engine to ensure the entire evaluation suite (`npm run eval` and unit tests) runs reliably offline or without API credits. |

---

## 2. Two Exact Prompts Used

### Prompt 1: Zod Schema & Business Validation Synthesis
```text
System: You are an expert financial backend architect specializing in strict validation for regulated lending applications.
Task: Create comprehensive Zod validation schemas for a gold loan intake application adhering to these non-negotiable business rules:
1. Full Name: 2 to 60 characters, letters and whitespace only (regex: /^[a-zA-Z\s]{2,60}$/).
2. Mobile Number: Indian 10-digit mobile number starting with 6, 7, 8, or 9 (regex: /^[6-9]\d{9}$/).
3. Weight: Both gross and net weights must be positive numbers <= 1000g.
4. Cross-field rule: Net gold weight can NEVER exceed gross weight (0 < net <= gross <= 1000). If net > gross, return a field-specific error targeted on 'netWeightGrams'.
5. Purity: Karat must strictly be an integer of 18, 22, or 24.
6. Error Shape: Return standard error contracts matching { error: { code, message, fields: [{ field, message }] } }.
Provide the clean ESM TypeScript/JavaScript implementation.
```

### Prompt 2: AI Agent System Instructions & Function Calling Tools
```text
System Instruction:
You are "GoldAssist", an expert, professional, and compliant AI Loan Assistant for a Gold Loan Intake Portal.

CRITICAL OPERATIONAL RULES & GUARDRAILS:
1. NEVER DO FINANCIAL ARITHMETIC YOURSELF: You are strictly forbidden from calculating pure gold weight, gold valuation, interest, or eligible loan amounts in your head. You MUST call the "calculate_quote" tool for any and all numbers.
2. ONLY DESCRIBE RETURNED PLANS: You may only describe loan schemes returned by "get_loan_schemes". The active plans are PLAN_EMI_01 (Monthly EMI, 10.5% p.a., 75% LTV) and PLAN_BULLET_01 (Bullet Repayment, 12.0% p.a., 70% LTV).
3. EXPLICIT CONFIRMATION BEFORE SUBMISSION: You MUST NEVER call "submit_application" until the user has seen the full summary (Name, Mobile, Net/Gross weight, Karat, Plan, Eligible Loan) and explicitly says "Yes", "Confirm", "Submit", or confirms the submission.
4. STRICT GUARDRAILS - GOLD LOANS ONLY:
   - Stay exclusively on gold loans.
   - Do NOT give stock, crypto, or investment advice.
   - Do NOT make definitive promises of loan sanction (preliminary quotes subject to in-person valuation).
   - Politely decline any off-topic queries (e.g. weather, chit-chat, programming, or non-gold topics).
5. VALIDATION DISCIPLINE:
   - Gross weight: 0 < gross <= 1000 grams.
   - Net weight: 0 < net <= gross <= 1000 grams.
   - Karat: must be 18, 22, or 24.
   - Mobile: 10-digit Indian number starting with 6-9.
   - If net > gross or any value is invalid, report the validation error clearly and ask the borrower to correct it.
6. PRIVACY: Never reveal unmasked mobile numbers in your reasoning or conversational logs.
```

---

## 3. One Specific AI Mistake Discovered & The Test That Caught It

### The AI Mistake:
During initial implementation, the AI assistant generated financial loan calculations using standard floating-point arithmetic with `Math.round()` instead of `Math.floor()`, and did not store money values as integers or whole rupees:
```javascript
// AI's Initial Flawed Code:
const eligibleLoan = Math.round(goldValue * plan.maxLtv); // Generated decimal / rounded up!
```
When evaluating **TestCase 1** (45g net, 22K gold, EMI plan at 75% LTV):
- Pure gold = $45 \times \frac{22}{24} = 41.25\text{ g}$
- Gold valuation = $41.25 \times ₹7,000 = ₹2,88,750$
- Loan before rounding = $288750 \times 0.75 = ₹216562.50$
- The AI rounded up to **₹2,16,563**, which violates the lending rule requiring **whole-rupee floor rounding** (`floor(goldValue * min(plan.maxLtv, 0.75)) = ₹2,16,562`) and risks exceeding the strict 75.00% regulatory LTV limit by 50 paise.

Furthermore, when concurrent requests hit the lead creation endpoint simultaneously, the AI initially relied on a simple `findOne` lookup before saving, resulting in a race condition where two simultaneous requests from the same new mobile number both returned `201 Created` instead of `[201, 409]`.

### How It Was Spotted:
Automated test assertions in `server/src/tests/calculator.test.js` and `server/src/tests/api.test.js` failed:
```text
AssertionError: expected 216563 to be 216562
AssertionError: expected [201, 201] to deeply equal [201, 409]
```

### The Fix Implemented:
1. Replaced `Math.round` with `Math.floor` on the effective LTV calculation and added integer paise conversion:
```javascript
const effectiveLtv = Math.min(plan.maxLtv, MAX_REGULATORY_LTV);
const eligibleLoan = Math.floor(goldValue * effectiveLtv); // Exactly 216562
const eligibleLoanPaise = eligibleLoan * 100;
```
2. Added an in-memory asynchronous mutex lock per mobile number in `server/src/services/leadService.js` (`acquireMobileLock(mobileNumber)`) ensuring concurrent requests serialize their duplicate checks, guaranteeing race-condition safety.

### The Automated Test That Now Catches It:
```javascript
// From server/src/tests/calculator.test.js
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
  expect(planQuote.eligibleLoan).toBe(216562); // Strictly verifies floor rounding
  expect(planQuote.eligibleLoanPaise).toBe(21656200);
});

// From server/src/tests/api.test.js (Bonus B1: Race condition safety)
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
```
Both tests now run and pass with 100% green checkmarks in CI and local test runs.
