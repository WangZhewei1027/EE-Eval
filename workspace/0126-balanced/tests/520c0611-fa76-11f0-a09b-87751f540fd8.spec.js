import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520c0611-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Digital Signatures (FSM) - 520c0611-fa76-11f0-a09b-87751f540fd8', () => {
  // Collect runtime errors and console messages per test
  test.beforeEach(async ({ page }) => {
    // Navigate fresh for each test
    await page.goto(APP_URL);
  });

  // Helper to attach listeners and return collected arrays
  async function attachCollectors(page) {
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', (err) => {
      // err is an Error with message and stack
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      try {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch {
        consoleMessages.push(`console: (could not read message)`);
      }
    });

    return { pageErrors, consoleMessages };
  }

  test('Initial Idle state: buttons present, enabled; signature empty', async ({ page }) => {
    // Verify initial Idle state (S0_Idle)
    const { pageErrors, consoleMessages } = await attachCollectors(page);

    // Buttons exist
    const generate = page.locator('#generate-signature');
    const verify = page.locator('#verify-signature');
    const signature = page.locator('#signature');

    await expect(generate).toBeVisible();
    await expect(verify).toBeVisible();

    // Both buttons should be enabled initially (not disabled)
    await expect(generate).toBeEnabled();
    await expect(verify).toBeEnabled();

    // Signature display should be empty
    await expect(signature).toHaveText('');

    // No runtime errors or console errors have happened just by loading
    expect(pageErrors.length).toBe(0);
    // Console might have benign messages; ensure no page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Generate Signature (prompt accepted) triggers generation flow and causes runtime error due to const reassignment (S0 -> S1) - assert partial state change and error', async ({ page }) => {
    // This test validates:
    // - Clicking Generate opens a prompt (we accept with a test message)
    // - signatureData gets set to the message
    // - generate/verify button disabled states change as in the implementation before the error
    // - A runtime error occurs due to attempting to reassign a const (observed as a pageerror)
    const { pageErrors, consoleMessages } = await attachCollectors(page);

    // Set up one-time dialog handler to accept the prompt
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      // Provide the message that should be signed
      await dialog.accept('Test message');
    });

    // Click the Generate Signature button and wait for the pageerror that occurs due to a bug in the implementation
    const errorPromise = page.waitForEvent('pageerror').catch(() => null); // catch to avoid unhandled rejections
    await page.click('#generate-signature');

    // Wait for a pageerror to be observed (the implementation tries to reassign a const 'signature')
    const errorEvent = await errorPromise;
    // Our attachCollectors also collects the error via page.on('pageerror')
    // Give a tiny delay to ensure handlers executed
    await page.waitForTimeout(50);

    // Validate that signatureData was set in the page to the provided prompt value
    const signatureData = await page.evaluate(() => {
      // signatureData is declared in the page scope as let signatureData = '';
      return typeof signatureData !== 'undefined' ? signatureData : null;
    });
    expect(signatureData).toBe('Test message');

    // Check button states as set before the thrown error in generateSignature()
    // The implementation sets generateSignatureButton.disabled = true; verifySignatureButton.disabled = false; before the failing assignment
    const generateDisabled = await page.$eval('#generate-signature', (el) => el.disabled);
    const verifyDisabled = await page.$eval('#verify-signature', (el) => el.disabled);
    expect(generateDisabled).toBe(true);
    expect(verifyDisabled).toBe(false);

    // Assert that a page error occurred and its message indicates an assignment to a constant or similar
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const matched = pageErrors.some((msg) => /assignment to constant|assignment to read-only property|constant/i.test(msg));
    // If the exact error text varies by engine, ensure at least the presence of 'Assignment' or 'constant'
    expect(matched).toBeTruthy();

    // Also ensure that the signature display hasn't been set to a verified message (we are in generated state or error)
    const signatureText = await page.locator('#signature').innerText();
    // It should not indicate verification succeeded
    expect(signatureText).not.toBe('Signature verified!');
  });

  test('Generate Signature (prompt dismissed) should not change signatureData, buttons remain enabled, no runtime error', async ({ page }) => {
    // This test validates the edge case: user cancels the prompt
    const { pageErrors, consoleMessages } = await attachCollectors(page);

    // Dismiss prompt
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      await dialog.dismiss();
    });

    await page.click('#generate-signature');
    // Give some time for any handlers (should be none executed that modify state)
    await page.waitForTimeout(100);

    // signatureData should still be the empty string
    const signatureData1 = await page.evaluate(() => {
      return typeof signatureData !== 'undefined' ? signatureData : null;
    });
    expect(signatureData).toBe('');

    // Buttons should remain enabled (no changes)
    await expect(page.locator('#generate-signature')).toBeEnabled();
    await expect(page.locator('#verify-signature')).toBeEnabled();

    // No page runtime errors should happen when dismissing the prompt
    expect(pageErrors.length).toBe(0);
  });

  test('Verify Signature without prior generate results in verification failed message (S0 -> S3)', async ({ page }) => {
    // This test validates verifying with no generated signature yields failure
    const { pageErrors, consoleMessages } = await attachCollectors(page);

    // Click verify
    await page.click('#verify-signature');

    // Allow any DOM updates
    await page.waitForTimeout(50);

    // The implementation sets the signature element to 'Signature verification failed!' when verification doesn't match
    const signatureText1 = await page.locator('#signature').innerText();
    expect(signatureText).toBe('Signature verification failed!');

    // No runtime errors are expected for this flow
    expect(pageErrors.length).toBe(0);
  });

  test('After a broken generate attempt, Verify Signature still results in verification failed (S1 -> S3) and no successful verification path exists', async ({ page }) => {
    // This test covers the transition from "signature generated" (partial, before error) to verification failure
    const { pageErrors, consoleMessages } = await attachCollectors(page);

    // Trigger a generate attempt that will cause the runtime error (we accept prompt)
    page.once('dialog', async (dialog) => {
      await dialog.accept('Another message');
    });
    // Wait for pageerror
    const errorPromise1 = page.waitForEvent('pageerror').catch(() => null);
    await page.click('#generate-signature');
    await errorPromise;
    await page.waitForTimeout(50);

    // Now click verify; the implementation's verifySignature will execute and return false, and the outer listener will set failed message
    await page.click('#verify-signature');
    await page.waitForTimeout(50);

    const signatureText2 = await page.locator('#signature').innerText();
    expect(signatureText).toBe('Signature verification failed!');

    // Confirm that the implementation never reaches a verified state: 'Signature verified!' should not appear
    expect(signatureText).not.toBe('Signature verified!');

    // Confirm at least one runtime error was recorded (from the generate attempt)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Implementation never produces "Signature verified!" because verifySignature() always returns false in code - assert unreachable S2', async ({ page }) => {
    // This test attempts several flows and asserts the 'Signature verified!' state never occurs
    const { pageErrors, consoleMessages } = await attachCollectors(page);

    // 1) Direct verify without generate
    await page.click('#verify-signature');
    await page.waitForTimeout(30);
    let text = await page.locator('#signature').innerText();
    expect(text).not.toBe('Signature verified!');

    // 2) Generate dismissed, then verify
    page.once('dialog', async (dialog) => await dialog.dismiss());
    await page.click('#generate-signature');
    await page.waitForTimeout(30);
    await page.click('#verify-signature');
    await page.waitForTimeout(30);
    text = await page.locator('#signature').innerText();
    expect(text).not.toBe('Signature verified!');

    // 3) Attempt generate that causes runtime error, then verify
    page.once('dialog', async (dialog) => await dialog.accept('irrelevant'));
    // collect the pageerror if any
    const errPromise = page.waitForEvent('pageerror').catch(() => null);
    await page.click('#generate-signature');
    await errPromise;
    await page.waitForTimeout(30);
    await page.click('#verify-signature');
    await page.waitForTimeout(30);
    text = await page.locator('#signature').innerText();
    expect(text).not.toBe('Signature verified!');

    // Final assertion: there was no successful verified state observed
    // (we already asserted this after each attempt)
  });

  test('Console and pageerror collection sanity check: ensure we observed expected error kinds from the broken implementation', async ({ page }) => {
    // Confirm that runtime errors are emitted when invoking the broken code path
    const { pageErrors, consoleMessages } = await attachCollectors(page);

    // Trigger the known-bad generate path
    page.once('dialog', async (dialog) => await dialog.accept('Cause error'));
    const errPromise1 = page.waitForEvent('pageerror').catch(() => null);
    await page.click('#generate-signature');
    const err = await errPromise;
    await page.waitForTimeout(30);

    // The collected pageErrors should include the thrown error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The consoleMessages may include logs or no entries; ensure we've collected at least the pageerror
    const foundAssignmentError = pageErrors.some((m) => /assignment to constant|constant/i.test(m));
    expect(foundAssignmentError).toBeTruthy();
  });
});