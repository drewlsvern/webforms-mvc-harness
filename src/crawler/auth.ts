import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { MigrationStore } from "../store/paths.ts";
import { isNotFound, readJson, writeJson } from "../store/jsonFile.ts";

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

export interface AuthState {
  /** The URL an unauthenticated visit lands on - the app's real login page, used later to detect an expired session. */
  loginUrl: string;
  storageState: StorageState;
  capturedAt: string;
}

export interface AuthSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  loginUrl: string;
}

export function authStatePath(store: MigrationStore): string {
  return path.join(store.crawlDir, "auth-state.json");
}

/**
 * Launches a real, visible browser window at the app's base URL - an
 * unauthenticated visit naturally redirects to the login page, which is
 * where the user completes login themselves (see design.md: scripted login
 * was rejected as unreliable against an unknown login flow).
 */
export async function launchAuthSession(baseUrl: string): Promise<AuthSession> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const loginUrl = page.url();
  return { browser, context, page, loginUrl };
}

/** Called once the user confirms they've completed login in the launched window. */
export async function confirmAuthSession(store: MigrationStore, session: AuthSession): Promise<AuthState> {
  const storageState = await session.context.storageState();
  const state: AuthState = { loginUrl: session.loginUrl, storageState, capturedAt: new Date().toISOString() };
  await writeJson(authStatePath(store), state);
  await session.browser.close();
  return state;
}

/** Closes the auth session's browser without persisting anything (user cancelled). */
export async function cancelAuthSession(session: AuthSession): Promise<void> {
  await session.browser.close();
}

export async function loadAuthState(store: MigrationStore): Promise<AuthState | null> {
  try {
    return await readJson<AuthState>(authStatePath(store));
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** A landed URL counts as a login redirect if it shares the login page's path - tolerant of query-string differences like `?ReturnUrl=...`. */
export function isLoginRedirect(landedUrl: string, loginUrl: string): boolean {
  try {
    return new URL(landedUrl).pathname === new URL(loginUrl).pathname;
  } catch {
    return landedUrl === loginUrl;
  }
}
