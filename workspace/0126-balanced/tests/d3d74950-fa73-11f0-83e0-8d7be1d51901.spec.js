import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d74950-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Floyd–Warshall Interactive Demonstration (d3d74950-fa73-11f0-83e0-8d7be1d51901)', () => {
  // shared holders for console and page errors observed during each test
  let consoleMsgs;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMsgs = [];
    pageErrors = [];

    // capture console messages for diagnostic assertions
    page.on('console', msg => {
      try {
        consoleMsgs.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // swallow any capture errors
      }
    });

    // capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err instanceof Error ? err.message : String(err));
    });

    await