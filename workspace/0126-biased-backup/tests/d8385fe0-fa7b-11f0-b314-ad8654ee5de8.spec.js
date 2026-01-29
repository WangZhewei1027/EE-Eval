import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8385fe0-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('FSM: Indexing — demo toggle (d8385fe0-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Helper to attach listeners and reset collections
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages with their types
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the exact HTML page as provided
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  // After each test, assert that there were no uncaught page errors and no console.error messages.
  test.afterEach(async () => {
    // Fail the test if any uncaught page errors were emitted
    expect(pageErrors, 'No uncaught page errors should have occurred').toHaveLength(0);

    // Ensure there are no console.error messages emitted by the page during the test
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsole, `No console warnings/errors expected, found: ${JSON.stringify(errorConsole)}`).toHaveLength(0);
  });

  test('Initial state S0_Idle: renders toggle button and demo output is hidden', async ({ page }) => {
    // Validate initial button exists and matches FSM evidence
    const demoBtn = await page.locator('#demoBtn');
    await expect(demoBtn).toHaveCount(1);
    await expect(demoBtn).toBeVisible();

    // Button initial text per FSM/component evidence
    await expect(demoBtn).toHaveText('Show simple inverted index output');

    // aria-expanded should be false initially
    await expect(demoBtn).toHaveAttribute('aria-expanded', 'false');

    // Demo output element should exist and be hidden (display:none) with aria-hidden true
    const demoOut = await page.locator('#demoOutput');
    await expect(demoOut).toHaveCount(1);

    // Read computed style.display via evaluate to confirm 'none'
    const display = await demoOut.evaluate(el => getComputedStyle(el).display);
    expect(display, 'Demo output should be hidden initially (display: none)').toBe('none');

    // Attribute aria-hidden should be true initially per FSM
    await expect(demoOut).toHaveAttribute('aria-hidden', 'true');

    // Verify the FSM entry action "renderPage()" is not present as a callable function on window.
    // The FSM mentioned renderPage() as an entry action; the page's script does not define it.
    const renderPageExists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(renderPageExists, 'renderPage should not be defined on window (no automatic call expected in this HTML)').toBe(false);
  });

  test('Transition S0 -> S1: clicking #demoBtn shows demo output and updates button attributes and text', async ({ page }) => {
    const demoBtn = page.locator('#demoBtn');
    const demoOut = page.locator('#demoOutput');

    // Click the button to toggle demo visible
    await demoBtn.click();

    // After click, demoOut display should be 'block'
    const displayAfter = await demoOut.evaluate(el => getComputedStyle(el).display);
    expect(displayAfter, 'After clicking, demo output should be visible (display: block)').toBe('block');

    // Button text should change to 'Hide inverted index output'
    await expect(demoBtn).toHaveText('Hide inverted index output');

    // aria-expanded should be true
    await expect(demoBtn).toHaveAttribute('aria-expanded', 'true');

    // demoOutput aria-hidden should be 'false'
    await expect(demoOut).toHaveAttribute('aria-hidden', 'false');

    // Check that demoOutput contains expected textual content from the HTML (basic sanity)
    const demoText = (await demoOut.textContent()) || '';
    expect(demoText.includes('"the"'), 'Demo output should contain "the" term representation').toBe(true);
    expect(demoText.includes('"quick"'), 'Demo output should contain "quick" term representation').toBe(true);
  });

  test('Transition S1 -> S0: clicking #demoBtn again hides demo output and restores initial button state', async ({ page }) => {
    const demoBtn = page.locator('#demoBtn');
    const demoOut = page.locator('#demoOutput');

    // Show first
    await demoBtn.click();
    // Hide again
    await demoBtn.click();

    // After second click, demoOut should be hidden again
    const displayAfter = await demoOut.evaluate(el => getComputedStyle(el).display);
    expect(displayAfter, 'After second click, demo output should be hidden again (display: none)').toBe('none');

    // Button text restored
    await expect(demoBtn).toHaveText('Show simple inverted index output');

    // aria-expanded back to false
    await expect(demoBtn).toHaveAttribute('aria-expanded', 'false');

    // demoOutput aria-hidden should be 'true' again
    await expect(demoOut).toHaveAttribute('aria-hidden', 'true');
  });

  test('Edge case: rapid multiple clicks toggle state predictably (odd -> visible, even -> hidden)', async ({ page }) => {
    const demoBtn = page.locator('#demoBtn');
    const demoOut = page.locator('#demoOutput');

    // Perform 5 rapid clicks. Starting from hidden -> odd number (5) should result in visible.
    for (let i = 0; i < 5; i++) {
      // Use Promise.all to avoid awaiting each click sequentially to simulate rapid user clicks,
      // but to preserve deterministic behavior we await each click here (rapid but sequential).
      await demoBtn.click();
    }

    // After 5 clicks, expect visible
    const displayAfter5 = await demoOut.evaluate(el => getComputedStyle(el).display);
    expect(displayAfter5, 'After 5 rapid clicks, demo output should be visible').toBe('block');
    await expect(demoBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(demoBtn).toHaveText('Hide inverted index output');

    // Now click one more time to make it 6 clicks total (even -> hidden)
    await demoBtn.click();
    const displayAfter6 = await demoOut.evaluate(el => getComputedStyle(el).display);
    expect(displayAfter6, 'After 6 clicks, demo output should be hidden').toBe('none');
    await expect(demoBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(demoBtn).toHaveText('Show simple inverted index output');
  });

  test('Event handler behavior: ensures toggle works repeatedly (listener once:false allows multiple toggles)', async ({ page }) => {
    const demoBtn = page.locator('#demoBtn');
    const demoOut = page.locator('#demoOutput');

    // Toggle several times to ensure listener wasn't added with once:true (it should allow multiple toggles)
    const iterations = 4;
    for (let i = 0; i < iterations; i++) {
      await demoBtn.click();
      // small check after each click
      const displayNow = await demoOut.evaluate(el => getComputedStyle(el).display);
      const expectedDisplay = (i % 2 === 0) ? 'block' : 'none';
      expect(displayNow, `Iteration ${i + 1}: display should be ${expectedDisplay}`).toBe(expectedDisplay);
    }

    // Final expected state after 4 toggles: even => back to initial hidden
    const finalDisplay = await demoOut.evaluate(el => getComputedStyle(el).display);
    expect(finalDisplay, 'After 4 toggles, demo output should be hidden').toBe('none');
  });

  test('Observability: capture console messages and page errors during interactions (no unexpected errors)', async ({ page }) => {
    const demoBtn = page.locator('#demoBtn');

    // Interact to potentially trigger any console output or errors
    await demoBtn.click();
    await demoBtn.click();

    // There should be no page errors captured
    expect(pageErrors.length, `Expected no page errors, found: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Ensure console did not emit any 'error' or 'warning' level entries
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errors.length, `Console should not contain errors/warnings, found: ${JSON.stringify(errors)}`).toBe(0);

    // But we should have captured at least some console entries if the page logged anything; the page's script does not log normally.
    // This assertion is non-blocking for correctness: we allow zero console logs but ensure our capture mechanism works by checking the array exists.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});