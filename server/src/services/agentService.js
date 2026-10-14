import { GoogleGenerativeAI } from '@google/generative-ai';
import { LoanScheme } from '../models/LoanScheme.js';
import { Lead } from '../models/Lead.js';
import { DEFAULT_LOAN_SCHEMES, DEFAULT_GOLD_RATE_24K, MAX_REGULATORY_LTV } from '../config/constants.js';
import { quoteQuerySchema, createLeadSchema } from '../validations/schemas.js';
import { calculateQuote } from './calculatorService.js';
import { createLead } from './leadService.js';
import { maskMobile } from '../utils/masking.js';

// Tool Definitions for LLM Function Calling
export const AGENT_TOOLS_DEFINITIONS = [
  {
    name: 'get_loan_schemes',
    description: 'Lists all currently active gold loan schemes with interest rates, max LTV, and tenure. The agent may only describe plans returned by this tool.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'calculate_quote',
    description: 'Calculates the pure gold grams, gold valuation at mock ₹7,000/g 24K, and eligible loan amounts for active loan schemes. The LLM must NEVER calculate financial numbers itself.',
    parameters: {
      type: 'OBJECT',
      properties: {
        grossWeightGrams: {
          type: 'NUMBER',
          description: 'Gross weight of gold in grams (0 < gross <= 1000)'
        },
        netWeightGrams: {
          type: 'NUMBER',
          description: 'Net weight of gold in grams (0 < net <= gross <= 1000)'
        },
        karat: {
          type: 'NUMBER',
          description: 'Gold purity in karat: 18, 22, or 24'
        }
      },
      required: ['grossWeightGrams', 'netWeightGrams', 'karat']
    }
  },
  {
    name: 'submit_application',
    description: 'Submits a validated gold loan application to create a lead with status SUBMITTED. MUST only be called after explicit borrower confirmation of the complete loan summary.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fullName: {
          type: 'STRING',
          description: 'Borrower full name (2-60 letters & spaces only)'
        },
        mobileNumber: {
          type: 'STRING',
          description: '10-digit Indian mobile number starting with 6-9'
        },
        grossWeightGrams: { type: 'NUMBER', description: 'Gross weight in grams' },
        netWeightGrams: { type: 'NUMBER', description: 'Net weight in grams' },
        karat: { type: 'NUMBER', description: 'Purity: 18, 22, or 24' },
        planId: { type: 'STRING', description: 'Selected plan ID, e.g. PLAN_EMI_01 or PLAN_BULLET_01' }
      },
      required: ['fullName', 'mobileNumber', 'grossWeightGrams', 'netWeightGrams', 'karat', 'planId']
    }
  },
  {
    name: 'check_existing_application',
    description: 'Checks if an application already exists for the given 10-digit mobile number within the last 7 days.',
    parameters: {
      type: 'OBJECT',
      properties: {
        mobileNumber: {
          type: 'STRING',
          description: '10-digit Indian mobile number'
        }
      },
      required: ['mobileNumber']
    }
  }
];

export const SYSTEM_PROMPT = `You are "GoldAssist", an expert, professional, and compliant AI Loan Assistant for a Gold Loan Intake Portal.

CRITICAL OPERATIONAL RULES & GUARDRAILS:
1. NEVER DO FINANCIAL ARITHMETIC YOURSELF: You are strictly forbidden from calculating pure gold weight, gold valuation, interest, or eligible loan amounts in your head. You MUST call the "calculate_quote" tool for any and all numbers.
2. ONLY DESCRIBE RETURNED PLANS: You may only describe loan schemes returned by "get_loan_schemes". The two active plans are PLAN_EMI_01 (Monthly EMI, 10.5% p.a., 75% LTV) and PLAN_BULLET_01 (Bullet Repayment, 12.0% p.a., 70% LTV).
3. EXPLICIT CONFIRMATION BEFORE SUBMISSION: You MUST NEVER call "submit_application" until the user has seen the full summary (Name, Mobile, Net/Gross weight, Karat, Plan, Eligible Loan) and explicitly says "Yes", "Confirm", "Submit", or confirms the submission.
4. STRICT GUARDRAILS - GOLD LOANS ONLY:
   - Stay exclusively on gold loans.
   - Do NOT give stock, crypto, or investment advice.
   - Do NOT make definitive promises of loan sanction (these are preliminary quotes subject to in-person valuation).
   - Politely decline any off-topic queries (e.g. weather, general chit-chat, programming, or non-gold topics).
5. VALIDATION DISCIPLINE:
   - Gross weight: 0 < gross <= 1000 grams.
   - Net weight: 0 < net <= gross <= 1000 grams.
   - Karat: must be 18, 22, or 24.
   - Mobile: 10-digit Indian number starting with 6, 7, 8, or 9.
   - If net > gross or any value is invalid, report the validation error clearly and ask the borrower to correct it.
6. PRIVACY: Never reveal unmasked mobile numbers in your reasoning or conversational logs.`;

