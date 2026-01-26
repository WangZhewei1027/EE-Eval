import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b390c2-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('f5b390c2-fa7c-11f0-adc7-178f556b1ee0 - Abstract Syntax Tree App (FSM validation)', () => {
  // We will attach console and pageerror listeners in beforeEach to record runtime outputs and errors.
  // Each test runs in a fresh browser context provided by Playwright's page fixture.

  test.beforeEach(async ({ page }) => {
    // Navigate to the page under test before each test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure page is closed/clean after each test (Playwright fixture normally handles this).
    // This is a placeholder for teardown if needed.
    await page.evaluate(() => {});
  });

  test.describe('FSM States - Idle and Demonstrating', () => {
    test('Idle state: initial render contains expected UI and demonstration button', async ({ page }) => {
      // Validate initial (Idle) state evidence: the Demonstrate button is present with correct text
      const demoButton = page.locator('#demonstration-button');

      // Button should be visible and enabled
      await expect(demoButton).toBeVisible();
      await expect(demoButton).toHaveText('Demonstrate');
      await expect(demoButton).toBeEnabled();

      // Check some static content that demonstrates initial page render (renderPage() evidence)
      await expect(page.locator('h1')).toHaveText('Abstract Syntax Tree');
      await expect(page.locator('pre')).toContainText('if (x > 5)');
    });

    test('Transition to Demonstrating: clicking the Demonstrate button triggers event handler (error observed due to missing parseSourceCode)', async ({ page }) => {
      // Collect console messages and page errors to assert expected runtime behaviour.
      const consoleMessages = [];
      page.on('console', msg => {
        try {
          consoleMessages.push({ type: msg.type(), text: msg.text() });
        } catch (e) {
          // swallow any rare serialization issues
        }
      });

      // Wait for the pageerror that we expect to be thrown because parseSourceCode is not defined.
      const [pageError] = await Promise.all([
        page.waitForEvent('pageerror'),
        // Trigger the FSM event: user clicks the demonstration button
        page.click('#demonstration-button')
      ]);

      // The application calls parseSourceCode(...) inside the click handler but parseSourceCode is not defined.
      // We expect a ReferenceError (or similar) mentioning parseSourceCode.
      expect(pageError).toBeTruthy();
      // The message can vary across browsers; check that parseSourceCode is referenced in the error message.
      expect(String(pageError.message)).toMatch(/parseSourceCode/);

      // Since parseSourceCode threw, the AST printing (console.log(ast) and printAST outputs) should not have occurred.
      // Ensure none of the console messages contain AST traversal logs like "Keyword:", "Identifier:", "Literal:", or the AST itself.
      const combinedConsoleText = consoleMessages.map(m => m.text).join('\n');
      expect(combinedConsoleText).not.toContain('Keyword:');
      expect(combinedConsoleText).not.toContain('Identifier:');
      expect(combinedConsoleText).not.toContain('Literal:');
      expect(combinedConsoleText).not.toContain('Comment:');

      // The DOM should remain intact after the error — the button should still be present and clickable.
      const demoButton = page.locator('#demonstration-button');
      await expect(demoButton).toBeVisible();
      await expect(demoButton).toBeEnabled();
    });
  });

  test.describe('Transitions, Events, and Edge Cases', () => {
    test('Clicking the Demonstrate button multiple times produces repeated runtime errors (one per click)', async ({ page }) => {
      // We will perform two sequential clicks and capture the pageerror for each click.
      const errors = [];

      // Attach a lightweight listener to collect console messages as well (to ensure no AST logs appear).
      const consoleMsgs = [];
      page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));

      // First click -> expect one pageerror
      const err1Promise = page.waitForEvent('pageerror');
      await page.click('#demonstration-button');
      const err1 = await err1Promise;
      errors.push(err1);
      expect(String(err1.message)).toMatch(/parseSourceCode/);

      // Second click -> expect another pageerror
      const err2Promise = page.waitForEvent('pageerror');
      await page.click('#demonstration-button');
      const err2 = await err2Promise;
      errors.push(err2);
      expect(String(err2.message)).toMatch(/parseSourceCode/);

      // Ensure both errors were captured and reference the missing function
      expect(errors).toHaveLength(2);
      for (const e of errors) {
        expect(String(e.message)).toMatch(/parseSourceCode/);
      }

      // Confirm again: no successful AST printouts happened on either click
      const allConsoleText = consoleMsgs.map(m => m.text).join(' ');
      expect(allConsoleText).not.toMatch(/Keyword:|Identifier:|Literal:|Comment:/);
    });

    test('Event handler execution is evidenced by runtime error and does not mutate DOM unexpectedly', async ({ page }) => {
      // This test double-checks that the click handler runs (evidence: pageerror) and that the page stays in a valid state after the handler fails.
      let pageErrorCaptured = null;
      page.on('pageerror', e => {
        pageErrorCaptured = e;
      });

      // Click the button to trigger the handler. Wait for a short interval for the pageerror to propagate.
      await page.click('#demonstration-button');
      // Give a small amount of time for the pageerror to fire and be captured by our listener.
      await page.waitForTimeout(200);

      // The listener should have observed an error from the click handler
      expect(pageErrorCaptured).toBeTruthy();
      expect(String(pageErrorCaptured.message)).toMatch(/parseSourceCode/);

      // Check DOM stability: verify presence of several static text elements that should remain unchanged
      await expect(page.locator('p')).toContainText('What is an Abstract Syntax Tree?');
      await expect(page.locator('pre').first()).toContainText('if (x > 5)');
      // The demonstration button should remain present and not removed by the faulty handler
      await expect(page.locator('#demonstration-button')).toBeVisible();
    });

    test('Edge case: ensure no unhandled console AST output if parse fails early', async ({ page }) => {
      // Attach console listener and click to trigger parse error
      const consoleTexts = [];
      page.on('console', msg => consoleTexts.push(msg.text()));

      // Trigger click and capture pageerror deterministically
      await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('#demonstration-button')
      ]);

      // If parseSourceCode threw, printAST won't run, therefore console output for AST traversal should be absent
      const joined = consoleTexts.join(' | ');
      expect(joined).not.toContain('Keyword:');
      expect(joined).not.toContain('Identifier:');
      expect(joined).not.toContain('Literal:');
    });
  });

  test.describe('Assertions related to FSM onEnter/onExit actions and expected observables', () => {
    test('Verify "renderPage" evidence present on initial load (Idle state entry)', async ({ page }) => {
      // The FSM's Idle state's entry action mentions renderPage().
      // The static DOM must be present as the page is already rendered. We assert the static content exists as evidence.
      await expect(page.locator('#demonstration-button')).toBeVisible();
      await expect(page.locator('h1')).toHaveText('Abstract Syntax Tree');
      await expect(page.locator('p')).toContainText('A syntax tree is a data structure');
    });

    test('Expected observable "AST printed to console" does not occur due to missing parseSourceCode, assert that failure is observed', async ({ page }) => {
      // This test affirms that the FSM transition expected observable (AST printed) does not happen,
      // and that an error prevents that observable — we assert the error occurs.
      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

      const [pageError] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('#demonstration-button')
      ]);

      // Assert error refers to the missing parse routine
      expect(String(pageError.message)).toMatch(/parseSourceCode/);

      // Verify that AST printouts are absent in console messages
      const combined = consoleMessages.map(m => m.text).join('\n');
      expect(combined).not.toContain('('); // naive check: AST printing would likely include parentheses or keywords
      expect(combined).not.toContain('Keyword:');
    });
  });
});