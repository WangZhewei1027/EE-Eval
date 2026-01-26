import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8368b21-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Dynamic Programming demo (d8368b21-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Increase timeout because the demo runs expensive synchronous computations (naive fib).
  test.setTimeout(2 * 60 * 1000);

  // Shared helper to attach console/pageerror listeners and return collectors.
  async function attachCollectors(page) {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    return { consoleMessages, pageErrors };
  }

  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto(APP_URL);
  });

  test.describe('State S0_Idle (Initial render)', () => {
    test('renders the main demo controls and informative text (Idle state)', async ({ page }) => {
      // Attach collectors to observe console logs and page errors during initial render
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Validate the Run demo button exists with expected id, class and label
      const btn = await page.locator('#runDemo');
      await expect(btn).toHaveCount(1);
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute('class', /demo/);
      await expect(btn).toHaveText('Run demo: compare fib(36)');

      // Validate the results container exists and contains initial instructional text
      const out = await page.locator('#demoResults');
      await expect(out).toHaveCount(1);
      await expect(out).toBeVisible();
      await expect(out).toHaveAttribute('aria-live', 'polite');
      await expect(out).toHaveText('Demo not yet run. Click the button to run.');

      // Assert there were no runtime page errors during initial load
      expect(pageErrors.length, 'no page errors on load').toBe(0);

      // Assert no console.error messages were emitted during load
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length, 'no console.error on load').toBe(0);
    });
  });

  test.describe('Transition S0_Idle -> S1_DemoRunning (RunDemo event)', () => {
    test('clicking the Run demo button sets results text to "Running..." (Demo Running)', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Click the Run demo button and immediately verify running state
      await page.click('#runDemo');

      // The script sets out.textContent = 'Running...' synchronously at the start of runDemo.
      // Ensure that intermediate state is observed.
      const out = page.locator('#demoResults');
      await expect(out).toHaveText('Running...');

      // Ensure no page errors or console.error occurred immediately after clicking
      expect(pageErrors.length, 'no page errors after click').toBe(0);
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length, 'no console.error after click').toBe(0);
    });
  });

  test.describe('Transition S1_DemoRunning -> S2_DemoCompleted (Demo Completed)', () => {
    test('demo completes and displays the expected result sections and numeric values', async ({ page }) => {
      // Collect console and page errors during the full run
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Start the demo
      await page.click('#runDemo');

      // Wait for the final output to appear. The final output contains "Naive recursion:" and "Bottom-up tabulation:"
      // The computation is synchronous and may take a moderate amount of time; use an extended timeout.
      const out = page.locator('#demoResults');

      // Wait until output contains at least one marker of completion; use a long timeout to allow computation.
      await expect.poll(async () => (await out.textContent()) || '', {
        message: 'waiting for demo completion text to appear',
        timeout: 90 * 1000
      }).toMatch(/Naive recursion:|Bottom-up tabulation:|n = 36/);

      const finalText = (await out.textContent()) || '';

      // Assertions that verify the Demo Completed state's expected evidence/content
      await expect(finalText).toContain('n = 36');
      await expect(finalText).toContain('Naive recursion:');
      await expect(finalText).toContain('Top-down memoization:');
      await expect(finalText).toContain('Bottom-up tabulation:');

      // Parse numeric values from the output to assert internal consistency:
      // - a value for naive recursion 'value = X'
      // - calls for naive recursion 'calls = Y'
      // - memoization calls '(...) = Z'
      // - bottom-up value 'value = W'
      const getNumber = (pattern) => {
        const re = new RegExp(pattern);
        const m = finalText.match(re);
        if (!m) return null;
        // Get last capturing group that matched number
        for (let i = m.length - 1; i >= 1; --i) {
          const g = m[i];
          if (g !== undefined) {
            const numStr = g.replace(/[^0-9.]/g, '');
            const num = Number(numStr);
            return Number.isNaN(num) ? null : num;
          }
        }
        return null;
      };

      // Extract values and counts
      const naiveValue = getNumber('Naive recursion:[\\s\\S]*?value =\\s*([0-9]+)');
      const naiveCalls = getNumber('Naive recursion:[\\s\\S]*?calls =\\s*([0-9]+)');
      const memoValue = getNumber('Top-down memoization:[\\s\\S]*?value =\\s*([0-9]+)');
      const memoCalls = getNumber('Top-down memoization:[\\s\\S]*?\\)=\\s*([0-9]+)');
      const tabValue = getNumber('Bottom-up tabulation:[\\s\\S]*?value =\\s*([0-9]+)');

      // Ensure numeric values were parsed
      expect(naiveValue, 'naive value parsed').not.toBeNull();
      expect(naiveCalls, 'naive calls parsed').not.toBeNull();
      expect(memoValue, 'memo value parsed').not.toBeNull();
      expect(memoCalls, 'memo calls parsed').not.toBeNull();
      expect(tabValue, 'tabulation value parsed').not.toBeNull();

      // The computed values should agree across methods
      expect(naiveValue).toBe(memoValue);
      expect(naiveValue).toBe(tabValue);

      // The naive recursive call count should be larger (often much larger) than memoized call count
      // We assert a strict inequality when both are numbers.
      expect(naiveCalls > memoCalls, 'naiveCalls should exceed memoCalls due to overlapping subproblems').toBe(true);

      // Assert timing strings exist and are parseable floats for each section (basic sanity check)
      const parseTimeMs = (label) => {
        const re = new RegExp(label + '[\\s\\S]*?time\\s*=\\s*([0-9]+\\.[0-9]{3})\\s*ms');
        const m = finalText.match(re);
        if (!m) return null;
        return parseFloat(m[1]);
      };
      const naiveTime = parseTimeMs('Naive recursion:');
      const memoTime = parseTimeMs('Top-down memoization:');
      const tabTime = parseTimeMs('Bottom-up tabulation:');

      expect(naiveTime, 'naive time parsed').not.toBeNull();
      expect(memoTime, 'memo time parsed').not.toBeNull();
      expect(tabTime, 'tab time parsed').not.toBeNull();

      // There should be no uncaught exceptions captured by pageerror during the entire run
      expect(pageErrors.length, 'no uncaught page errors during demo run').toBe(0);

      // There should be no console.error messages
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length, 'no console.error messages during demo run').toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('rapid double-click does not crash the page and finishes with valid output', async ({ page }) => {
      // Attach collectors explicitly here
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Perform two quick clicks in succession
      // Do not await between clicks to simulate rapid user interaction.
      const button = page.locator('#runDemo');
      await Promise.all([
        button.click(),
        button.click()
      ]);

      // Wait for demo to complete as in previous test
      const out = page.locator('#demoResults');
      await expect.poll(async () => (await out.textContent()) || '', {
        message: 'waiting for demo completion after double-click',
        timeout: 90 * 1000
      }).toMatch(/Naive recursion:|Bottom-up tabulation:|n = 36/);

      const finalText = (await out.textContent()) || '';

      // Basic sanity checks on final content
      expect(finalText.includes('n = 36')).toBe(true);
      expect(finalText.includes('Naive recursion:')).toBe(true);

      // Ensure no uncaught page errors or console.error entries were produced by rapid clicks
      expect(pageErrors.length, 'no page errors after rapid double-click').toBe(0);
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length, 'no console.error after rapid double-click').toBe(0);
    });

    test('observes and reports any runtime exceptions if they occur (no modifications allowed)', async ({ page }) => {
      // This test demonstrates observation: we will capture console and pageerror events
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Perform a normal run to trigger any potential runtime issues
      await page.click('#runDemo');

      // Wait for completion (or at least a clear progression)
      const out = page.locator('#demoResults');
      await expect.poll(async () => (await out.textContent()) || '', {
        message: 'waiting for demo completion for error observation',
        timeout: 90 * 1000
      }).toMatch(/Naive recursion:|Bottom-up tabulation:|n = 36/);

      // If any page errors occurred, surface them as test failures with details.
      if (pageErrors.length > 0) {
        // Fail with collected error messages for diagnostic purposes.
        const errMessages = pageErrors.map(e => e && e.stack ? e.stack : String(e)).join('\n---\n');
        throw new Error('Page had uncaught exceptions during demo run:\n' + errMessages);
      }

      // If console.error messages exist, fail and include them.
      const errorConsole = consoleMessages.filter(m => m.type === 'error');
      if (errorConsole.length > 0) {
        const msgs = errorConsole.map(m => `[console.${m.type}] ${m.text}`).join('\n');
        throw new Error('Console emitted error messages during demo run:\n' + msgs);
      }

      // If no errors were observed, assert that explicitly
      expect(pageErrors.length).toBe(0);
      expect(errorConsole.length).toBe(0);
    });
  });
});