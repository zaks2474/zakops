// k6 Load Test Scenario: SLO Validation
// Validates API performance against defined SLOs
//
// Usage:
//   k6 run --env BASE_URL=http://localhost:8095 scenarios/slo-validation.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Import generated thresholds
// Note: Run generate_k6_thresholds.py first to generate this file
import { thresholds } from '../generated/thresholds.js';

// Custom metrics
const healthCheckDuration = new Trend('health_check_duration');
const invokeAgentDuration = new Trend('invoke_agent_duration');
const approvalListDuration = new Trend('approval_list_duration');
const errors = new Rate('errors');

// Test configuration
export const options = {
  // Thresholds imported from SLO configuration
  thresholds: {
    // Override with generated thresholds
    ...thresholds,
    // Add scenario-specific thresholds
    'health_check_duration': ['p(95)<100'],
    'invoke_agent_duration': ['p(95)<5000'],
    'approval_list_duration': ['p(95)<500'],
    'errors': ['rate<0.01'],
  },

  // Test stages
  stages: [
    // Ramp up
    { duration: '30s', target: 10 },
    // Steady state
    { duration: '2m', target: 10 },
    // Spike test
    { duration: '30s', target: 50 },
    // Recovery
    { duration: '30s', target: 10 },
    // Ramp down
    { duration: '30s', target: 0 },
  ],

  // Tags for better reporting
  tags: {
    scenario: 'slo-validation',
    environment: __ENV.ENVIRONMENT || 'development',
  },
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8095';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Request parameters
function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  return { headers };
}

// Scenario: Health Check
function healthCheck() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/v1/health`);
  const duration = Date.now() - start;

  healthCheckDuration.add(duration);

  const success = check(res, {
    'health: status is 200': (r) => r.status === 200,
    'health: has status field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'healthy';
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    errors.add(1);
  }

  return success;
}

// Scenario: Agent Invoke (requires auth)
function invokeAgent() {
  if (!AUTH_TOKEN) {
    // Skip if no auth token provided
    return true;
  }

  const payload = JSON.stringify({
    message: 'What is the current status of deal D-001?',
    actor_id: 'load-test-user',
    thread_id: `load-test-${__VU}-${__ITER}`,
  });

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/v1/agent/invoke`,
    payload,
    getAuthHeaders()
  );
  const duration = Date.now() - start;

  invokeAgentDuration.add(duration);

  const success = check(res, {
    'invoke: status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'invoke: has response body': (r) => r.body && r.body.length > 0,
  });

  if (!success && res.status >= 500) {
    errors.add(1);
  }

  return success;
}

// Scenario: List Approvals
function listApprovals() {
  const start = Date.now();
  const res = http.get(
    `${BASE_URL}/v1/agent/approvals`,
    getAuthHeaders()
  );
  const duration = Date.now() - start;

  approvalListDuration.add(duration);

  const success = check(res, {
    'approvals: status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  if (!success && res.status >= 500) {
    errors.add(1);
  }

  return success;
}

// Main test function
export default function () {
  // Health check (always runs)
  healthCheck();

  // Random sleep to simulate real user behavior
  sleep(Math.random() * 2);

  // Agent invocation (50% of iterations)
  if (Math.random() < 0.5) {
    invokeAgent();
    sleep(1);
  }

  // List approvals (30% of iterations)
  if (Math.random() < 0.3) {
    listApprovals();
    sleep(0.5);
  }

  // Inter-request delay
  sleep(Math.random() * 1);
}

// Setup function - runs once before the test
export function setup() {
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Auth token provided: ${AUTH_TOKEN ? 'yes' : 'no'}`);

  // Verify the service is reachable
  const res = http.get(`${BASE_URL}/v1/health`);
  if (res.status !== 200) {
    throw new Error(`Service not healthy: ${res.status}`);
  }

  return {
    startTime: new Date().toISOString(),
    baseUrl: BASE_URL,
  };
}

// Teardown function - runs once after the test
export function teardown(data) {
  console.log(`Test completed. Started at: ${data.startTime}`);
}

// Handle test summary
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

// Text summary helper
function textSummary(data, options) {
  const { metrics } = data;
  let output = '\n===== SLO Validation Summary =====\n\n';

  // Check thresholds
  const thresholdsPassed = Object.entries(data.thresholds || {}).filter(
    ([_, v]) => v.ok
  ).length;
  const thresholdsTotal = Object.keys(data.thresholds || {}).length;

  output += `Thresholds: ${thresholdsPassed}/${thresholdsTotal} passed\n\n`;

  // Key metrics
  if (metrics.http_req_duration) {
    const p95 = metrics.http_req_duration.values['p(95)'];
    const p99 = metrics.http_req_duration.values['p(99)'];
    output += `HTTP Request Duration:\n`;
    output += `  p95: ${p95.toFixed(2)}ms\n`;
    output += `  p99: ${p99.toFixed(2)}ms\n\n`;
  }

  if (metrics.http_req_failed) {
    const rate = metrics.http_req_failed.values.rate;
    output += `Error Rate: ${(rate * 100).toFixed(2)}%\n\n`;
  }

  if (metrics.iterations) {
    output += `Total Iterations: ${metrics.iterations.values.count}\n`;
    output += `VUs Max: ${data.options?.scenarios?.default?.maxVUs || 'N/A'}\n`;
  }

  return output;
}
