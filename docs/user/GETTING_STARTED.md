# Getting Started with ZakOps

This guide helps you get up and running with ZakOps quickly.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.11+**: Required for backend services
- **Node.js 18+**: Required for the dashboard
- **Docker**: For containerized deployment (optional)
- **Git**: For version control

### System Requirements

- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 10GB free disk space
- **OS**: Linux, macOS, or Windows with WSL2

### Access Requirements

- Valid user credentials
- Network access to ZakOps services
- Appropriate role permissions

## Installation

### Option 1: Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/zakops-agent-api.git
   cd zakops-agent-api
   ```

2. Install dependencies:
   ```bash
   make install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. Start services:
   ```bash
   make dev
   ```

### Option 2: Docker Deployment

1. Build images:
   ```bash
   make docker-build
   ```

2. Start containers:
   ```bash
   make docker-up
   ```

3. Verify deployment:
   ```bash
   curl http://localhost:8091/health
   ```

## First Steps

### 1. Access the Dashboard

Open your browser and navigate to:
- **Dashboard**: http://localhost:3003
- **API Docs**: http://localhost:8091/docs

### 2. Create Your First Deal

1. Log in to the dashboard
2. Click "New Deal" in the sidebar
3. Fill in the deal details
4. Click "Create"

### 3. Invoke the Agent

1. Select a deal from the list
2. Click "Agent Actions"
3. Choose an action (e.g., "Analyze Deal")
4. Review and approve if required

### 4. View Audit Logs

1. Navigate to "Audit Logs" in the sidebar
2. Filter by date, user, or action type
3. Click on an entry for details

## Next Steps

- Read the [Workflows Guide](WORKFLOWS.md) to understand deal lifecycle
- Learn about [Approvals](APPROVALS.md) and human-in-the-loop
- Review [Audit Logs](AUDIT_LOGS.md) for compliance

## Getting Help

- **Documentation**: Browse the `/docs` directory
- **Issues**: Report bugs on GitHub Issues
- **Support**: Contact your administrator
