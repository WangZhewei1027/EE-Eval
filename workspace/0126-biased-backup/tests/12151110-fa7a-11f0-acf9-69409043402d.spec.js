import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12151110-fa7a-11f0-acf9-69409043402d.html';

test.describe('Two Pointers Interactive Explorer (FSM driven)', () => {
  // Capture console messages and page errors for each test to observe runtime issues.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection.
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If something odd happens while reading, still record generic info.
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (uncaught exceptions).
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page.
    await page.goto(APP_URL, { waitUntil: 'load' });
    // allow any on-load initialization to run
    await page.waitForTimeout(50);
  });

  // Helper to read the execution log textarea.
  async function getExecutionLog(page) {
    return page.locator('#log').inputValue();
  }

  // Helper to set range input value and dispatch input event.
  async function setRangeValue(page, selector, value) {
    await page.evaluate(
      ({ selector, value }) => {
        const el = document.querySelector(selector);
        if (!el) return;
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      { selector, value }
    );
  }

  // Helper to click even if element is disabled (useful to fire handlers that exist).
  async function clickForce(page, selector) {
    await page.locator(selector).click({ force: true });
  }

  test('Initial Idle state renders load controls and array visualization (S0)', async ({ page }) => {
    // Validate presence of the Load Array button and that initial array visualization exists.
    await expect(page.locator('#loadArrayBtn')).toBeVisible();
    await expect(page.locator('#arrayInput')).toBeVisible();
    // The page loads initial array from textarea; we expect the array visualization table to exist.
    const tableLocator = page.locator('#arrayDisplay table[aria-label="Array visualization"]');
    await expect(tableLocator).toBeVisible();
    // Ensure the log area exists and is readonly.
    await expect(page.locator('#log')).toBeVisible();
    expect(await page.locator('#log').getAttribute('readonly')).toBe('true');

    // Assert that no uncaught page errors were emitted during initial render.
    expect(pageErrors.length).toBe(0);
  });

  test('Load Array event transitions to Array Loaded (S1) and shows count', async ({ page }) => {
    // Replace input with a known array and click Load
    await page.fill('#arrayInput', '10,20,30,40');
    await clickForce(page, '#loadArrayBtn');

    // Validate message and visualization reflect 4 elements.
    const loadMsg = await page.locator('#arrayLoadMsg').innerText();
    expect(loadMsg).toContain('Array loaded with 4 elements.');

    // The visualization should have a table with 4 element cells (td)
    const tdCount = await page.locator('#arrayDisplay table td').count();
    // Three rows: elements row has 4 tds, indices row also 4; we check total tds >= 4
    expect(tdCount).toBeGreaterThanOrEqual(4);

    // Buttons should be updated (algorithm controls cleared)
    expect(await page.locator('#algorithmSelect').inputValue()).toBe('');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Selecting an algorithm initializes it (S2) and logs initialization', async ({ page }) => {
    // Ensure array is loaded (use default or reload)
    await page.fill('#arrayInput', '1,2,3,4,5,6,7,8,9');
    await clickForce(page, '#loadArrayBtn');

    // Select Reverse Array algorithm
    await page.selectOption('#algorithmSelect', 'reverseArray');

    // The description area should show the algorithm description
    const desc = await page.locator('#algoDesc').innerText();
    expect(desc).toContain('Use two pointers (left and right)');

    // The algoControls container should show the initial state render and step controls
    const controlsHtml = await page.locator('#algoControls').innerHTML();
    expect(controlsHtml).toContain('Left pointer at index');

    // Execution log should contain initialization message and initial state step
    const log = await getExecutionLog(page);
    expect(log).toContain('Algorithm Reverse Array In-Place initialized.');
    expect(log).toContain('Step 1: Initial state');

    // Step forward button may be disabled; ensure initialization happened without page errors.
    expect(pageErrors.length).toBe(0);
  });

  test('Step forward transitions to Algorithm Running (S3) and Step back works', async ({ page }) => {
    // Load default array and initialize algorithm
    await page.fill('#arrayInput', '1,2,3,4,5,6,7,8,9');
    await clickForce(page, '#loadArrayBtn');
    await page.selectOption('#algorithmSelect', 'reverseArray');

    // Force click Step Forward (button might be disabled in UI but handler exists)
    await clickForce(page, '#stepForwardBtn');

    // After one step, arrayDisplay should reflect swap of indices 0 and 8 (values 1 and 9)
    const firstCellText = await page.locator('#arrayDisplay table tbody tr:nth-of-type(2) td:nth-of-type(1)').innerText();
    const lastIndex = await page.locator('#arrayDisplay table tbody tr:nth-of-type(3) td').count();
    const lastCellText = await page.locator(`#arrayDisplay table tbody tr:nth-of-type(2) td:nth-of-type(${lastIndex})`).innerText();

    // Expect the first displayed element to now be '9' and last to be '1'
    expect(firstCellText.trim()).toBe('9');
    expect(lastCellText.trim()).toBe('1');

    // Log should include the swap action
    const log = await getExecutionLog(page);
    expect(log).toMatch(/Swapped elements at indices 0 and 8/);

    // Now step back (force click even if disabled)
    await clickForce(page, '#stepBackBtn');

    // After stepping back, array should return to original [1,...,9]
    const firstAfterBack = await page.locator('#arrayDisplay table tbody tr:nth-of-type(2) td:nth-of-type(1)').innerText();
    const lastAfterBack = await page.locator(`#arrayDisplay table tbody tr:nth-of-type(2) td:nth-of-type(${lastIndex})`).innerText();
    expect(firstAfterBack.trim()).toBe('1');
    expect(lastAfterBack.trim()).toBe('9');

    // Ensure no page errors occurred during stepping actions
    expect(pageErrors.length).toBe(0);
  });

  test('Auto run starts and pause stops it (AUTO_RUN / PAUSE_RUN), buttons toggle accordingly', async ({ page }) => {
    // Use Remove Element algorithm which has a manageable number of steps.
    await page.fill('#arrayInput', '0,1,0,2,0');
    await clickForce(page, '#loadArrayBtn');
    await page.selectOption('#algorithmSelect', 'removeElement');

    // Set value to remove to 0 via control input
    // The control input id appears after initialization inside algoControls
    // Fill the val and trigger Set button to re-initialize state accordingly.
    await page.fill('#valToRemove', '0');
    await clickForce(page, '#valRemoveSetBtn');

    // Ensure autoRunSpeed small for test and dispatch 'input' to apply change
    await setRangeValue(page, '#autoRunSpeed', 100);

    // Start auto run (force click even if button disabled in UI)
    await clickForce(page, '#autoRunBtn');

    // After starting, autoRunBtn should become disabled and pauseRunBtn enabled (per startAutoRun)
    // We give a short wait for the interval to run a few steps
    await page.waitForTimeout(250);

    // Pause the auto-run
    await clickForce(page, '#pauseRunBtn');

    // After pausing, autoRunBtn should be enabled, pauseRunBtn disabled, resetRunBtn enabled
    expect(await page.locator('#autoRunBtn').isEnabled()).toBe(true);
    expect(await page.locator('#pauseRunBtn').isEnabled()).toBe(false);
    expect(await page.locator('#resetRunBtn').isEnabled()).toBe(true);

    // The execution log should contain at least initial and some steps
    const logText = await getExecutionLog(page);
    expect(logText).toMatch(/Algorithm Remove Element/);
    expect(logText).toMatch(/Step \d+:/);

    // Ensure no uncaught page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Reset run transitions back to Idle (RESET_RUN -> S0) and clears execution state', async ({ page }) => {
    // Prepare and initialize an algorithm
    await page.fill('#arrayInput', '1,2,3,4,5');
    await clickForce(page, '#loadArrayBtn');
    await page.selectOption('#algorithmSelect', 'reverseArray');

    // Perform one forward step
    await clickForce(page, '#stepForwardBtn');
    // Force reset (button may be enabled or disabled; use force)
    await clickForce(page, '#resetRunBtn');

    // After reset, algorithmSelect should be reset, algoControls cleared and log cleared
    expect(await page.locator('#algorithmSelect').inputValue()).toBe('');
    const controlsHtml = await page.locator('#algoControls').innerHTML();
    expect(controlsHtml.trim()).toBe('');
    const logText = await getExecutionLog(page);
    expect(logText).toBe('');

    // Step/back/auto/pause should be disabled (reset state)
    expect(await page.locator('#stepBackBtn').isDisabled()).toBe(true);
    expect(await page.locator('#stepForwardBtn').isDisabled()).toBe(true);
    expect(await page.locator('#autoRunBtn').isDisabled()).toBe(true);
    expect(await page.locator('#pauseRunBtn').isDisabled()).toBe(true);
    expect(await page.locator('#resetRunBtn').isDisabled()).toBe(true);

    // Ensure the array display remains visible and shows base array (no pointer highlights)
    const arrTdCount = await page.locator('#arrayDisplay table td').count();
    expect(arrTdCount).toBeGreaterThanOrEqual(5);

    // No uncaught page errors during reset
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invalid array input shows validation message and prevents loading', async ({ page }) => {
    // Input non-numeric values and click Load Array
    await page.fill('#arrayInput', 'a,b,xyz');
    await clickForce(page, '#loadArrayBtn');

    // Should present an invalid input message
    const msg = await page.locator('#arrayLoadMsg').innerText();
    expect(msg).toContain('Invalid input');

    // The array display should not render numbers for invalid input; existing visualization may remain unchanged.
    // Ensure no uncaught page errors were emitted while parsing invalid input.
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: loading an empty array results in "0 elements" and algorithm init handles zero length', async ({ page }) => {
    // Clear input and load empty
    await page.fill('#arrayInput', '');
    await clickForce(page, '#loadArrayBtn');

    const msg = await page.locator('#arrayLoadMsg').innerText();
    expect(msg).toContain('Array loaded with 0 elements.');

    // Selecting an algorithm should initialize but often mark done immediately for empty arrays.
    await page.selectOption('#algorithmSelect', 'sortSquares'); // Squares of Sorted Array
    const log = await getExecutionLog(page);
    expect(log).toContain('Algorithm Squares of Sorted Array initialized.');
    // The initial state may be marked done immediately; ensure no errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console messages and ensure no unexpected runtime errors during typical usage', async ({ page }) => {
    // Perform a small sequence of typical operations to capture console and runtime behavior.
    await page.fill('#arrayInput', '2,4,6,8');
    await clickForce(page, '#loadArrayBtn');
    await page.selectOption('#algorithmSelect', 'maxArea');
    await clickForce(page, '#stepForwardBtn');
    await clickForce(page, '#stepForwardBtn');
    await clickForce(page, '#resetRunBtn');

    // Allow potential async logging or errors to settle.
    await page.waitForTimeout(50);

    // Output captured console messages just for visibility in failure logs (not printed here).
    // Assert that no uncaught page errors occurred (i.e., no ReferenceError/SyntaxError/TypeError bubbled up).
    expect(pageErrors.length).toBe(0);

    // Basic sanity: console messages may exist (e.g., user code might log), but we are not requiring any.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});