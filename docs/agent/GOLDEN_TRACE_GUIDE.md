# Golden Trace Guide

## Overview

Golden traces are predefined test cases that verify agent behavior against expected outcomes. They serve as regression tests and help maintain agent quality over time.

## What is a Golden Trace?

A golden trace captures:
1. **Input**: User message and context
2. **Expected Output**: Tools to call, approval requirements, response characteristics
3. **Mock Response**: Simulated agent response for CI testing

## Directory Structure

```
apps/agent-api/evals/
├── golden_trace.schema.json    # JSON schema for traces
├── golden_trace_runner.py      # Test runner (CI & local modes)
└── golden_traces/
    ├── GT-001.json             # Basic deal query
    ├── GT-002.json             # Deal transition (approval)
    ├── GT-003.json             # List deals
    └── ...                     # More traces
```

## Creating a New Golden Trace

### Step 1: Identify the Test Case

Consider what behavior you want to verify:
- **Query**: Information retrieval (no side effects)
- **Mutation**: State change (may require approval)
- **Approval Required**: High-risk actions needing human confirmation
- **Error Handling**: Graceful handling of invalid inputs
- **Edge Case**: Ambiguous or unusual requests
- **No Tool**: General questions not requiring tools

### Step 2: Create the Trace File

Create a new file in `apps/agent-api/evals/golden_traces/` with the naming convention `GT-XXX.json`:

```json
{
  "id": "GT-011",
  "version": "1.0",
  "name": "Brief descriptive name",
  "description": "Detailed description of what this trace tests",
  "category": "query",
  "tags": ["deal", "query"],
  "input": {
    "user_message": "The user's input message",
    "context": {
      "deal_id": "optional-deal-id",
      "deal_name": "Optional Deal Name"
    }
  },
  "expected": {
    "tool_calls": [
      {
        "tool_name": "expected_tool",
        "required_parameters": ["param1", "param2"]
      }
    ],
    "requires_approval": false
  },
  "mock_response": {
    "tool_calls": [
      {
        "tool_name": "expected_tool",
        "parameters": {
          "param1": "value1",
          "param2": "value2"
        }
      }
    ],
    "response_text": "The agent's response text",
    "requires_approval": false
  },
  "metadata": {
    "created_at": "2025-01-25",
    "author": "Your Name"
  }
}
```

### Step 3: Validate the Trace

Run the schema validation:

```bash
# Run the trace runner in CI mode
CI=true python -m apps.agent_api.evals.golden_trace_runner
```

### Step 4: Test Locally (Optional)

If you have the agent running locally:

```bash
# Run against real agent
python -m apps.agent_api.evals.golden_trace_runner
```

## Running Modes

### CI Mode (Default in Gates)

Uses `mock_response` from trace files for deterministic, fast testing:

```bash
CI=true python -m apps.agent_api.evals.golden_trace_runner
```

**Pros:**
- Fast execution
- No external dependencies
- Deterministic results

**Cons:**
- Doesn't test actual agent behavior
- Requires maintaining mock responses

### Local Mode

Calls the real agent API:

```bash
# Default agent URL: http://localhost:8095
python -m apps.agent_api.evals.golden_trace_runner

# Custom agent URL
AGENT_URL=http://localhost:9000 python -m apps.agent_api.evals.golden_trace_runner
```

**Pros:**
- Tests real agent behavior
- Catches integration issues

**Cons:**
- Slower execution
- Requires running agent
- May have non-deterministic results

## Trace Categories

| Category | Description | Example |
|----------|-------------|---------|
| `query` | Information retrieval | "What's the status of deal X?" |
| `mutation` | State changes | "Create a new deal" |
| `approval_required` | High-risk actions | "Move deal to closed_won" |
| `error_handling` | Invalid input handling | "Get deal XYZ123" (non-existent) |
| `edge_case` | Ambiguous requests | "Update the deal" (which one?) |
| `no_tool` | General questions | "What can you help me with?" |

## Best Practices

### DO:
- ✅ Keep traces focused on one behavior
- ✅ Use realistic user messages
- ✅ Include both positive and negative cases
- ✅ Document why the trace exists
- ✅ Update mock responses when agent behavior changes

### DON'T:
- ❌ Create traces that depend on external state
- ❌ Use production data in traces
- ❌ Combine multiple test scenarios in one trace
- ❌ Skip the mock_response (breaks CI mode)

## Maintenance

### When to Update Traces

1. **Agent behavior changes**: Update expected and mock values
2. **New tools added**: Create traces for new functionality
3. **Bug discovered**: Add regression trace
4. **Feature removed**: Delete corresponding traces

### Review Cadence

| Activity | Frequency |
|----------|-----------|
| Run trace suite | Every PR (CI) |
| Review trace coverage | Weekly |
| Add new traces | As features ship |
| Audit mock accuracy | Quarterly |

## Troubleshooting

### Trace Fails in CI but Passes Locally

The mock response doesn't match actual agent behavior. Update the mock:

```bash
# Run locally to see actual response
python -m apps.agent_api.evals.golden_trace_runner

# Update mock_response in the trace file
```

### Schema Validation Fails

Check the trace against `golden_trace.schema.json`:
- Required fields: `id`, `version`, `name`, `description`, `input`, `expected`
- ID format: `GT-XXX` (three digits)
- Category must be valid enum value

### All Traces Fail

1. Check if the runner can find traces: `ls apps/agent-api/evals/golden_traces/`
2. Verify JSON syntax in trace files
3. Check Python path: `python -c "import apps.agent_api.evals.golden_trace_runner"`

## Related Documentation

- [SLO Definitions](/docs/slos/SLO_DEFINITIONS.md) - Tool accuracy targets
- [Risk Register](/docs/risk/RISK_REGISTER.md) - Validation risks
- [OWASP LLM Tests](/apps/agent-api/tests/security/) - Security testing
