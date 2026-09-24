import { cloudLogin, cloudLogout, cloudRegister, getCloudAccount } from '../services/cloud';

export interface LocalAccount {
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

const accountsKey = 'genelab-local-accounts';
const sessionKey = 'genelab-local-session';

const readAccounts = (): LocalAccount[] => {
  try {
    const value = JSON.parse(localStorage.getItem(accountsKey) ?? '[]');
    return Array.isArray(value) ? value as LocalAccount[] : [];
  } catch {
    return [];
  }
};

const encode = (value: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(value)));

const hashPassword = async (password: string, salt: string): Promise<string> => encode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`)));

const makeSalt = (): string => { const bytes = new Uint8Array(16); crypto.getRandomValues(bytes); return encode(bytes.buffer); };

export const getCurrentAccount = (): LocalAccount | undefined => {
  const cloudAccount = getCloudAccount();
  if (cloudAccount) return { email: cloudAccount.email, createdAt: cloudAccount.createdAt, passwordHash: '', salt: '' };
  const email = localStorage.getItem(sessionKey);
  return email ? readAccounts().find((account) => account.email === email) : undefined;
};

export const createAccount = async (emailInput: string, password: string): Promise<LocalAccount> => {
  const email = emailInput.trim().toLocaleLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid-email');
  if (password.length < 8) throw new Error('weak-password');
  try {
    const account = await cloudRegister(email, password);
    return { email: account.email, createdAt: account.createdAt, passwordHash: '', salt: '' };
  } catch (error) {
    if (error instanceof Error && !['cloud-unavailable', 'Failed to fetch'].includes(error.message)) throw error;
  }
  const accounts = readAccounts();
  if (accounts.some((account) => account.email === email)) throw new Error('account-exists');
  const salt = makeSalt();
  const account: LocalAccount = { email, salt, passwordHash: await hashPassword(password, salt), createdAt: new Date().toISOString() };
  localStorage.setItem(accountsKey, JSON.stringify([...accounts, account]));
  localStorage.setItem(sessionKey, email);
  return account;
};

export const loginAccount = async (emailInput: string, password: string): Promise<LocalAccount> => {
  const email = emailInput.trim().toLocaleLowerCase();
  try {
    const account = await cloudLogin(email, password);
    return { email: account.email, createdAt: account.createdAt, passwordHash: '', salt: '' };
  } catch (error) {
    if (error instanceof Error && !['cloud-unavailable', 'Failed to fetch'].includes(error.message)) throw error;
  }
  const account = readAccounts().find((candidate) => candidate.email === email);
  if (!account || await hashPassword(password, account.salt) !== account.passwordHash) throw new Error('invalid-credentials');
  localStorage.setItem(sessionKey, email);
  return account;
};

export const logoutAccount = (): void => { localStorage.removeItem(sessionKey); cloudLogout(); };
