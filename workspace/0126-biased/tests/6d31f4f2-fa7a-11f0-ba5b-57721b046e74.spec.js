import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d31f4f2-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Integration Testing Demo (Application ID: 6d31f4f2-fa7a-11f0-ba5b-57721b046e74)', () => {
  // Arrays to capture console error messages and page errors for each test.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    // Collect uncaught page errors (e.g., ReferenceError, TypeError)
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });

    // Navigate to the application page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No special teardown besides allowing the browser context to clean up.
    // The collectors are scoped per test and will be reinitialized in beforeEach.
  });

  test.describe('Initial rendering and basic structure', () => {
    test('renders all major UI components and no console/page errors on load', async ({ page }) => {
      // Verify presence of main sections
      await expect(page.locator('h1')).toHaveText('Integration Testing Demo');
      await expect(page.locator('#service-status')).toBeVisible();
      await expect(page.locator('#user-form')).toBeVisible();
      await expect(page.locator('#test-scenarios')).toBeVisible();
      await expect(page.locator('#test-controls')).toBeVisible();
      await expect(page.locator('#test-results')).toBeVisible();

      // The results area initially contains placeholder text
      await expect(page.locator('#test-results')).toContainText('Test Results Will Appear Here');

      // There should be three scenario buttons rendered (userRegistration, orderProcessing, userLogin)
      const scenarioButtons = page.locator('#test-scenarios button');
      await expect(scenarioButtons).toHaveCount(3);

      // Service status controls: there should be a button for each service (authService, dataService, paymentService)
      const serviceDivs = page.locator('#service-status div');
      await expect(serviceDivs).toHaveCount(3);

      // Sliders initial values confirmed
      await expect(page.locator('#timeout-value')).toHaveText('5000');
      await expect(page.locator('#failure-value')).toHaveText('20');

      // Assert that no console errors or uncaught page errors occurred during initial load
      // We assert zero errors to ensure the page loaded cleanly. This will also capture any unexpected runtime errors.
      expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('Service toggling and visual feedback', () => {
    test('toggles authService between offline and online and updates DOM', async ({ page }) => {
      // Locate the specific service container for authService and its button
      const authServiceDiv = page.locator('#service-status div', { hasText: 'authService' });
      const authButton = authServiceDiv.locator('button');

      // Initial text should be 'offline'
      await expect(authButton).toHaveText('offline');

      // Click to toggle to 'online'
      await authButton.click();
      await expect(authButton).toHaveText('online');

      // Click again to toggle back to 'offline'
      await authButton.click();
      await expect(authButton).toHaveText('offline');

      // No unexpected console/page errors during toggling
      expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('User data input interactions', () => {
    test('updates state via inputs and reflected in results after running a test scenario', async ({ page }) => {
      // Fill username, password, email and check the newsletter checkbox
      const usernameInput = page.locator('#user-form input[type="text"]');
      const passwordInput = page.locator('#user-form input[type="password"]');
      const emailInput = page.locator('#user-form input[type="email"]');
      const newsletterCheckbox = page.locator('#user-form input[type="checkbox"]');

      await usernameInput.fill('tester01');
      await passwordInput.fill('s3cr3t!');
      await emailInput.fill('tester@example.com');
      await newsletterCheckbox.check();

      // Start a test scenario to force updateResults to render the current state
      const runButton = page.locator('#test-scenarios button', { hasText: 'Run userRegistration' });
      await runButton.click();

      // Immediately the results area should display a heading with Status (likely 'running')
      const resultsHeading = page.locator('#test-results h3');
      await expect(resultsHeading).toContainText('Test Scenario: userRegistration');

      // The system state after test should contain the user data we entered.
      // Wait for the system-state block to appear and check its text content.
      const systemState = page.locator('#test-results div', { hasText: 'System State After Test:' });
      await expect(systemState).toBeVisible();

      const systemText = await systemState.textContent();
      expect(systemText).toContain('tester01'); // username present
      expect(systemText).toContain('tester@example.com'); // email present

      // For the newsletter checkbox, updateUserData writes to a key named 'preferences.newsletter'
      // The JSON string should include that key name (as a single string property).
      expect(systemText).toContain('preferences.newsletter');

      // Ensure no unexpected console/page errors during input update and immediate rendering
      expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('Test scenario lifecycle and transitions', () => {
    test('running a single scenario moves to running then final (passed or failed) and DOM reflects steps classes', async ({ page }) => {
      // Start the 'userLogin' scenario
      const runLoginButton = page.locator('#test-scenarios button', { hasText: 'Run userLogin' });
      await runLoginButton.click();

      // After clicking, results area should show the scenario and status (running)
      const heading = page.locator('#test-results h3');
      await expect(heading).toContainText('Test Scenario: userLogin');

      // The status should initially be 'running'
      await expect(heading).toContainText('Status: running');

      // Shortly after starting, at least one step item should gain the 'running' class.
      // Use a generous timeout because UI step transitions use setTimeouts with up to ~3 seconds delays.
      const runningStep = page.locator('#test-results li.running');
      await runningStep.waitFor({ state: 'visible', timeout: 8000 });

      // Wait for the final status to be either passed or failed.
      // The script randomly determines success, so accept either outcome.
      await page.waitForFunction(() => {
        const h3 = document.querySelector('#test-results h3');
        if (!h3) return false;
        return /Status:\s*(passed|failed)/i.test(h3.textContent || '');
      }, null, { timeout: 20000 });

      // Verify the final heading contains passed or failed
      const finalHeadingText = await heading.textContent();
      expect(finalHeadingText).toMatch(/Status:\s*(passed|failed)/i);

      // Check that the final step list item's class matches the final status (passed -> .passed, failed -> .failed)
      const listItems = page.locator('#test-results ul li');
      const lastItem = listItems.nth((await listItems.count()) - 1);
      const lastClass = await lastItem.getAttribute('class');

      if (/Status:\s*passed/i.test(finalHeadingText)) {
        expect(lastClass).toContain('passed');
      } else {
        expect(lastClass).toContain('failed');
      }

      // Validate no uncaught runtime errors during the full run
      expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    }, 30000); // Extended timeout to allow for asynchronous test execution
  });

  test.describe('Run All Tests and Reset behavior (edge case: reset during running)', () => {
    test('Run All Tests starts sequential execution; Reset All Tests clears state and UI', async ({ page }) => {
      // Click 'Run All Tests'
      const runAllButton = page.locator('#test-controls button', { hasText: 'Run All Tests' });
      await runAllButton.click();

      // Immediately after starting Run All, at least one scenario should be running (results heading appears)
      const heading = page.locator('#test-results h3');
      await heading.waitFor({ state: 'visible', timeout: 8000 });
      await expect(heading).toContainText('Status: running');

      // While tests are running, click Reset All Tests to simulate an interruption
      const resetButton = page.locator('#test-controls button', { hasText: 'Reset All Tests' });
      await resetButton.click();

      // After reset, the results area should revert to the initial placeholder content
      await expect(page.locator('#test-results')).toContainText('Test Results Will Appear Here');

      // Also check that there is no Status heading present after reset
      const maybeHeading = page.locator('#test-results h3');
      // Wait a small moment for the DOM to update and then assert heading is not the test scenario heading
      await page.waitForTimeout(200);
      const headingCount = await maybeHeading.count();
      if (headingCount > 0) {
        const headingText = await maybeHeading.textContent();
        expect(headingText).not.toContain('Test Scenario:');
      }

      // Ensure no uncaught errors during runAll/reset flow
      expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('UI controls and edge interactions', () => {
    test('slider inputs update displayed values and do not cause runtime errors', async ({ page }) => {
      const timeoutSlider = page.locator('#timeout-slider');
      const failureSlider = page.locator('#failure-slider');
      const timeoutValue = page.locator('#timeout-value');
      const failureValue = page.locator('#failure-value');

      // Programmatically set slider values and dispatch input events in the page context
      await timeoutSlider.evaluate((el) => {
        el.value = '3000';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      await failureSlider.evaluate((el) => {
        el.value = '5';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Confirm the displayed values reflect the changes
      await expect(timeoutValue).toHaveText('3000');
      await expect(failureValue).toHaveText('5');

      // No runtime errors from interacting with sliders
      expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('resetTests resets internal status and UI to not run (via Reset All Tests button)', async ({ page }) => {
      // Run a specific test to change state
      const runButton = page.locator('#test-scenarios button', { hasText: 'Run orderProcessing' });
      await runButton.click();

      // Wait until we see running status
      await page.waitForFunction(() => {
        const h3 = document.querySelector('#test-results h3');
        return !!h3 && /Status:\s*running/i.test(h3.textContent || '');
      }, null, { timeout: 8000 });

      // Now click Reset All Tests
      const resetButton = page.locator('#test-controls button', { hasText: 'Reset All Tests' });
      await resetButton.click();

      // After reset, results area should contain the placeholder
      await expect(page.locator('#test-results')).toContainText('Test Results Will Appear Here');

      // There should not be a 'Status:' heading visible
      const maybeHeading = page.locator('#test-results h3');
      // Allow slight delay for DOM update
      await page.waitForTimeout(200);
      const count = await maybeHeading.count();
      if (count > 0) {
        const text = await maybeHeading.textContent();
        expect(text).not.toContain('Status:');
      }

      // Ensure no runtime errors during reset
      expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });
});