/**
 * Execute backend tools with Zod validation
 */
export async function executeTool(toolName, args = {}) {
  console.log(`[Agent Tool Execution] Tool: ${toolName}, Args:`, JSON.stringify(args));

  switch (toolName) {
    case 'get_loan_schemes': {
      let plans = await LoanScheme.find({ isActive: true }).lean();
      if (!plans || plans.length === 0) {
        plans = DEFAULT_LOAN_SCHEMES;
      }
      return {
        success: true,
        schemes: plans.map((p) => ({
          planId: p.planId,
          name: p.name,
          annualInterestRate: `${p.annualInterestRate}% p.a.`,
          maxLtv: `${Math.round(p.maxLtv * 100)}%`,
          tenure: p.tenure
        }))
      };
    }

    case 'calculate_quote': {
      // Validate input arguments using Zod schema
      const parseResult = quoteQuerySchema.safeParse(args);
      if (!parseResult.success) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid quote parameters',
            fields: parseResult.error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }
        };
      }

      let plans = await LoanScheme.find({ isActive: true }).lean();
      if (!plans || plans.length === 0) {
        plans = DEFAULT_LOAN_SCHEMES;
      }

      const quote = calculateQuote({
        grossWeightGrams: parseResult.data.grossWeightGrams,
        netWeightGrams: parseResult.data.netWeightGrams,
        karat: parseResult.data.karat,
        plans
      });

      return {
        success: true,
        quote
      };
    }

    case 'check_existing_application': {
      const { mobileNumber } = args;
      if (!mobileNumber || !/^[6-9]\d{9}$/.test(mobileNumber)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid mobile number. Must be a 10-digit Indian number.'
          }
        };
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const existing = await Lead.findOne({
        mobileNumber,
        createdAt: { $gte: sevenDaysAgo }
      }).sort({ createdAt: -1 });

      if (existing) {
        return {
          hasExisting: true,
          applicationId: existing.applicationId,
          status: existing.status,
          appliedAt: existing.createdAt
        };
      }

      return { hasExisting: false };
    }

    case 'submit_application': {
      const parseResult = createLeadSchema.safeParse(args);
      if (!parseResult.success) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Cannot submit application due to invalid details',
            fields: parseResult.error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }
        };
      }

      try {
        const result = await createLead(parseResult.data);
        return {
          success: true,
          applicationId: result.applicationId,
          status: result.status,
          lead: result.lead
        };
      } catch (err) {
        return {
          success: false,
          error: {
            code: err.code || 'SUBMISSION_ERROR',
            message: err.message,
            applicationId: err.extra?.applicationId
          }
        };
      }
    }

    default:
      return {
        success: false,
        error: { code: 'UNKNOWN_TOOL', message: `Tool '${toolName}' is not defined.` }
      };
  }
}

/**
 * Intelligent Deterministic Agent Engine (Runs out of the box without requiring external API keys)
 * Also used to guarantee 100% reliable evaluation in CI/unit tests.
 */
