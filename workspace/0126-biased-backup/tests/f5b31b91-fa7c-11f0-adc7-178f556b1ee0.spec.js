import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b31b91-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('f5b31b91-fa7c-11f0-adc7-178f556b1ee0 - Socket Programming FSM tests', () => {
  // Arrays to collect page errors and console messages for assertions
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleMessages = [];

    // Observe runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // store the Error object for later inspection
      pageErrors.push(err);
    });

    // Observe console messages (logs, errors, warnings, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Navigate to the page (this will execute the page script as-is)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // no special teardown required; keep this hook to satisfy structure and future extension
  });

  test('Idle state (S0_Idle) is rendered correctly on page load', async ({ page }) => {
    // This test validates the initial/idle state: page rendered, entry actions (renderPage)
    // The evidence for idle state includes the presence of the "Demonstrate Socket Programming" button.
    const h1 = await page.locator('h1');
    await expect(h1).toHaveText('Socket Programming');

    const demoButton = page.locator('#socket-demo');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Demonstrate Socket Programming');

    // Verify that the page includes the step list that documents the socket process
    const listItems = await page.locator('ol li').allInnerTexts();
    // The FSM expects these observables: Establish a connection, Send data, Receive data, Close connection
    expect(listItems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Establish a connection'),
        expect.stringContaining('Send data'),
        expect.stringContaining('Receive data'),
        expect.stringContaining('Close the connection')
      ])
    );

    // On initial load we expect no uncaught errors yet (the runtime error occurs when the demo is invoked)
    expect(pageErrors.length).toBe(0);

    // There may be console informational messages regarding page load; ensure none include 'Server response:' yet.
    const anyServerResponse = consoleMessages.some(m => m.text.includes('Server response:'));
    expect(anyServerResponse).toBeFalsy();
  });

  test('SocketDemoStart event - clicking the socket demo button triggers socketDemo() and results in a ReferenceError (Socket undefined)', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_SocketDemo when the button is clicked.
    // It also observes the runtime error naturally produced by the page implementation (Socket is not defined).

    // Ensure button exists before clicking
    const demoButton = page.locator('#socket-demo');
    await expect(demoButton).toBeVisible();

    // Click the button and await the uncaught page error produced by the page's socketDemo function.
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      demoButton.click()
    ]);

    // Assert that a runtime error occurred and includes expected clues
    // Different browsers may format the message differently; be resilient in checks.
    const msg = String(err?.message ?? err);
    expect(msg.toLowerCase()).toContain('socket'); // should mention Socket
    expect(msg.toLowerCase()).toMatch(/not defined|is not defined|undefined/);

    // Also confirm that no "Server response:" console log was emitted (because execution should fail before that point)
    const serverResponseLogs = consoleMessages.filter(m => m.text.includes('Server response:'));
    expect(serverResponseLogs.length).toBe(0);

    // The button should remain in the DOM and still be interactable after the error
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Demonstrate Socket Programming');
  });

  test('Multiple clicks produce multiple runtime errors (edge case)', async ({ page }) => {
    // This test checks repeated triggering of the transition/event and ensures errors occur each time
    const demoButton = page.locator('#socket-demo');
    await expect(demoButton).toBeVisible();

    // Click and await first error
    const firstErr = await Promise.all([
      page.waitForEvent('pageerror'),
      demoButton.click()
    ]);
    expect(String(firstErr[0].message ?? firstErr[0]).toLowerCase()).toContain('socket');

    // Click a second time and await second error
    const secondErr = await Promise.all([
      page.waitForEvent('pageerror'),
      demoButton.click()
    ]);
    expect(String(secondErr[0].message ?? secondErr[0]).toLowerCase()).toContain('socket');

    // Click a third time and await third error
    const thirdErr = await Promise.all([
      page.waitForEvent('pageerror'),
      demoButton.click()
    ]);
    expect(String(thirdErr[0].message ?? thirdErr[0]).toLowerCase()).toContain('socket');

    // Ensure we have recorded at least three pageErrors in our listener array
    // Note: pageErrors is populated by the beforeEach listener and should reflect these three errors.
    expect(pageErrors.length).toBeGreaterThanOrEqual(3);

    // The DOM should remain unchanged: the button text remains the same
    await expect(demoButton).toHaveText('Demonstrate Socket Programming');
  });

  test('Validate textual evidence and expected observables are present in the DOM', async ({ page }) => {
    // Ensure the explanatory text and algorithm steps exist as they are part of the FSM evidence
    await expect(page.locator('text=Socket programming is a technique')).toBeVisible();

    // Check that the "Socket Programming Algorithms" section exists and enumerates items
    const algSection = page.locator('h2', { hasText: 'Socket Programming Algorithms' });
    await expect(algSection).toBeVisible();

    const algorithmItems = await page.locator('h2:has-text("Socket Programming Algorithms") + ul li').allInnerTexts();
    // Validate that at least the general items are present; be forgiving about exact phrasing
    expect(algorithmItems.length).toBeGreaterThanOrEqual(1);

    // Confirm the list describing the socket procedure (the ordered list) contains the four major steps
    const orderedText = await page.locator('ol').innerText();
    expect(orderedText).toContain('Establish a connection');
    expect(orderedText).toContain('Send data');
    expect(orderedText).toContain('Receive data');
    expect(orderedText).toContain('Close the connection');
  });

  test('Observes console and page errors without modifying page environment (ensures we do not patch runtime)', async ({ page }) => {
    // This test explicitly validates that we are only observing runtime behavior and not patching or injecting anything.
    // We confirm that the global window does not get new helpers injected by the test harness and that clicking produces native errors.

    // Confirm that our test did not add any global variable used by the page (e.g., no global "Socket" from the test)
    const hasSocketGlobal = await page.evaluate(() => typeof window.Socket !== 'undefined');
    // The page itself expects Socket to be undefined (that's why clicking throws). We assert it is false.
    expect(hasSocketGlobal).toBe(false);

    // Now trigger the demo and ensure the pageerror occurs naturally (no intervention)
    const demoButton = page.locator('#socket-demo');
    await expect(demoButton).toBeVisible();

    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      demoButton.click()
    ]);

    // Make assertions about the natural runtime error
    const errMsg = String(err?.message ?? err);
    expect(errMsg.toLowerCase()).toMatch(/socket.*not defined|not defined.*socket|undefined/);

    // Confirm that we observed console messages from the page (if any) but did not inject any messages ourselves
    // For safety, ensure at least our consoleMessages array exists and is an array
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});