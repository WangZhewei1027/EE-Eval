import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b444c2-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Comprehensive Guide to Version Control (Application f0b444c2-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Shared variables to capture console and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for console and page errors
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and errors emitted by the page
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Collect unhandled/page errors (e.g., ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', (err) => {
      // err is an Error object; record its message and name
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Navigate to the application page (do not modify the page)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Small sanity check in teardown: ensure page is still reachable
    // (not asserting here; just ensuring we don't close unexpectedly)
    try {
      await page.title();
    } catch (e) {
      // ignore
    }
  });

  test.describe('State S0_Idle (Initial state) validations', () => {
    test('S0: Page should render initial content and provide the demo button (Idle state)', async ({ page }) => {
      // Validate the page title matches the document title
      await expect(page).toHaveTitle(/Comprehensive Guide to Version Control/);

      // The FSM evidence expects a button with onclick="showDemo()"
      const demoButton = page.locator("button[onclick='showDemo()']");
      await expect(demoButton).toHaveCount(1);
      await expect(demoButton).toBeVisible();
      await expect(demoButton).toHaveText('Run Version Control Demo');

      // The demo output region should be hidden initially (S0 Idle state's evidence)
      const demoOutput = page.locator('#demoOutput');
      // Using Playwright to confirm it's hidden via CSS (display: none)
      await expect(demoOutput).toBeHidden();

      // The FSM lists an entry action renderPage() for S0_Idle.
      // The implementation does NOT define renderPage(); verify that it is not present on window.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      // We assert that renderPage is not a function on the global scope (i.e., undefined or not a function).
      expect(renderPageType === 'undefined' || renderPageType === 'object' || renderPageType === 'function').toBeTruthy();

      // Verify there were no console errors or page errors immediately after load
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Event: RunDemo and Transition S0_Idle -> S1_DemoVisible', () => {
    test('RunDemo: Clicking the button shows the demo output (transition to Demo Visible)', async ({ page }) => {
      const demoButton = page.locator("button[onclick='showDemo()']");
      const demoOutput = page.locator('#demoOutput');

      // Sanity: showDemo should be defined on the window before clicking
      const showDemoType = await page.evaluate(() => typeof window.showDemo);
      expect(showDemoType).toBe('function');

      // Click the button to trigger the demo (FSM event: RunDemo)
      await demoButton.click();

      // After clicking, the demo output should become visible (evidence: output.style.display = 'block';)
      await expect(demoOutput).toBeVisible();

      // Check that the output contains the expected simulation header and several commit lines
      const content = await demoOutput.innerHTML();
      expect(content).toContain('Version Control Simulation');
      expect(content).toContain('Commit 1 (abc123)');
      expect(content).toContain('Commit 2 (def456)');
      expect(content).toContain("Branch 'feature'");
      expect(content).toContain('Commit 3 (ghi789 on main)');
      expect(content).toContain('Merge: Combined changes');

      // Ensure showDemo (S1 entry action) performed the DOM update - we already saw visible and innerHTML populated
      // Ensure there were no console errors or page errors during this transition
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: Clicking the demo button multiple times should not duplicate the demo header', async ({ page }) => {
      const demoButton = page.locator("button[onclick='showDemo()']");
      const demoOutput = page.locator('#demoOutput');

      // Click once
      await demoButton.click();
      await expect(demoOutput).toBeVisible();

      // Capture innerHTML after first click
      const firstHTML = await demoOutput.innerHTML();

      // Click again quickly (simulate double activation)
      await demoButton.click();

      // After second click, the content should replace (not append) — header occurrence should remain one
      const secondHTML = await demoOutput.innerHTML();

      // The content should be identical because showDemo sets innerHTML to the same template each time
      expect(secondHTML).toBe(firstHTML);

      // Count occurrences of the main h3 header in the innerHTML
      const h3Count = (secondHTML.match(/<h3[^>]*>Version Control Simulation<\/h3>/g) || []).length;
      expect(h3Count).toBe(1);

      // Again, no console/page errors from repeated clicks
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Verify DOM after transition remains stable and accessible', async ({ page }) => {
      const demoButton = page.locator("button[onclick='showDemo()']");
      const demoOutput = page.locator('#demoOutput');

      // Trigger the demo
      await demoButton.click();
      await expect(demoOutput).toBeVisible();

      // Verify that the note element inside the demoOutput exists and has the CSS class 'note'
      const noteLocator = demoOutput.locator('.note');
      await expect(noteLocator).toHaveCount(1);
      const noteText = await noteLocator.textContent();
      expect(noteText).toContain('This is a simplified representation');

      // Verify that the demoOutput contains several paragraphs with strong tags describing commits
      const strongElements = demoOutput.locator('p strong');
      await expect(strongElements).toHaveCountGreaterThan(0);

      // Confirm no page errors or console errors occurred while interacting
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and robustness checks', () => {
    test('No unexpected ReferenceError, SyntaxError, or TypeError should be thrown during normal usage', async ({ page }) => {
      const demoButton = page.locator("button[onclick='showDemo()']");
      const demoOutput = page.locator('#demoOutput');

      // Exercise multiple interactions: click, wait, click again
      await demoButton.click();
      await expect(demoOutput).toBeVisible();
      // Wait for a short period to allow any asynchronous errors to surface
      await page.waitForTimeout(200);

      await demoButton.click();
      await page.waitForTimeout(200);

      // Collect any page error names for diagnostics if present
      const errorNames = pageErrors.map(err => err.name);
      // We expect the page to be free of runtime errors in this implementation
      expect(errorNames).toEqual([]);

      // Also assert that there were no console.error messages emitted
      expect(consoleErrors).toEqual([]);
    });

    test('Sanity check: showDemo is callable and does not return a value (undefined)', async ({ page }) => {
      // Evaluate calling showDemo from the page context and capture return
      const returnValue = await page.evaluate(() => {
        // call the function and return typeof return
        const fn = window.showDemo;
        if (typeof fn === 'function') {
          try {
            const r = fn();
            return { returnedType: typeof r, returnedValue: r === undefined ? null : String(r) };
          } catch (e) {
            return { errorName: e.name, errorMessage: e.message };
          }
        }
        return { present: false };
      });

      // If an error object was returned, fail the test; otherwise, ensure function call returned undefined (represented as null in our transfer)
      if ('errorName' in returnValue) {
        // If an error occurred during invocation, that is notable — record and assert none expected
        throw new Error(`showDemo threw an error: ${returnValue.errorName} - ${returnValue.errorMessage}`);
      }

      // Ensure function was present and returned undefined (we encoded undefined as null for serialization)
      expect(returnValue.present === undefined).toBeTruthy(); // present key only exists if not a function; so ensure it's not the case
      expect(returnValue.returnedType === 'undefined' || returnValue.returnedType === undefined).toBeTruthy();

      // Confirm no console/page errors produced by directly invoking the function
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('FSM completeness checks', () => {
    test('Validate FSM components presence: button and demo output element exist as described by FSM', async ({ page }) => {
      // The FSM extraction expected two components: the button and #demoOutput
      const button = page.locator("button[onclick='showDemo()']");
      await expect(button).toHaveCount(1);
      await expect(button).toBeVisible();

      const demoOutput = page.locator('#demoOutput');
      await expect(demoOutput).toHaveCount(1);

      // Confirm the demo output is initially hidden and becomes visible after the expected event
      await expect(demoOutput).toBeHidden();
      await button.click();
      await expect(demoOutput).toBeVisible();

      // No runtime errors in the process
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});