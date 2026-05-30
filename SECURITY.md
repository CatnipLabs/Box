# Security Policy

## Supported versions

Box follows pre-1.0 semantic versioning. Security fixes are released on the
latest minor version unless otherwise announced.

## Reporting a vulnerability

Please do not open public issues for suspected vulnerabilities.

Report security issues by emailing the maintainers or using GitHub private
vulnerability reporting when enabled for the repository.

Include:

- Affected version/commit.
- Reproduction steps.
- Impact and exploitability notes.
- Suggested fix, if known.

## Security expectations

Box aims to provide safe defaults for modern REST APIs:

- Universal JSON error contract.
- Sanitized unexpected errors.
- CORS middleware.
- Helmet-like secure headers including optional HSTS.
- Streaming request body limits.
- Logging that should never break request handling.

Applications are still responsible for authentication, authorization,
business-level rate limits, and secret management.
