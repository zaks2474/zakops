import http from 'node:http';
import { spawn } from 'node:child_process';
import process from 'node:process';

const backendPort = parseInt(process.env.E2E_BACKEND_PORT || '19090', 10);
const frontendPort = parseInt(process.env.E2E_FRONTEND_PORT || '3003', 10);

const sessions = new Map(); // session_id -> { proposals: Map<string, any> }

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function canonicalizeProposalType(type) {
  const raw = String(type || '').trim().toLowerCase();
  const normalized = raw.replace(/[\s-]+/g, '_');
  const alias = {
    schedule_action: 'create_task',
    schedule_task: 'create_task',
  };
  return alias[normalized] || normalized;
}

function ensureSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { proposals: new Map() });
  }
  return sessions.get(sessionId);
}

async function handleChatSse(req, res) {
  const body = await readJson(req);
  const query = String(body.query || '');
  const scope = body.scope || {};

  const sessionId = body.session_id || `sess-${Math.random().toString(16).slice(2, 10)}`;
  const session = ensureSession(sessionId);

  let proposals = [];
  let fullText = 'OK';

  const dealId = scope.deal_id || 'DEAL-2025-008';

  if (/draft email|email/i.test(query)) {
    proposals = [
      {
        proposal_id: 'p-draft-email',
        type: 'draft_email',
        deal_id: dealId,
        params: {
          recipient: 'broker@example.com',
          subject: 'Re: CIM request',
          context: 'Please send the CIM and last-twelve-month financials.',
        },
        reason: 'Draft a broker email request',
        status: 'pending_approval',
      },
    ];
    fullText = 'Drafting an email proposal for the broker.';
  } else if (/task|schedule/i.test(query)) {
    // Intentionally emit schedule_action to exercise UI/backend normalization.
    proposals = [
      {
        proposal_id: 'p-schedule-action',
        type: 'schedule_action',
        deal_id: dealId,
        params: {
          description: 'Follow up with broker in 1 day',
          due_days: 1,
          action_type: 'follow_up',
          priority: 'normal',
        },
        reason: 'Schedule a follow-up task',
        status: 'pending_approval',
      },
    ];
    fullText = 'Scheduling a follow-up task proposal.';
  } else if (/note/i.test(query)) {
    proposals = [
      {
        proposal_id: 'p-add-note',
        type: 'add_note',
        deal_id: dealId,
        params: {
          content: 'Test note from e2e.',
          category: 'chat_note',
        },
        reason: 'Add an operator note',
        status: 'pending_approval',
      },
    ];
    fullText = 'Here is a note proposal.';
  } else if (/long/i.test(query)) {
    const lines = Array.from({ length: 120 }).map((_, i) => `Line ${i + 1}: ${query}`);
    fullText = lines.join('\n');
  } else {
    fullText = `Echo: ${query}`;
  }

  // Persist proposals for execute-proposal.
  for (const p of proposals) {
    session.proposals.set(p.proposal_id, { ...p });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Stream token chunks to exercise scroll/streaming UX.
  const chunkSize = 24;
  for (let i = 0; i < fullText.length; i += chunkSize) {
    sendSse(res, 'token', { token: fullText.slice(i, i + chunkSize) });
    // Keep streaming long responses slightly slower for scroll assertions.
    if (fullText.length > 2000) {
      // ~1s for long responses
      // eslint-disable-next-line no-await-in-loop
      await delay(12);
    } else {
      // eslint-disable-next-line no-await-in-loop
      await delay(2);
    }
  }

  sendSse(res, 'done', {
    session_id: sessionId,
    citations: [],
    proposals,
    warnings: [],
    timings: {
      request_id: `req-${Math.random().toString(16).slice(2, 10)}`,
      total_ms: 10,
      evidence_ms: 0,
      llm_ms: 10,
      deterministic_ms: 0,
      cache_hit: false,
      provider_used: 'mock',
      provider_fallback: false,
      degraded: false,
      evidence_breakdown: {},
    },
    final_text: fullText,
  });

  res.end();
}

async function handleExecuteProposal(req, res) {
  const body = await readJson(req);
  const sessionId = String(body.session_id || '');
  const proposalId = String(body.proposal_id || '');
  const action = String(body.action || 'approve').toLowerCase();

  const session = sessions.get(sessionId);
  if (!session) {
    return sendJson(res, 404, { success: false, error: 'Session not found', reason: 'session_not_found' });
  }
  const proposal = session.proposals.get(proposalId);
  if (!proposal) {
    return sendJson(res, 404, { success: false, error: 'Proposal not found', reason: 'proposal_not_found' });
  }

  const canonicalType = canonicalizeProposalType(proposal.type);
  proposal.type = canonicalType;

  if (action === 'reject') {
    proposal.status = 'rejected';
    session.proposals.set(proposalId, proposal);
    return sendJson(res, 200, {
      success: true,
      result: { status: 'rejected' },
      proposal,
      proposal_type: proposal.type,
    });
  }

  let result = {};
  if (canonicalType === 'add_note') {
    proposal.status = 'executed';
    result = { success: true, event_id: 'E-MOCK' };
  } else if (canonicalType === 'create_task') {
    proposal.status = 'executed';
    result = { action_id: 'A-MOCK', scheduled_days: Number(proposal?.params?.due_days || 1) };
  } else if (canonicalType === 'draft_email') {
    proposal.status = 'executed';
    result = {
      email_draft: {
        subject: 'Re: CIM request',
        body: 'Hi — can you please share the CIM and LTM financials?\nThanks,',
        provider: 'gemini-pro',
        model: 'gemini-1.5-pro',
      },
      recipient: 'broker@example.com',
      subject: 'Re: CIM request',
      provider: 'gemini-pro',
      model: 'gemini-1.5-pro',
      forced_reason: 'email_draft',
    };
  } else if (canonicalType === 'stage_transition') {
    proposal.status = 'executed';
    result = { success: true, from_stage: 'new', to_stage: 'qualified' };
  } else if (canonicalType === 'request_docs') {
    proposal.status = 'executed';
    result = { success: true, event_id: 'E-REQ', action_id: 'A-REQ' };
  } else {
    proposal.status = 'failed';
    proposal.error = `Unknown proposal type: ${proposal.type}`;
    session.proposals.set(proposalId, proposal);
    return sendJson(res, 400, {
      success: false,
      error: proposal.error,
      reason: 'unknown_proposal_type',
      proposal,
    });
  }

  proposal.result = result;
  session.proposals.set(proposalId, proposal);
  return sendJson(res, 200, {
    success: true,
    result,
    proposal,
    proposal_type: proposal.type,
  });
}

const backend = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/deals') {
      return sendJson(res, 200, {
        count: 2,
        deals: [
          { deal_id: 'DEAL-2025-008', canonical_name: 'Test Deal 008', stage: 'new', status: 'active' },
          { deal_id: 'DEAL-2025-010', canonical_name: 'Test Deal 010', stage: 'qualified', status: 'active' },
        ],
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      return await handleChatSse(req, res);
    }

    if (req.method === 'POST' && url.pathname === '/api/chat/execute-proposal') {
      return await handleExecuteProposal(req, res);
    }
  } catch (err) {
    return sendJson(res, 500, { success: false, error: String(err) });
  }

  return sendJson(res, 404, { success: false, error: 'Not found' });
});

backend.listen(backendPort, () => {
  // eslint-disable-next-line no-console
  console.log(`[e2e] mock backend listening on http://localhost:${backendPort}`);
});

const nextProc = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['next', 'dev', '--port', String(frontendPort)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      API_URL: `http://localhost:${backendPort}`,
      E2E_BACKEND_PORT: String(backendPort),
      E2E_FRONTEND_PORT: String(frontendPort),
    },
    stdio: 'inherit',
  }
);

function shutdown() {
  try {
    backend.close();
  } catch {
    // ignore
  }
  try {
    nextProc.kill('SIGTERM');
  } catch {
    // ignore
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

nextProc.on('exit', (code) => {
  shutdown();
  process.exit(code ?? 0);
});

