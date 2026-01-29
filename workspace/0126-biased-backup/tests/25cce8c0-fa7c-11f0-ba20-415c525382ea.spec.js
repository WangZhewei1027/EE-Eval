import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cce8c0-fa7c-11f0-ba20-415c525382ea.html';

test.describe('Load Balancing Demo (FSM: Idle <-> Simulating)', () => {
  let consoleErrors;
  let pageErrors;

  // Setup: navigate to the page and start collecting console/page errors
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect only error-level console messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : undefined
          });
        }
      } catch (e) {
        // Defensive: if msg.type() throws, still record something
        consoleErrors.push({ text: `console.msg.type() access failed: ${String(e)}` });
      }
    });

    // Collect uncaught exceptions and page errors
    page.on('pageerror', err => {
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });

    await page.goto(APP_URL);
    // Ensure the page is loaded and initial DOM is present
    await expect(page.locator('#simulateBtn')).toBeVisible();
    await expect(page.locator('#server1')).toBeVisible();
    await expect(page.locator('#server2')).toBeVisible();
    await expect(page.locator('#server3')).toBeVisible();
  });

  // Teardown: after each test assert there were no unexpected runtime errors
  test.afterEach(async () => {
    // These assertions ensure we observed console/page errors (if any).
    // Common expected behavior for a healthy page is zero console errors and zero page errors.
    // If errors exist, they will cause the test to fail and their details are available in the test output.
    expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Initial Idle state: page renders correctly with zero loads and no requests', async ({ page }) => {
    // Validate Idle state UI elements and evidence expected in FSM S0_Idle
    // Check the simulate button is present and matches accessibility attributes
    const simulateBtn = page.locator('#simulateBtn');
    await expect(simulateBtn).toHaveAttribute('aria-label', 'Simulate Round Robin');
    await expect(simulateBtn).toHaveText('Simulate Round Robin');

    // Check that load indicators start at 0
    await expect(page.locator('#load1')).toHaveText('Load: 0');
    await expect(page.locator('#load2')).toHaveText('Load: 0');
    await expect(page.locator('#load3')).toHaveText('Load: 0');

    // There should not be any .request-container elements initially
    const requests = page.locator('.request-container');
    await expect(requests).toHaveCount(0);

    // Validate accessibility attributes on demo container
    await expect(page.locator('#demo')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#demo')).toHaveAttribute('aria-atomic', 'true');
    await expect(page.locator('#demo')).toHaveAttribute('aria-relevant', 'additions');
  });

  test('Transition S0_Idle -> S1_Simulating: clicking Simulate Round Robin creates 9 requests in round robin order', async ({ page }) => {
    // Click the simulate button to enter Simulating state
    const simulateBtn = page.locator('#simulateBtn');
    await simulateBtn.click();

    // After simulation, each server should have Load: 3 (9 requests, 3 servers, strict round robin)
    await expect(page.locator('#load1')).toHaveText('Load: 3');
    await expect(page.locator('#load2')).toHaveText('Load: 3');
    await expect(page.locator('#load3')).toHaveText('Load: 3');

    // There should be exactly 9 .request-container elements across all servers
    await expect(page.locator('.request-container')).toHaveCount(9);

    // Each server should have a .requests-area container with 3 children
    const server1Requests = page.locator('#server1 .requests-area .request-container');
    const server2Requests = page.locator('#server2 .requests-area .request-container');
    const server3Requests = page.locator('#server3 .requests-area .request-container');

    await expect(server1Requests).toHaveCount(3);
    await expect(server2Requests).toHaveCount(3);
    await expect(server3Requests).toHaveCount(3);

    // Verify the text content of some of the request elements to ensure ordering
    // Request IDs assigned are 1..9 in round robin: Server1 should have 1,4,7; Server2 2,5,8; Server3 3,6,9
    const s1Texts = await server1Requests.allTextContents();
    const s2Texts = await server2Requests.allTextContents();
    const s3Texts = await server3Requests.allTextContents();

    // Trim and compare numeric text content
    const normalize = arr => arr.map(t => t.trim()).sort((a,b) => Number(a) - Number(b));
    expect(normalize(s1Texts)).toEqual(['1','4','7']);
    expect(normalize(s2Texts)).toEqual(['2','5','8']);
    expect(normalize(s3Texts)).toEqual(['3','6','9']);
  });

  test('Transition S1_Simulating -> S0_Idle on subsequent click: clears previous requests then re-runs simulation', async ({ page }) => {
    const simulateBtn = page.locator('#simulateBtn');

    // First click: create simulation artifacts
    await simulateBtn.click();
    await expect(page.locator('.request-container')).toHaveCount(9);

    // Capture references to the existing DOM nodes' texts to confirm removal later
    const initialRequestTexts = await page.locator('.request-container').allTextContents();

    // Second click: simulateRoundRobin should clear previous requests (clearRequests()) then create new ones
    await simulateBtn.click();

    // After second click, still exactly 9 request containers (the old ones should have been removed)
    await expect(page.locator('.request-container')).toHaveCount(9);

    const newRequestTexts = await page.locator('.request-container').allTextContents();

    // The textual content (IDs) should match the same distribution but be different DOM nodes.
    // We can't directly compare node identity, but we can assert that the sequence of texts matches '1'..'9' distribution.
    const allTextsSorted = arr => arr.map(t => t.trim()).sort((a,b) => Number(a) - Number(b));
    expect(allTextsSorted(initialRequestTexts)).toEqual(allTextsSorted(newRequestTexts));

    // Ensure loads still read 3 each after second run (reset happened then reassigned)
    await expect(page.locator('#load1')).toHaveText('Load: 3');
    await expect(page.locator('#load2')).toHaveText('Load: 3');
    await expect(page.locator('#load3')).toHaveText('Load: 3');
  });

  test('Edge case: rapid repeated clicks do not accumulate requests and do not throw errors', async ({ page }) => {
    const simulateBtn = page.locator('#simulateBtn');

    // Rapidly click the button multiple times
    // Use a short loop; ensure we await each click to let DOM update; this simulates fast user clicks
    for (let i = 0; i < 5; i++) {
      await simulateBtn.click();
    }

    // Regardless of number of clicks, the implementation resets and produces 9 requests each time,
    // so we expect exactly 9 request containers now (not e.g., 45)
    await expect(page.locator('.request-container')).toHaveCount(9);

    // Loads should be correct
    await expect(page.locator('#load1')).toHaveText('Load: 3');
    await expect(page.locator('#load2')).toHaveText('Load: 3');
    await expect(page.locator('#load3')).toHaveText('Load: 3');

    // Confirm no runtime page errors or console.error occurrences were recorded in this scenario
    // (final assertions live in afterEach hook)
  });

  test('Verifies demo area and server visual elements remain present and accessible after simulation', async ({ page }) => {
    // Enter simulating state
    await page.locator('#simulateBtn').click();

    // Servers should retain their role and aria-label attributes and contain the requests-area elements
    for (const id of ['server1', 'server2', 'server3']) {
      const server = page.locator(`#${id}`);
      await expect(server).toBeVisible();
      await expect(server).toHaveAttribute('aria-label', new RegExp('Server'));
      // Each server should have a .requests-area container created by simulateRoundRobin
      await expect(server.locator('.requests-area')).toBeVisible();
    }

    // The demo container's aria-live attribute should remain unchanged
    await expect(page.locator('#demo')).toHaveAttribute('aria-live', 'polite');
  });

  test('Observes console and page error streams during interactions (captures and asserts none present)', async ({ page }) => {
    // This test explicitly validates that console errors and page errors are captured by our listeners.
    // It performs a normal interaction and relies on the afterEach hook to assert zero errors.
    await page.locator('#simulateBtn').click();

    // Add a small wait to allow asynchronous errors (if any) to surface
    await page.waitForTimeout(200);

    // Validate at least that our listener arrays are defined and of type Array
    expect(Array.isArray(consoleErrors)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // The actual assertion for zero errors is handled in afterEach to ensure it runs consistently.
  });
});