---
name: security-review
description: Security-focused code review. Audits for OWASP Top 10, auth flaws, injection, crypto misuse, secret exposure. Use before deploying or when handling sensitive data.
---

# Security Review Skill

## Check categories (in order)
1. **AuthN/AuthZ** — broken access control, privilege escalation, IDOR
2. **Injection** — SQL, NoSQL, OS command, template, SSTI
3. **Secrets** — hardcoded keys, tokens in logs, exposed env vars
4. **Crypto** — weak algorithms, ECB mode, hardcoded IV, self-signed
5. **Data** — PII leakage, excessive exposure, mass assignment
6. **Supply chain** — pinned deps, lockfile integrity, known vulns

## Severity
- CRITICAL: direct RCE, auth bypass, data breach
- HIGH: privilege escalation, sensitive data exposure
- MEDIUM: missing validation, weak crypto
- LOW: info disclosure, missing headers

## Reporting
One line per finding. Include CWE if applicable.
