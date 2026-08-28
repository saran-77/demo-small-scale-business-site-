#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ROUTES = {
  public: ['/api/health', '/api/products', '/search?q=brightline'],
  protected: ['/api/profile', '/api/orders'],
  admin: ['/api/admin/products', '/api/admin/messages', '/api/admin/users'],
  idor: '/api/orders/1'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isLoopbackUrl(value) {
  const url = new URL(value);
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
}

export function parseArgs(argv) {
  const args = { baseUrl: 'http://127.0.0.1:3000', allowRemote: false, delay: 250, outputDir: 'reports' };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--allow-remote') args.allowRemote = true;
    else if (item === '--routes') args.routes = argv[++index];
    else if (item === '--delay') args.delay = Number(argv[++index]);
    else if (item === '--output-dir') args.outputDir = argv[++index];
    else if (item === '--help' || item === '-h') args.help = true;
    else if (!item.startsWith('-')) positional.push(item);
  }
  if (positional[0]) args.baseUrl = positional[0];
  return args;
}

export function validateTarget(baseUrl, allowRemote = false) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid base URL: ${baseUrl}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) URLs are supported.');
  if (!allowRemote && !isLoopbackUrl(baseUrl)) {
    throw new Error('Refusing non-loopback target. Use --allow-remote only when you have explicit permission.');
  }
  return url;
}

class Client {
  constructor(baseUrl, delay) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.delay = Math.max(100, Number.isFinite(delay) ? delay : 250);
    this.lastRequestAt = 0;
    this.cookie = '';
    this.requestCount = 0;
  }

  async request(route, options = {}) {
    const wait = this.delay - (Date.now() - this.lastRequestAt);
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
    this.requestCount += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${this.baseUrl}${route}`, {
        ...options,
        signal: controller.signal,
        headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}), ...(options.headers || {}) }
      });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) this.cookie = setCookie.split(';')[0];
      const text = await response.text();
      let body = text;
      try { body = JSON.parse(text); } catch { /* text response */ }
      return { status: response.status, headers: response.headers, text, body };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function finding(type, endpoint, severity, evidence, remediation) {
  return { type, endpoint, severity, evidence, remediation };
}

async function checkSqlInjection(client) {
  const baseline = await client.request('/api/products?search=not-a-real-product-987');
  const payload = encodeURIComponent("%' OR 1=1 --");
  const probe = await client.request(`/api/products?search=${payload}`);
  const baselineCount = Array.isArray(baseline.body?.products) ? baseline.body.products.length : 0;
  const probeCount = Array.isArray(probe.body?.products) ? probe.body.products.length : 0;
  if (probe.status >= 500 || probeCount > baselineCount) {
    return finding('SQL injection', '/api/products?search=', 'high', `Baseline returned ${baselineCount} products; SQLi probe returned HTTP ${probe.status} and ${probeCount} products.`, 'Use parameterized SQL queries and validate search input.');
  }
  return null;
}

async function checkXss(client) {
  const marker = 'scanner-xss-marker';
  const payload = `<script>${marker}</script>`;
  const response = await client.request(`/search?q=${encodeURIComponent(payload)}`);
  if (response.text.includes(payload) || response.text.includes(marker)) {
    return finding('Reflected XSS', '/search?q=', 'medium', `The response contains the unescaped marker "${marker}".`, 'HTML-escape reflected values and apply a restrictive Content Security Policy.');
  }
  return null;
}

async function checkMissingAuth(client, routes) {
  const findings = [];
  for (const route of [...routes.admin, ...routes.protected]) {
    const response = await client.request(route);
    if (response.status >= 200 && response.status < 300) {
      findings.push(finding('Missing authentication/authorization', route, route.includes('/admin/') ? 'critical' : 'high', `Unauthenticated request returned HTTP ${response.status}.`, 'Require a server-side session and role check before serving the resource.'));
    }
  }
  return findings;
}

async function checkIdor(client, route) {
  const login = await client.request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'casey@example.test', password: 'password123' })
  });
  if (login.status < 200 || login.status >= 300) return null;
  const response = await client.request(route);
  if (response.status === 200 && response.body?.order?.user_id) {
    return finding('IDOR / broken access control', route, 'high', `Seeded customer Casey received another customer's order with user_id=${response.body.order.user_id}.`, 'Constrain the resource query by both resource ID and authenticated owner ID.');
  }
  return null;
}

async function checkVerboseErrors(client) {
  const response = await client.request('/api/debug/error');
  const signals = ['Demo debug failure', 'Error:', 'at ', 'stack'];
  const matched = signals.filter((signal) => response.text.includes(signal));
  if (response.status >= 500 && matched.length) {
    return finding('Verbose error disclosure', '/api/debug/error', 'medium', `HTTP ${response.status} response exposed: ${matched.join(', ')}.`, 'Return a generic error to clients and log diagnostic details server-side.');
  }
  return null;
}

