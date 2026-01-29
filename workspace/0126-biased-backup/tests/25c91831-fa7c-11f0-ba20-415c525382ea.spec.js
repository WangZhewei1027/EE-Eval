import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c91831-fa7c-11f0-ba20-415c525382ea.html';

test.describe('Understanding Multisets demo (Application ID: 25c91831-fa7c-11f0-ba20-415c525382ea)', () => {
  // Arrays to capture runtime diagnostics from the page
  let consoleMessages = [];
  let pageErrors = [];

  // Reusable expected data derived from the page source
  const demoArray = ["apple", "banana", "apple", "orange", "banana", "apple", "pear"];
  const expectedCounts = { apple: 3, banana: 2, orange: 1, pear: 1 };
  const expectedOutput = (() => {
    let out = "Array elements:\n[ " + demoArray.join(", ") + " ]\n\n";
    out += "Multiset multiplicities:\n";
    // keys order follows first-seen order in demoArray: apple, banana, orange, pear
    out += `• apple: 3\n`;
    out += `• banana: 2\n`;
    out += `• orange: 1\n`;
    out += `• pear: 1\n`;
    return out;
  })();

  test.beforeEach(async ({ page }) => {
    // Reset diagnostic arrays before each test
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      // Convert to a string summary to simplify assertions
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test we ensure we recorded console and page errors arrays (tests may assert their contents)
    // This block intentionally left simple; individual tests perform assertions on these arrays.
  });

  test.describe('FSM State: S0_Idle (Initial render)', () => {
    test('Initial render shows the "Show Multiset Multiplicities Demo" button and an empty demo output', async ({ page }) => {
      // This test validates the Idle state entry action renderPage() - the button must be present and visible.
      const showDemo = await page.waitForSelector('#showDemo', { state: 'visible' });
      expect(await showDemo.innerText()).toBe('Show Multiset Multiplicities Demo');

      // Validate the demoOutput element exists and is initially empty
      const demoOutput = await page.waitForSelector('#demoOutput');
      const demoText = (await demoOutput.textContent()) ?? '';
      expect(demoText.trim()).toBe(''); // Should be empty at idle

      // Validate attributes and styles declared in FSM components
      expect(await demoOutput.getAttribute('class')).toContain('demo-output');
      expect(await demoOutput.getAttribute('aria-live')).toBe('polite');
      expect(await demoOutput.getAttribute('aria-atomic')).toBe('true');

      // Assert no unexpected page errors happened while loading initial state
      expect(pageErrors.length, `Unexpected page errors on initial render: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    });

    test('Console did not emit uncaught exceptions (no ReferenceError/SyntaxError/TypeError) on initial load', async ({ page }) => {
      // This test inspects captured page errors and console messages to ensure no fatal runtime errors happened during load.
      const fatalErrors = pageErrors.filter(err => {
        const name = err?.name || '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });
      expect(fatalErrors.length).toBe(0);
    });
  });

  test.describe('FSM Transition: S0_Idle -> S1_DemoDisplayed via ShowDemo (click #showDemo)', () => {
    test('Clicking the demo button displays the array and multiset multiplicities in the expected format', async ({ page }) => {
      // Validate initial assertions again for safety
      await page.waitForSelector('#showDemo', { state: 'visible' });
      const button = await page.$('#showDemo');

      // Click the button to trigger the transition
      await Promise.all([
        page.waitForFunction(() => {
          const el = document.getElementById('demoOutput');
          return el && el.textContent && el.textContent.trim().length > 0;
        }),
        button.click()
      ]);

      // Verify the demoOutput text content exactly matches the constructed expected output
      const demoOutputHandle = await page.$('#demoOutput');
      const actualText = (await demoOutputHandle.textContent()) ?? '';
      expect(actualText).toBe(expectedOutput);

      // Additional checks: ensure that the output uses textContent (not HTML injection)
      // The demoOutput should not contain HTML tags like <div> or <span>
      expect(actualText).not.toContain('<div>');
      expect(actualText).not.toContain('<span>');

      // Confirm the multiset counts by parsing the displayed content
      // Extract lines starting with bullet and build an object for comparison
      const countsFromText = {};
      const bulletLines = actualText.split('\n').filter(line => line.trim().startsWith('•'));
      for (const line of bulletLines) {
        // line format: '• key: val'
        const match = line.match(/•\s*(.+?):\s*(\d+)/);
        if (match) {
          countsFromText[match[1]] = Number(match[2]);
        }
      }
      expect(countsFromText).toEqual(expectedCounts);

      // Ensure no page errors were emitted as a result of clicking/processing
      const fatalErrors = pageErrors.filter(err => {
        const name = err?.name || '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });
      expect(fatalErrors.length).toBe(0);
    });

    test('Clicking the demo button multiple times does not append duplicate results (idempotence of display)', async ({ page }) => {
      // Click the button once and capture output
      await page.waitForSelector('#showDemo', { state: 'visible' });
      const btn = await page.$('#showDemo');
      await btn.click();
      await page.waitForFunction(() => {
        const el = document.getElementById('demoOutput');
        return el && el.textContent && el.textContent.includes('Multiset multiplicities:');
      });

      const firstText = ((await (await page.$('#demoOutput')).textContent()) || '');

      // Click again and ensure textContent is replaced (not appended) and equals the same expected output
      await btn.click();
      // Wait for a short time to let handler run; content should be stable quickly
      await page.waitForTimeout(50);
      const secondText = ((await (await page.$('#demoOutput')).textContent()) || '');

      // Both captures should be identical and match expected output
      expect(firstText).toBe(secondText);
      expect(secondText).toBe(expectedOutput);
    });

    test('Underlying countMultiset function produces correct object when invoked directly in page context', async ({ page }) => {
      // Evaluate the function in page context without changing any page state
      const counts = await page.evaluate(() => {
        // Access the demoArray and countMultiset function defined on the page
        // Note: we do not modify these functions, only call them as-is
        const result = (typeof countMultiset === 'function' && typeof demoArray !== 'undefined')
          ? countMultiset(demoArray)
          : null;
        return result;
      });

      // The evaluation should yield the same counts as expectedCounts
      expect(counts).not.toBeNull();
      expect(counts).toEqual(expectedCounts);
    });
  });

  test.describe('Edge cases & error observation', () => {
    test('Attempt to query non-existent elements should not throw fatal page errors', async ({ page }) => {
      // This test attempts to access an element that does not exist, in a safe manner, and ensures no crash
      // We intentionally perform a safe access: document.getElementById('nonExistent') and check null
      const nonExistent = await page.evaluate(() => {
        try {
          return document.getElementById('thisElementDoesNotExist');
        } catch (e) {
          // Return a serializable representation of the error if thrown
          return { __error: e && e.message ? e.message : String(e) };
        }
      });

      // Should simply be null; not an error object
      expect(nonExistent).toBeNull();

      // Also assert that no page errors have the fatal types
      const fatalErrors = pageErrors.filter(err => {
        const name = err?.name || '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });
      expect(fatalErrors.length).toBe(0);
    });

    test('Page console messages are captured and do not contain uncaught exceptions by type', async ({ page }) => {
      // This test inspects collected console messages for any obvious 'Error' strings
      const errorLikeConsole = consoleMessages.filter(m => /error/i.test(m.text) || m.type === 'error');
      // It's acceptable for there to be warnings/info; but there should be no console error messages indicating runtime failures
      expect(errorLikeConsole.length).toBe(0);
    });
  });
});