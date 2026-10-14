import express from 'express';
import { handleChatMessage, executeTool } from '../services/agentService.js';

const router = express.Router();

/**
 * POST /api/v1/chat
 * Conversational endpoint for the AI Loan Assistant.
 * Routes through backend, protecting API keys and enforcing guardrails.
 */
router.post('/', async (req, res, next) => {
  try {
    const { messages = [], sessionState = {} } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'messages array is required and cannot be empty.'
        }
      });
    }

    const response = await handleChatMessage({ messages, sessionState });

    return res.status(200).json({
      success: true,
      data: response
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/chat/tool
 * Direct tool execution endpoint for testing and UI action verification.
 */
router.post('/tool', async (req, res, next) => {
  try {
    const { toolName, args } = req.body;
    if (!toolName) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'toolName is required'
        }
      });
    }

    const result = await executeTool(toolName, args);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
