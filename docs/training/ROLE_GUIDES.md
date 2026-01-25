# Role-Based Guides

This document provides role-specific guidance for ZakOps users.

## Operator

### Overview

Operators are responsible for day-to-day use of ZakOps, including managing deals, reviewing agent outputs, and handling approvals.

### Key Responsibilities

- Create and manage deals
- Review and approve agent actions
- Monitor deal progress
- Escalate issues when needed

### Daily Tasks

#### Morning Checklist
1. Review pending approvals
2. Check deal queue status
3. Review overnight agent activity
4. Address any flagged items

#### Deal Management
1. Create new deals as needed
2. Update deal metadata
3. Track deal progress
4. Close completed deals

#### Approval Handling
1. Review approval requests promptly
2. Examine context and risk assessment
3. Make informed approve/reject decisions
4. Document decision rationale

### Common Workflows

#### Creating a Deal
1. Navigate to Deals > New Deal
2. Enter required information
3. Set priority and category
4. Submit for processing

#### Approving an Agent Action
1. Click on pending approval
2. Review action context
3. Check risk assessment
4. Click Approve or Reject
5. Add optional comment

### Tips for Operators

- Respond to approvals within SLA
- Use filters to prioritize work
- Document unusual situations
- Escalate when uncertain

## Admin

### Overview

Administrators manage ZakOps configuration, user access, and system settings.

### Key Responsibilities

- User account management
- Permission configuration
- System configuration
- Monitoring and alerting
- Troubleshooting

### Administrative Tasks

#### User Management
1. Create new user accounts
2. Assign appropriate roles
3. Review and update permissions
4. Disable inactive accounts

#### Configuration
1. Configure approval rules
2. Set up notification channels
3. Define agent behaviors
4. Manage integrations

#### Monitoring
1. Review system health dashboards
2. Check error rates and latency
3. Monitor resource utilization
4. Review audit logs

### Common Admin Workflows

#### Adding a New User
1. Navigate to Admin > Users > Add User
2. Enter user details
3. Select appropriate role(s)
4. Set initial password or send invite
5. Verify access works

#### Configuring Approval Rules
1. Navigate to Admin > Approvals > Rules
2. Click Add Rule
3. Define trigger conditions
4. Specify approver groups
5. Set timeout and escalation
6. Save and test

#### Reviewing Audit Logs
1. Navigate to Admin > Audit Logs
2. Apply relevant filters
3. Review entries for anomalies
4. Export if needed for compliance

### Admin Best Practices

- Follow least-privilege principle
- Regularly review user permissions
- Keep configuration documented
- Test changes in staging first
- Maintain backup of configurations

### Security Responsibilities

- Review authentication logs
- Monitor for suspicious activity
- Ensure secrets are rotated
- Keep system patches current
- Conduct periodic access reviews

### Escalation Path

| Issue | First Contact | Escalate To |
|-------|--------------|-------------|
| User access | Admin on-call | IT Security |
| System down | DevOps on-call | Engineering Lead |
| Data breach | Security team | CISO |
| Compliance | Compliance Officer | Legal |
