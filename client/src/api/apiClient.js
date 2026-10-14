const API_BASE = '/api/v1';

async function handleResponse(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorObj = json.error || {
      code: 'API_ERROR',
      message: `Request failed with status ${res.status}`
    };
    const err = new Error(errorObj.message);
    err.code = errorObj.code;
    err.fields = errorObj.fields || [];
    err.status = res.status;
    err.raw = json;
    throw err;
  }
  return json;
}

export const api = {
  // Get active loan schemes
  getSchemes: async () => {
    const res = await fetch(`${API_BASE}/loan-schemes`);
    const data = await handleResponse(res);
    return data.data || [];
  },

  // Calculate live quote (no DB write)
  calculateQuote: async (payload) => {
    const res = await fetch(`${API_BASE}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await handleResponse(res);
    return data.data;
  },

  // Submit new lead
  submitLead: async (payload, idempotencyKey) => {
    const headers = { 'Content-Type': 'application/json' };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await fetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    return await handleResponse(res);
  },

  // Get all leads (Admin)
  getLeads: async ({ planId = '', status = '', page = 1, limit = 50 } = {}) => {
    const params = new URLSearchParams();
    if (planId) params.append('planId', planId);
    if (status) params.append('status', status);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);

    const res = await fetch(`${API_BASE}/leads?${params.toString()}`);
    return await handleResponse(res);
  },

  // Update lead status (Admin)
  updateLeadStatus: async (applicationId, { status, notes }) => {
    const res = await fetch(`${API_BASE}/leads/${applicationId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });
    return await handleResponse(res);
  },

  // Send message to AI Agent
  sendMessage: async ({ messages, sessionState }) => {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, sessionState })
    });
    return await handleResponse(res);
  }
};
