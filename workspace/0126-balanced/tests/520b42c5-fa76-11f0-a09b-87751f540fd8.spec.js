import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b42c5-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Type System Interactive Application (520b42c5-fa76-11f0-a09b-87751f540fd8)', () => {
  // Shared collectors for console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Setup before each test: reset collectors and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect uncaught page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page and wait for the three buttons to be available
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure the expected UI components are present before each test proceeds
    await Promise.all([
      page.waitForSelector('#type-button'),
      page.waitForSelector('#type-button-2'),
      page.waitForSelector('#type-button-3'),
      page.waitForSelector('#type-output')
    ]);
  });

  // Teardown after each test: basic assertion that page errors are recorded in test results via explicit checks below.
  test.afterEach(async () => {
    // No automatic cleanup required; assertions related to console and page errors live in tests.
  });

  test.describe('Initial Idle State', () => {
    test('renders three type buttons and an empty output container (Idle state entry)', async ({ page }) => {
      // This test validates the Idle state UI evidence:
      // - Buttons for Type A/B/C exist
      // - Output container exists and is initially empty
      const btnA = await page.$('#type-button');
      const btnB = await page.$('#type-button-2');
      const btnC = await page.$('#type-button-3');
      const output = await page.$('#type-output');

      expect(btnA).not.toBeNull();
      expect(btnB).not.toBeNull();
      expect(btnC).not.toBeNull();
      expect(output).not.toBeNull();

      // The output should start empty (renderPage() is an FSM conceptual entry action — page does not define it; we assert DOM state instead)
      const outputText = await page.$eval('#type-output', el => el.innerHTML.trim());
      expect(outputText).toBe('');

      // Ensure no uncaught errors occurred during initial load
      expect(pageErrors.length).toBe(0);
      // Ensure no console error-type messages were emitted
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Type selection transitions', () => {
    test('clicking Type A transitions to S1_TypeA and updates output (Type: Type A)', async ({ page }) => {
      // Validate that getTypeOutput exists on the page context (transition entry action should use it)
      const hasGetTypeOutput = await page.evaluate(() => typeof window.getTypeOutput === 'function');
      expect(hasGetTypeOutput).toBe(true);

      // Click the Type A button and verify transition result
      await page.click('#type-button');

      // The FSM expected observable: output.innerHTML = 'Type: Type A';
      const outputText1 = await page.$eval('#type-output', el => el.innerHTML.trim());
      expect(outputText).toBe('Type: Type A');

      // No uncaught page errors or console errors should have happened as a result
      expect(pageErrors.length).toBe(0);
      const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('clicking Type B transitions to S2_TypeB and updates output (Type: Type B)', async ({ page }) => {
      // Click Type B
      await page.click('#type-button-2');
      const outputText2 = await page.$eval('#type-output', el => el.innerHTML.trim());
      expect(outputText).toBe('Type: Type B');

      // Ensure no runtime page errors were thrown
      expect(pageErrors.length).toBe(0);
      const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('clicking Type C transitions to S3_TypeC and updates output (Type: Type C)', async ({ page }) => {
      // Click Type C
      await page.click('#type-button-3');
      const outputText3 = await page.$eval('#type-output', el => el.innerHTML.trim());
      expect(outputText).toBe('Type: Type C');

      // Ensure no runtime page errors were thrown
      expect(pageErrors.length).toBe(0);
      const consoleErrors3 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('sequential transitions: A -> B -> C update output to reflect last selection', async ({ page }) => {
      // Click Type A then Type B then Type C and ensure output matches the last click
      await page.click('#type-button');
      let outputText4 = await page.$eval('#type-output', el => el.innerHTML.trim());
      expect(outputText).toBe('Type: Type A');

      await page.click('#type-button-2');
      outputText = await page.$eval('#type-output', el => el.innerHTML.trim());
      expect(outputText).toBe('Type: Type B');

      await page.click('#type-button-3');
      outputText = await page.$eval('#type-output', el => el.innerHTML.trim());
      expect(outputText).toBe('Type: Type C');

      // Confirm no page errors or console errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors4 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('rapid repeated clicks produce the expected final output (robustness edge case)', async ({ page }) => {
      // Rapidly click buttons in quick succession to simulate a user spamming buttons
      // The application should deterministically reflect the last click.
      await Promise.all([
        page.click('#type-button'),
        page.click('#type-button-2'),
        page.click('#type-button-3'),
        page.click('#type-button'),
        page.click('#type-button-3')
      ]);

      // Wait a tick to ensure DOM updates
      await page.waitForTimeout(50);

      const outputText5 = await page.$eval('#type-output', el => el.innerHTML.trim());
      // The last click in the sequence above is '#type-button-3' (Type C)
      expect(outputText).toBe('Type: Type C');

      expect(pageErrors.length).toBe(0);
      const consoleErrors5 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Behavioral and error observations', () => {
    test('verify no ReferenceError, SyntaxError, or TypeError occurred during interactions', async ({ page }) => {
      // Perform some interactions to exercise the script
      await page.click('#type-button');
      await page.click('#type-button-2');
      await page.click('#type-button-3');

      // Wait briefly for any asynchronous errors to surface
      await page.waitForTimeout(100);

      // pageErrors collects Error objects raised as 'pageerror' events.
      // Ensure none of them are ReferenceError, SyntaxError, or TypeError.
      const problematicErrors = pageErrors.filter(err => {
        const name = err && err.name ? err.name : '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });

      // Assert that no such errors occurred
      expect(problematicErrors.length).toBe(0);

      // Additionally inspect console messages for textual occurrences of those error names
      const consoleProblematic = consoleMessages.filter(m =>
        /ReferenceError|SyntaxError|TypeError/.test(m.text)
      );
      expect(consoleProblematic.length).toBe(0);
    });

    test('validate getTypeOutput behavior directly via page.evaluate (function produces expected DOM change)', async ({ page }) => {
      // Directly call getTypeOutput from the page context as an integration check.
      const result = await page.evaluate(() => {
        if (typeof getTypeOutput !== 'function') {
          return { error: 'no-function' };
        }
        // Call the function with a custom value and return the resulting DOM innerHTML
        getTypeOutput('Custom Test Type');
        return { output: document.getElementById('type-output').innerHTML };
      });

      // Ensure the function existed and produced the expected innerHTML (sanity check on the implementation)
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('Type: Custom Test Type');

      // No runtime exceptions should have bubbled to the test harness
      expect(pageErrors.length).toBe(0);
      const consoleErrors6 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });
});