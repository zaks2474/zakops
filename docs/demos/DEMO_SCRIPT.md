# ZakOps Demo Script

This document provides a script for demonstrating ZakOps capabilities.

## Setup

### Prerequisites

Before the demo, ensure:

1. **Services running**: All ZakOps services are healthy
   ```bash
   make doctor
   curl http://localhost:8091/health
   ```

2. **Test data ready**: Demo user and sample deals exist
   ```bash
   # Create demo user (if needed)
   curl -X POST http://localhost:8091/api/v1/users \
     -H "Content-Type: application/json" \
     -d '{"username": "demo_user", "role": "operator"}'
   ```

3. **Browser ready**: Chrome with clean profile recommended

4. **Credentials available**: Have demo credentials ready

### Environment Check

```bash
# Run pre-demo checks
./tools/demos/run_demo.sh --check-only

# Expected output: All services healthy
```

## Script

### 1. Introduction (2 minutes)

"Welcome to ZakOps, an intelligent deal management platform. Today I'll show you how ZakOps combines AI automation with human oversight to streamline deal operations."

**Key points**:
- AI-powered analysis and automation
- Human-in-the-loop for critical decisions
- Complete audit trail
- Modern, intuitive interface

### 2. Dashboard Overview (3 minutes)

1. Log in to the dashboard at http://localhost:3003
2. Point out main navigation:
   - Deals list
   - Approvals queue
   - Audit logs
   - Settings

"The dashboard gives you a complete view of all deal activity. Let's create a new deal."

### 3. Creating a Deal (5 minutes)

1. Click "New Deal"
2. Fill in details:
   - Title: "Demo Partnership Agreement"
   - Description: "Q1 2025 partnership renewal"
   - Priority: High
3. Click "Create"

"Notice how the deal is created in draft status. Let's submit it for processing."

4. Click "Submit for Review"

### 4. Agent Interaction (5 minutes)

1. Select the deal
2. Click "Process with Agent"
3. Show agent analyzing the deal

"The AI agent is now analyzing the deal. Watch as it identifies key information and suggests next steps."

4. Show agent output with recommendations

"The agent has provided analysis. Notice some actions are flagged for approval."

### 5. Approval Workflow (5 minutes)

1. Navigate to Approvals
2. Show pending approval
3. Click on approval to expand

"High-risk actions pause for human review. Let's examine what the agent wants to do."

4. Review context and risk assessment
5. Click "Approve" with comment

"I've approved the action. The agent will now proceed with execution."

### 6. Audit Trail (3 minutes)

1. Navigate to Audit Logs
2. Filter by recent activity
3. Show deal creation and approval entries

"Every action is logged. This audit trail supports compliance and enables investigation when needed."

### 7. Q&A (Variable)

Open floor for questions.

## Cleanup

After the demo:

```bash
# Remove demo data
curl -X DELETE http://localhost:8091/api/v1/deals/demo_deal_id

# Or run cleanup script
./tools/demos/run_demo.sh --cleanup
```

### Reset for Next Demo

```bash
# Reset demo environment
./tools/demos/run_demo.sh --reset
```

## Troubleshooting During Demo

| Issue | Quick Fix |
|-------|-----------|
| Login fails | Use backup credentials |
| Service down | Switch to screenshots |
| Slow performance | Apologize, explain production differs |
| Agent error | Show error handling gracefully |

## Demo Variants

### Quick Demo (5 minutes)
- Skip setup details
- Pre-created deal
- Focus on agent + approval

### Technical Demo (20 minutes)
- Include API examples
- Show configuration
- Discuss architecture

### Executive Demo (10 minutes)
- Focus on business value
- Highlight compliance features
- Show metrics and reporting
