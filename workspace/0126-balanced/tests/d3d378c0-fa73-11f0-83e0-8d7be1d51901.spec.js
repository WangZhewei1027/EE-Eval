import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d378c0-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('JavaScript Arrays — Interactive Demo (FSM tests)', () => {
  // Shared state to collect console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for assertions
    page.__consoleMessages = [];
    page.__pageErrors = [];

    page.on('console', (msg) => {
      page.__consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      page.__pageErrors.push(String(err));
    });

    await page.goto(APP_URL);
    // Ensure main elements have rendered
    await expect(page.locator('#runAll')).toBeVisible();
    await expect(page.locator('#clearOutput')).toBeVisible();
    await expect(page.locator('#runCustom')).toBeVisible();
    await expect(page.locator('#copyCustom')).toBeVisible();
    await expect(page.locator('#clearCustom')).toBeVisible();
    await expect(page.locator('#examplesContainer')).toBeVisible();
    await expect(page.locator('#output')).toBeVisible();
  });

  test.describe('S0 Idle - Initial UI checks', () => {
    test('renders expected top-level controls and shows example count', async ({ page }) => {
      // Validate presence and text of main buttons
      await expect(page.locator('#runAll')).toHaveText('Run All');
      await expect(page.locator('#clearOutput')).toHaveText('Clear Output');
      await expect(page.locator('#runCustom')).toHaveText('Run Custom');
      await expect(page.locator('#copyCustom')).toHaveText('Copy Template');
      await expect(page.locator('#clearCustom')).toHaveText('Reset');

      // The count should reflect the number of examples present (as text)
      const countText = await page.locator('#count').textContent();
      // There are multiple examples defined in the app; make sure it's a positive integer string
      expect(Number(countText)).toBeGreaterThan(0);
    });
  });

  test.describe('S1 Output Displayed - running examples and clearing output', () => {
    test('Run All appends output entries for every example', async ({ page }) => {
      // Ensure output is empty
      await page.locator('#clearOutput').click();
      await expect(page.locator('#output .log')).toHaveCount(0);

      // Click Run All
      await page.locator('#runAll').click();

      // Wait for logs to be appended. Expect at least the number displayed in #count
      const examplesCount = Number(await page.locator('#count').textContent());
      await expect(page.locator('#output .log')).toHaveCount(examplesCount, { timeout: 5000 });

      // Check that one of the known example titles appears in the output headers
      const outputText = await page.locator('#output').innerText();
      expect(outputText).toContain('Creation & Basic Access'); // sanity check
    });

    test('Run a specific example produces output (Run button)', async ({ page }) => {
      // Clear previous output
      await page.locator('#clearOutput').click();
      await expect(page.locator('#output .log')).toHaveCount(0);

      // Click "Run" on the first example
      const firstRunBtn = page.locator('#examplesContainer .example').first().locator('button', { hasText: 'Run' });
      await firstRunBtn.click();

      // Expect the output to include the example's title
      await expect.poll(async () => {
        return await page.locator('#output').innerText();
      }, { timeout: 3000 }).toContain('Creation & Basic Access');
    });

    test('Inspect example (Run + Inspect) includes returned snapshot marker', async ({ page }) => {
      // Clear output
      await page.locator('#clearOutput').click();

      // Click "Run + Inspect" on the first example
      const firstInspectBtn = page.locator('#examplesContainer .example').first().locator('button', { hasText: 'Run + Inspect' });
      await firstInspectBtn.click();

      // The wrapperCode logs '[[returned]]' so expect that marker in the output
      await expect.poll(async () => {
        return await page.locator('#output').innerText();
      }, { timeout: 3000 }).toContain('[[returned]]');
    });

    test('Clear Output empties the output console (S1 -> S0 transition)', async ({ page }) => {
      // Ensure some content exists
      await page.locator('#runAll').click();
      const examplesCount1 = Number(await page.locator('#count').textContent());
      await expect(page.locator('#output .log')).toHaveCount(examplesCount, { timeout: 5000 });

      // Click clear
      await page.locator('#clearOutput').click();

      // Output should be empty
      await expect(page.locator('#output .log')).toHaveCount(0);
      // Also assert the container innerHTML is empty/string-trim length 0
      const outHtml = await page.locator('#output').innerHTML();
      expect(outHtml.trim()).toBe('');
    });
  });

  test.describe('S2 Custom Code Running and related behaviors', () => {
    test('Running custom with empty content shows a warning entry', async ({ page }) => {
      // Set custom code to whitespace to simulate empty submission
      await page.locator('#customCode').evaluate((el) => (el.textContent = '   '));

      // Clear any existing output
      await page.locator('#clearOutput').click();

      // Click Run Custom
      await page.locator('#runCustom').click();

      // Expect a warn entry appended containing "(no code provided)"
      const lastLog = page.locator('#output .log').last();
      await expect(lastLog).toHaveClass(/warn/);
      await expect(lastLog).toContainText('(no code provided)');
    });

    test('Running custom code that throws results in err output and console.error call', async ({ page }) => {
      // Prepare to capture console.error messages that the page may produce
      const consoleErrors = [];
      const onConsole = (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      };
      page.on('console', onConsole);

      // Clear output
      await page.locator('#clearOutput').click();

      // Inject a custom script that throws an error
      const throwCode = `throw new Error('boom');`;
      await page.locator('#customCode').evaluate((el, val) => (el.textContent = val), throwCode);

      // Click Run Custom
      await page.locator('#runCustom').click();

      // Expect the output to include the error text
      const outText = await page.locator('#output').innerText();
      expect(outText).toContain('Error: boom');

      // Expect the in-page console captured an error (console.error called in runExampleCode catch)
      // Wait short time for console message propagation
      await page.waitForTimeout(100); // small delay to ensure console event fired
      expect(consoleErrors.some(text => text.includes('Error: boom'))).toBeTruthy();

      page.off('console', onConsole);
    });

    test('Reset custom code sets the contenteditable to the escaped template string', async ({ page }) => {
      // Click Reset (clearCustom)
      await page.locator('#clearCustom').click();

      // The application sets a literal escaped-newline string into textContent:
      const expected = "// Example:\\n// const arr = [1, 2, 3];\\n// console.log(arr.map(x => x * 2));";
      const actual = await page.locator('#customCode').evaluate((el) => el.textContent);

      expect(actual).toBe(expected);
    });

    test('Copy Template button shows alert about success or failure', async ({ page }) => {
      // Listen for dialog, triggered by copyCustom button's alert in both success and failure branches
      const dialogPromise = page.waitForEvent('dialog', { timeout: 3000 });

      await page.locator('#copyCustom').click();

      const dialog = await dialogPromise;
      const msg = dialog.message();
      // Dialog message should be one of the two messages in the app
      const okMsg = 'Template copied to clipboard. Paste into the editor.';
      const failMsg = 'Copy failed. You can select and copy manually.';
      expect([okMsg, failMsg]).toContain(msg);
      await dialog.dismiss();
    });
  });

  test.describe('Per-example copy buttons and UI feedback', () => {
    test('Per-example copy button shows feedback then reverts to "Copy"', async ({ page }) => {
      // Select first example's copy button (the small copy at the title row)
      const copyBtn = page.locator('#examplesContainer .example').first().locator('.copy-btn');

      // Click it. The app will attempt clipboard.writeText and then set textContent to 'Copied!' or 'Failed' for 1200ms
      await copyBtn.click();

      // Immediately after click, either 'Copied!' or 'Failed' should appear within a short time
      await expect.poll(async () => (await copyBtn.textContent()).trim(), { timeout: 1500 })
        .toMatch(/^(Copied!|Failed)$/);

      // Eventually (after the 1200ms timeout in app) it should revert back to 'Copy'
      await expect.poll(async () => (await copyBtn.textContent()).trim(), { timeout: 4000 })
        .toBe('Copy');
    });
  });

  test.describe('Observability: console and page errors during interactions', () => {
    test('No unexpected page errors on normal interactions; expected errors surface via console.error', async ({ page }) => {
      // Clear any output
      await page.locator('#clearOutput').click();

      // Run a normal example (should not produce uncaught page errors)
      await page.locator('#examplesContainer .example').nth(1).locator('button', { hasText: 'Run' }).click();

      // Wait briefly for any pageerror to surface
      await page.waitForTimeout(200);

      // page.pageerror should be empty for this normal interaction
      expect(page.__pageErrors.length).toBe(0);

      // Now intentionally produce an error via custom code to ensure console.error is used
      await page.locator('#customCode').evaluate((el) => (el.textContent = `throw new Error('intentional-test-error');`));
      // Register a small collector for console.error
      const errors = [];
      const listener = (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      };
      page.on('console', listener);

      await page.locator('#runCustom').click();
      await page.waitForTimeout(100);

      // We expect at least one console.error mentioning the intentional error
      expect(errors.some(t => t.includes('intentional-test-error'))).toBeTruthy();

      page.off('console', listener);
    });
  });
});