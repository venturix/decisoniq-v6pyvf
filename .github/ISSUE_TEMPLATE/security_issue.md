---
name: Security Issue
about: Report a security vulnerability or incident
title: '[SECURITY] '
labels: security
assignees: ''
---

**CONFIDENTIALITY NOTICE**
SECURITY SENSITIVE: This issue contains confidential security information. Handle according to security policy section 7.2. Do not share outside authorized security and response teams. All communications must be encrypted.

## Security Issue Description
<!-- Provide a clear and detailed description of the security issue -->
**Description:**

**Affected Components/Systems:**

**Discovery Timeline:**
- First Detected:
- Initial Triage:
- Current Status:

**Initial Assessment:**

## Vulnerability Details
**Severity Level:** <!-- Required - Select one -->
- [ ] Critical (2hr response)
- [ ] High (24hr response)
- [ ] Medium (72hr response)
- [ ] Low (1 week response)

**Security Component:** <!-- Required - Select one -->
- [ ] Authentication
  - [ ] SSO
  - [ ] MFA
  - [ ] Session Management
  - [ ] Access Control
  - [ ] Token Management
- [ ] Data Protection
  - [ ] Encryption
  - [ ] Key Management
  - [ ] Data Access
  - [ ] Privacy
  - [ ] Data Classification
- [ ] Infrastructure
  - [ ] Network
  - [ ] Cloud
  - [ ] Container
  - [ ] Database
  - [ ] Service Mesh
- [ ] Application
  - [ ] API
  - [ ] Frontend
  - [ ] Backend
  - [ ] Integrations
  - [ ] Microservices

**Attack Vector:**

**Affected Versions/Environments:**

**Proof of Concept:** <!-- If safe to include -->

**Security Control Bypass:**

## Impact Assessment
**Data Exposure Risk:**
- Scope:
- Type of Data:
- Volume:

**Service Availability Impact:**
- Systems Affected:
- Downtime Risk:
- User Impact:

**Compliance Implications:**
- Regulations Affected:
- Reporting Requirements:
- Timeline Requirements:

**Business Risk Assessment:**
- Revenue Impact:
- Customer Impact:
- Reputation Risk:

## Technical Context
**Security Logs/Alerts:**
```
<!-- Insert relevant logs -->
```

**Error Messages:**
```
<!-- Insert error messages -->
```

**System Configuration:**
<!-- Relevant configuration details -->

**Related Security Controls:**

**Affected Infrastructure:**

## Remediation Status
**Current Mitigation:**

**Proposed Fixes:**

**Infrastructure Changes Required:**

**Timeline Estimate:**
- Start Date:
- Completion Target:
- Milestones:

**Resource Requirements:**
- Teams:
- Tools:
- Budget:

---
### Auto-Assignment and Notification Rules
<!-- Do not modify - For automation use -->
Authentication_related: @security-auth-team
Data_related: @security-data-team
Infrastructure_related: @security-infra-team
Application_related: @security-app-team

Critical: @security-team @executive-team @on-call @compliance-team
High: @security-team @engineering-leads @compliance-team
Medium: @security-team @affected-team-leads
Low: @security-team

<!-- Required Labels -->
/label security severity component environment compliance