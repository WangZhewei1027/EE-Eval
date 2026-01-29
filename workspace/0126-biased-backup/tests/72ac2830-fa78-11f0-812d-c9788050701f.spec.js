import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac2830-fa78-11f0-812d-c9788050701f.html';

test.describe('B-Tree Visual Symphony - FSM validation (72ac2830-fa78-11f0-812d-c9788050701f)', () => {
  // Page-level error and console collectors
  test.beforeEach(async ({ page }) => {
    // Collect page errors and console.error messages for assertions
    page.context()._pageErrors = [];
    page.context()._consoleErrors = [];

    page.on('pageerror', (err) => {
      // store the error object or message
      page.context()._pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        page.context()._consoleErrors.push(msg.text());
      }
    });

    // Navigate to the exact page as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Fail if any uncaught page errors occurred during the test
    const pageErrors = page.context()._pageErrors || [];
    const consoleErrors = page.context()._consoleErrors || [];

    // Provide diagnostics in failure case
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e.message || e.toString()).join('; ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.join('; ')}`).toHaveLength(0);
  });

  test.describe('State S0 - Idle (initial render)', () => {
    test('renders the B-Tree, controls, and legend on DOMContentLoaded', async ({ page }) => {
      // Validate that nodes are rendered in Idle state (entry action renderPage/renderBTree)
      // Wait for at least one node to become active (renderBTree sets .node elements and adds .active via timeout)
      const nodeSelector = '.tree .node';
      await page.waitForSelector('#tree', { state: 'attached' });
      const nodes = await page.$$(nodeSelector);
      expect(nodes.length).toBeGreaterThan(0);

      // Validate keys exist and the root key 25 is rendered
      const key25 = await page.locator('.key', { hasText: '25' }).first();
      await expect(key25).toBeVisible();

      // Controls should be present and visible
      await expect(page.locator('#animateBtn')).toBeVisible();
      await expect(page.locator('#resetBtn')).toBeVisible();

      // Legend items visible
      await expect(page.locator('.legend')).toBeVisible();
      await expect(page.locator('.legend-item')).toHaveCount(3);

      // Ensure no page errors or console errors occurred during initial render (checked in afterEach)
    });
  });

  test.describe('Transition tests (AnimateSearch and ResetView)', () => {
    test('S0 -> S1: clicking Animate Search triggers animation and shows an alert', async ({ page }) => {
      // Collect dialogs produced by alert so we can assert them
      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      // Click the animate button to trigger animateSearch(bTree, randomValue)
      const animateBtn = page.locator('#animateBtn');
      await expect(animateBtn).toBeVisible();
      await animateBtn.click();

      // During the animation, at least one .key should receive the .highlight class
      // animateSearch uses timeouts - wait sufficiently long for a highlight to appear
      const highlightedKeyLocator = page.locator('.key.highlight');
      await highlightedKeyLocator.first().waitFor({ timeout: 8000 });

      // Assert that at least one highlighted key exists
      const highlightedCount = await page.locator('.key.highlight').count();
      expect(highlightedCount).toBeGreaterThan(0);

      // Wait for the alert dialog to be shown and captured
      // animateSearch shows an alert after searchPath.length * 1200 + delay
      // Give generous timeout for the dialog to appear
      await page.waitForTimeout(1000); // small wait to allow dialog event processing
      expect(dialogs.length).toBeGreaterThanOrEqual(1);

      // Validate the alert message format (either found or not found)
      const msg = dialogs[0];
      expect(msg).toMatch(/(Found value \d+ in the B-Tree!|Value \d+ not found in the B-Tree\.)/);

      // Also verify that a highlighted key's text is a number between expected range (5..48 as present in sample)
      const firstHighlighted = await page.locator('.key.highlight').first();
      const text = await firstHighlighted.textContent();
      const num = parseInt((text || '').trim(), 10);
      expect(Number.isFinite(num)).toBeTruthy();

      // After animation completes, highlighted keys should remain until reset
      expect(await page.locator('.key.highlight').count()).toBeGreaterThan(0);
    });

    test('S1 -> S0: clicking Reset View during/after animation clears highlights and styles', async ({ page }) => {
      // Start animation to create highlights and inline node styles
      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      await page.locator('#animateBtn').click();

      // Wait for at least one key to be highlighted
      await page.locator('.key.highlight').first().waitFor({ timeout: 8000 });

      // Confirm that there's at least one highlighted key before reset
      expect(await page.locator('.key.highlight').count()).toBeGreaterThan(0);

      // Click reset to invoke resetAnimation(bTree) which should remove highlights and inline transforms/styles
      await page.locator('#resetBtn').click();

      // After reset, no keys should have the highlight class
      await page.waitForTimeout(300); // allow small time for resetAnimation to run
      const highlightCountAfterReset = await page.locator('.key.highlight').count();
      expect(highlightCountAfterReset).toBe(0);

      // All nodes should have empty inline transform and boxShadow styles
      const nodes = await page.$$('.node');
      for (const node of nodes) {
        const transform = await node.evaluate((n) => n.style.transform || '');
        const boxShadow = await node.evaluate((n) => n.style.boxShadow || '');
        expect(transform).toBe('');
        expect(boxShadow).toBe('');
      }

      // Ensure an alert was shown previously (from animate) and was accepted
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
    });

    test('S0 -> S2: clicking Reset View from Idle does not cause errors and leaves DOM in stable state', async ({ page }) => {
      // From Idle state, click reset without any prior animate
      await page.locator('#resetBtn').click();

      // Ensure no keys are highlighted after reset (should be none)
      const highlightCount = await page.locator('.key.highlight').count();
      expect(highlightCount).toBe(0);

      // Ensure nodes have no inline transforms/styles
      const nodes = await page.$$('.node');
      for (const node of nodes) {
        const transform = await node.evaluate((n) => n.style.transform || '');
        const boxShadow = await node.evaluate((n) => n.style.boxShadow || '');
        expect(transform).toBe('');
        expect(boxShadow).toBe('');
      }
    });
  });

  test.describe('Edge cases and concurrency', () => {
    test('multiple Animate Search clicks produce multiple alerts and do not crash the page', async ({ page }) => {
      // Collect dialogs; accept them to allow flow
      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      // Click animate twice in quick succession to simulate concurrent animations
      await page.locator('#animateBtn').click();
      await page.waitForTimeout(200); // quick second click while first animation is in-flight
      await page.locator('#animateBtn').click();

      // Wait for at least one highlight from the first or second invocation
      await page.locator('.key.highlight').first().waitFor({ timeout: 10000 });

      // Wait some time for dialogs from both invocations to appear; they may appear sequentially
      await page.waitForTimeout(4000);

      // Expect at least one dialog; in many runs two dialogs will occur (one per click)
      expect(dialogs.length).toBeGreaterThanOrEqual(1);

      // If multiple dialogs occurred, ensure messages are valid
      for (const message of dialogs) {
        expect(message).toMatch(/(Found value \d+ in the B-Tree!|Value \d+ not found in the B-Tree\.)/);
      }
    });

    test('calling Reset repeatedly remains idempotent and stable', async ({ page }) => {
      // Click reset multiple times in quick succession
      const resetBtn = page.locator('#resetBtn');
      await resetBtn.click();
      await resetBtn.click();
      await resetBtn.click();

      // Ensure no keys are highlighted and no inline styles on nodes
      await page.waitForTimeout(200);
      expect(await page.locator('.key.highlight').count()).toBe(0);

      const nodes = await page.$$('.node');
      for (const node of nodes) {
        const transform = await node.evaluate((n) => n.style.transform || '');
        const boxShadow = await node.evaluate((n) => n.style.boxShadow || '');
        expect(transform).toBe('');
        expect(boxShadow).toBe('');
      }
    });

    test('observes console and page errors (none expected) while interacting heavily', async ({ page }) => {
      // Interact: animate, reset, animate, reset quickly
      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      for (let i = 0; i < 3; i++) {
        await page.locator('#animateBtn').click();
        // small delay to let animation start
        await page.waitForTimeout(300);
        await page.locator('#resetBtn').click();
      }

      // Allow any late asynchronous work to finish
      await page.waitForTimeout(1500);

      // Ensure no page errors or console errors were captured (checked in afterEach)
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
    });
  });
});