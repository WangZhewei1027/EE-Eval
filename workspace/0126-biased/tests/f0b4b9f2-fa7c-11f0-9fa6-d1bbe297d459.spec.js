import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b4b9f2-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('f0b4b9f2-fa7c-11f0-9fa6-d1bbe297d459 - Type System Interactive App (FSM validation)', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and page errors
    page.on('console', msg => {
      // Collect console error type messages for later assertions
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      // Uncaught exceptions land here
      pageErrors.push(err);
    });

    // Navigate to the exact URL given in the requirements
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // nothing to teardown beyond the Playwright fixtures
  });

  test.describe('Initial Idle State (S0_Idle) - DOM and entry action checks', () => {
    test('Idle state renders the Run Type Demonstration button and empty output', async ({ page }) => {
      // Validate presence of the button as evidence for S0_Idle
      const btn = await page.waitForSelector('#typeDemoBtn', { state: 'visible' });
      expect(await btn.textContent()).toBe('Run Type Demonstration');

      // Validate the demo output exists and is initially empty
      const output = await page.waitForSelector('#demoOutput');
      const outputText = (await output.textContent()).trim();
      expect(outputText).toBe(''); // idle state's evidence shows an empty output div

      // Verify that FSM entry action 'renderPage()' (mentioned in FSM) is not present in the global scope.
      // We do NOT call or define renderPage; we only assert its absence/presence to validate expectation handling.
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage === 'function');
      expect(hasRenderPage).toBe(false);

      // Also assert that there were no console.error or page errors during initial render
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: RunTypeDemo (S0_Idle -> S1_TypeDemoRunning)', () => {
    test('Clicking the button transitions to Type Demonstration Running and produces expected output lines', async ({ page }) => {
      // Ensure button exists and click it
      const btn = await page.waitForSelector('#typeDemoBtn', { state: 'visible' });
      await btn.click();

      // After click, the transition action output.innerHTML = '' should run and then the demo should append paragraphs.
      // Wait for demoOutput to contain paragraphs. There should be 6 lines produced by the demo.
      await page.waitForSelector('#demoOutput p');

      const paragraphs = await page.$$eval('#demoOutput p', ps => ps.map(p => p.textContent?.trim() ?? ''));
      // Validate number of produced paragraphs matches expected_observables (6)
      expect(paragraphs.length).toBe(6);

      // Validate each expected observable substring is present in appropriate paragraph(s).
      expect(paragraphs).toContain('Initial value: x = 5 (type: number)');
      expect(paragraphs).toContain('After reassignment: x = "hello" (type: string)');
      expect(paragraphs).toContain('Adding number to string: "5" + 2 = 52');
      expect(paragraphs).toContain('Subtracting from string: "5" - 2 = 3');
      expect(paragraphs).toContain('typeof null: object');
      expect(paragraphs).toContain('typeof []: object');

      // Confirm that the demo replaced the output (i.e., action output.innerHTML = '' ran before appending).
      // Click the button again and ensure we still have exactly 6 paragraphs (not cumulative 12).
      await btn.click();
      await page.waitForSelector('#demoOutput p');

      const paragraphsAfterSecondClick = await page.$$eval('#demoOutput p', ps => ps.map(p => p.textContent?.trim() ?? ''));
      expect(paragraphsAfterSecondClick.length).toBe(6);

      // Validate contents are still the expected ones after re-running (verifies reset behavior)
      expect(paragraphsAfterSecondClick).toContain('Initial value: x = 5 (type: number)');
      expect(paragraphsAfterSecondClick).toContain('After reassignment: x = "hello" (type: string)');

      // Ensure no console errors or page errors were produced during the interaction
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('DOM structure and types of outputs are correct (deep check of nodes & content formatting)', async ({ page }) => {
      // This test verifies the exact HTML structure the script appends (each line is wrapped in a <p>)
      const btn = await page.waitForSelector('#typeDemoBtn', { state: 'visible' });
      await btn.click();

      // Wait for paragraphs to be created
      await page.waitForSelector('#demoOutput p');

      // Verify that each child is a <p> element and contains expected characters like parentheses and type names
      const nodeInfos = await page.$$eval('#demoOutput p', ps => ps.map(p => ({
        tag: p.tagName,
        text: p.textContent ?? ''
      })));

      expect(nodeInfos.length).toBe(6);
      for (const info of nodeInfos) {
        expect(info.tag).toBe('P');
        // Each line should include a '(' and ')' for "(type: ...)" or other parentheses; at minimum non-empty text
        expect(info.text.trim().length).toBeGreaterThan(0);
      }

      // Ensure that the "After reassignment" line includes quotes around hello exactly as in the implementation
      const afterReassignment = nodeInfos.find(n => n.text.includes('After reassignment'));
      expect(afterReassignment).toBeTruthy();
      expect(afterReassignment.text).toContain('"hello"');

      // Validate again: no console or runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error observations', () => {
    test('Rapid multiple clicks do not produce duplicate accumulated outputs (output reset behavior)', async ({ page }) => {
      const btn = await page.waitForSelector('#typeDemoBtn', { state: 'visible' });

      // Click rapidly 5 times
      for (let i = 0; i < 5; i++) {
        await btn.click();
      }

      // Wait for paragraphs to be present, then assert exactly 6 paragraphs (reset each run)
      await page.waitForSelector('#demoOutput p');
      const paragraphs = await page.$$eval('#demoOutput p', ps => ps.map(p => p.textContent?.trim() ?? ''));
      expect(paragraphs.length).toBe(6);

      // Ensure expected lines are present
      expect(paragraphs).toContain('Initial value: x = 5 (type: number)');
      expect(paragraphs).toContain('typeof null: object');

      // Ensure still no console/page errors on repeated stress interactions
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Verify absence of unexpected global variables and functions referenced in FSM (do not invoke)', async ({ page }) => {
      // FSM mentions entry action renderPage(). Confirm it's not present; we DO NOT call it.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // Also confirm that there is no global 'output' variable leaking into window scope (implementation uses local const)
      const outputGlobalType = await page.evaluate(() => typeof window.output);
      expect(outputGlobalType).toBe('undefined');

      // Verify no page errors or console errors were registered simply by checking for globals
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Observe console messages (no console.error) and capture any runtime exceptions if they occur', async ({ page }) => {
      // Attach additional console listener in-test to snapshot console messages too (non-errors)
      const consoleMessages = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      // Trigger the demo to potentially cause errors
      const btn = await page.waitForSelector('#typeDemoBtn', { state: 'visible' });
      await btn.click();

      // Small wait to allow any async console messages or errors to surface
      await page.waitForTimeout(200);

      // Ensure that no console.error messages were emitted
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);

      // Ensure there were no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // For diagnostics: assert that normal console messages (if any) do not contain 'ReferenceError' etc.
      const suspicious = consoleMessages.find(m => /ReferenceError|TypeError|SyntaxError/.test(m.text));
      expect(suspicious).toBeUndefined();
    });
  });
});