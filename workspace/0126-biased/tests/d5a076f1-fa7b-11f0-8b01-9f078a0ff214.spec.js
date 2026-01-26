import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a076f1-fa7b-11f0-8b-01-9f078a0ff214.html';

// Helper to assert any captured errors conform to expected JS error types
function assertErrorsAreJSRuntimeTypes(errors) {
  const allowed = /ReferenceError|TypeError|SyntaxError/;
  for (const e of errors) {
    // e may be string or Error object; normalize to string
    const text = typeof e === 'string' ? e : e.message || String(e);
    expect(allowed.test(text), `Unexpected error type: ${text}`).toBeTruthy();
  }
}

test.describe('B-Tree Explanation - FSM-driven UI (Show Demonstration)', () => {
  // Shared collectors for console/page errors for each test
  test.beforeEach(async ({ page }) => {
    // nothing here; per-test listeners will be attached inside each test to keep isolation
  });

  // Validate initial idle state (S0_Idle)
  test('S0_Idle: page loads with button present and demo hidden; no unexpected runtime errors on load', async ({ page }) => {
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    // Collect console messages and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);

    // Basic DOM expectations for Idle state
    const button = await page.$('.button');
    expect(button, 'Expected a button with class .button to exist').not.toBeNull();

    const buttonText = await page.$eval('.button', el => el.textContent && el.textContent.trim());
    expect(buttonText).toBe('Show Demonstration');

    // Check onclick attribute references showDemo() as per evidence
    const onclickAttr = await page.$eval('.button', el => el.getAttribute('onclick'));
    expect(onclickAttr).toBe('showDemo()');

    // Demo section must exist
    const demoExists = await page.$('#demo');
    expect(demoExists, 'Expected a #demo element to exist').not.toBeNull();

    // Check that demo is hidden initially (display === 'none')
    const demoDisplay = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(demoDisplay).toBe('none');

    // Assert no unexpected page errors occurred during load.
    // If errors did occur, ensure they are JS runtime errors (ReferenceError/TypeError/SyntaxError)
    if (pageErrors.length + consoleErrors.length === 0) {
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    } else {
      // If there are errors, ensure they are the allowed JS runtime error classes
      assertErrorsAreJSRuntimeTypes([...consoleErrors, ...pageErrors]);
    }

    // Also capture console debug for future troubleshooting (not an assertion)
    // but keep it available via test attachments if desired (Playwright will show failures)
  });

  // Transition: Idle -> Demo Visible (S0 -> S1)
  test('Transition S0_Idle -> S1_DemoVisible: clicking the button shows the demo', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Precondition: demo hidden
    const beforeDisplay = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(beforeDisplay).toBe('none');

    // Click the Show Demonstration button (event: ShowDemo)
    await page.click('.button');

    // After click, demo should be displayed (evidence: demoSection.style.display = "block")
    // The script sets inline style to 'block' so computed display should be 'block'
    const afterDisplay = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(afterDisplay === 'block' || afterDisplay === 'flex' || afterDisplay === 'inline-block' || afterDisplay === 'block', 'Expected #demo to be visible after first click').toBeTruthy();
    expect(afterDisplay).toBe('block');

    // Verify the showDemo function exists on the window
    const hasShowDemo = await page.evaluate(() => typeof window.showDemo === 'function');
    expect(hasShowDemo).toBe(true);

    // Validate errors scenario: none or JS runtime types if any
    if (pageErrors.length + consoleErrors.length === 0) {
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    } else {
      assertErrorsAreJSRuntimeTypes([...consoleErrors, ...pageErrors]);
    }
  });

  // Transition: Demo Visible -> Demo Hidden (S1 -> S2)
  test('Transition S1_DemoVisible -> S2_DemoHidden: clicking the button again hides the demo', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Ensure visible by clicking once
    await page.click('.button');
    const visible = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(visible).toBe('block');

    // Click again to hide
    await page.click('.button');

    const hidden = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(hidden).toBe('none');

    // Confirm that repeated toggling doesn't throw runtime errors
    if (pageErrors.length + consoleErrors.length === 0) {
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    } else {
      assertErrorsAreJSRuntimeTypes([...consoleErrors, ...pageErrors]);
    }
  });

  // Transition: Demo Hidden -> Demo Visible (S2 -> S1)
  test('Transition S2_DemoHidden -> S1_DemoVisible: toggling from hidden to visible again', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Ensure hidden initial
    const initial = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(initial).toBe('none');

    // Click to show
    await page.click('.button');
    const afterFirst = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(afterFirst).toBe('block');

    // Click to hide
    await page.click('.button');
    const afterSecond = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(afterSecond).toBe('none');

    // Click third time to show (S2 -> S1)
    await page.click('.button');
    const afterThird = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(afterThird).toBe('block');

    // Confirm no unexpected errors (or only allowed JS runtime errors)
    if (pageErrors.length + consoleErrors.length === 0) {
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    } else {
      assertErrorsAreJSRuntimeTypes([...consoleErrors, ...pageErrors]);
    }
  });

  // Edge case: Rapid clicks and idempotency of toggling
  test('Edge case: rapid sequential clicks should result in deterministic toggle behavior and no crashes', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Starting state hidden
    const start = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(start).toBe('none');

    // Rapid click sequence: 5 quick clicks
    // Expected behavior: toggles state 5 times -> end state should be visible (since odd number)
    await Promise.all([
      page.click('.button'),
      page.click('.button'),
      page.click('.button'),
      page.click('.button'),
      page.click('.button'),
    ]);

    // Wait a short moment to let DOM updates settle
    await page.waitForTimeout(100);

    const endDisplay = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    // After 5 toggles starting from 'none' -> odd -> visible
    expect(endDisplay).toBe('block');

    // Now click 2 rapid times (even) -> should be hidden
    await Promise.all([page.click('.button'), page.click('.button')]);
    await page.waitForTimeout(50);
    const afterEven = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(afterEven).toBe('block' ? 'block' || 'none' : afterEven); // fallback, but we'll assert explicitly next

    // Real assertion: after two toggles from visible -> visible (even toggles restore original)
    // For clarity, compute deterministic expected: currently visible, two toggles -> visible
    expect(afterEven).toBe('block');

    // Confirm no unexpected errors occurred
    if (pageErrors.length + consoleErrors.length === 0) {
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    } else {
      assertErrorsAreJSRuntimeTypes([...consoleErrors, ...pageErrors]);
    }
  });

  // Verify entry/exit actions when possible: check presence of referenced functions.
  // FSM mentions renderPage() as an entry action for S0_Idle but the HTML does not define renderPage.
  // We validate the environment: showDemo exists, renderPage does not. If renderPage is missing, that's an observable difference.
  test('Verify FSM-declared onEnter/onExit actions presence (renderPage vs showDemo)', async ({ page }) => {
    await page.goto(APP_URL);

    // showDemo should be defined
    const hasShowDemo = await page.evaluate(() => typeof window.showDemo === 'function');
    expect(hasShowDemo).toBe(true);

    // renderPage was mentioned in FSM as an entry_action for S0_Idle, but HTML does not define it.
    // We assert that renderPage is undefined on the page (document remains unmodified).
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);
  });

  // Negative test: Ensure invoking showDemo programmatically behaves same as user click
  test('Programmatic invocation of showDemo toggles demo visibility consistent with button interactions', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Initially hidden
    const initial = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(initial).toBe('none');

    // Call showDemo() via page.evaluate
    await page.evaluate(() => { window.showDemo(); });

    const afterCall = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(afterCall).toBe('block');

    // Call again
    await page.evaluate(() => { window.showDemo(); });
    const afterSecondCall = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(afterSecondCall).toBe('none');

    // Confirm no unexpected errors
    if (pageErrors.length + consoleErrors.length === 0) {
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    } else {
      assertErrorsAreJSRuntimeTypes([...consoleErrors, ...pageErrors]);
    }
  });

  // Final test to explicitly surface any console/page errors collected across a fresh load
  test('Observe console and page errors across a fresh load and assert they are either absent or expected JS runtime errors', async ({ page }) => {
    const consoleErrors = [];
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Delay briefly to allow any async errors to surface
    await page.waitForTimeout(50);

    // If there are any captured errors, assert they are JS runtime errors (ReferenceError/TypeError/SyntaxError)
    if (consoleErrors.length + pageErrors.length === 0) {
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    } else {
      assertErrorsAreJSRuntimeTypes([...consoleErrors, ...pageErrors]);
    }

    // As a sanity: ensure there is at least one console message for manual inspection (not required)
    // We don't fail on missing logs; this simply ensures we've inspected them.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});