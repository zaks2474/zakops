# Frequently Asked Questions

## General

### What is ZakOps?

ZakOps is an intelligent deal management system that uses AI agents to automate and assist with deal processing while maintaining human oversight through approval workflows.

### Who should use ZakOps?

ZakOps is designed for:
- Deal operations teams
- Business analysts
- Operations managers
- Compliance officers

### How do I get access?

Contact your administrator to request access. They will create an account and assign appropriate permissions based on your role.

## Deals

### How do I create a new deal?

1. Log in to ZakOps
2. Click "New Deal" in the sidebar
3. Fill in the required fields
4. Click "Create" or "Submit for Review"

### What are the deal status values?

- **Draft**: Being created/edited
- **Pending Review**: Awaiting approval
- **Approved**: Ready for processing
- **In Progress**: Being processed
- **Completed**: Successfully finished
- **Rejected**: Not approved
- **Cancelled**: Cancelled by user

### Can I edit a deal after submission?

Deals in "Draft" status can be freely edited. Once submitted, only administrators can modify deals, and all changes are logged.

## Agent

### What does the agent do?

The AI agent analyzes deals, suggests actions, and can execute approved operations. It helps automate routine tasks while keeping humans in control of important decisions.

### Why do some actions need approval?

High-risk actions require human approval to ensure:
- Safety: Prevent unintended consequences
- Compliance: Meet regulatory requirements
- Accountability: Maintain clear decision trails

### How long do approvals take?

Approval SLAs depend on priority:
- Critical: 15 minutes
- High: 1 hour
- Medium: 4 hours
- Low: 24 hours

### What if the agent makes a mistake?

All agent actions are logged and can be reviewed. If an error occurs:
1. Report the issue
2. Review the audit log
3. Correct any affected data
4. Provide feedback for improvement

## Approvals

### How do I approve a request?

1. Navigate to Approvals
2. Click on a pending approval
3. Review the context and risk
4. Click "Approve" or "Reject"
5. Add an optional comment

### What if I'm unsure about an approval?

If uncertain:
1. Request more information (if option available)
2. Consult with colleagues
3. Escalate to a senior approver
4. When in doubt, reject and ask for clarification

### Can I delegate my approvals?

Administrators can configure delegation rules. Contact your admin if you need to delegate during absence.

## Technical

### What browsers are supported?

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

### Is there an API?

Yes, ZakOps provides a REST API. See the [API Documentation](../api/OVERVIEW.md) for details.

### How is my data protected?

- All data encrypted at rest and in transit
- Role-based access control
- Comprehensive audit logging
- Regular security assessments

### What should I do if I find a bug?

1. Note the exact steps to reproduce
2. Capture any error messages
3. Report via the feedback system or GitHub Issues
4. Include your browser and version

## Troubleshooting

### I can't log in

1. Verify your username and password
2. Check if your account is active
3. Try resetting your password
4. Contact your administrator

### The page won't load

1. Clear your browser cache
2. Try a different browser
3. Check your network connection
4. Contact support if issue persists

### I'm not seeing expected data

1. Check your filter settings
2. Verify your permissions
3. Refresh the page
4. Contact your administrator

## Contact

### How do I get help?

- Check this FAQ first
- Review the documentation
- Contact your administrator
- Submit a support ticket

### How do I provide feedback?

- Use the in-app feedback button
- Email feedback to the support team
- Participate in user surveys