export async function runDeterministicAgent({ messages = [], sessionState = {} }) {
  const lastMessage = messages[messages.length - 1];
  const userText = (lastMessage?.content || '').trim().toLowerCase();
  const state = { ...sessionState };

  // 1. Guardrail: Off-Topic Filter
  const offTopicKeywords = [
    'bitcoin', 'crypto', 'stock', 'weather', 'recipe', 'python', 'java',
    'coding', 'movie', 'president', 'election', 'football', 'cricket score',
    'buy car', 'mutual fund', 'real estate'
  ];
  if (offTopicKeywords.some((word) => userText.includes(word))) {
    return {
      reply: 'I am your Gold Loan Assistant. I specialize exclusively in gold loans, gold valuation, and application processing. I cannot assist with investments or other unrelated topics.',
      toolCalls: [],
      sessionState: state
    };
  }

  // 2. Extract Data from User Messages
  // Extract karat
  const karatMatch = userText.match(/\b(18|22|24)\s*(?:k|karat|carat)\b/i);
  if (karatMatch) state.karat = parseInt(karatMatch[1], 10);

  // Extract weight: e.g. "45 grams", "45g", "net 45g gross 50g", "net 52g > gross 50g"
  const grossNetMatch = userText.match(/gross\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?.*net\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?/i);
  const netGrossMatch = userText.match(/net\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?.*gross\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?/i);

  if (grossNetMatch) {
    state.grossWeightGrams = parseFloat(grossNetMatch[1]);
    state.netWeightGrams = parseFloat(grossNetMatch[2]);
  } else if (netGrossMatch) {
    state.netWeightGrams = parseFloat(netGrossMatch[1]);
    state.grossWeightGrams = parseFloat(netGrossMatch[2]);
  } else {
    // Single weight mentioned (e.g. "45 grams of 22 carat")
    const weightMatch = userText.match(/(\d+(?:\.\d+)?)\s*(?:grams?|g\b)/i);
    if (weightMatch) {
      const w = parseFloat(weightMatch[1]);
      if (!state.netWeightGrams) state.netWeightGrams = w;
      if (!state.grossWeightGrams) state.grossWeightGrams = w; // Default gross = net if single weight given
    }
  }

  // Extract mobile number: 10-digit Indian number
  const mobileMatch = userText.match(/\b([6-9]\d{9})\b/);
  if (mobileMatch) state.mobileNumber = mobileMatch[1];

  // Extract plan preference
  if (userText.includes('bullet')) state.planId = 'PLAN_BULLET_01';
  if (userText.includes('emi') || userText.includes('monthly')) state.planId = 'PLAN_EMI_01';

  // Extract name: e.g. "my name is Rahul Sharma and my mobile is 9876543210"
  const nameMatch = userText.match(/(?:my name is|i am|name[:=]?)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)(?=\s+(?:and|my|mobile|phone|\d)|$|,|\.)/i);
  if (nameMatch) {
    const rawName = nameMatch[1].trim();
    // Capitalize each word properly
    state.fullName = rawName
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  const toolCalls = [];

  // 3. Validation Check: If net > gross, call calculate_quote to let Zod reject it
  if (state.netWeightGrams && state.grossWeightGrams && state.netWeightGrams > state.grossWeightGrams) {
    toolCalls.push({
      tool: 'calculate_quote',
      args: {
        grossWeightGrams: state.grossWeightGrams,
        netWeightGrams: state.netWeightGrams,
        karat: state.karat || 22
      }
    });

    const toolResult = await executeTool('calculate_quote', {
      grossWeightGrams: state.grossWeightGrams,
      netWeightGrams: state.netWeightGrams,
      karat: state.karat || 22
    });

    return {
      reply: `Validation Error: Net weight (${state.netWeightGrams}g) cannot exceed gross weight (${state.grossWeightGrams}g). Please provide a valid net weight.`,
      toolCalls,
      sessionState: state
    };
  }

  // 4. Calculate Quote if weight and karat are available
  if (state.netWeightGrams && state.karat && !state.quoteCalculated) {
    const gross = state.grossWeightGrams || state.netWeightGrams;
    toolCalls.push({
      tool: 'calculate_quote',
      args: {
        grossWeightGrams: gross,
        netWeightGrams: state.netWeightGrams,
        karat: state.karat
      }
    });

    const quoteRes = await executeTool('calculate_quote', {
      grossWeightGrams: gross,
      netWeightGrams: state.netWeightGrams,
      karat: state.karat
    });

    if (quoteRes.success) {
      state.quoteCalculated = true;
      state.quote = quoteRes.quote;

      const emiQuote = quoteRes.quote.plans.find((p) => p.planId === 'PLAN_EMI_01');
      const bulletQuote = quoteRes.quote.plans.find((p) => p.planId === 'PLAN_BULLET_01');

      let reply = `Based on current 24K gold rates of ₹7,000/g:\n` +
        `• Pure Gold: ${quoteRes.quote.pureGoldGrams}g\n` +
        `• Gold Valuation: ₹${quoteRes.quote.goldValue.toLocaleString('en-IN')}\n\n` +
        `Eligible Loan Offers:\n` +
        `1. Monthly EMI (10.5% p.a., 75% LTV): Eligible loan up to ₹${emiQuote?.eligibleLoan.toLocaleString('en-IN')}\n` +
        `2. Bullet Repayment (12.0% p.a., 70% LTV): Eligible loan up to ₹${bulletQuote?.eligibleLoan.toLocaleString('en-IN')}\n\n`;

      if (!state.fullName || !state.mobileNumber) {
        reply += `To proceed with your application, please share your Full Name and 10-digit Mobile Number.`;
      } else {
        reply += `Would you like me to submit your application? Please confirm to proceed.`;
      }

      return {
        reply,
        toolCalls,
        sessionState: state
      };
    }
  }

  // 5. Check if user is confirming submission
  const isConfirming = /\b(yes|confirm|proceed|apply|submit|ok|sure|please submit)\b/i.test(userText);
  if (isConfirming && state.quoteCalculated && state.fullName && state.mobileNumber) {
    const selectedPlanId = state.planId || 'PLAN_EMI_01';

    // Submit Application tool call
    toolCalls.push({
      tool: 'submit_application',
      args: {
        fullName: state.fullName,
        mobileNumber: state.mobileNumber,
        grossWeightGrams: state.grossWeightGrams || state.netWeightGrams,
        netWeightGrams: state.netWeightGrams,
        karat: state.karat,
        planId: selectedPlanId
      }
    });

    const submitRes = await executeTool('submit_application', {
      fullName: state.fullName,
      mobileNumber: state.mobileNumber,
      grossWeightGrams: state.grossWeightGrams || state.netWeightGrams,
      netWeightGrams: state.netWeightGrams,
      karat: state.karat,
      planId: selectedPlanId
    });

    if (submitRes.success) {
      state.submitted = true;
      state.applicationId = submitRes.applicationId;
      return {
        reply: `🎉 Congratulations! Your gold loan application has been successfully submitted.\n\nApplication ID: ${submitRes.applicationId}\nStatus: SUBMITTED\nA representative will reach out to you shortly.`,
        toolCalls,
        sessionState: state
      };
    } else {
      // Duplicate or validation error
      if (submitRes.error?.code === 'DUPLICATE_APPLICATION') {
        return {
          reply: submitRes.error.message || `You already applied recently under application ${submitRes.error.applicationId}. Please wait 7 days before applying again.`,
          toolCalls,
          sessionState: state
        };
      }
      return {
        reply: `Could not submit application: ${submitRes.error?.message || 'Error occurred'}`,
        toolCalls,
        sessionState: state
      };
    }
  }

  // 6. Check for Missing Information Prompts
  if (!state.netWeightGrams || !state.karat) {
    return {
      reply: 'Hello! I can help you find out how much gold loan you can receive. Could you please share the net weight of your gold jewellery (in grams) and the karat purity (18K, 22K, or 24K)?',
      toolCalls: [],
      sessionState: state
    };
  }

  if (!state.fullName || !state.mobileNumber) {
    const missing = [];
    if (!state.fullName) missing.push('Full Name');
    if (!state.mobileNumber) missing.push('10-digit Indian Mobile Number');
    return {
      reply: `Got it! Before we can finalize your application, please provide your ${missing.join(' and ')}.`,
      toolCalls: [],
      sessionState: state
    };
  }

  // 7. Prompt Confirmation
  return {
    reply: `Here is a summary of your gold loan application:\n` +
      `• Name: ${state.fullName}\n` +
      `• Mobile: ${maskMobile(state.mobileNumber)}\n` +
      `• Weight: ${state.netWeightGrams}g (${state.karat}K)\n` +
      `• Plan: ${state.planId === 'PLAN_BULLET_01' ? 'Bullet Repayment (70% LTV)' : 'Monthly EMI (75% LTV)'}\n\n` +
      `Please reply "Confirm" or click submit to file your application.`,
    toolCalls: [],
    sessionState: state
  };
}

