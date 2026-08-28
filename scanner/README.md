# Local Vulnerability Scanner

This independent Node.js CLI performs conservative, non-destructive HTTP checks against an HTTP target. It does not import or execute target code. The bundled small-business project is currently frontend-only, so this scanner is retained for a future backend or permitted local target.

## Usage

Start an HTTP target first, then run the scanner from the repository root:

```powershell
npm run scan -- http://127.0.0.1:3000
```

The scanner checks SQL injection differential behavior, reflected XSS, unauthenticated admin/protected routes, IDOR, verbose errors, and missing security headers. It uses only read-oriented probes plus the two seeded test-account logins needed to test session boundaries. It waits at least 250 ms between requests by default.

Options:

```text
--allow-remote       Permit a non-loopback target and print a warning
--routes <file>      Merge route overrides from a JSON route file
--delay <ms>         Change the minimum request delay (never below 100 ms)
--output-dir <dir>   Choose the report directory
```

Non-loopback hosts are rejected by default. `--allow-remote` is an explicit safety override: use it only against a system you own or are authorized to test.

Reports contain the target, timestamp, request count, configured checks, and findings with type, endpoint, severity, evidence, and remediation. Both JSON and Markdown reports are generated.
