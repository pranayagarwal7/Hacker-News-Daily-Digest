# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (`main`) | Yes |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately by emailing the maintainer via GitHub (go to the profile and use the contact options) or by using [GitHub's private vulnerability reporting](https://github.com/pranayagarwal7/Hacker-News-Daily-Digest/security/advisories/new).

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

You'll receive a response within 48 hours. If confirmed, a fix will be prioritised and released as soon as possible.

## Secrets

- `GEMINI_API_KEY` — stored in Vercel environment variables only, never in the repo
- `GH_PAT` — stored in GitHub Actions secrets only, never in the repo
- `.env.local` is gitignored — never commit real credentials
