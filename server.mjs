import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';

const scrypt = promisify(scryptCallback);
const port = Number(process.env.PORT ?? 8787);
const dataFile = process.env.GENELAB_DATA_FILE ?? join(process.cwd(), '.data', 'genelab.json');

const emptyState = { accounts: [], experiments: [], sessions: [] };
const loadState = async () => { try { return { ...emptyState, ...JSON.parse(await readFile(dataFile, 'utf8')) }; } catch { return structuredClone(emptyState); } };
const saveState = async (state) => { await mkdir(dirname(dataFile), { recursive: true }); await writeFile(dataFile, JSON.stringify(state, null, 2)); };
const json = (response, status, value) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' }); response.end(JSON.stringify(value)); };
const readBody = async (request) => { let body = ''; for await (const chunk of request) body += chunk; return body ? JSON.parse(body) : {}; };
const passwordHash = async (password, salt) => Buffer.from(await scrypt(password, salt, 64)).toString('base64');
const createPassword = async (password) => { const salt = randomBytes(16).toString('base64'); return { salt, hash: await passwordHash(password, salt) }; };
const validPassword = async (password, account) => { const actual = Buffer.from(await passwordHash(password, account.salt)); const expected = Buffer.from(account.hash); return actual.length === expected.length && timingSafeEqual(actual, expected); };
const tokenFor = (state, email) => { const token = randomBytes(32).toString('base64url'); state.sessions = [...state.sessions.filter((session) => session.email !== email), { token, email, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30 }]; return token; };
const accountFrom = (account) => ({ email: account.email, createdAt: account.createdAt });
const authEmail = (request, state) => { const token = request.headers.authorization?.replace(/^Bearer\s+/i, ''); const session = state.sessions.find((candidate) => candidate.token === token && candidate.expiresAt > Date.now()); return session?.email; };
const route = (request) => new URL(request.url, `http://${request.headers.host ?? 'localhost'}`).pathname;

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  try {
    const state = await loadState();
    const path = route(request);
    if (request.method === 'GET' && path === '/api/health') return json(response, 200, { ok: true });
    if (request.method === 'POST' && path === '/api/auth/register') {
      const { email: rawEmail, password } = await readBody(request);
      const email = String(rawEmail ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 8) return json(response, 400, { error: 'invalid-account' });
      if (state.accounts.some((account) => account.email === email)) return json(response, 409, { error: 'account-exists' });
      const credentials = await createPassword(password);
      const account = { email, ...credentials, createdAt: new Date().toISOString() };
      state.accounts.push(account);
      const token = tokenFor(state, email);
      await saveState(state);
      return json(response, 201, { account: accountFrom(account), token });
    }
    if (request.method === 'POST' && path === '/api/auth/login') {
      const { email: rawEmail, password } = await readBody(request);
      const email = String(rawEmail ?? '').trim().toLowerCase();
      const account = state.accounts.find((candidate) => candidate.email === email);
      if (!account || typeof password !== 'string' || !(await validPassword(password, account))) return json(response, 401, { error: 'invalid-credentials' });
      const token = tokenFor(state, email);
      await saveState(state);
      return json(response, 200, { account: accountFrom(account), token });
    }
    const email = authEmail(request, state);
    if (!email) return json(response, 401, { error: 'unauthorized' });
    if (request.method === 'GET' && path === '/api/experiments') return json(response, 200, { experiments: state.experiments.filter((experiment) => experiment.ownerEmail === email) });
    if (request.method === 'POST' && path === '/api/experiments') {
      const experiment = await readBody(request);
      if (!experiment.id || !experiment.title || !Array.isArray(experiment.references)) return json(response, 400, { error: 'invalid-experiment' });
      const saved = { ...experiment, dataPoints: Array.isArray(experiment.dataPoints) ? experiment.dataPoints.slice(0, 20) : [], ownerEmail: email, updatedAt: new Date().toISOString() };
      state.experiments = [saved, ...state.experiments.filter((item) => !(item.id === saved.id && item.ownerEmail === email))];
      await saveState(state);
      return json(response, 200, { experiment: saved });
    }
    if (request.method === 'DELETE' && path.startsWith('/api/experiments/')) {
      const id = decodeURIComponent(path.split('/').pop());
      state.experiments = state.experiments.filter((experiment) => !(experiment.id === id && experiment.ownerEmail === email));
      await saveState(state);
      return json(response, 200, { ok: true });
    }
    return json(response, 404, { error: 'not-found' });
  } catch (error) {
    return json(response, 500, { error: 'server-error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`GeneLab API listening on http://localhost:${port}`));
