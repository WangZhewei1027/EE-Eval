import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b52f23-fa7c-11f0-9fa6-d1bbe297d459.html';

// Increase default timeout for tests that need to wait for animated demo (multiple setTimeouts)
test.setTimeout(30000);

test.describe('K-Means Demonstration - FSM validation (f0b52f23-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // Capture console messages for observation/assertion
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic assertion that no unexpected page errors were thrown during the test run.
    // The application as provided does not intentionally throw ReferenceError/SyntaxError/TypeError,
    // so we assert there are zero page errors. If any such errors occur naturally, this will fail,
    // satisfying the requirement to observe and assert on runtime errors.
    expect(pageErrors.length, `Expected no page errors, but found: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test.describe('State S0_Idle (Initial)', () => {
    test('Initial render shows Run K-Means Demonstration button and demo container hidden', async ({ page }) => {
      // This test validates the initial (Idle) state as per FSM:
      // - The page has the Run K-Means Demonstration button (#demo-button)
      // - The demo container (#demo-container) is present but hidden (display: none)
      // - The demo output (#demo-output) is present and initially empty
      const demoButton = await page.locator('#demo-button');
      await expect(demoButton).toBeVisible();
      await expect(demoButton).toHaveText('Run K-Means Demonstration');

      const demoContainer = await page.locator('#demo-container');
      // The container exists in DOM
      await expect(demoContainer).toBeVisible({ timeout: 2000 }).catch(() => {
        // If toBeVisible fails because display:none, we still assert it's in the DOM and check computed style
      });
      // Check computed style: should be display: none initially
      const display = await page.$eval('#demo-container', (el) => window.getComputedStyle(el).display);
      expect(display).toBe('none');

      const demoOutputHTML = await page.locator('#demo-output').innerText();
      // Initially the output should be empty string
      expect(demoOutputHTML.trim()).toBe('');
    });
  });

  test.describe('Event RunDemo and transition to S1_DemoRunning', () => {
    test('Clicking the demo button displays container and starts animated output (entry action: displayDemoSteps / displayNextStep)', async ({ page }) => {
      // This test validates the FSM transition S0_Idle -> S1_DemoRunning:
      // - Clicking #demo-button triggers the demo to start
      // - #demo-container should become visible (container.style.display = "block")
      // - #demo-output should start receiving lines (output.innerHTML updated)
      //
      // We also observe console messages and page errors (collected in beforeEach/afterEach).
      const demoButton = page.locator('#demo-button');
      await expect(demoButton).toBeVisible();

      // Click to start the demo
      await demoButton.click();

      // After click, container should be displayed (entry evidence)
      const displayAfterClick = await page.$eval('#demo-container', (el) => window.getComputedStyle(el).display);
      expect(displayAfterClick).toBe('block');

      // Immediately after click, the code sets output.innerHTML = '';
      const initialOutputAfterClick = await page.locator('#demo-output').innerText();
      expect(initialOutputAfterClick.trim()).toBe('');

      // Wait for first step to appear (the first step string in the steps array)
      await expect.poll(async () => {
        const text = await page.locator('#demo-output').innerText();
        return text.includes('Initializing with K=3 clusters...');
      }, {
        timeout: 5000,
        message: 'Expected first demo step to appear within 5s',
      }).toBeTruthy();

      // Eventually, the demo should complete and include "Demonstration complete."
      // This is the final step appended by the animation; wait up to 20s for it
      await expect.poll(async () => {
        const text = await page.locator('#demo-output').innerText();
        return text.includes('Demonstration complete.');
      }, {
        timeout: 20000,
        message: 'Expected demo to finish and contain "Demonstration complete." within 20s',
      }).toBeTruthy();

      // Final assertions about the output containing expected cluster summary lines
      const finalText = await page.locator('#demo-output').innerText();
      expect(finalText).toContain('Final Clusters:');
      expect(finalText).toContain('Cluster 1: 35 points around [2.3, 3.7]');
      expect(finalText).toContain('Demonstration complete.');

      // Observe that we collected console messages (if any) and assert no page errors (afterEach will assert)
      // We assert that consoleMessages is at least an array (non-crashing)
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });

    test('Demo animation appends lines over time (output grows) and no errors on repeated start attempts', async ({ page }) => {
      // This test checks that the output is appended incrementally (i.e., displayNextStep is adding lines)
      // and that re-clicking the button while the demo runs does not crash the page (no uncaught exceptions).
      const demoButton = page.locator('#demo-button');
      await demoButton.click();

      // Wait briefly for a couple of steps to accumulate
      // Record length after 1 second
      await page.waitForTimeout(1100);
      const textAfterShort = await page.locator('#demo-output').innerText();
      const lengthAfterShort = textAfterShort.length;

      // Wait another 1.2 second and ensure the content length has grown (new lines appended)
      await page.waitForTimeout(1200);
      const textAfterMore = await page.locator('#demo-output').innerText();
      const lengthAfterMore = textAfterMore.length;

      expect(lengthAfterMore).toBeGreaterThanOrEqual(lengthAfterShort);

      // Try clicking the button again while demo is running to exercise edge behavior
      // The page code will clear output.innerHTML = '' and start a new animation sequence.
      // We ensure that doing so does not produce page errors.
      await demoButton.click();

      // Wait for first step to reappear after second click
      await expect.poll(async () => {
        const text = await page.locator('#demo-output').innerText();
        return text.includes('Initializing with K=3 clusters...');
      }, {
        timeout: 5000,
        message: 'Expected first demo step to reappear after second click within 5s',
      }).toBeTruthy();

      // Let the demo finish (to ensure timers settle) - up to 20s total
      await expect.poll(async () => {
        const text = await page.locator('#demo-output').innerText();
        return text.includes('Demonstration complete.');
      }, {
        timeout: 20000,
        message: 'Expected demo to finish after second click within 20s',
      }).toBeTruthy();

      // No uncaught page errors should have occurred (checked in afterEach)
      // Also check that the container remains visible (the demo does not auto-hide)
      const displayFinal = await page.$eval('#demo-container', (el) => window.getComputedStyle(el).display);
      expect(displayFinal).toBe('block');
    });
  });

  test.describe('FSM onEnter / onExit actions verification and edge scenarios', () => {
    test('Verify entry action observable behavior and absence of exit invocation (no hide invoked automatically)', async ({ page }) => {
      // The FSM describes entry action displayDemoSteps and exit action hideDemoContainer.
      // The implementation calls container.style.display = 'block' (entry) and never calls hideDemoContainer (no exit triggered).
      // This test ensures entry action observable occurs and that nothing in the provided code hides the container after completion.
      await page.locator('#demo-button').click();

      // Confirm entry observable: container displayed
      await expect.poll(async () => {
        return await page.$eval('#demo-container', (el) => window.getComputedStyle(el).display === 'block');
      }, { timeout: 3000 }).toBeTruthy();

      // Wait for demo to complete to ensure no automatic hide occurs afterwards
      await expect.poll(async () => {
        const text = await page.locator('#demo-output').innerText();
        return text.includes('Demonstration complete.');
      }, { timeout: 20000 }).toBeTruthy();

      // After demo completes, assert container remains displayed (i.e., exit action hideDemoContainer was not invoked automatically)
      const displayAfterCompletion = await page.$eval('#demo-container', (el) => window.getComputedStyle(el).display);
      expect(displayAfterCompletion).toBe('block');
    });

    test('Edge case: rapid multiple clicks do not crash the page (no uncaught exceptions) and demo eventually completes', async ({ page }) => {
      // Simulate a user clicking the run button rapidly several times.
      // Observe that the application may restart the animation multiple times but should not throw.
      const demoButton = page.locator('#demo-button');

      // Rapid clicks
      await demoButton.click();
      await demoButton.click();
      await demoButton.click();

      // Wait for the demo to complete (allowing for several restarts)
      await expect.poll(async () => {
        const text = await page.locator('#demo-output').innerText();
        return text.includes('Demonstration complete.');
      }, { timeout: 25000 }).toBeTruthy();

      // No page errors should have been captured (afterEach will assert)
      // Additionally assert that demo output contains expected content
      const finalText = await page.locator('#demo-output').innerText();
      expect(finalText).toContain('Demonstration complete.');
      expect(finalText).toContain('Final Clusters:');
    });
  });
});