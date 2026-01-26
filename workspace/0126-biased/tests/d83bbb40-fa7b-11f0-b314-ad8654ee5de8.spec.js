import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83bbb40-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Asymmetric Cryptography — RSA Toy Demonstration (FSM tests)', () => {
  // Arrays to collect runtime console messages and page errors for inspection in tests.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors while tests interact with the page.
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the exact provided HTML page, wait for load.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // After each test ensure no unexpected uncaught page errors occurred.
    // Note: some intentional evaluations in tests will cause Promise rejections
    // from page.evaluate() — those are handled by the test and typically do not
    // generate uncaught page errors. Here we assert that the page did not emit
    // any uncaught errors (SyntaxError/TypeError/ReferenceError) during normal load/interactions.
    expect(pageErrors.length).toBe(0);
  });

  test('Initial state S0_Idle: page renders and demo components are present and hidden', async ({ page }) => {
    // Validate main structural elements exist.
    const title = await page.locator('h1').innerText();
    expect(title).toContain('Asymmetric Cryptography');

    // The button should be present and enabled initially.
    const demoBtn = page.locator('#demoBtn');
    await expect(demoBtn).toBeVisible();
    await expect(demoBtn).toBeEnabled();
    await expect(demoBtn).toHaveText('Run RSA Toy Demonstration');

    // The demo result container should exist and be initially hidden (style="display:none;").
    const demoResult = page.locator('#demoResult');
    await expect(demoResult).toBeVisible(); // the element exists and occupies layout (visibility via CSS display checked below)
    // Use getComputedStyle to check display is 'none' initially per the HTML inline style.
    const initialDisplay = await demoResult.evaluate((el) => getComputedStyle(el).display);
    expect(initialDisplay).toBe('none');

    // demoSteps should be empty at start.
    const demoStepsHtml = await page.locator('#demoSteps').innerHTML();
    expect(demoStepsHtml.trim()).toBe('');

    // FSM entry action mentions renderPage() in the FSM definition.
    // The implementation does not define a global renderPage in the page.
    // We assert that calling renderPage() from the page context throws a ReferenceError.
    // This validates that the expected entry action is not present in the runtime (and produces the natural ReferenceError).
    await expect(page.evaluate(() => {
      // Intentionally call the missing global to let a ReferenceError happen naturally.
      // The test framework should observe and assert that this call rejects.
      // Note: this will reject the returned promise and not modify the page global scope.
      // We do not catch it here — the test assertion will handle expected rejection.
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/);

    // Confirm there were no console.error messages emitted during load.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('RunDemo event/transition: clicking the demo button reveals result, shows computed RSA steps, and disables the button', async ({ page }) => {
    const demoBtn = page.locator('#demoBtn');
    const demoResult = page.locator('#demoResult');
    const demoSteps = page.locator('#demoSteps');

    // Click the demo button as the user would (this should trigger the transition S0_Idle -> S1_DemoResultVisible).
    await demoBtn.click();

    // The script sets result.style.display = 'block'; wait for computed style to reflect this.
    await page.waitForFunction(() => {
      const el = document.getElementById('demoResult');
      return el && getComputedStyle(el).display === 'block';
    });

    // Verify the container is now visible and contains the detailed steps.
    const displayAfter = await demoResult.evaluate((el) => getComputedStyle(el).display);
    expect(displayAfter).toBe('block');

    const stepsText = await demoSteps.innerText();
    // Confirm core expected numeric results from the toy RSA demonstration.
    expect(stepsText).toContain('n = 3233'); // n = p × q = 3233
    expect(stepsText).toContain('Ciphertext c = 2790'); // encryption result
    expect(stepsText).toContain('Recovered m = 65'); // decryption recovers 65
    expect(stepsText).toContain('Success: decrypted value matches original message'); // success message

    // After running, the implementation disables the button and changes its text.
    await expect(demoBtn).toBeDisabled();
    await expect(demoBtn).toHaveText('Demonstration completed');

    // Ensure demoSteps contains some HTML markup (it populates innerHTML).
    const stepsHtml = await demoSteps.innerHTML();
    expect(stepsHtml.trim().length).toBeGreaterThan(0);

    // Confirm no console.error occurred during the click handler execution.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking again does not re-run the demonstration (handler runs only once and button disabled)', async ({ page }) => {
    const demoBtn = page.locator('#demoBtn');
    const demoSteps = page.locator('#demoSteps');

    // Run the demonstration once.
    await demoBtn.click();

    // Wait until result is visible and steps populated.
    await page.waitForFunction(() => {
      const el = document.getElementById('demoResult');
      const steps = document.getElementById('demoSteps');
      return el && getComputedStyle(el).display === 'block' && steps && steps.innerText.trim().length > 0;
    });

    // Capture the current steps HTML and button text.
    const stepsHtmlBefore = await demoSteps.innerHTML();
    const btnTextBefore = await demoBtn.innerText();

    // Attempt to "click" the button again programmatically.
    // Because the script disables the button as part of the handler, this should not change the content.
    // Use page.evaluate to call the element's click() — programmatic clicks on disabled elements should not trigger the handler.
    await page.evaluate(() => {
      const btn = document.getElementById('demoBtn');
      if (btn) {
        // Programmatic click on disabled button should be a no-op; we do not attempt to re-enable it.
        btn.click();
      }
    });

    // Give a short delay to let any unexpected work happen (there should be none).
    await page.waitForTimeout(250);

    // Re-read steps and button text; they should be unchanged.
    const stepsHtmlAfter = await demoSteps.innerHTML();
    const btnTextAfter = await demoBtn.innerText();
    expect(stepsHtmlAfter).toBe(stepsHtmlBefore);
    expect(btnTextAfter).toBe(btnTextBefore);

    // Ensure the button stayed disabled.
    await expect(demoBtn).toBeDisabled();
  });

  test('Internal implementation details are not exposed globally: calling modPow() or closure variables throws ReferenceError', async ({ page }) => {
    // The implementation defines modPow and RSA variables inside an IIFE closure.
    // They should not be globally accessible. Attempting to call them should throw ReferenceError.
    await expect(page.evaluate(() => {
      // Attempt to call modPow which is not exposed; this should throw a ReferenceError in the page context.
      // eslint-disable-next-line no-undef
      return modPow(2, 3, 5);
    })).rejects.toThrow(/modPow is not defined|ReferenceError/);

    // Attempt to access p (the prime variable inside closure). Accessing it should throw ReferenceError.
    await expect(page.evaluate(() => {
      // eslint-disable-next-line no-undef
      return p;
    })).rejects.toThrow(/p is not defined|ReferenceError/);

    // As a complementary check, typeof these names returns 'undefined' if accessed in a typeof-safe manner.
    const modPowType = await page.evaluate(() => typeof window.modPow);
    expect(modPowType).toBe('undefined');
    const pType = await page.evaluate(() => typeof window.p);
    expect(pType).toBe('undefined');
  });
});