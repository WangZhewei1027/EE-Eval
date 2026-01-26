import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b3e650-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('Refactoring Demonstration App - FSM validation (63b3e650-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  // Keep track of runtime issues observed during each test
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Capture console error-level messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture dialogs (alerts) so tests can assert their messages and accept them
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    // Load the page exactly as-is (do not modify the environment)
    await page.goto(APP_URL);
    // Ensure critical UI elements are present before interacting
    await page.waitForSelector('#btn-calc');
    await page.waitForSelector('#input-price');
    await page.waitForSelector('#input-tax');
    await page.waitForSelector('#input-discount');
    await page.waitForSelector('#result');
  });

  test.afterEach(async () => {
    // Post-condition: assert there were no unexpected runtime errors during the test
    // If the application legitimately throws runtime errors, those will be captured in pageErrors and consoleErrors.
    // This assertion ensures we are notified when uncaught exceptions happen.
    expect(pageErrors, `No uncaught page errors should occur. Found: ${pageErrors.length > 0 ? pageErrors.map(e => String(e)).join('; ') : 'none'}`).toHaveLength(0);
    expect(consoleErrors, `No console.error messages should be emitted. Found: ${consoleErrors.length > 0 ? consoleErrors.join('; ') : 'none'}`).toHaveLength(0);
  });

  // Helper: compute expected final price using same logic as the page (for assertions)
  function computeFinal(price, taxRate, discount) {
    const taxAmount = price * (taxRate / 100);
    const priceWithTax = price + taxAmount;
    const discountAmount = priceWithTax * (discount / 100);
    const final = priceWithTax - discountAmount;
    return final.toFixed(2);
  }

  test('Initial Idle state renders inputs, defaults and the Calculate button', async ({ page }) => {
    // Validate initial UI corresponds to the Idle state evidence:
    // - button exists with expected label
    // - inputs exist and have the documented default values
    // - result area exists and is empty on load
    const btn = page.locator('#btn-calc');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Calculate Final Price');

    const inputPrice = page.locator('#input-price');
    const inputTax = page.locator('#input-tax');
    const inputDiscount = page.locator('#input-discount');
    const result = page.locator('#result');

    await expect(inputPrice).toHaveAttribute('value', '100');
    await expect(inputTax).toHaveAttribute('value', '8.5');
    await expect(inputDiscount).toHaveAttribute('value', '10');

    // Result zone should be empty when idle
    await expect(result).toHaveText('');

    // No dialogs should have shown up on initial render
    expect(dialogs).toHaveLength(0);
  });

  test('Successful calculation transitions from Calculating to Result state', async ({ page }) => {
    // This test validates the transition: S0_Idle -> S1_Calculating -> S3_Result
    // It fills valid inputs, clicks calculate, and verifies the result text is shown
    const price = 200;
    const taxRate = 10;
    const discount = 5;

    await page.fill('#input-price', String(price));
    await page.fill('#input-tax', String(taxRate));
    await page.fill('#input-discount', String(discount));

    // Ensure no dialogs are pending before click
    expect(dialogs).toHaveLength(0);

    await page.click('#btn-calc');

    // Compute expected final using same logic the app uses
    const expected = `Final price: $${computeFinal(price, taxRate, discount)}`;

    // Wait for the result element to display the expected text
    const result = page.locator('#result');
    await expect(result).toHaveText(expected);

    // No validation alerts should have been shown for valid inputs
    expect(dialogs).toHaveLength(0);
  });

  test('Negative price triggers price validation alert and remains in Error state', async ({ page }) => {
    // Validate the InputError transition and S2_Error state for negative price
    await page.fill('#input-price', '-5');
    // keep tax and discount valid
    await page.fill('#input-tax', '8.5');
    await page.fill('#input-discount', '10');

    await page.click('#btn-calc');

    // An alert should have been shown with the price error message
    expect(dialogs).toContain('Please enter a valid price >= 0');

    // Result should still be empty because calculation was aborted
    await expect(page.locator('#result')).toHaveText('');
  });

  test('Tax rate out of range (>100) triggers tax validation alert', async ({ page }) => {
    // Validate InputError for tax rate > 100
    await page.fill('#input-price', '100');
    await page.fill('#input-tax', '150'); // invalid
    await page.fill('#input-discount', '5');

    await page.click('#btn-calc');

    expect(dialogs).toContain('Please enter a valid tax rate between 0 and 100');
    await expect(page.locator('#result')).toHaveText('');
  });

  test('Discount out of range (>100) triggers discount validation alert', async ({ page }) => {
    // Validate InputError for discount > 100
    await page.fill('#input-price', '100');
    await page.fill('#input-tax', '8.5');
    await page.fill('#input-discount', '200'); // invalid

    await page.click('#btn-calc');

    expect(dialogs).toContain('Please enter a valid discount between 0 and 100');
    await expect(page.locator('#result')).toHaveText('');
  });

  test('Empty (non-numeric) inputs trigger appropriate validation alerts', async ({ page }) => {
    // Clear price -> should trigger price validation
    await page.fill('#input-price', '');
    await page.fill('#input-tax', '8.5');
    await page.fill('#input-discount', '10');

    await page.click('#btn-calc');
    expect(dialogs).toContain('Please enter a valid price >= 0');

    // Clear tax -> should trigger tax validation (use valid price again)
    dialogs = []; // reset recorded dialogs for next check
    await page.fill('#input-price', '100');
    await page.fill('#input-tax', '');

    await page.click('#btn-calc');
    expect(dialogs).toContain('Please enter a valid tax rate between 0 and 100');

    // Clear discount -> should trigger discount validation
    dialogs = [];
    await page.fill('#input-tax', '8.5');
    await page.fill('#input-discount', '');

    await page.click('#btn-calc');
    expect(dialogs).toContain('Please enter a valid discount between 0 and 100');
  });

  test('Edge case: zero price, zero tax, zero discount yields $0.00 final price', async ({ page }) => {
    // Validate calculation when all inputs are zero
    await page.fill('#input-price', '0');
    await page.fill('#input-tax', '0');
    await page.fill('#input-discount', '0');

    await page.click('#btn-calc');

    const expected = `Final price: $${computeFinal(0, 0, 0)}`; // should be 0.00
    await expect(page.locator('#result')).toHaveText(expected);

    // No validation alerts expected
    expect(dialogs).toHaveLength(0);
  });

  test('Sanity: no unexpected runtime errors or console.error emitted during interaction scenarios', async ({ page }) => {
    // This test will perform several actions and then assert no uncaught exceptions or console.error messages occurred.
    // It complements other tests by performing multiple interactions in a single session.

    // 1) Valid calculation
    await page.fill('#input-price', '123.45');
    await page.fill('#input-tax', '7.25');
    await page.fill('#input-discount', '12.5');
    await page.click('#btn-calc');
    await expect(page.locator('#result')).toHaveText(`Final price: $${computeFinal(123.45, 7.25, 12.5)}`);

    // 2) Trigger a validation error (discount > 100)
    await page.fill('#input-discount', '150');
    await page.click('#btn-calc');
    expect(dialogs.some(d => d === 'Please enter a valid discount between 0 and 100')).toBeTruthy();

    // 3) Fix and calculate again
    await page.fill('#input-discount', '0');
    await page.click('#btn-calc');
    await expect(page.locator('#result')).toHaveText(`Final price: $${computeFinal(123.45, 7.25, 0)}`);

    // At the end of this test, afterEach will assert that there were no page errors/console.errors.
  });
});