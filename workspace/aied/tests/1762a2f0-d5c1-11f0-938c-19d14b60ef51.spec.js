import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1762a2f0-d5c1-11f0-938c-19d14b60ef51.html';

test.describe('Set Demonstration - FSM validation and UI behavior', () => {
  // Collect console messages and page errors to assert on them
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(BASE_URL);
    // Ensure initial DOM has loaded
    await page.waitForSelector('#numberInput');
    await page.waitForSelector('button[onclick="showUniqueValues()"]');
    await page.waitForSelector('#output');
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test failed, print collected console messages and page errors for debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      // eslint-disable-next-line no-console
      console.log('Collected console messages:', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Collected page errors:', pageErrors.map(e => e && e.message));
    }
  });

  test.describe('FSM States - Initial (S0_Idle) and Final (S1_ValuesDisplayed)', () => {
    test('Initial state (Idle) renders input, button, and output (renderPage entry action not implemented)', async ({ page }) => {
      // This test validates the S0_Idle state's evidence: presence of input, button and output.
      const input = await page.$('#numberInput');
      const button = await page.$('button[onclick="showUniqueValues()"]');
      const output = await page.$('#output');

      expect(input).not.toBeNull();
      expect(button).not.toBeNull();
      expect(output).not.toBeNull();

      // Verify placeholder text matches the FSM evidence
      const placeholder = await page.getAttribute('#numberInput', 'placeholder');
      expect(placeholder).toBe('Enter numbers, e.g. 1, 2, 2, 3, 4');

      // The FSM's entry action mentions renderPage(), but the implementation does not define it.
      // Verify that renderPage is not defined on the page global scope.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // showUniqueValues should be implemented per the HTML; verify it exists
      const showUniqueValuesType = await page.evaluate(() => typeof window.showUniqueValues);
      expect(showUniqueValuesType).toBe('function');

      // Initially, the output div should be empty (no unique values displayed yet)
      const initialOutputText = (await page.locator('#output').innerText()).trim();
      // The innerText might be empty string; ensure it's either empty or only whitespace
      expect(initialOutputText === '' || initialOutputText.length === 0).toBeTruthy();

      // Confirm no uncaught page errors occurred during initial render
      expect(pageErrors.length).toBe(0);
      // Also confirm there were no console.error messages logged on load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Final state (Values Displayed) is reached after clicking the button and shows expected output', async ({ page }) => {
      // This test validates the transition S0_Idle -> S1_ValuesDisplayed when the Show Unique Values button is clicked.
      // Enter values with duplicates and click the button.
      await page.fill('#numberInput', '1, 2, 2, 3, 4');
      await page.click('button[onclick="showUniqueValues()"]');

      // Wait for output to update
      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && out.innerHTML && out.innerHTML.includes('Unique Values:');
      });

      // Validate DOM update: output contains the strong label and the expected unique sequence
      const outputHTML = await page.locator('#output').innerHTML();
      expect(outputHTML).toContain('<strong>Unique Values:</strong>');
      // After the strong label, the unique values should be "1, 2, 3, 4"
      const outputText = await page.locator('#output').textContent();
      // Normalize whitespace and extract the part after "Unique Values:"
      const afterLabel = outputText.replace(/\s+/g, ' ').split('Unique Values:')[1].trim();
      expect(afterLabel).toBe('1, 2, 3, 4');

      // Confirm no uncaught page errors after this interaction
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Events and Transitions', () => {
    test('Clicking the Show Unique Values button triggers the expected transition and template used in output', async ({ page }) => {
      // This test validates the event described in the FSM and that the HTML template used matches evidence.
      await page.fill('#numberInput', 'a, b, a, c');
      const [response] = await Promise.all([
        // click triggers DOM update
        page.click('button[onclick="showUniqueValues()"]'),
        // allow microtask/update
        page.waitForTimeout(100)
      ]);

      // Confirm that output innerHTML uses the template "<strong>Unique Values:</strong> ..."
      const outputInnerHTML = await page.locator('#output').innerHTML();
      expect(outputInnerHTML.startsWith('<strong>Unique Values:</strong>')).toBeTruthy();

      // Since the code uses Set on strings, order is preserved for first occurrences
      const outputText = await page.locator('#output').textContent();
      const afterLabel = outputText.split('Unique Values:')[1].trim();
      expect(afterLabel).toBe('a, b, c');

      // No page errors or console.error during this transition
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });

    test('Clicking the button multiple times with different inputs updates output accordingly', async ({ page }) => {
      // First input
      await page.fill('#numberInput', '1,1,2');
      await page.click('button[onclick="showUniqueValues()"]');
      await page.waitForFunction(() => document.getElementById('output').innerText.includes('1'));

      let outputText = await page.locator('#output').textContent();
      let afterLabel = outputText.split('Unique Values:')[1].trim();
      expect(afterLabel).toBe('1, 2');

      // Change input and click again
      await page.fill('#numberInput', 'x, y, x, z, y');
      await page.click('button[onclick="showUniqueValues()"]');
      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && out.innerText.includes('x');
      });

      outputText = await page.locator('#output').textContent();
      afterLabel = outputText.split('Unique Values:')[1].trim();
      expect(afterLabel).toBe('x, y, z');

      // Final check: no uncaught errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Empty input results in label shown but no values after the label', async ({ page }) => {
      // This test checks how the app behaves if user provides an empty string.
      await page.fill('#numberInput', '');
      await page.click('button[onclick="showUniqueValues()"]');

      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && out.innerHTML.includes('Unique Values:');
      });

      const outputText = await page.locator('#output').textContent();
      // After the "Unique Values:" label there should be an empty string (trimmed)
      const afterLabel = outputText.split('Unique Values:')[1].trim();
      expect(afterLabel).toBe('');

      // No JS runtime errors should occur for this edge case
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });

    test('Input with only commas results in empty value as the unique entry (edge parsing behavior)', async ({ page }) => {
      // Input: ",,," -> split + trim yields empty strings; Set will yield one empty string
      await page.fill('#numberInput', ',,,');
      await page.click('button[onclick="showUniqueValues()"]');

      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && out.innerHTML.includes('Unique Values:');
      });

      const outputText = await page.locator('#output').textContent();
      const afterLabel = outputText.split('Unique Values:')[1];
      // The empty string join will result in an empty substring; trimmed should be empty.
      expect(afterLabel.trim()).toBe('');

      // Validate implementation detail: the output uses the documented innerHTML assignment
      const outputInnerHTML = await page.locator('#output').innerHTML();
      expect(outputInnerHTML).toContain('<strong>Unique Values:</strong>');

      // No errors on this edge case
      expect(pageErrors.length).toBe(0);
    });

    test('Different string forms that look numeric are treated as distinct (no coercion to Number)', async ({ page }) => {
      // "1" and "01" should be distinct as strings
      await page.fill('#numberInput', '1, 01, 1');
      await page.click('button[onclick="showUniqueValues()"]');

      await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && out.innerText.includes('01');
      });

      const outputText = await page.locator('#output').textContent();
      const afterLabel = outputText.split('Unique Values:')[1].trim();
      expect(afterLabel).toBe('1, 01');

      // No runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Implementation details and assertions about missing/defined functions', () => {
    test('showUniqueValues function exists and renderPage is absent (verifies FSM entry action not implemented)', async ({ page }) => {
      // Confirm presence/absence of functions
      const functionsInfo = await page.evaluate(() => {
        return {
          showUniqueValues: typeof window.showUniqueValues,
          renderPage: typeof window.renderPage
        };
      });

      expect(functionsInfo.showUniqueValues).toBe('function');
      expect(functionsInfo.renderPage).toBe('undefined');

      // Also check that clicking the button does not cause ReferenceError or other page errors
      await page.fill('#numberInput', '5,5');
      await page.click('button[onclick="showUniqueValues()"]');

      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });
  });
});