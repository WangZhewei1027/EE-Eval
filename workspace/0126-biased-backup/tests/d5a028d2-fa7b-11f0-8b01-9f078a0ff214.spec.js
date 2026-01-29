import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a028d2-fa7b-11f0-8b01-9f078a0ff214.html';

// Expected alert message as defined in the page's showExample() implementation
const EXPECTED_ALERT_TEXT = "Demonstration: Imagine we have the keys 'cat', 'bat', and 'rat'. If the hash function maps 'cat' and 'bat' to the same index, both will be stored in a linked list at that index.";

test.describe('Understanding Hash Maps - FSM and UI tests (d5a028d2-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Each test will navigate to the page fresh
  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages for assertions
    await page.goto(APP_URL);
  });

  // Test: Initial idle state S0_Idle - page renders and button exists
  test('S0_Idle: Page renders content and Show Hash Map Example button exists with correct attributes', async ({ page }) => {
    // Validate main heading exists
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Understanding Hash Maps');

    // Validate the demonstration button exists and matches selector from FSM
    const button = page.locator("button[onclick='showExample()']");
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Show Hash Map Example');

    // Ensure the onclick attribute is exactly as expected (evidence from FSM)
    const onclick = await button.getAttribute('onclick');
    expect(onclick).toBe('showExample()');

    // No alert/dialog should be present initially.
    // Also ensure there are no uncaught page errors emitted immediately after load.
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err?.message ?? err)));
    // wait a tick to ensure any synchronous errors would be captured
    await page.waitForTimeout(150);
    expect(pageErrors.length).toBe(0);
  });

  // Test: Transition ShowExample from S0_Idle -> S1_ExampleShown via button click should show an alert
  test('Transition ShowExample: clicking button triggers alert and corresponds to S1_ExampleShown', async ({ page }) => {
    // Listen for page errors during this interaction
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err?.message ?? err)));

    const buttonSelector = "button[onclick='showExample()']";

    // Click the button and capture the alert dialog
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click(buttonSelector)
    ]);

    // Validate that the alert text matches the FSM's expected message
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);

    // Accept the alert to continue
    await dialog.accept();

    // After handling the alert, ensure no unexpected page errors occurred
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBe(0);
  });

  // Test: showExample function exists on the page and invoking it (directly) produces the same alert
  test('S1_ExampleShown entry action: showExample() exists and is callable (invoking triggers alert)', async ({ page }) => {
    // Confirm the function exists
    const fnType = await page.evaluate(() => typeof window['showExample']);
    expect(fnType).toBe('function');

    // Prepare to capture the dialog opened by calling showExample directly
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.evaluate(() => {
        // Call the function exactly as defined by the implementation
        // Let the alert happen naturally in the page context
        // (We do not catch it here so the runtime behavior is observed)
        // eslint-disable-next-line no-undef
        return showExample();
      }).catch((e) => {
        // The alert will pause execution until it's accepted; after acceptance evaluate resolves to undefined.
        // This catch should not normally be hit for a properly functioning showExample that only triggers alert.
        // Re-throw to surface unexpected issues.
        throw e;
      })
    ]);

    // Validate the alert content is as expected and accept it
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
    await dialog.accept();
  });

  // Test: Validate the FSM-declared onEnter action "renderPage()" is NOT present in the page,
  // and attempting to invoke it results in a natural ReferenceError emitted by the page.
  test('S0_Idle onEnter action "renderPage()" is missing and causes a ReferenceError when invoked', async ({ page }) => {
    // Collect any pageerror events that occur
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(String(err?.message ?? err));
    });

    // Attempt to call renderPage() directly within the page context.
    // This is intentionally done to let the ReferenceError happen naturally in the page runtime.
    let evaluateError = null;
    try {
      await page.evaluate(() => {
        // Intentionally call the function that is referenced in the FSM but not implemented in the HTML.
        // This will cause a ReferenceError in the page context.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      evaluateError = err;
    }

    // The page.evaluate call should have rejected due to ReferenceError in page context.
    expect(evaluateError).not.toBeNull();
    const evalMsg = String(evaluateError?.message ?? '');
    // The message typically contains 'renderPage is not defined' or similar; assert that it mentions renderPage and 'not defined' or 'is not defined'
    expect(evalMsg.toLowerCase()).toContain('renderpage');
    expect(evalMsg.toLowerCase()).toMatch(/not defined|is not defined/);

    // Also assert that the page emitted a pageerror reflecting the same ReferenceError (natural runtime error)
    // Give a moment for pageerror propagation if needed
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // At least one of the captured page errors should mention renderPage
    const foundRenderPageError = pageErrors.some(msg => String(msg).toLowerCase().includes('renderpage'));
    expect(foundRenderPageError).toBe(true);
  });

  // Edge case tests and additional validations
  test('Edge cases: multiple clicks produce multiple alerts; undefined function call triggers ReferenceError event', async ({ page }) => {
    // Capture page errors
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err?.message ?? err)));

    const buttonSelector = "button[onclick='showExample()']";

    // Click the button twice and capture both alerts sequentially
    for (let i = 0; i < 2; i++) {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click(buttonSelector)
      ]);
      expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
      await dialog.accept();
    }

    // After the two natural alerts, ensure no page errors from them
    expect(pageErrors.length).toBe(0);

    // Now intentionally invoke a non-existent function to trigger a ReferenceError and ensure pageerror is emitted
    const undefinedFnName = 'nonExistentFunction_abc123';
    let evalError = null;
    try {
      await page.evaluate((fnName) => {
        // @ts-ignore - intentionally referencing a variable that doesn't exist to cause a ReferenceError
        // eslint-disable-next-line no-undef
        return window[fnName]();
      }, undefinedFnName);
    } catch (err) {
      evalError = err;
    }

    // The call should have produced an error
    expect(evalError).not.toBeNull();
    const evalErrorMsg = String(evalError?.message ?? '').toLowerCase();
    expect(evalErrorMsg).toContain('not defined');

    // Ensure pageerror listener captured at least one error mentioning the undefined function name or 'not defined'
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const hasNotDefined = pageErrors.some(msg => /not defined/i.test(msg));
    expect(hasNotDefined).toBe(true);
  });

  // Validate console and DOM stability: check that the document content remains intact after interactions
  test('DOM stability: content remains intact after interactions (no unexpected mutations)', async ({ page }) => {
    // Capture snapshot of some key DOM pieces before interaction
    const initialTitle = await page.locator('h1').innerText();
    const initialParagraphCount = await page.locator('.content p').count();
    const initialButtonHtml = await page.locator("button[onclick='showExample()']").innerHTML();

    // Interact: click the example button and accept the alert
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click("button[onclick='showExample()']")
    ]);
    expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
    await dialog.accept();

    // Re-check DOM pieces remained unchanged
    const finalTitle = await page.locator('h1').innerText();
    const finalParagraphCount = await page.locator('.content p').count();
    const finalButtonHtml = await page.locator("button[onclick='showExample()']").innerHTML();

    expect(finalTitle).toBe(initialTitle);
    expect(finalParagraphCount).toBe(initialParagraphCount);
    expect(finalButtonHtml).toBe(initialButtonHtml);
  });
});