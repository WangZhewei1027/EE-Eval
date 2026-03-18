import { test, expect } from '@playwright/test';

// Test file: a3703c82-ffc4-11f0-821c-7d25bc609266.spec.js
// URL under test:
// http://127.0.0.1:5500/workspace/0202-sample/html/a3703c82-ffc4-11f0-821c-7d25bc609266.html

// Page Object Model for the demo page
class DemoPage {
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demo-btn');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0202-sample/html/a3703c82-ffc4-11f0-821c-7d25bc609266.html', { waitUntil: 'domcontentloaded' });
  }

  async clickDemo() {
    await this.button.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async getOutputComputedStyle(prop) {
    return this.page.locator('#demo-output').evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  }
}

test.describe('FSM: Understanding the Concept of Set - Union & Intersection Demo', () => {
  // Capture console errors and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // Install listeners to capture console error messages and page errors
    page.__consoleErrors = [];
    page.__consoleMessages = [];
    page.__pageErrors = [];

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      page.__consoleMessages.push({ type, text });
      if (type === 'error') {
        page.__consoleErrors.push(text);
      }
    });

    page.on('pageerror', err => {
      // err is an Error object from the page context
      page.__pageErrors.push(String(err && err.stack ? err.stack : err));
    });
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown sanity: ensure listeners exist (Playwright cleans up automatically)
    // No explicit action required.
  });

  test('Initial Idle state: button present and demo output is empty', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) from the FSM:
    // - The page renders the control button
    // - The demo output region exists and is initially empty
    const demo = new DemoPage(page);
    await demo.goto();

    // Assert the demo button exists and has the expected label
    await expect(demo.button).toBeVisible();
    await expect(demo.button).toHaveText('Show Union & Intersection Demo');

    // Assert demo output element exists and is empty before interaction
    await expect(demo.output).toBeVisible();
    const initialText = await demo.getOutputText();
    expect(initialText).toBe('', 'Expected demo output to be empty in the Idle state');

    // Validate accessibility attributes per FSM component extraction
    const role = await demo.output.getAttribute('role');
    const ariaLive = await demo.output.getAttribute('aria-live');
    const ariaAtomic = await demo.output.getAttribute('aria-atomic');
    expect(role).toBe('region');
    expect(ariaLive).toBe('polite');
    expect(ariaAtomic).toBe('true');

    // Verify no runtime errors were emitted simply by loading the page
    expect(page.__consoleErrors.length).toBe(0, `Console errors found on load: ${JSON.stringify(page.__consoleErrors)}`);
    expect(page.__pageErrors.length).toBe(0, `Page errors found on load: ${JSON.stringify(page.__pageErrors)}`);

    // Entry action listed in FSM for Idle: renderPage()
    // The implementation does not call renderPage(); ensure no ReferenceError related to renderPage was thrown.
    const renderPageErrors = page.__pageErrors.concat(page.__consoleErrors).filter(m => m.includes('renderPage') || m.includes('ReferenceError'));
    expect(renderPageErrors.length).toBe(0, 'No ReferenceError or renderPage-related errors should be present on initial load');
  });

  test('Transition: clicking button shows union and intersection demo (S0_Idle -> S1_DemoDisplayed)', async ({ page }) => {
    // This test validates the event ShowUnionIntersectionDemo and the transition to DemoDisplayed state:
    // - Clicking #demo-btn should populate #demo-output with textual demo
    const demo = new DemoPage(page);
    await demo.goto();

    // Pre-condition: output empty
    const before = await demo.getOutputText();
    expect(before).toBe('', 'Pre-condition: demo output should be empty before clicking');

    // Click the demo button and wait for output to update
    await demo.clickDemo();

    // Wait until output.textContent is non-empty
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.textContent && el.textContent.trim().length > 0;
    }, { timeout: 2000 });

    const out = await demo.getOutputText();

    // Check that output contains expected content (union & intersection results and set definitions)
    expect(out).toContain('Set A = {1, 3, 5, 7}', 'Output should show Set A');
    // Note: the implementation contains a trailing space in Set B formatting; assert a substring that is robust
    expect(out).toMatch(/Set B = \{3,\s*4,\s*5,\s*6\s*\}/);
    expect(out).toContain('Union (A ∪ B): { 1, 3, 4, 5, 6, 7 }', 'Output should show correct union result');
    expect(out).toContain('Intersection (A ∩ B): { 3, 5 }', 'Output should show correct intersection result');

    // Validate the textual step-by-step explanation is present
    expect(out).toContain('Step-by-step explanation of union', 'Union explanation should be present');
    expect(out).toContain('Step-by-step explanation of intersection', 'Intersection explanation should be present');

    // Ensure that the demo-output region has expected background color (visual feedback)
    const bg = await demo.getOutputComputedStyle('background-color');
    // The CSS sets #e1f0ff which corresponds to rgb(225, 240, 255)
    // Some environments may normalize spacing/case; compare trimmed lower-case
    expect(bg.replace(/\s+/g, '')).toContain('rgb(225,240,255)');

    // Assert that no errors were thrown during the interaction
    expect(page.__consoleErrors.length).toBe(0, `Console errors during demo click: ${JSON.stringify(page.__consoleErrors)}`);
    expect(page.__pageErrors.length).toBe(0, `Page errors during demo click: ${JSON.stringify(page.__pageErrors)}`);
  });

  test('Idempotency: multiple clicks produce consistent output and no errors', async ({ page }) => {
    // This test validates clicking the demo button repeatedly (edge case)
    // - Output should remain consistent across multiple clicks
    // - No runtime errors should be emitted during rapid/incremental clicking
    const demo = new DemoPage(page);
    await demo.goto();

    // Click once and record output
    await demo.clickDemo();
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.textContent && el.textContent.trim().length > 0;
    });
    const first = await demo.getOutputText();

    // Rapidly click several more times
    for (let i = 0; i < 5; i++) {
      await demo.clickDemo();
    }

    // Give the page a short moment to process any additional events
    await page.waitForTimeout(200);

    const after = await demo.getOutputText();

    // Content should remain the same (idempotent behavior for this demo)
    expect(after).toBe(first, 'Output should be identical after multiple clicks');

    // Confirm no console or page errors appeared during the rapid clicks
    expect(page.__consoleErrors.length).toBe(0, `Console errors after repeated clicks: ${JSON.stringify(page.__consoleErrors)}`);
    expect(page.__pageErrors.length).toBe(0, `Page errors after repeated clicks: ${JSON.stringify(page.__pageErrors)}`);
  });

  test('Accessibility and DOM checks: component properties match FSM extraction', async ({ page }) => {
    // Validate that the DOM components match the FSM's component extraction
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure the button has the expected id and text
    const btn = page.locator('#demo-btn');
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveText('Show Union & Intersection Demo');

    // Ensure the output region has attributes described by FSM and is present
    const out = page.locator('#demo-output');
    await expect(out).toHaveCount(1);
    const role = await out.getAttribute('role');
    const ariaLive = await out.getAttribute('aria-live');
    const ariaAtomic = await out.getAttribute('aria-atomic');
    expect(role).toBe('region');
    expect(ariaLive).toBe('polite');
    expect(ariaAtomic).toBe('true');

    // Confirm the output region has white-space: pre-wrap (ensures long lines wrap)
    const whiteSpace = await demo.getOutputComputedStyle('white-space');
    expect(whiteSpace).toBe('pre-wrap');

    // No unexpected page errors or console errors
    expect(page.__consoleErrors.length).toBe(0);
    expect(page.__pageErrors.length).toBe(0);
  });

  test('Edge scenario: ensure no unexpected runtime errors on navigation + interaction', async ({ page }) => {
    // This test intentionally repeats navigation and interaction to try and surface intermittent errors.
    // It does not modify global state or patch page code.
    const demo = new DemoPage(page);

    // Visit page multiple times to exercise page initialization repeatedly
    for (let i = 0; i < 3; i++) {
      await demo.goto();
      // Perform a click each time
      await demo.clickDemo();
      // Allow time for script to execute
      await page.waitForTimeout(100);
    }

    // Collect any console errors and page errors
    const allConsoleErrors = page.__consoleErrors;
    const allPageErrors = page.__pageErrors;

    // Assert none occurred during repeated loads/interactions
    expect(allConsoleErrors.length).toBe(0, `Unexpected console errors during repeated navigation/interactions: ${JSON.stringify(allConsoleErrors)}`);
    expect(allPageErrors.length).toBe(0, `Unexpected page errors during repeated navigation/interactions: ${JSON.stringify(allPageErrors)}`);
  });
});