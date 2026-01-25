# Beta Support Playbook

Internal guide for supporting beta customers.

## Triage Process

### Severity Levels

| Level | Description | Response SLA | Resolution SLA |
|-------|-------------|--------------|----------------|
| P1 - Critical | System down, data loss | 15 min | 4 hours |
| P2 - High | Major feature broken | 1 hour | 24 hours |
| P3 - Medium | Feature degraded | 4 hours | 72 hours |
| P4 - Low | Minor issue, cosmetic | 24 hours | Best effort |

### Initial Triage Steps

1. **Identify Severity**
   - Is the customer blocked?
   - Is data at risk?
   - How many users affected?

2. **Gather Information**
   - Customer name and organization
   - Steps to reproduce
   - Error messages (screenshots if available)
   - Time of occurrence
   - Browser/device info

3. **Check Known Issues**
   - Review `BETA_CHANGELOG.md` for recent changes
   - Check open GitHub issues
   - Search Slack #beta-issues channel

4. **Create Ticket**
   - Use template below
   - Tag with severity
   - Assign to on-call engineer

### Ticket Template

```markdown
## Beta Support Ticket

**Customer**: [Org Name]
**Reporter**: [Contact Name/Email]
**Severity**: P[1-4]
**Date/Time**: [When reported]

### Issue Description
[Clear description of the problem]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Environment
- Browser: [Chrome/Firefox/etc]
- OS: [Windows/Mac/Linux]
- Dashboard URL: [URL]

### Attachments
- [ ] Screenshots
- [ ] Error logs
- [ ] Request ID/Trace ID

### Investigation Notes
[To be filled by support]
```

## Common Issues and Solutions

### Login Problems

**Issue**: User can't log in
**Check**:
1. Verify credentials are active
2. Check MFA setup
3. Clear browser cache
4. Try incognito mode

**Escalate if**: Multiple users affected, or persists after cache clear

### Slow Performance

**Issue**: Dashboard is slow
**Check**:
1. Check their network speed
2. Verify browser version
3. Check system status page
4. Look for large datasets

**Escalate if**: P95 latency > 5s, or multiple customers report

### AI Agent Issues

**Issue**: Suggestions not appearing
**Check**:
1. Verify agent is enabled
2. Check daily quota
3. Verify deal has required fields
4. Check LLM service status

**Escalate if**: LLM service down, or quota system broken

### Data Issues

**Issue**: Missing or incorrect data
**Check**:
1. Verify sync status
2. Check recent imports
3. Look for validation errors
4. Check database connectivity

**Escalate immediately if**: Data corruption suspected

## Escalation Path

### L1 → L2 Escalation
- After 30 min of troubleshooting
- When root cause is unclear
- When fix requires code change

### L2 → L3 Escalation
- Security incidents
- Data corruption
- System-wide outages
- Architecture questions

### Emergency Contacts

| Role | Contact | When to Use |
|------|---------|-------------|
| On-Call Engineer | PagerDuty | P1 issues |
| Beta Program Manager | [Email] | Customer escalations |
| Security Team | security@zakops.com | Security concerns |

## Communication Templates

### Initial Response
```
Hi [Name],

Thank you for reporting this issue. I'm looking into it now.

I'll update you within [SLA time] with my findings.

In the meantime, could you please provide:
- [Specific question]

Best,
[Your name]
```

### Resolution
```
Hi [Name],

Good news - we've resolved the issue you reported.

**Root Cause**: [Brief explanation]
**Resolution**: [What was done]
**Prevention**: [Steps to prevent recurrence]

Please let me know if you experience any further issues.

Best,
[Your name]
```

### Workaround
```
Hi [Name],

While we work on a permanent fix, here's a workaround:

1. [Step 1]
2. [Step 2]
3. [Step 3]

I'll update you when the fix is deployed.

Best,
[Your name]
```

## Feedback Collection

### Weekly Check-ins
- Schedule 15-min call with each beta customer
- Use standard feedback questions
- Log responses in feedback system

### Feedback Questions
1. What's working well?
2. What's frustrating?
3. What features are missing?
4. Would you recommend to a colleague?
5. What would make you a paying customer?

## Metrics to Track

- Tickets per customer
- Time to first response
- Time to resolution
- Customer satisfaction (CSAT)
- Feature requests frequency
