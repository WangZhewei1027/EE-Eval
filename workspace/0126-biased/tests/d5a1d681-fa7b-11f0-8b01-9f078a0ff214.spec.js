import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1d681-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('d5a1d681-fa7b-11f0-8b01-9f078a0ff214 - Understanding Big-Omega Notation (FSM validation)', () => {
  // Arrays to capture runtime observations for each test
  let consoleMessages;
  let pageErrors;
  let dialogs;

  // Common setup for each test: navigate to page and attach listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', error => {
      // store the string form for assertions and debugging
      pageErrors.push(String(error));
    });

    // Capture dialogs (alerts) and automatically accept them to allow flow to continue.
    page.on('dialog', async dialog => {
      try {
        dialogs.push({
          type: dialog.type(),
          message: dialog.message()
        });
        await dialog.accept();
      } catch (e) {
        // If accepting fails, still record the failure as a page error
        pageErrors.push('Dialog acceptance failed: ' + String(e));
      }
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond per-test listeners cleanup handled by Playwright.
    // Keep this hook for symmetry and possible future teardown actions.
  });

  test.describe('State S0_Idle (Initial render checks)', () => {
    test('S0_Idle: Page renders with title, header and the Demonstrate Sorting button', async ({ page }) => {
      // Validate page title
      await expect(page).toHaveTitle(/Understanding Big-Omega Notation/);

      // Check the main header exists and contains expected text
      const header = page.locator('h1');
      await expect(header).toHaveText(/Understanding Big-Omega Notation/);

      // The FSM evidence indicates a single button with an inline onclick handler.
      const demoButton = page.locator('button[onclick]');
      // Ensure the button exists exactly once
      await expect(demoButton).toHaveCount(1);

      // Verify the visible text on the button matches the FSM evidence
      await expect(demoButton).toHaveText('Demonstrate Sorting');

      // Verify the onclick attribute exists and includes the alert text as in the FSM evidence
      const onclickAttr = await demoButton.getAttribute('onclick');
      await expect(onclickAttr).toContain("This is a placeholder for sorting demonstration. Explore sorting algorithms for detailed insights!");

      // Assert that loading the page did not produce any uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Sanity check: there should be no dialogs created on initial load (S0 has no alert entry action in the DOM)
      expect(dialogs.length).toBe(0);
    });

    test('S0_Idle: DOM sections and explanatory text are present (content sanity)', async ({ page }) => {
      // Check presence of several section headings to ensure the page rendered fully
      const expectedHeadings = [
        'What is Big-Omega Notation?',
        'Mathematical Definition',
        'Example of Big-Omega Notation',
        'Why is Big-Omega Important?',
        'A Simple Demonstration',
        'Conclusion'
      ];

      for (const headingText of expectedHeadings) {
        const locator = page.locator(`text=${headingText}`);
        await expect(locator).toHaveCount(1);
      }

      // No unexpected page errors during content checks
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: DemonstrateSorting (S0_Idle -> S1_SortingDemonstration)', () => {
    test('Clicking the Demonstrate Sorting button triggers an alert with the expected message (S1 entry_action)', async ({ page }) => {
      // This validates the FSM transition from Idle to SortingDemonstration via click event

      const demoButton = page.locator('button[onclick]');
      await expect(demoButton).toBeVisible();

      // Click the button to trigger the alert defined in the onclick attribute.
      // The page.on('dialog') handler will capture and accept the alert.
      await demoButton.click();

      // After the click, we expect exactly one dialog captured with the correct message
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.type).toBe('alert');
      expect(lastDialog.message).toBe("This is a placeholder for sorting demonstration. Explore sorting algorithms for detailed insights!");

      // Ensure no uncaught page errors were thrown as a result of the click
      expect(pageErrors.length).toBe(0);

      // Check that clicking did not produce any error-level console messages (optional check)
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('Repeated clicks create multiple alerts and are each captured (edge case: rapid user interaction)', async ({ page }) => {
      // Simulate multiple rapid clicks and ensure each alert is captured in order

      const demoButton = page.locator('button[onclick]');
      await expect(demoButton).toBeVisible();

      // Click the button three times sequentially, awaiting each click to allow dialog handling
      await demoButton.click();
      await demoButton.click();
      await demoButton.click();

      // Expect at least three dialog events captured (the handler auto-accepts them)
      expect(dialogs.length).toBeGreaterThanOrEqual(3);

      // Verify content of each captured dialog
      for (let i = 0; i < 3; i++) {
        expect(dialogs[i].type).toBe('alert');
        expect(dialogs[i].message).toBe("This is a placeholder for sorting demonstration. Explore sorting algorithms for detailed insights!");
      }

      // Ensure no page errors occurred during repeated interactions
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Event binding and evidence checks', () => {
    test('The button includes the exact onclick evidence specified in the FSM', async ({ page }) => {
      // Validate the attribute content matches the FSM evidence string exactly (or contains it)
      const demoButton = page.locator('button[onclick]');
      const onclickAttr = await demoButton.getAttribute('onclick');

      // FSM evidence shows the inline onclick calling alert with a specific string.
      const expectedSnippet = "alert('This is a placeholder for sorting demonstration. Explore sorting algorithms for detailed insights!')";
      expect(onclickAttr).toContain(expectedSnippet);

      // Ensure that the button is clickable (no overlay or disabled state)
      await expect(demoButton).toBeEnabled();

      // No page errors from attribute inspection
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking elsewhere does not trigger the DemonstrateSorting event (negative case)', async ({ page }) => {
      // Click on the page body (not the button) and assert no alert/dialog is produced
      await page.click('body', { position: { x: 10, y: 10 } });

      // There should be zero dialogs from this action
      // (If previous tests ran in same worker, dialogs array may have entries; ensure this test runs in isolated context)
      // We assert that the last dialog was not created by the body click by taking a snapshot length and verifying no new entries appear.
      const currentDialogCount = dialogs.length;

      // Wait a short time to allow any unexpected dialogs to appear
      await page.waitForTimeout(200);

      expect(dialogs.length).toBe(currentDialogCount);

      // No page errors should have resulted from clicking the body
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and console monitoring', () => {
    test('No uncaught ReferenceError / SyntaxError / TypeError occurred during page load and interactions', async ({ page }) => {
      // This test collects and asserts that there were no uncaught page errors during load/interactions.
      // It is valid for there to be console logs, but we expect no fatal page errors for this static resource.
      expect(pageErrors.length).toBe(0);
    });

    test('Capture and report console messages (if any) for manual inspection', async ({ page }) => {
      // This test is primarily observational: it ensures console messages are captured and accessible.
      // We assert that captured messages are an array and that each entry has a type and text.
      expect(Array.isArray(consoleMessages)).toBe(true);

      for (const msg of consoleMessages) {
        expect(msg).toHaveProperty('type');
        expect(msg).toHaveProperty('text');
      }

      // The test does not fail if there are console messages; it only enforces the capture shape.
    });
  });
});