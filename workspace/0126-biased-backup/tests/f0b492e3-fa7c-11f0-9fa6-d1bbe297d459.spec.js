import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b492e3-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Understanding Interpreters - Application f0b492e3-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Shared holders for console and page errors collected during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors before navigation so we capture load-time errors too
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as provided
    await page.goto(APP_URL);
  });

  test.describe('State: S0_Idle (Initial state)', () => {
    test('Initial Idle state: Run Interpretation Demo button is present and #demo-output is hidden', async ({ page }) => {
      // Validate the button exists and has the expected onclick attribute
      const button = await page.waitForSelector("button[onclick='runDemo()']");
      expect(button).not.toBeNull();
      const buttonText = await button.innerText();
      // The FSM expects exact text on the button
      expect(buttonText).toContain('Run Interpretation Demo');

      // Check attribute onclick exactly matches runDemo()
      const onclickAttr = await button.getAttribute('onclick');
      expect(onclickAttr).toBe('runDemo()');

      // The demo output should initially be hidden (display: none)
      const output = await page.$('#demo-output');
      expect(output).not.toBeNull();

      // Check inline style property set to display: none; in the HTML
      // We examine both computed style and inline style to be thorough
      const inlineDisplay = await page.evaluate((el) => el.getAttribute('style'), output);
      // Inline attribute may be absent; the HTML declared style "display: none;" in components evidence,
      // but stylesheet sets display: none as well. Accept either that inline contains 'display: none' or computed style is none.
      const computedDisplay = await page.evaluate((el) => window.getComputedStyle(el).display, output);
      expect(
        inlineDisplay === null
          ? computedDisplay
          : inlineDisplay.includes('display: none') || computedDisplay === 'none'
      ).toBeTruthy();

      // The output container should be empty at load (no interpretive content)
      const initialHTML = await page.evaluate((el) => el.innerHTML.trim(), output);
      expect(initialHTML === '' || initialHTML === '<!-- -->').toBeTruthy();

      // Ensure no uncaught page errors were reported during load (we observe but do not patch)
      expect(pageErrors.length).toBe(0);

      // Also ensure there were no console messages of type 'error' emitted during load
      const errorConsole = consoleMessages.filter((m) => m.type === 'error' || m.type === 'assert');
      expect(errorConsole.length).toBe(0);
    });

    test('Entry action renderPage() is mentioned in FSM but not defined in page (verify its absence)', async ({ page }) => {
      // The FSM lists renderPage() as an entry action; verify whether the function exists on window
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      // According to the provided HTML, renderPage() is NOT implemented. We assert that it's absent.
      expect(hasRenderPage).toBe(false);

      // Confirm that absence did not cause any runtime exceptions during load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: RunDemo (S0_Idle -> S1_DemoRunning)', () => {
    test('Clicking Run Interpretation Demo displays #demo-output with interpretation steps', async ({ page }) => {
      // Locate and click the demo button (event: RunDemo)
      const button = await page.waitForSelector("button[onclick='runDemo()']");
      await button.click();

      // The application uses inline style to set display='block', wait for that change
      const output = await page.waitForSelector('#demo-output', { state: 'attached' });

      // Wait for the element to become visible (display != none)
      await page.waitForFunction(() => {
        const el = document.getElementById('demo-output');
        if (!el) return false;
        return window.getComputedStyle(el).display !== 'none';
      });

      // Verify style.display was set to 'block' by the runDemo function
      const inlineDisplayAfter = await page.evaluate((el) => el.style.display, output);
      expect(inlineDisplayAfter).toBe('block');

      // Validate that the output contains expected interpretation steps/evidence
      const outputText = await page.evaluate((el) => el.textContent, output);
      expect(outputText).toContain('Interpreting');
      expect(outputText).toContain('Lexical Analysis');
      expect(outputText).toContain('Parsing');
      expect(outputText).toContain('Evaluation');
      expect(outputText).toContain("Variable 'result'"); // evidence mentions variable 'result'
      expect(outputText).toContain('16'); // result 16 should be mentioned

      // Check that expected markup exists (h3 with code)
      const codeText = await page.$eval('#demo-output h3 code', (c) => c.textContent.trim());
      expect(codeText).toBe('result = (5 + 3) * 2');

      // Confirm that invoking the demo triggered no uncaught exceptions
      expect(pageErrors.length).toBe(0);

      // No console errors created by clicking the button
      const errorConsoleAfterClick = consoleMessages.filter((m) => m.type === 'error' || m.type === 'assert');
      expect(errorConsoleAfterClick.length).toBe(0);
    });

    test('Clicking the demo button multiple times is idempotent (innerHTML remains consistent)', async ({ page }) => {
      const button = await page.waitForSelector("button[onclick='runDemo()']");

      // First click
      await button.click();
      await page.waitForSelector('#demo-output', { state: 'visible' });
      const firstHTML = await page.$eval('#demo-output', (el) => el.innerHTML);

      // Second click
      await button.click();
      // Wait briefly to let any DOM updates occur
      await page.waitForTimeout(100);
      const secondHTML = await page.$eval('#demo-output', (el) => el.innerHTML);

      // Since runDemo assigns innerHTML directly, it should be identical after repeated clicks
      expect(secondHTML).toBe(firstHTML);

      // There should be no duplicate outlines (simple sanity check: exactly one top-level h3)
      const h3Count = await page.$$eval('#demo-output h3', (els) => els.length);
      expect(h3Count).toBe(1);

      // Ensure no runtime errors occurred due to repeated invocations
      expect(pageErrors.length).toBe(0);
    });

    test('Keyboard activation of the button (Enter key) triggers the same transition', async ({ page }) => {
      const button = await page.waitForSelector("button[onclick='runDemo()']");
      // Focus and press Enter
      await button.focus();
      await page.keyboard.press('Enter');

      // Wait for visibility
      await page.waitForSelector('#demo-output', { state: 'visible' });
      const visible = await page.$eval('#demo-output', (el) => window.getComputedStyle(el).display !== 'none');
      expect(visible).toBe(true);

      // Content checks
      const text = await page.$eval('#demo-output', (el) => el.textContent);
      expect(text).toContain('Lexical Analysis');
      expect(text).toContain('Evaluation');

      // No uncaught errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Verify that missing FSM-specified function (renderPage) would be detectable (no automatic call on load)', async ({ page }) => {
      // We intentionally do not call renderPage (not allowed to inject or patch).
      // Verify that if renderPage were required and missing it didn't cause a runtime error on load.
      expect(pageErrors.length).toBe(0);

      // For robustness, verify that window.runDemo exists (it should), while renderPage does not
      const hasRunDemo = await page.evaluate(() => typeof window.runDemo === 'function');
      expect(hasRunDemo).toBe(true);
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage === 'function');
      expect(hasRenderPage).toBe(false);
    });

    test('Observe console messages and assert there are no unexpected errors during typical interactions', async ({ page }) => {
      // Clear any previous captured messages, then perform actions
      consoleMessages = [];
      pageErrors = [];

      // Click button to run demo
      const button = await page.waitForSelector("button[onclick='runDemo()']");
      await button.click();

      // Small wait to capture any delayed console output
      await page.waitForTimeout(200);

      // Ensure pageerror did not capture anything
      expect(pageErrors.length).toBe(0);

      // Filter console errors and warnings for scrutiny
      const errors = consoleMessages.filter((m) => m.type === 'error');
      const warnings = consoleMessages.filter((m) => m.type === 'warning');

      // Application is static and not expected to emit console errors; assert zero
      expect(errors.length).toBe(0);

      // Warnings are allowed but we assert none for this simple page
      expect(warnings.length).toBe(0);
    });

    test('Attempt to trigger transition via programmatic click (element.click()) and ensure same outcome without injecting functions', async ({ page }) => {
      // Use page.evaluate to call click() on the element (simulates programmatic trigger)
      await page.evaluate(() => {
        const btn = document.querySelector("button[onclick='runDemo()']");
        if (btn) btn.click();
      });

      // Wait for result to be visible
      await page.waitForSelector('#demo-output', { state: 'visible' });

      // Verify that the output is displayed and contains expected phrases
      const outputVisible = await page.$eval('#demo-output', (el) => window.getComputedStyle(el).display === 'block');
      expect(outputVisible).toBe(true);

      const content = await page.$eval('#demo-output', (el) => el.textContent);
      expect(content).toContain('Assign 16 to variable \'result\''); // check for a phrase describing assignment or similar
    });
  });

  test.afterEach(async ({ page }) => {
    // Final sanity: no uncaught exceptions during the test lifecycle
    expect(pageErrors.length).toBe(0);

    // No console errors observed
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'assert');
    expect(consoleErrors.length).toBe(0);

    // Close page to ensure clean teardown (Playwright usually handles this)
    await page.close();
  });
});