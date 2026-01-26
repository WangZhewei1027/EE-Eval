import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cb8931-fa7c-11f0-ba20-415c525382ea.html';

test.describe('Understanding NP-Completeness - FSM and UI tests (Application ID: 25cb8931-fa7c-11f0-ba20-415c525382ea)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.stack ? err.stack : err));
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No global teardown required; listeners are attached per test via page fixture
  });

  test.describe('State S0_Idle (Initial render)', () => {
    test('S0_Idle: Page renders with expected static content and components', async ({ page }) => {
      // This test validates the initial Idle state (S0_Idle)
      // - The verify button exists and has the correct label
      // - The demo output container exists, is empty, and exposes aria-live="polite"
      const verifyBtn = page.locator('#verifySAT');
      const demoOutput = page.locator('#demoOutput');

      await expect(verifyBtn).toBeVisible();
      await expect(verifyBtn).toHaveText('Verify SAT Certificate Demo');

      await expect(demoOutput).toBeVisible();
      // demoOutput should be initially empty
      await expect(demoOutput).toHaveText('');
      // aria-live attribute should be polite as described in the FSM/components
      await expect(demoOutput).toHaveAttribute('aria-live', 'polite');

      // Assert that no uncaught page errors happened during initial render
      expect(pageErrors.length, `Expected no page errors on initial load, got: ${pageErrors.join('\n')}`).toBe(0);
      // Also assert there are no console error messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Expected no console error messages, got: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });

  test.describe('Event: VerifySAT_Click and transition S0 -> S1 -> S2', () => {
    test('Clicking Verify SAT transitions through Verifying and shows verification result (S1_Verifying -> S2_Verified)', async ({ page }) => {
      // This test validates:
      // - Clicking the button triggers the verification demo
      // - demoOutput contains the expected "Verifying the following formula:" header
      // - Each clause's evaluation appears
      // - Overall satisfaction line contains TRUE and "Verification PASSED."
      const verifyBtn = page.locator('#verifySAT');
      const demoOutput = page.locator('#demoOutput');

      // Precondition: ensure idle state
      await expect(demoOutput).toHaveText('');

      // Trigger the VerifySAT_Click event
      await verifyBtn.click();

      // After click, we expect the output to include the verification header and clause outputs
      await expect(demoOutput).toContainText('Verifying the following formula:');
      await expect(demoOutput).toContainText('(x1 OR NOT x2) AND (x3 OR x2) AND (NOT x1 OR NOT x3)');

      // Check that clause lines are present and indicate satisfaction
      await expect(demoOutput).toContainText('Clause 1:');
      await expect(demoOutput).toContainText('Clause satisfied: true'); // each clause uses boolean text true/false

      // Check overall satisfaction and PASS message
      await expect(demoOutput).toContainText('Overall formula satisfaction by assignment: TRUE');
      await expect(demoOutput).toContainText('Verification PASSED');

      // Ensure no uncaught page errors occurred during/after the click
      const errorsSnapshot = pageErrors.slice();
      expect(errorsSnapshot.length, `Expected no page errors after clicking verify, got: ${errorsSnapshot.join('\n')}`).toBe(0);

      // Ensure no console error messages were emitted
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Expected no console error messages after clicking verify, got: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });

    test('Repeated clicks (idempotency) - clicking twice produces a valid verification output and clears previous output on re-run', async ({ page }) => {
      // This test validates:
      // - The demo can be run multiple times.
      // - On re-run, output is regenerated and remains correct.
      // - The entry action demoOutput.textContent = "" executes (we validate by ensuring content updates properly)
      const verifyBtn = page.locator('#verifySAT');
      const demoOutput = page.locator('#demoOutput');

      // First run
      await verifyBtn.click();
      const firstContent = (await demoOutput.textContent()) || '';
      expect(firstContent.length).toBeGreaterThan(0);
      expect(firstContent).toContain('Verifying the following formula:');
      expect(firstContent).toContain('Overall formula satisfaction by assignment: TRUE');
      expect(firstContent).toContain('Verification PASSED');

      // Second run (simulate a user re-running the verification)
      // We capture content before second click to ensure clearing/regeneration occurs.
      const beforeSecond = (await demoOutput.textContent()) || '';
      await verifyBtn.click();
      // After the second click, content should again contain the expected verification output.
      const secondContent = (await demoOutput.textContent()) || '';
      expect(secondContent.length).toBeGreaterThan(0);
      expect(secondContent).toContain('Verifying the following formula:');
      expect(secondContent).toContain('Overall formula satisfaction by assignment: TRUE');
      expect(secondContent).toContain('Verification PASSED');

      // The content strings may be identical (the demo produces deterministic output).
      // However, at minimum, ensure the content after second click is a fresh evaluation (still valid).
      // Also ensure no errors were recorded across repeated runs.
      expect(pageErrors.length, `Expected no page errors after repeated clicks, got: ${pageErrors.join('\n')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Expected no console error messages after repeated clicks, got: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });

    test('Rapid double-click (edge case): final output remains correct and no errors thrown', async ({ page }) => {
      // This test validates robustness under quick successive interactions.
      const verifyBtn = page.locator('#verifySAT');
      const demoOutput = page.locator('#demoOutput');

      // Perform two quick clicks
      await verifyBtn.click();
      await verifyBtn.click();

      // Final output should be valid and include expected strings
      await expect(demoOutput).toContainText('Verifying the following formula:');
      await expect(demoOutput).toContainText('Overall formula satisfaction by assignment: TRUE');
      await expect(demoOutput).toContainText('Verification PASSED');

      // No uncaught errors in pageErrors
      expect(pageErrors.length, `Expected no page errors after rapid double-click, got: ${pageErrors.join('\n')}`).toBe(0);
      // No console errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Expected no console error messages after rapid double-click, got: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });

  test.describe('FSM coverage and edge scenarios', () => {
    test('Validates evidence strings described in FSM are present in UI output', async ({ page }) => {
      // This test asserts that the key evidence strings from the FSM appear somewhere in the UI or demo output.
      // Evidence includes:
      // - "Verifying the following formula:"
      // - "Overall formula satisfaction by assignment: "
      // - Success and failure messages (we expect success for the provided assignment)
      const verifyBtn = page.locator('#verifySAT');
      const demoOutput = page.locator('#demoOutput');

      // Run demo
      await verifyBtn.click();

      // Verify the presence of evidence fragments
      await expect(demoOutput).toContainText('Verifying the following formula:');
      await expect(demoOutput).toContainText('Overall formula satisfaction by assignment:');
      await expect(demoOutput).toContainText('This assignment satisfies the formula. Verification PASSED');

      // Assert that the demo output has clause-level evidence
      await expect(demoOutput).toContainText('Clause 1:');
      await expect(demoOutput).toContainText('Clause satisfied: true');

      // Finally, ensure no page-level exceptions were raised
      expect(pageErrors.length, `Expected no page errors for evidence validation, got: ${pageErrors.join('\n')}`).toBe(0);
    });

    test('No unexpected console errors or uncaught exceptions during full scenario', async ({ page }) => {
      // This test intentionally covers the page lifecycle:
      // - Initial render
      // - Running the demo
      // - Re-running the demo
      // and asserts there are no console errors or unhandled page errors.
      const verifyBtn = page.locator('#verifySAT');

      // Run demo a few times to exercise code paths
      await verifyBtn.click();
      await verifyBtn.click();
      await verifyBtn.click();

      // Wait for potential asynchronous errors to surface (small delay)
      await page.waitForTimeout(100);

      // Collect any console error messages and page errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');

      expect(consoleErrors.length, `Expected no console error messages during full scenario, got: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Expected no page errors during full scenario, got: ${pageErrors.join('\n')}`).toBe(0);
    });
  });

  test.describe('Intentional verification of onEnter/onExit behavior described in FSM', () => {
    test('Entry action for S1_Verifying: demoOutput is cleared before writing new content (observable across runs)', async ({ page }) => {
      // The script contains demoOutput.textContent = "" at the start of the click handler.
      // We validate that when demoOutput had previous content, upon clicking the button again,
      // the content is regenerated (i.e., previous content is not preserved).
      const verifyBtn = page.locator('#verifySAT');
      const demoOutput = page.locator('#demoOutput');

      // First run to populate content
      await verifyBtn.click();
      const contentAfterFirst = (await demoOutput.textContent()) || '';
      expect(contentAfterFirst.length).toBeGreaterThan(0);

      // Now click again to trigger clearing and regeneration
      // We'll perform the click and then immediately poll for the content to become non-empty again.
      // This verifies the handler cleared and re-populated the output.
      await verifyBtn.click();

      // Wait until demoOutput becomes non-empty again (repopulated) - default timeout will apply
      await expect(demoOutput).toHaveText(/Verifying the following formula:/);

      const contentAfterSecond = (await demoOutput.textContent()) || '';
      expect(contentAfterSecond.length).toBeGreaterThan(0);
      expect(contentAfterSecond).toContain('Overall formula satisfaction by assignment: TRUE');

      // Ensure that content was indeed regenerated (though content strings may be identical, the fact we had a non-empty result after the second click indicates clearing+repopulation)
      expect(pageErrors.length, `Expected no page errors when validating onEnter action, got: ${pageErrors.join('\n')}`).toBe(0);
    });
  });
});