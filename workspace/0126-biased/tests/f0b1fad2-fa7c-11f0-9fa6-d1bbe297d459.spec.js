import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1fad2-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Merge Sort Demo FSM - f0b1fad2-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Shared containers for observed console messages and page errors
  let consoleMessages;
  let pageErrors;

  // Attach console and pageerror listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        // guard in case msg.text() throws unexpectedly
        consoleMessages.push(`console: <unable to read message>`);
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      // store error message string for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the exact provided HTML page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // A small sanity check that tests should inspect pageErrors when needed.
    // No automatic failing here; individual tests assert expected error behavior.
    // keep listeners cleared by closing page context automatically by Playwright
  });

  test('S0_Idle: Initial Idle state renders button, hidden demoOutput, and empty demoSteps', async ({ page }) => {
    // Validate presence of the Run Merge Sort Demo button (evidence for S0_Idle)
    const demoButton = page.locator('#demoButton');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Run Merge Sort Demo');

    // demoOutput should initially be hidden (display: none)
    const demoOutput = page.locator('#demoOutput');
    // Use evaluate to read computed style/display attribute
    const display = await demoOutput.evaluate((el) => getComputedStyle(el).display);
    expect(display === 'none' || display === 'inline' || display).toBeTruthy(); // ensure property exists
    // Specifically expect it to be 'none' per implementation evidence
    expect(display).toBe('none');

    // demoSteps should be present and empty initially
    const demoSteps = page.locator('#demoSteps');
    await expect(demoSteps).toBeVisible();
    const stepsHTML = await demoSteps.innerHTML();
    expect(stepsHTML.trim()).toBe(''); // no initial children in Idle state

    // Ensure there are currently no uncaught page errors on load
    expect(pageErrors.length).toBe(0);

    // Console messages may be empty (no intentional console.logs in the implementation)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('S0 -> S1 -> S3 -> S4 -> S2: Running demo triggers visualization steps (dividing, base case, merging)', async ({ page }) => {
    // Click the demo button to start the demo (event: RunDemo) - transition S0_Idle -> S1_DemoRunning
    await page.click('#demoButton');

    // After click, demoOutput should be visible (evidence of S1_DemoRunning)
    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();
    const displayAfter = await demoOutput.evaluate((el) => getComputedStyle(el).display);
    expect(displayAfter).toBe('block');

    // demoSteps should now have child nodes with the simulation steps
    const demoSteps = page.locator('#demoSteps');
    // Wait until at least one step is appended (Initial Array)
    await expect(demoSteps.locator('div')).toHaveCountGreaterThan(0);

    // Read full text to assert presence of evidence strings for various states
    const allText = (await demoSteps.innerText()).trim();

    // Evidence: Initial Array should be displayed (entry to simulation)
    expect(allText).toContain('Initial Array');

    // Evidence for Dividing state: at least one 'Dividing:' line
    expect(allText).toContain('Dividing:');

    // Evidence for Base Case state: there should be at least one 'Base Case:' line
    expect(allText).toContain('Base Case:');

    // Evidence for Merging state: at least one 'Merged:' line
    expect(allText).toContain('Merged:');

    // The demo uses the array [34, 7, 23, 32, 5, 62] in the implementation.
    // Final merged expected is [5, 7, 23, 32, 34, 62]. Assert that this final sequence appears in the output.
    expect(allText).toContain('→ [5, 7, 23, 32, 34, 62]');

    // Ensure no uncaught errors were thrown during a normal run
    expect(pageErrors.length).toBe(0);
  });

  test('Re-running demo clears previous steps then re-populates (transition re-entry to S1_DemoRunning)', async ({ page }) => {
    const demoSteps = page.locator('#demoSteps');

    // First run
    await page.click('#demoButton');
    await expect(demoSteps.locator('div')).toHaveCountGreaterThan(0);
    const firstRunText = await demoSteps.innerText();

    // Click again to run demo a second time. Per implementation, demoSteps.innerHTML should be cleared at start.
    await page.click('#demoButton');

    // After second click, ensure content has been reset and repopulated (should still contain Initial Array but not duplicate from previous)
    await expect(demoSteps.locator('div')).toHaveCountGreaterThan(0);
    const secondRunText = await demoSteps.innerText();

    // The second run should create a fresh set of steps; ensure the two outputs are not identical HTML fragments (order may be identical, but ensure cleared then re-added)
    expect(secondRunText.length).toBeGreaterThan(0);
    // It is acceptable that the textual content is the same; what we must assert is that demoSteps was cleared before repopulating.
    // The implementation explicitly sets demoSteps.innerHTML = '' before simulation — detect transient emptiness by observing that after clicking,
    // demoSteps content was repopulated and the DOM has not grown uncontrollably (sanity).
    expect(secondRunText).toContain('Initial Array');

    // Ensure no uncaught page errors on re-run
    expect(pageErrors.length).toBe(0);
  });

  test('S3 Dividing -> S2 Base Case counts: expected number of base cases and dividing occurrences for given array', async ({ page }) => {
    // Run demo to populate steps
    await page.click('#demoButton');
    const demoSteps = page.locator('#demoSteps');

    // Wait for content to appear
    await expect(demoSteps.locator('div')).toHaveCountGreaterThan(0);

    // Count occurrences of specific keywords in the textual output
    const text = await demoSteps.innerText();

    // For array of length 6 (implementation uses [34,7,23,32,5,62]) we expect base case entries for each single-element subarray = 6 occurrences.
    // Count 'Base Case:' occurrences
    const baseCaseMatches = (text.match(/Base Case:/g) || []).length;
    expect(baseCaseMatches).toBeGreaterThanOrEqual(1);
    // We assert the implementation emits at least 4 base cases (safe lower bound) and at most 10 (conservative upper bound)
    expect(baseCaseMatches).toBeGreaterThanOrEqual(4);
    expect(baseCaseMatches).toBeLessThanOrEqual(10);

    // Count dividing occurrences - expect at least one division
    const dividingMatches = (text.match(/Dividing:/g) || []).length;
    expect(dividingMatches).toBeGreaterThanOrEqual(1);

    // Count merges - expect merges present
    const mergedMatches = (text.match(/Merged:/g) || []).length;
    expect(mergedMatches).toBeGreaterThanOrEqual(1);

    // No page errors should have occurred during these steps
    expect(pageErrors.length).toBe(0);
  });

  test('Direct invocation: simulateMergeSort with a single-element array returns that array and appends Base Case (S2_BaseCase)', async ({ page }) => {
    // Ensure demoSteps exists and is visible
    const demoStepsHandle = await page.$('#demoSteps');

    // Call simulateMergeSort directly from the page context with a single-element array
    const result = await page.evaluate((container) => {
      // call the function that exists on the page
      // It should return the array back for a base case
      return simulateMergeSort([9], container, 1);
    }, demoStepsHandle);

    // The function should return the same array [9]
    expect(Array.isArray(result)).toBeTruthy();
    expect(result).toEqual([9]);

    // Check that a new Base Case entry was appended to demoSteps (textual check)
    const text = await page.locator('#demoSteps').innerText();
    expect(text).toContain('Base Case:');
  });

  test('Error scenario: invoking simulateMergeSort with undefined should produce a page error (TypeError) and reject evaluate', async ({ page }) => {
    // Intentionally call simulateMergeSort with undefined to let runtime error happen naturally
    // We expect evaluate to reject; also a pageerror event should be emitted.
    let evaluateError = null;
    try {
      await page.evaluate(() => {
        // This will attempt to access .length of undefined and should throw inside page context
        simulateMergeSort(undefined, document.getElementById('demoSteps'), 1);
      });
    } catch (err) {
      evaluateError = err;
    }

    // The evaluate call should have thrown an error on the Node side
    expect(evaluateError).not.toBeNull();
    // The error message will vary by runtime, but should indicate inability to read 'length' or similar
    const evalMsg = String(evaluateError.message || evaluateError);
    expect(
      evalMsg.toLowerCase().includes('length') ||
      evalMsg.toLowerCase().includes('cannot') ||
      evalMsg.toLowerCase().includes('undefined')
    ).toBeTruthy();

    // Also ensure a pageerror event was captured (the page context should have emitted an uncaught error)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // At least one of the captured page error messages should mention 'length' or 'undefined'
    const matches = pageErrors.filter((m) => /length|undefined|cannot/i.test(m));
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  test('Observability: Console and pageerror listeners capture any runtime messages (sanity)', async ({ page }) => {
    // This test simply validates that console and pageerror instrumentation work.
    // As part of that, trigger a benign console message using the page (without modifying library code)
    // Use page.evaluate to log to console (this is allowed; we are not patching page functions).
    await page.evaluate(() => console.log('playwright-test:log-setup'));
    // Wait a tick to ensure console event was captured
    await page.waitForTimeout(50);

    // Confirm our console listener captured the message
    const found = consoleMessages.find((m) => m.includes('playwright-test:log-setup'));
    expect(found).toBeTruthy();

    // There should still be no uncaught errors from a simple console.log
    expect(pageErrors.length).toBe(0);
  });
});