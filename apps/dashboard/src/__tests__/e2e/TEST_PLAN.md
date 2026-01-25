# ZakOps E2E Integration Test Plan

## Overview

This document provides manual test scenarios for verifying the complete integration between ZakOps UI components and the backend services.

---

## Prerequisites

1. Backend API running on `http://localhost:9200`
2. Frontend dev server running on `http://localhost:3000`
3. LangSmith Agent Builder configured with ZakOps assistant
4. Test email account connected (optional for email flows)

---

## Test Scenarios

### Scenario 1: Email → Deal Flow

**Objective:** Verify that emails forwarded to quarantine are correctly processed and result in new deals.

#### Steps:

1. **Forward Email to Quarantine**
   - Navigate to Quarantine page (`/quarantine`)
   - Click "Forward Email" or use the email forwarding address
   - Send a test email with deal information:
     ```
     Subject: New Deal - ABC Manufacturing

     Hi,

     I have a deal that matches your criteria:
     - Company: ABC Manufacturing
     - Revenue: $5M
     - EBITDA: $1.2M
     - Location: Austin, TX

     Interested?
     ```

2. **Verify Agent Extraction**
   - [ ] Email appears in quarantine list within 30 seconds
   - [ ] Company name is extracted: "ABC Manufacturing"
   - [ ] Classification is set appropriately
   - [ ] Urgency is calculated based on content

3. **Approve Quarantine Item**
   - Click on the quarantine item
   - Review extracted information
   - Click "Approve" button
   - [ ] Approval dialog appears with deal preview
   - [ ] Confirm approval

4. **Verify Deal Creation**
   - [ ] `deal.created` event appears in network tab
   - [ ] Deal appears in Pipeline page (`/deals`)
   - [ ] Deal stage is "inbound"
   - [ ] TodayNextUpStrip shows the new deal

**Expected Events:**
- `quarantine.created`
- `quarantine.approved`
- `deal.created`

---

### Scenario 2: Chat → Action → Approval Flow

**Objective:** Verify the complete flow from chat request to approved action execution.

#### Steps:

1. **Open Deal Workspace**
   - Navigate to a deal (`/deals/{deal_id}`)
   - Open the Chat tab

2. **Send Agent Request**
   - Type: "Please draft and send a follow-up email to the broker asking about financial documents"
   - Press Enter

3. **Verify Agent Processing**
   - [ ] Agent starts thinking (spinner shows)
   - [ ] Reasoning display shows agent's thought process
   - [ ] `draft_broker_response` tool call appears
   - [ ] `send_email` tool call appears with approval checkpoint

4. **Review Approval Request**
   - [ ] ApprovalCard appears in timeline
   - [ ] Risk level badge shows "high"
   - [ ] External impact indicator shows
   - [ ] Preview shows email subject and recipient
   - [ ] Expand to view full email content

5. **Approve the Action**
   - Click "Approve" button
   - [ ] Loading spinner shows
   - [ ] Tool execution starts

6. **Verify Completion**
   - [ ] `tool_call_completed` event fires
   - [ ] Action status changes to "completed"
   - [ ] Success message appears
   - [ ] Agent acknowledges in response

**Expected Events:**
- `run_started`
- `tool_call_started` (draft_broker_response)
- `tool_call_completed`
- `tool_approval_requested` (send_email)
- `tool_approval_granted`
- `tool_call_started` (send_email)
- `tool_call_completed`
- `run_completed`

---

### Scenario 3: Stage Transition Flow

**Objective:** Verify deal stage changes with approval workflow.

#### Steps:

1. **Open Deal in Screening Stage**
   - Navigate to a deal currently in "screening" stage

2. **Request Stage Advance**
   - In chat, type: "This deal meets our criteria, please move it to qualified stage"
   - Or click the "Advance Stage" button in deal header

3. **Review Approval**
   - [ ] `advance_deal_stage` tool call appears
   - [ ] ApprovalCard shows current → new stage
   - [ ] Preview shows reason for advancement

4. **Approve Transition**
   - Click "Approve"
   - [ ] Stage changes to "qualified"

5. **Verify Updates**
   - [ ] `deal.stage_changed` event fires
   - [ ] StageProgressBar updates in real-time
   - [ ] Deal moves in Pipeline view
   - [ ] Activity timeline shows stage change

**Expected Events:**
- `tool_approval_requested`
- `tool_approval_granted`
- `deal.stage_changed`

---

### Scenario 4: Disconnect/Reconnect

**Objective:** Verify SSE connection resilience and state recovery.

#### Steps:

1. **Start Agent Run**
   - Open a deal workspace
   - Send a message that triggers multiple tool calls
   - Note the current state (tool calls in progress, etc.)

2. **Simulate Disconnect**
   - Open DevTools → Network
   - Set to "Offline" mode
   - Wait 5 seconds

3. **Observe Reconnection**
   - Set back to "Online"
   - [ ] Connection state shows "Reconnecting..."
   - [ ] Reconnect attempt counter increases
   - [ ] After reconnect, state shows "Connected"

4. **Verify State Recovery**
   - [ ] All previous tool calls are visible
   - [ ] Pending approvals are shown
   - [ ] No duplicate events
   - [ ] Run continues from where it left off

5. **Alternative: Close and Reopen Tab**
   - During an active run, close the browser tab
   - Reopen the same URL
   - [ ] Run state is recovered from API
   - [ ] SSE reconnects with lastEventId

**Expected Behavior:**
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
- Max 10 reconnection attempts
- lastEventId passed on reconnect

---

### Scenario 5: Onboarding Complete Flow

**Objective:** Verify new user onboarding creates proper configuration.

#### Steps:

1. **Start as New User**
   - Clear local storage
   - Navigate to `/` or `/onboarding`

2. **Complete Welcome Step**
   - [ ] Welcome message displays
   - Click "Continue"

3. **Email Setup Step**
   - Click "Google Workspace" or "Microsoft 365"
   - [ ] OAuth flow initiates (or simulates)
   - [ ] Email address shows as connected
   - Click "Continue"

4. **Agent Configuration Step**
   - [ ] Agent toggle is ON by default
   - [ ] Auto-approve level shows "Low Risk Only"
   - Optionally adjust settings
   - Click "Continue"

5. **Preferences Step**
   - [ ] Notifications options are shown
   - Configure email/browser notifications
   - Select digest frequency
   - Click "Continue"

6. **Complete Step**
   - [ ] Summary of configuration shows
   - Click "Get Started"

7. **Verify Dashboard**
   - [ ] Redirected to main dashboard
   - [ ] Quick stats show (even if empty)
   - [ ] Email monitoring is active
   - [ ] First deal appears when email arrives

**Expected Outcome:**
- User preferences saved to localStorage/API
- Safety config reflects auto-approve level
- Email connection established
- Dashboard is functional

---

## Test Results Template

### Execution Date: ___________
### Tester: ___________
### Environment: ___________

| Scenario | Status | Issues Found | Notes |
|----------|--------|--------------|-------|
| 1. Email → Deal Flow | ⬜ Pass / ⬜ Fail | | |
| 2. Chat → Approval Flow | ⬜ Pass / ⬜ Fail | | |
| 3. Stage Transition | ⬜ Pass / ⬜ Fail | | |
| 4. Disconnect/Reconnect | ⬜ Pass / ⬜ Fail | | |
| 5. Onboarding | ⬜ Pass / ⬜ Fail | | |

### Issues to Fix:
1.
2.
3.

### Recommendations:
1.
2.
3.