/**
 * Main chat handler: Uses Google Gemini API if key is configured,
 * otherwise transparently routes to the deterministic agent engine.
 */
export async function handleChatMessage({ messages = [], sessionState = {} }) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: process.env.AI_MODEL || 'gemini-2.5-flash',
        systemInstruction: SYSTEM_PROMPT
      });

      // Format conversation history for Gemini
      const lastMsg = messages[messages.length - 1];
      const chat = model.startChat({
        tools: [{ functionDeclarations: AGENT_TOOLS_DEFINITIONS }]
      });

      const response = await chat.sendMessage(lastMsg.content);
      const functionCalls = response.response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        const toolCallsExecuted = [];
        let toolResults = [];

        for (const call of functionCalls) {
          const result = await executeTool(call.name, call.args);
          toolCallsExecuted.push({ tool: call.name, args: call.args });
          toolResults.push({
            functionResponse: {
              name: call.name,
              response: result
            }
          });
        }

        const secondResponse = await chat.sendMessage(toolResults);
        return {
          reply: secondResponse.response.text(),
          toolCalls: toolCallsExecuted,
          sessionState
        };
      }

      return {
        reply: response.response.text(),
        toolCalls: [],
        sessionState
      };
    } catch (llmError) {
      console.warn('[Gemini LLM Error, falling back to deterministic agent]:', llmError.message);
    }
  }

  // Deterministic fallback agent
  return runDeterministicAgent({ messages, sessionState });
}
