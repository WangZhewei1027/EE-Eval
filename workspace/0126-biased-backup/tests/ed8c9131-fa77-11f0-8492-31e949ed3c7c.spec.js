import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8c9131-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Stack Visualization (ed8c9131-fa77-11f0-8492-31e949ed3c7c) - FSM based tests', () => {
  // Reusable page-level collectors for console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      // store the Error object for more detailed assertions later
      pageErrors.push(err);
    });

    // Navigate to the app page
    await page.goto(APP_URL);
    // ensure the page fully loads and inline script runs
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async ({ page }) => {
    // slightly useful debug info if a test fails
    if (pageErrors.length) {
      // log error messages to help debugging when tests fail - Playwright will capture these
      // (not modifying the page, just recording)
      for (const e of pageErrors) {
        // no-op: this loop ensures we "observe" the errors; console output is visible in test logs
      }
    }
    // Clear listeners to avoid duplicate captures across tests
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial state (S0_Idle): stack exists and has initial transform from stylesheet', async ({ page }) => {
    // Validate presence of main components
    const stack = await page.$('.stack');
    const button = await page.$('.button');
    expect(stack, 'Expected .stack element to be present').not.toBeNull();
    expect(button, 'Expected .button element to be present').not.toBeNull();

    // The implementation sets initial transform via CSS (transform: rotateX(0)).
    // Inline style is not set initially. We check both inline style and computed style.
    const inlineTransform = await page.evaluate(() => {
      const s = document.querySelector('.stack');
      return s ? s.style.transform : null;
    });
    // Inline style should be empty string as initial transform is in the stylesheet
    expect(inlineTransform).toBe('');

    const computedTransform = await page.evaluate(() => {
      const s = document.querySelector('.stack');
      return s ? window.getComputedStyle(s).getPropertyValue('transform') : null;
    });
    // Computed transform should be defined (either 'none' or a matrix)
    expect(computedTransform).not.toBeNull();
    expect(computedTransform.length).toBeGreaterThan(0);

    // Ensure the button has the expected onclick evidence per FSM
    const onclickAttr = await page.getAttribute('.button', 'onclick');
    expect(onclickAttr, 'Button should have onclick attribute referencing toggleRotate').toContain('toggleRotate');

    // No runtime errors should have happened on initial load
    expect(pageErrors.length, 'No runtime page errors during initial load').toBe(0);
  });

  test('Transition S0_Idle -> S1_Rotated on ToggleRotate click: inline transform set to rotateX(360deg)', async ({ page }) => {
    // Click the toggle button to trigger rotation
    await page.click('.button');

    // Wait briefly for the inline style to be applied (script sets style synchronously, but transition is async)
    await page.waitForTimeout(100);

    // The implementation sets inline style string to 'rotateX(360deg)'
    const inlineTransformAfterClick = await page.evaluate(() => {
      const s = document.querySelector('.stack');
      return s ? s.style.transform : null;
    });

    expect(inlineTransformAfterClick, 'After first click, inline transform should be rotateX(360deg)').toBe('rotateX(360deg)');

    // Also verify exposed rotated variable is true after click
    const rotatedFlag = await page.evaluate(() => {
      // read the module-level variable set by the page script
      // (we are not modifying it, only reading)
      // If variable is missing, this will return undefined
      return typeof rotated !== 'undefined' ? rotated : undefined;
    });
    expect(rotatedFlag).toBe(true);

    // No runtime errors expected for this normal interaction
    expect(pageErrors.length, 'No runtime errors after a normal toggle').toBe(0);
  });

  test('Transition S1_Rotated -> S0_Idle on ToggleRotate click again: inline transform reset to rotateX(0deg)', async ({ page }) => {
    // Trigger first click to get into rotated state
    await page.click('.button');
    await page.waitForTimeout(50);

    // Trigger second click to reset rotation
    await page.click('.button');

    // Wait a bit for inline style to be updated
    await page.waitForTimeout(100);

    const inlineTransformAfterSecondClick = await page.evaluate(() => {
      const s = document.querySelector('.stack');
      return s ? s.style.transform : null;
    });

    // Implementation sets inline style to 'rotateX(0deg)' when toggling back
    expect(inlineTransformAfterSecondClick, 'After second click, inline transform should be rotateX(0deg)').toBe('rotateX(0deg)');

    // Validate rotated flag toggled back to false
    const rotatedFlag = await page.evaluate(() => {
      return typeof rotated !== 'undefined' ? rotated : undefined;
    });
    expect(rotatedFlag).toBe(false);

    // Ensure no unexpected runtime errors occurred
    expect(pageErrors.length, 'No runtime errors after toggling back').toBe(0);
  });

  test('Edge case: Missing .stack element causes runtime TypeError when ToggleRotate invoked', async ({ page }) => {
    // Remove the .stack element from the DOM to simulate an error scenario
    await page.evaluate(() => {
      const s = document.querySelector('.stack');
      if (s) s.remove();
    });

    // Now click the button. Because toggleRotate assumes .stack exists and does stack.style.transform = ..., this should throw.
    // Wait for the pageerror event that will be emitted when the exception is thrown.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('.button'),
    ]);

    // Validate that a TypeError occurred (attempting to access style of null)
    expect(error).toBeTruthy();
    // The name is commonly 'TypeError' in browsers when accessing properties of null/undefined
    expect(error.name, 'Expected a TypeError when .stack is missing').toBe('TypeError');

    // Error message varies by browser, but it should mention null/undefined; assert non-empty message
    expect(typeof error.message).toBe('string');
    expect(error.message.length).toBeGreaterThan(0);

    // Record that we did observe an error as part of this edge case test
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Idempotency & rapid interactions: multiple quick toggles result in predictable rotated flag flips', async ({ page }) => {
    // Read initial rotated flag (should be false or undefined if not accessible)
    const initial = await page.evaluate(() => (typeof rotated !== 'undefined' ? rotated : undefined));
    // Perform three quick clicks: final rotated state should be toggled 3 times => !initial (if defined)
    await page.click('.button');
    await page.click('.button');
    await page.click('.button');

    // small wait to allow inline styles and flag to update
    await page.waitForTimeout(100);

    // Check rotated flag
    const final = await page.evaluate(() => (typeof rotated !== 'undefined' ? rotated : undefined));
    if (typeof initial === 'boolean') {
      expect(final).toBe(!initial);
    } else {
      // If rotated was not accessible for some reason, at least ensure it's boolean now
      expect(typeof final).toBe('boolean');
    }

    // Check inline transform string exists and reflects last toggle: either 'rotateX(360deg)' or 'rotateX(0deg)'
    const inlineTransform = await page.evaluate(() => {
      const s = document.querySelector('.stack');
      return s ? s.style.transform : null;
    });
    expect(inlineTransform === 'rotateX(360deg)' || inlineTransform === 'rotateX(0deg)').toBe(true);

    // No unexpected runtime errors expected here
    expect(pageErrors.length, 'No runtime errors during rapid toggling').toBe(0);
  });

  test('Visual/DOM assertions: blocks present and CSS transition property exists on .stack', async ({ page }) => {
    const blocksCount = await page.$$eval('.block', (nodes) => nodes.length);
    expect(blocksCount).toBe(5);

    // Ensure transition CSS property is present on .stack
    const transitionValue = await page.$eval('.stack', (s) => window.getComputedStyle(s).getPropertyValue('transition'));
    expect(transitionValue.length).toBeGreaterThan(0);
    // The stylesheet defines transition: transform 0.6s ease;
    expect(transitionValue).toContain('transform');

    // No runtime errors expected
    expect(pageErrors.length, 'No runtime errors when inspecting DOM and styles').toBe(0);
  });
});