async function checkHeaders(client) {
  const response = await client.request('/api/health');
  const missing = ['content-security-policy', 'x-frame-options', 'x-content-type-options']
    .filter((header) => !response.headers.has(header));
  if (missing.length) {
    return finding('Missing security headers', '/api/health', 'low', `Missing headers: ${missing.join(', ')}.`, 'Set a baseline security-header policy at the server boundary.');
  }
  return null;
}

async function loadRoutes(file) {
  if (!file) return DEFAULT_ROUTES;
  const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  if (Array.isArray(parsed)) {
    return {
      ...DEFAULT_ROUTES,
      public: parsed.filter((route) => !route.includes('/admin/') && !route.includes('/profile') && !route.includes('/orders')),
      protected: parsed.filter((route) => route.includes('/profile') || (route.includes('/orders') && !route.match(/\/orders\/\d+/))),
      admin: parsed.filter((route) => route.includes('/admin/')),
      idor: parsed.find((route) => route.match(/\/orders\/\{?id\}?/))?.replace('{id}', '1') || DEFAULT_ROUTES.idor
    };
  }
  if (parsed.paths) {
    const routes = Object.keys(parsed.paths);
    return {
      ...DEFAULT_ROUTES,
      public: routes.filter((route) => !route.includes('/admin/') && !route.includes('/profile') && !route.includes('/orders')),
      protected: routes.filter((route) => route.includes('/profile') || (route.includes('/orders') && !route.match(/\/orders\/\{?id\}?/))),
      admin: routes.filter((route) => route.includes('/admin/')),
      idor: routes.find((route) => route.match(/\/orders\/\{?id\}?/))?.replace('{id}', '1') || DEFAULT_ROUTES.idor
    };
  }
  return {
    ...DEFAULT_ROUTES,
    ...parsed,
    public: parsed.public || DEFAULT_ROUTES.public,
    protected: parsed.protected || DEFAULT_ROUTES.protected,
    admin: parsed.admin || DEFAULT_ROUTES.admin,
    idor: parsed.idor || DEFAULT_ROUTES.idor
  };
}

function markdownReport(report) {
  const lines = [
    '# Local Vulnerability Scan',
    '',
    `- Target: \`${report.target}\``,
    `- Started: ${report.startedAt}`,
    `- Requests: ${report.requestCount}`,
    `- Findings: ${report.findings.length}`,
    '',
    '## Findings',
    ''
  ];
  if (!report.findings.length) lines.push('No findings were detected by the configured non-destructive checks.');
  for (const item of report.findings) {
    lines.push(`### ${item.type} (${item.severity})`, '', `- Endpoint: \`${item.endpoint}\``, `- Evidence: ${item.evidence}`, `- Remediation: ${item.remediation}`, '');
  }
  lines.push('## Checks', '', ...report.checks.map((check) => `- ${check}`));
  return `${lines.join('\n')}\n`;
}

export async function scan(options) {
  const target = validateTarget(options.baseUrl, options.allowRemote);
  const routes = await loadRoutes(options.routes);
  const client = new Client(target.toString().replace(/\/$/, ''), options.delay);
  const startedAt = new Date().toISOString();
  const findings = [];
  const checks = ['SQL injection differential response', 'reflected XSS marker', 'unauthenticated protected/admin routes', 'IDOR ownership check', 'verbose error disclosure', 'security response headers'];
  const sql = await checkSqlInjection(client);
  if (sql) findings.push(sql);
  const xss = await checkXss(client);
  if (xss) findings.push(xss);
  findings.push(...await checkMissingAuth(client, routes));
  const idor = await checkIdor(client, routes.idor);
  if (idor) findings.push(idor);
  const verbose = await checkVerboseErrors(client);
  if (verbose) findings.push(verbose);
  const headers = await checkHeaders(client);
  if (headers) findings.push(headers);
  return { target: target.toString().replace(/\/$/, ''), startedAt, requestCount: client.requestCount, findings, checks };
}

function help() {
  return `Usage: npm run scan -- [base-url] [options]

Options:
  --allow-remote       Permit a non-loopback target (use only with permission)
  --routes <file>      Merge route overrides from a JSON file
  --delay <ms>         Minimum delay between requests (default: 250)
  --output-dir <dir>   Report directory (default: reports)
`;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(help());
  } else {
    try {
      validateTarget(options.baseUrl, options.allowRemote);
      if (options.allowRemote && !isLoopbackUrl(options.baseUrl)) console.warn('WARNING: scanning a remote target. Confirm you have explicit permission.');
      const report = await scan(options);
      await fs.mkdir(options.outputDir, { recursive: true });
      const stamp = report.startedAt.replace(/[:.]/g, '-');
      const jsonPath = path.join(options.outputDir, `scan-${stamp}.json`);
      const markdownPath = path.join(options.outputDir, `scan-${stamp}.md`);
      await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
      await fs.writeFile(markdownPath, markdownReport(report));
      console.log(`Scan complete: ${report.findings.length} finding(s)`);
      console.log(`JSON: ${jsonPath}`);
      console.log(`Markdown: ${markdownPath}`);
    } catch (error) {
      console.error(`Scanner error: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
