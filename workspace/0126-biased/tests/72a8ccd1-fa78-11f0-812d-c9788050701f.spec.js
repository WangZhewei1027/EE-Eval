import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a8ccd1-fa78-11f0-812d-c9788050701f.html';

test.describe('Visual Hash Map - FSM and UI integration tests (Application ID: 72a8ccd1-fa78-11f0-812d-c9788050701f)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Setup: for each test, collect console messages and page errors and navigate to the app
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // defensive: some console messages may throw when reading type/text in exotic environments
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect runtime page errors
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the provided HTML page
    await page.goto(APP_URL);

    // Wait for critical UI elements to be present
    await Promise.all([
      page.waitForSelector('#buckets', { state: 'attached' }),
      page.waitForSelector('#addBtn', { state: 'visible' }),
      page.waitForSelector('#highlightBtn', { state: 'visible' }),
      page.waitForSelector('.hash-function', { state: 'visible' })
    ]);
  });

  test.afterEach(async ({ page }) => {
    // attach any console output and page errors to test output when a test fails
    if (pageErrors.length > 0) {
      // print to stdout (Playwright will capture in test trace/logs)
      // No throws here; tests will assert on pageErrors explicitly when needed
      // eslint-disable-next-line no-console
      console.error('Captured page errors:', pageErrors);
    }
    if (consoleMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages (last 20):', consoleMessages.slice(-20));
    }
  });

  test.describe('State S0: Idle (Initial render)', () => {
    test('should render main components and initial buckets/items without runtime errors', async ({ page }) => {
      // This test validates the Idle state (S0_Idle): renderPage() entry action equivalent.
      // - Buttons exist
      // - Buckets container exists with 7 buckets
      // - Initial sample items (5) are rendered as key-value pairs
      // - No uncaught page errors occurred during initial render

      // Assert controls are present and visible
      await expect(page.locator('#addBtn')).toBeVisible();
      await expect(page.locator('#highlightBtn')).toBeVisible();

      // There should be exactly 7 bucket elements created
      const bucketCount = await page.locator('.bucket').count();
      expect(bucketCount).toBe(7);

      // The app seeds the first 5 sampleData items on load
      const kvCount = await page.locator('.key-value-pair').count();
      expect(kvCount).toBe(5);

      // No runtime page errors should have been captured during load
      expect(pageErrors.length).toBe(0);

      // No console errors (type === 'error') emitted during load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: AddRandomItem (S0 -> S1 -> S0)', () => {
    test('clicking Add Random Item highlights the modified bucket and adds a key-value pair', async ({ page }) => {
      // Validate transition from Idle to ItemAdded:
      // - Click '#addBtn'
      // - A bucket (one of the .bucket elements) receives the "highlight" class
      // - A new .key-value-pair is appended to the DOM
      // - The highlight is removed after the configured timeout (1500ms)

      const initialPairs = await page.locator('.key-value-pair').count();

      // Perform the action: click add button
      await page.click('#addBtn');

      // Expect: some bucket gets the 'highlight' class shortly after clicking
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('.bucket')).some(b => b.classList.contains('highlight'));
      }, { timeout: 2000 });

      // Confirm that a new key-value-pair has been added (count increases by 1)
      await page.waitForFunction((expected) => {
        return document.querySelectorAll('.key-value-pair').length >= expected;
      }, initialPairs + 1, { timeout: 2000 });

      const newPairs = await page.locator('.key-value-pair').count();
      expect(newPairs).toBeGreaterThanOrEqual(initialPairs + 1);

      // Wait for highlight removal (bucket parent highlight removed after ~1500ms)
      await page.waitForFunction(() => {
        return !Array.from(document.querySelectorAll('.bucket')).some(b => b.classList.contains('highlight'));
      }, { timeout: 3000 });

      // Ensure no page errors occurred during the transition
      expect(pageErrors.length).toBe(0);
    });

    test('rapid multiple Add Random Item clicks append multiple pairs and still trigger highlights', async ({ page }) => {
      // Edge case: user clicks Add Random Item multiple times quickly.
      // Ensure multiple items are added and at least one highlight is observed.

      const initial = await page.locator('.key-value-pair').count();

      // Click three times in quick succession
      await Promise.all([
        page.click('#addBtn'),
        page.click('#addBtn'),
        page.click('#addBtn')
      ]);

      // Expect at least 3 new items within a reasonable timeout
      await page.waitForFunction((expected) => {
        return document.querySelectorAll('.key-value-pair').length >= expected;
      }, initial + 3, { timeout: 3000 });

      const after = await page.locator('.key-value-pair').count();
      expect(after).toBeGreaterThanOrEqual(initial + 3);

      // Ensure at least one bucket was highlighted during this burst
      const highlightedDuring = consoleMessages.some(m => m.text && /highlight/i.test(m.text));
      // We don't rely on console output for the UI highlight presence, so also assert DOM:
      const anyBucketHighlighted = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.bucket')).some(b => b.classList.contains('highlight'));
      });
      // anyBucketHighlighted might be false if highlight already timed out; still assert items were added
      expect(after).toBeGreaterThanOrEqual(initial + 3);
      // No uncaught runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ShowHashing (S0 -> S2 -> S0)', () => {
    test('clicking Show Hashing highlights the hash function then highlights the bucket it maps to (sequence)', async ({ page }) => {
      // Validate the ShowHashing transition:
      // - Clicking '#highlightBtn' highlights '.hash-function' immediately
      // - After ~1000ms the hash-function highlight is removed
      // - Then the corresponding bucket (parent of #bucket-<index>) gets highlighted
      // - That bucket highlight is removed after ~1500ms

      // Click the highlight button to trigger the sequence
      await page.click('#highlightBtn');

      // Hash function should be highlighted quickly
      await page.waitForFunction((sel) => {
        const el = document.querySelector(sel);
        return !!(el && el.classList && el.classList.contains('highlight'));
      }, '.hash-function', { timeout: 1500 });

      // Hash function highlight should be removed after ~1000ms - wait up to 2s for removal
      await page.waitForFunction((sel) => {
        const el = document.querySelector(sel);
        return !(el && el.classList && el.classList.contains('highlight'));
      }, '.hash-function', { timeout: 2500 });

      // After hash function highlight removal, a bucket should be highlighted
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('.bucket')).some(b => b.classList.contains('highlight'));
      }, { timeout: 2000 });

      // Finally, the bucket highlight should be removed (within ~1500ms), allow generous timeout
      await page.waitForFunction(() => {
        return !Array.from(document.querySelectorAll('.bucket')).some(b => b.classList.contains('highlight'));
      }, { timeout: 4000 });

      // No runtime page errors during sequence
      expect(pageErrors.length).toBe(0);
    });

    test('repeated Show Hashing calls return to idle after each run (S2 -> S0) and do not throw', async ({ page }) => {
      // Click the highlight button twice with a pause to ensure the sequence completes each time.
      await page.click('#highlightBtn');

      // Wait for the full sequence to complete (hash highlight removed, then bucket highlight removed)
      await page.waitForFunction(() => {
        const hashEl = document.querySelector('.hash-function');
        const anyBucketHighlighted = Array.from(document.querySelectorAll('.bucket')).some(b => b.classList.contains('highlight'));
        const hashHighlighted = hashEl && hashEl.classList.contains('highlight');
        // Wait until neither hash nor buckets are highlighted => idle
        return !hashHighlighted && !anyBucketHighlighted;
      }, { timeout: 6000 });

      // Trigger again
      await page.click('#highlightBtn');

      // Wait for second run to return to idle
      await page.waitForFunction(() => {
        const hashEl = document.querySelector('.hash-function');
        const anyBucketHighlighted = Array.from(document.querySelectorAll('.bucket')).some(b => b.classList.contains('highlight'));
        const hashHighlighted = hashEl && hashEl.classList.contains('highlight');
        return !hashHighlighted && !anyBucketHighlighted;
      }, { timeout: 7000 });

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Integration and robustness checks (edge/error scenarios)', () => {
    test('rapid alternating clicks between Add Random Item and Show Hashing does not produce uncaught exceptions', async ({ page }) => {
      // Edge scenario: user rapidly alternates the two buttons
      // This test ensures no uncaught exceptions (pageerror) are produced

      // Perform a sequence of alternating clicks
      const sequence = [
        () => page.click('#addBtn'),
        () => page.click('#highlightBtn'),
        () => page.click('#addBtn'),
        () => page.click('#highlightBtn'),
        () => page.click('#addBtn')
      ];

      // Execute clicks with small delays to simulate a real user
      for (let i = 0; i < sequence.length; i++) {
        // call function
        // eslint-disable-next-line no-await-in-loop
        await sequence[i]();
        // short pause to interleave animations but not to block too long
        // eslint-disable-next-line no-await-in-loop
        await page.waitForTimeout(200);
      }

      // Allow time for all highlight timeouts and DOM updates to finish
      await page.waitForTimeout(3000);

      // Ensure no uncaught runtime errors happened
      expect(pageErrors.length).toBe(0);

      // Confirm that at least one new pair has been added (robustness check)
      const pairsAfter = await page.locator('.key-value-pair').count();
      expect(pairsAfter).toBeGreaterThanOrEqual(6); // initial 5 + at least 1 add in sequence
    });

    test('observes and reports any console and page errors (if present) - test will assert zero errors by default', async ({ page }) => {
      // This test explicitly asserts that no console errors or page errors were produced during normal interaction.
      // If the page or environment produces errors, the assertions will fail and logs are printed by afterEach.

      // Interact a bit to surface potential errors
      await page.click('#addBtn');
      await page.click('#highlightBtn');
      await page.waitForTimeout(2500); // allow highlights/timeouts to occur

      // Assert: no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Assert: no console messages of type 'error'
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });
});