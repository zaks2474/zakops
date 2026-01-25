# NIST AI Risk Management Framework Mapping

## Overview

This document maps ZakOps AI system controls and practices to the NIST AI Risk Management Framework (AI RMF 1.0). The framework provides structure for managing AI-related risks throughout the AI lifecycle.

## NIST AI RMF Core Functions

The AI RMF consists of four core functions:
1. **GOVERN** - Cultivating a culture of risk management
2. **MAP** - Understanding context and characterizing risks
3. **MEASURE** - Assessing, analyzing, and tracking risks
4. **MANAGE** - Prioritizing and acting on risks

---

## GOVERN: Risk Management Culture

### GOV-1: Organizational Policies

| Requirement | ZakOps Implementation | Status |
|-------------|----------------------|--------|
| AI risk management policy | Error Budget Policy, Risk Register | Implemented |
| Roles and responsibilities | Risk owners assigned per risk | Implemented |
| Accountability structures | Escalation paths defined | Implemented |

### GOV-2: Risk Tolerance

| Requirement | ZakOps Implementation | Status |
|-------------|----------------------|--------|
| Risk tolerance defined | SLO targets (99.5% API, 99% Agent) | Implemented |
| Error budget thresholds | Green/Yellow/Orange/Red states | Implemented |
| Deployment gates | Tool accuracy ≥95% required | Implemented |

### GOV-3: Workforce Diversity

| Requirement | ZakOps Implementation | Status |
|-------------|----------------------|--------|
| Cross-functional input | Agent, Security, Product teams involved | Implemented |
| Review processes | Quarterly SLO/risk reviews | Implemented |

---

## MAP: Context and Risk Identification

### MAP-1: System Context

| Requirement | ZakOps Implementation | Status |
|-------------|----------------------|--------|
| Use case documentation | Deal lifecycle management agent | Documented |
| User identification | Internal deal operators | Documented |
| Impact assessment | Risk register with impact ratings | Implemented |

### MAP-2: Data and Model Understanding

| Requirement | ZakOps Implementation | Status |
|-------------|----------------------|--------|
| Data sources documented | CRM, deal artifacts, user input | Documented |
| Model capabilities | LLM tool calling for CRM operations | Documented |
| Limitations acknowledged | Hallucination risk documented | Documented |

### MAP-3: Risk Identification

| Requirement | ZakOps Implementation | Status |
|-------------|----------------------|--------|
| Comprehensive risk register | 12+ risks documented | Implemented |
| Risk categories | NIST-aligned categories | Implemented |
| Periodic review | Monthly risk register review | Implemented |

---

## MEASURE: Risk Assessment

### MEA-1: Quantitative Assessment

| Requirement | ZakOps Implementation | Status |
|-------------|----------------------|--------|
| Performance metrics | Tool accuracy, latency SLOs | Implemented |
| Reliability metrics | Availability SLOs | Implemented |
| Evaluation framework | Golden trace evaluation | Implemented |

### MEA-2: Qualitative Assessment

| Requirement | ZakOps Implementation | Status |
|-------------|----------------------|--------|
| Risk likelihood ratings | High/Medium/Low | Implemented |
| Impact assessment | High/Medium/Low | Implemented |
| Risk level calculation | Matrix-based | Implemented |

### MEA-3: Tracking and Monitoring

| Requirement | ZakOps Implementation | Status |
|-------------|----------------------|--------|
| Continuous monitoring | SLO dashboards | Implemented |
| Alerting | Threshold-based alerts | Implemented |
| Trend analysis | Historical data retention | Implemented |

---

## MANAGE: Risk Treatment

### MAN-1: Risk Prioritization

| Requirement | ZakOps Implementation | Status |
|-------------|----------------------|--------|
| Risk ranking | By risk level (Critical → Low) | Implemented |
| Resource allocation | Based on risk priority | Implemented |
| Treatment timeline | Review dates assigned | Implemented |

### MAN-2: Risk Mitigation

| Requirement | ZakOps Implementation | Status |
|-------------|----------------------|--------|
| Mitigation strategies | Defined per risk | Implemented |
| Human oversight | Approval workflow for high-risk | Implemented |
| Fallback mechanisms | Local LLM lane, graceful degradation | Implemented |

### MAN-3: Documentation and Communication

| Requirement | ZakOps Implementation | Status |
|-------------|----------------------|--------|
| Risk documentation | Risk Register | Implemented |
| Stakeholder communication | Escalation paths | Implemented |
| Audit trail | Comprehensive logging | Implemented |

---

## NIST Trustworthy AI Characteristics

### Validity and Reliability

| Characteristic | ZakOps Control | Evidence |
|---------------|---------------|----------|
| Accurate outputs | Golden trace validation | GT-001 to GT-010 |
| Consistent behavior | Temperature tuning, deterministic mode | Configuration |
| Error handling | Graceful degradation | Error handling code |

### Safety

| Characteristic | ZakOps Control | Evidence |
|---------------|---------------|----------|
| Harmful output prevention | Output filtering | Implemented |
| Fail-safe mechanisms | Circuit breaker, fallback | Architecture |
| Human override | Approval workflow | ApprovalCard UI |

### Security and Resilience

| Characteristic | ZakOps Control | Evidence |
|---------------|---------------|----------|
| Input validation | Sanitization, OWASP tests | Security tests |
| Access control | RBAC, tool permissions | Auth system |
| Adversarial robustness | Prompt hardening | Security review |

### Accountability

| Characteristic | ZakOps Control | Evidence |
|---------------|---------------|----------|
| Decision traceability | Audit logging | AuditLogViewer |
| Responsibility assignment | Risk owners | Risk Register |
| Incident response | Runbooks | /ops/runbooks/ |

### Transparency

| Characteristic | ZakOps Control | Evidence |
|---------------|---------------|----------|
| Explainability | Tool call visibility in UI | ApprovalCard |
| Documentation | SLOs, Risk Register | /docs/ |
| User notification | Approval requests | Notification system |

### Privacy

| Characteristic | ZakOps Control | Evidence |
|---------------|---------------|----------|
| Data minimization | Need-to-know access | RBAC |
| PII protection | Log redaction | Implemented |
| Data governance | Classification policy | Documented |

### Fairness

| Characteristic | ZakOps Control | Evidence |
|---------------|---------------|----------|
| Bias assessment | Diverse eval dataset | Evaluation suite |
| Non-discrimination | Human review | Approval workflow |
| Equitable treatment | Consistent tool behavior | Golden traces |

---

## Compliance Status Summary

| Core Function | Categories | Implemented | Coverage |
|--------------|------------|-------------|----------|
| GOVERN | 3 | 3 | 100% |
| MAP | 3 | 3 | 100% |
| MEASURE | 3 | 3 | 100% |
| MANAGE | 3 | 3 | 100% |

**Overall NIST AI RMF Alignment: 100%**

---

## Review and Maintenance

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Mapping Review | Quarterly | Compliance Team |
| Control Verification | Annually | Security Team |
| Framework Update Alignment | As NIST updates | Compliance Team |

## References

- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)
- [ZakOps Risk Register](./RISK_REGISTER.md)
- [ZakOps SLO Definitions](/docs/slos/SLO_DEFINITIONS.md)
