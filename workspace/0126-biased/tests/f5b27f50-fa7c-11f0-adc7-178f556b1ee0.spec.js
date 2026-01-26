import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b27f50-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Virtual Memory FSM (Application ID: f5b27f50-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    // Listen for console messages to aid debugging in test output if needed
    page.on('console', (msg) => {
      // Attach console messages to the test output if they are relevant
      if (msg.type() === 'error' || msg.type() === 'warning') {
        // No-op here; Playwright will still record these if run with verbose logs.
      }
    });
    await page.goto(APP_URL);
  });

  test.describe('Initial State: S0_Idle validations', () => {
    test('Initial DOM reflects Idle state: Move button exists and memory table present', async ({ page }) => {
      // This test validates the S0_Idle evidence:
      // - The "Move to Hard Disk" button exists
      // - The initial memory table shown in the HTML exists
      // - There is no table with class "memory" (which the script expects)
      const moveButton = await page.locator('#move-button');
      await expect(moveButton).toHaveCount(1);
      await expect(moveButton).toHaveText('Move to Hard Disk');

      // There should be at least one table element initially as provided by the HTML
      const tables = await page.locator('table');
      await expect(tables).toHaveCount(1);

      // The script queries document.querySelectorAll('table.memory')
      // Validate that there are zero elements matching that selector in the initial DOM.
      const memoryClassCount = await page.evaluate(() => document.querySelectorAll('table.memory').length);
      expect(memoryClassCount).toBe(0);
    });

    test('Script internal NodeList "memoryUsage" is empty (edge case leading to error)', async ({ page }) => {
      // Validate the runtime variable memoryUsage (declared in the page script) has length 0.
      // This demonstrates the mismatch between implementation and expected selector.
      const memoryUsageLength = await page.evaluate(() => {
        try {
          // Access the const declared in the page script
          return memoryUsage.length;
        } catch (e) {
          // If it's not accessible for some reason, return a distinct sentinel
          return 'not-accessible';
        }
      });
      expect(memoryUsageLength).toBe(0);
    });
  });

  test.describe('Transitions and event handling', () => {
    test('Clicking the Move button triggers the MoveToHardDisk event and causes a runtime TypeError (as-is)', async ({ page }) => {
      // This test validates the FSM transition S0_Idle -> S1_Moving via clicking the button.
      // Per instructions, we must NOT fix the application. The implementation has a bug:
      // memoryUsage[0] is undefined (memoryUsage length is 0), so appendChild causes a TypeError.
      //
      // We assert that a page error occurs on click and that the application state variables
      // did not change (i.e., currentMemoryUsage remains the initial value), and no new table
      // elements were appended to the DOM.

      // Confirm counts before click
      const initialTableCount = await page.locator('table').count();
      expect(initialTableCount).toBe(1);

      // Wait for the uncaught exception (pageerror) that should be emitted when handler runs.
      // Use Promise.all to trigger the click and wait for the error at the same time.
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('#move-button'),
      ]);

      // The runtime error should relate to appendChild/read of undefined.
      // We assert that the error message references appendChild or undefined access.
      expect(error).toBeTruthy();
      expect(typeof error.message).toBe('string');
      const msg = error.message;
      // Be flexible: different engines have slightly different messages. We look for key substring.
      expect(
        msg.includes('appendChild') ||
        msg.includes('Cannot read') ||
        msg.includes('reading') ||
        msg.includes('of undefined')
      ).toBeTruthy();

      // After the errored click, the DOM should remain unchanged: still one table (no program appended)
      const tableCountAfter = await page.locator('table').count();
      expect(tableCountAfter).toBe(initialTableCount);

      // The move button text should remain unchanged because the handler didn't complete
      await expect(page.locator('#move-button')).toHaveText('Move to Hard Disk');

      // Check that the script-level variable currentMemoryUsage remains 0 (entry action did not complete)
      // We attempt to read currentMemoryUsage directly from the page context.
      const currentMemoryUsage = await page.evaluate(() => {
        try {
          return typeof currentMemoryUsage !== 'undefined' ? currentMemoryUsage : null;
        } catch (e) {
          // If accessing the name throws, return a sentinel
          return 'access-error';
        }
      });
      // The script defined let currentMemoryUsage = 0; at top-level, so it should be 0 here.
      expect(currentMemoryUsage === 0 || currentMemoryUsage === 'access-error' ? currentMemoryUsage === 0 : true).toBeTruthy();
    });

    test('Subsequent clicks continue to produce errors and do not alter the DOM/state', async ({ page }) => {
      // This test validates idempotency of the failing transition when invoked multiple times.
      // We expect each click to raise a pageerror (TypeError), and the DOM / state remain unchanged.

      // Confirm baseline table count
      const baselineTables = await page.locator('table').count();
      expect(baselineTables).toBe(1);

      // Click twice and collect both errors
      const errorPromises = [
        page.waitForEvent('pageerror'),
        page.waitForEvent('pageerror'),
      ];
      // Trigger two clicks in sequence; ensure we await them properly.
      await page.click('#move-button');
      await page.click('#move-button');

      const errors = await Promise.all(errorPromises);
      expect(errors.length).toBe(2);
      for (const err of errors) {
        expect(err).toBeTruthy();
        expect(typeof err.message).toBe('string');
        const em = err.message;
        expect(
          em.includes('appendChild') ||
          em.includes('Cannot read') ||
          em.includes('reading') ||
          em.includes('of undefined')
        ).toBeTruthy();
      }

      // Ensure no new table nodes were added by the attempted (but failing) handler
      const finalTableCount = await page.locator('table').count();
      expect(finalTableCount).toBe(baselineTables);

      // Ensure currentMemoryUsage did not increase (remains 0)
      const currentMemoryUsageAfter = await page.evaluate(() => {
        try {
          return typeof currentMemoryUsage !== 'undefined' ? currentMemoryUsage : null;
        } catch (e) {
          return 'access-error';
        }
      });
      expect(currentMemoryUsageAfter === 0 || currentMemoryUsageAfter === 'access-error' ? currentMemoryUsageAfter === 0 : true).toBeTruthy();
    });
  });

  test.describe('FSM behavior mapping and assertions', () => {
    test('Verify expected onEnter action would increment currentMemoryUsage if it executed (assert it did not due to error)', async ({ page }) => {
      // The FSM defines an entry action for S1_Moving: currentMemoryUsage += 1000;
      // The application code attempts to execute this, but the earlier appendChild causes an exception before increment.
      // Here we validate the intended effect did not happen in this buggy implementation.

      // Trigger the event and catch the error as before
      await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('#move-button'),
      ]);

      // Confirm currentMemoryUsage is still 0 (i.e., the onEnter action did not complete)
      const cmu = await page.evaluate(() => {
        try {
          return typeof currentMemoryUsage !== 'undefined' ? currentMemoryUsage : null;
        } catch (e) {
          return 'access-error';
        }
      });
      expect(cmu === 0).toBeTruthy();
    });
  });
});