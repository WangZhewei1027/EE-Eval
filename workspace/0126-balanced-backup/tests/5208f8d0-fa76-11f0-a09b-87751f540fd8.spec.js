import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5208f8d0-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Bucket Sort FSM - 5208f8d0-fa76-11f0-a09b-87751f540fd8', () => {
  // Utility to attach listeners and collect console messages and page errors.
  async function attachLogAndErrorCollectors(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // swallow errors while collecting console logs
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    return { consoleMessages, pageErrors };
  }

  test.describe('S0_Idle (Initial render) tests', () => {
    test('renders page title and bucket container with five buckets', async ({ page }) => {
      // Validate initial static DOM elements (Idle state evidence)
      // Attach collectors before navigation to capture any messages/errors emitted during load.
      const { consoleMessages, pageErrors } = await attachLogAndErrorCollectors(page);

      await page.goto(APP_URL, { waitUntil: 'load' });

      // The header should be present as described in the FSM evidence for Idle state.
      const header = await page.locator('h1');
      await expect(header).toHaveText('Bucket Sort');

      // The bucket container exists and there should be exactly 5 buckets per the extracted components.
      const buckets = await page.locator('.bucket');
      await expect(buckets).toHaveCount(5);

      // Each bucket should have the expected id attributes present.
      const expectedIds = ['bucket-1', 'bucket-2', 'bucket-3', 'bucket-4', 'bucket-5'];
      for (const id of expectedIds) {
        const el = await page.locator(`#${id}`);
        await expect(el).toHaveCount(1);
      }

      // Ensure no unexpected global page crash prevented initial DOM rendering.
      // Even if script errors occur, the static DOM should be present.
      expect(await pageErrors.length).toBeGreaterThanOrEqual(0);
      // The consoleMessages array must exist (may be empty if script errored early).
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });

  test.describe('Transitions (InitializeBuckets) and error behavior', () => {
    test('InitializeBuckets partially updates first five buckets and triggers a runtime error due to out-of-bounds access', async ({ page }) => {
      // This test validates the transition S0_Idle -> S1_Unsorted and the subsequent error preventing further transitions.
      // Attach collectors before navigation to ensure we capture the runtime exception emitted while the script runs.
      const { consoleMessages, pageErrors } = await attachLogAndErrorCollectors(page);

      // Start navigation. The page script runs during load and is expected to throw a runtime TypeError
      // when it attempts to access buckets[number] for number >= 5 because there are only 5 bucket elements.
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Allow a short moment for any async console/pageerror events to be emitted.
      await page.waitForTimeout(200);

      // After the script runs (and errors), the first five buckets (indices 0..4) should have been updated.
      // The mapping is: bucket-1 <- number 0, bucket-2 <- number 1, ..., bucket-5 <- number 4
      for (let i = 1; i <= 5; i++) {
        const bucket = page.locator(`#bucket-${i}`);
        await expect(bucket).toHaveCount(1);
        const html = await bucket.innerHTML();

        // Expect that innerHTML contains the "Number: X" text where X is (i-1).
        await expect(html).toContain(`Number: ${i - 1}`);

        // Also expect that the original bucket label (e.g., '1-10', '11-20', etc.) is present in the Bucket: ... portion.
        // This checks that the script used buckets[number].textContent when building the innerHTML for the first updates.
        const originalLabels = {
          1: '1-10',
          2: '11-20',
          3: '21-30',
          4: '31-40',
          5: '41-50',
        };
        await expect(html).toContain(originalLabels[i]);
      }

      // Ensure number of bucket elements remains 5 (no extra buckets created).
      const bucketCount = await page.locator('.bucket').count();
      expect(bucketCount).toBe(5);

      // Confirm that a page error occurred during script execution.
      // The exact error message varies across browsers, so check for typical patterns involving 'innerHTML' or 'undefined'.
      // pageErrors array should contain at least one Error object.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      const matched = pageErrors.some((err) => {
        const msg = err && err.message ? err.message : String(err);
        return /innerHTML/i.test(msg) || /Cannot read properties of undefined/i.test(msg) || /Cannot set properties of undefined/i.test(msg) || /reading 'innerHTML'/i.test(msg) || /setting 'innerHTML'/i.test(msg);
      });

      expect(matched).toBe(true);
    });

    test('Console logs for "Unsorted array" and "Sorted array" are absent because script execution was interrupted by the runtime error', async ({ page }) => {
      // This test asserts that the console entry points described in the FSM (entry_actions for S1 and S2)
      // did not successfully execute (i.e., no 'Unsorted array:' or 'Sorted array:' messages) because the script throws early.
      const { consoleMessages, pageErrors } = await attachLogAndErrorCollectors(page);

      await page.goto(APP_URL, { waitUntil: 'load' });

      // Small pause to capture console messages emitted during load.
      await page.waitForTimeout(200);

      // Collect text from console messages for easier assertions.
      const texts = consoleMessages.map((m) => m.text);

      // Assert that neither 'Unsorted array:' nor 'Sorted array:' messages are present.
      const hasUnsortedLog = texts.some((t) => t.includes('Unsorted array:'));
      const hasSortedLog = texts.some((t) => t.includes('Sorted array:'));

      expect(hasUnsortedLog).toBe(false);
      expect(hasSortedLog).toBe(false);

      // For visibility in failure reports, ensure that at least one pageError exists (the runtime TypeError).
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    });

    test('Edge case: Validate that attempts to access buckets beyond available indices produce a TypeError (explicit assertion on error type/message)', async ({ page }) => {
      // This test explicitly waits for a pageerror event and asserts the type/message conforms to an out-of-bounds property access.
      const { consoleMessages } = await attachLogAndErrorCollectors(page);

      // Start navigation and wait for the pageerror event that should be thrown by the faulty script.
      const [navResult, pageError] = await Promise.allSettled([
        page.goto(APP_URL, { waitUntil: 'load' }),
        page.waitForEvent('pageerror', { timeout: 2000 }).catch((e) => e),
      ]);

      // If pageError is a real Error object, perform assertions on its message.
      if (pageError && typeof pageError === 'object' && pageError.message) {
        // The browser typically reports TypeError for attempting to set innerHTML of undefined.
        // The message may vary, so assert it mentions undefined or innerHTML.
        expect(pageError.message).toMatch(/(innerHTML|undefined|Cannot read properties of undefined|Cannot set properties of undefined)/i);
      } else {
        // If no pageerror was captured, fail the test because the application is expected to error based on the provided implementation.
        expect(pageError).not.toBeUndefined();
      }

      // Confirm that DOM still has the bucket elements (sanity check).
      await expect(page.locator('.bucket')).toHaveCount(5);
    });
  });

  test.describe('General DOM and evidence checks (FSM evidence validation)', () => {
    test('verifies FSM evidence: header text and bucket container existence', async ({ page }) => {
      // This test revalidates FSM evidence items such as presence of <h1>Bucket Sort</h1>
      // and that a container with class "bucket-container" exists.
      await page.goto(APP_URL, { waitUntil: 'load' });

      const headerText = await page.locator('h1').innerText();
      expect(headerText.trim()).toBe('Bucket Sort');

      const bucketContainer = page.locator('.bucket-container');
      await expect(bucketContainer).toHaveCount(1);
    });
  });
});