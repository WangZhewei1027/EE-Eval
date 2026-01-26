import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044409c3-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object Model for the HTTP interactive page
class HttpPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.getStarted = page.locator('#get-started');
    this.getLearned = page.locator('#get-learned');
    this.container = page.locator('.container');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickGetStarted() {
    await this.getStarted.click();
  }

  async clickGetLearned() {
    await this.getLearned.click();
  }

  async pressEnterOnGetStarted() {
    await this.getStarted.focus();
    await this.page.keyboard.press('Enter');
  }

  async pressSpaceOnGetLearned() {
    await this.getLearned.focus();
    await this.page.keyboard.press('Space');
  }
}

test.describe('044409c3-fa79-11f0-8a8e-bbe4f11717c6 - HTTP interactive app (FSM validation)', () => {
  // Captured console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for assertions
    page.on('console', (msg) => {
      // store both type and text for better diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // global post-condition: no uncaught page errors unless the page naturally produces them
    // We assert per-test explicitly; leaving this hook for future teardown if needed.
  });

  test('Initial Idle state shows expected elements (S0_Idle evidence)', async ({ page }) => {
    // Validates evidence for the Idle state: both buttons are present and visible with correct text
    const httpPage = new HttpPage(page);
    await httpPage.goto();

    // Verify elements exist and match the FSM evidence
    await expect(httpPage.getStarted).toBeVisible();
    await expect(httpPage.getLearned).toBeVisible();
    await expect(httpPage.getStarted).toHaveText('Get Started');
    await expect(httpPage.getLearned).toHaveText('Get Learned');

    // There should be no console.error or page errors on load
    const errors = pageErrors.filter(Boolean);
    expect(errors.length).toBe(0);

    // No click logs should be present before any interaction
    const clickLogs = consoleMessages.filter(m => m.text === 'Button 1 clicked' || m.text === 'Button 2 clicked');
    expect(clickLogs.length).toBe(0);
  });

  test('Clicking "Get Started" triggers Button1_Click transition and stays in Idle', async ({ page }) => {
    // Validates transition: clicking #get-started emits "Button 1 clicked" and UI remains in Idle
    const httpPage = new HttpPage(page);
    await httpPage.goto();

    // Click and wait for the console message emitted by the handler
    const consolePromise = page.waitForEvent('console', { predicate: msg => msg.text() === 'Button 1 clicked' });
    await httpPage.clickGetStarted();
    const msg = await consolePromise;
    expect(msg.text()).toBe('Button 1 clicked');
    expect(msg.type()).toBe('log');

    // After the transition, the state is expected to remain Idle: both buttons remain visible
    await expect(httpPage.getStarted).toBeVisible();
    await expect(httpPage.getLearned).toBeVisible();

    // Verify no uncaught page errors occurred during interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking "Get Learned" triggers Button2_Click transition and stays in Idle', async ({ page }) => {
    // Validates transition: clicking #get-learned emits "Button 2 clicked" and UI remains in Idle
    const httpPage = new HttpPage(page);
    await httpPage.goto();

    // Click and wait for the console message emitted by the handler
    const consolePromise = page.waitForEvent('console', { predicate: msg => msg.text() === 'Button 2 clicked' });
    await httpPage.clickGetLearned();
    const msg = await consolePromise;
    expect(msg.text()).toBe('Button 2 clicked');
    expect(msg.type()).toBe('log');

    // After the transition, both buttons should still be present (state remains idle)
    await expect(httpPage.getStarted).toBeVisible();
    await expect(httpPage.getLearned).toBeVisible();

    // Verify no uncaught page errors occurred during interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Rapid multiple clicks on "Get Started" produce multiple console logs (event handler is repeatable)', async ({ page }) => {
    // Edge case: ensure repetitive triggering of the same transition works and produces multiple logs
    const httpPage = new HttpPage(page);
    await httpPage.goto();

    const clickCount = 5;
    // Prepare promises for each expected console log in sequence
    const consolePromises = [];
    for (let i = 0; i < clickCount; i++) {
      consolePromises.push(page.waitForEvent('console', { predicate: msg => msg.text() === 'Button 1 clicked' }));
    }

    // Perform rapid clicks
    for (let i = 0; i < clickCount; i++) {
      await httpPage.clickGetStarted();
    }

    // Wait for all console messages to appear
    const results = await Promise.all(consolePromises);
    expect(results.length).toBe(clickCount);
    for (const r of results) {
      expect(r.text()).toBe('Button 1 clicked');
    }

    // No runtime errors expected from repeated interactions
    expect(pageErrors.length).toBe(0);

    // State remains Idle: the buttons are still present
    await expect(httpPage.getStarted).toBeVisible();
    await expect(httpPage.getLearned).toBeVisible();
  });

  test('Keyboard activation triggers click handlers (accessibility check)', async ({ page }) => {
    // Edge case: ensure keyboard activation (Enter/Space) triggers the same event handlers
    const httpPage = new HttpPage(page);
    await httpPage.goto();

    // Press Enter on Get Started -> expect Button 1 clicked
    const p1 = page.waitForEvent('console', { predicate: msg => msg.text() === 'Button 1 clicked' });
    await httpPage.pressEnterOnGetStarted();
    const r1 = await p1;
    expect(r1.text()).toBe('Button 1 clicked');

    // Press Space on Get Learned -> expect Button 2 clicked
    const p2 = page.waitForEvent('console', { predicate: msg => msg.text() === 'Button 2 clicked' });
    await httpPage.pressSpaceOnGetLearned();
    const r2 = await p2;
    expect(r2.text()).toBe('Button 2 clicked');

    // Confirm still in Idle
    await expect(httpPage.getStarted).toBeVisible();
    await expect(httpPage.getLearned).toBeVisible();

    // No uncaught errors expected
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking outside interactive elements does not trigger click handlers', async ({ page }) => {
    // Edge case: clicking the main container should not produce Button 1/2 logs
    const httpPage = new HttpPage(page);
    await httpPage.goto();

    // Ensure no button logs exist yet
    expect(consoleMessages.filter(m => m.text === 'Button 1 clicked' || m.text === 'Button 2 clicked').length).toBe(0);

    // Click the container area (but not the buttons)
    await httpPage.container.click({ position: { x: 10, y: 10 } });

    // Small delay to allow any console messages if they were erroneously emitted
    await page.waitForTimeout(200);

    // Assert no button click messages were emitted due to clicking the container
    const clickLogs = consoleMessages.filter(m => m.text === 'Button 1 clicked' || m.text === 'Button 2 clicked');
    expect(clickLogs.length).toBe(0);

    // Verify no page errors
    expect(pageErrors.length).toBe(0);
  });

  test('FSM metadata expectations: no onEnter/onExit actions defined (sanity check)', async ({ page }) => {
    // The FSM provided has no explicit entry/exit actions for S0_Idle; validate that no unexpected console output occurs on navigation
    const httpPage = new HttpPage(page);
    await httpPage.goto();

    // There should be no special onEnter logs produced by the page load other than none expected
    const onEnterLikeLogs = consoleMessages.filter(m => /enter|exit|onEnter|onExit/i.test(m.text));
    expect(onEnterLikeLogs.length).toBe(0);

    // Confirm no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Diagnostic: collect and expose console and page errors for debugging if test fails', async ({ page }) => {
    // This test simply ensures the diagnostics mechanism works; it does not assert the absence of all logs,
    // but will assert that diagnostic arrays are accessible and are arrays.
    const httpPage = new HttpPage(page);
    await httpPage.goto();

    // basic sanity checks on diagnostic containers
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // No assumption about content here; but if there are pageErrors, surface them as part of assertion failure to help debugging
    if (pageErrors.length > 0) {
      // Fail with a helpful message that includes the error stack(s)
      const serialized = pageErrors.map(e => (e && e.stack) ? e.stack : String(e)).join('\n---\n');
      throw new Error(`Detected page errors during test run:\n${serialized}`);
    }
  });
});