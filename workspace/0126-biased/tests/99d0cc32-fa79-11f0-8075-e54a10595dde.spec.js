import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0cc32-fa79-11f0-8075-e54a10595dde.html';

test.describe('Refactoring Interactive Demo (FSM validation) - 99d0cc32-fa79-11f0-8075-e54a10595dde', () => {
  // Shared variables for observability of console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(BASE);
  });

  test.afterEach(async () => {
    // Nothing to teardown on the server side - listeners are per-page and cleared with the page fixture.
  });

  test.describe('Initialization and Metrics (S0_Idle)', () => {
    test('initial render: UI elements exist and default metrics are correct', async ({ page }) => {
      // Verify that core UI components are present after initial load
      await expect(page.locator('#add')).toBeVisible();
      await expect(page.locator('#clear')).toBeVisible();
      await expect(page.locator('#inputField')).toBeVisible();
      await expect(page.locator('#submit')).toBeVisible();
      await expect(page.locator('#entriesList')).toBeVisible();
      await expect(page.locator('#totalEntries')).toHaveText('0');
      await expect(page.locator('#currentInputLength')).toHaveText('0');

      // Max length initial values: slider default is 10, maxLengthValue span should reflect '10', maxLength span updated by updateEntriesList later but initial script sets maxLength variable to 10
      await expect(page.locator('#maxLengthValue')).toHaveText('10');

      // After load, there should be no uncaught exceptions
      expect(pageErrors.length).toBe(0);
    });

    test('adjusting max length slider updates visible values (AdjustMaxLength event)', async ({ page }) => {
      const slider = page.locator('#maxLengthSlider');
      const maxLengthValue = page.locator('#maxLengthValue');
      const maxLengthSpan = page.locator('#maxLength');

      // Programmatically set slider to 5 and dispatch input event so page's handler runs
      await slider.evaluate((el) => {
        el.value = '5';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // UI should reflect the new value in the visible span and maxLength span should update
      await expect(maxLengthValue).toHaveText('5');
      await expect(maxLengthSpan).toHaveText('5');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Adding and Submitting Entries (S1_EntryAdded & S3_InputSubmitted)', () => {
    test('Add Entry via prompt adds item to entries list (AddEntry event)', async ({ page }) => {
      // Intercept the prompt and respond with a valid entry (<= default maxLength 10)
      const promptedText = 'hello';
      page.once('dialog', async (dialog) => {
        // Expect a prompt dialog
        expect(dialog.type()).toBe('prompt');
        await dialog.accept(promptedText);
      });

      await page.click('#add');

      // After adding, the entries list should contain one item with index 0
      await expect(page.locator('#entriesList li')).toHaveCount(1);
      await expect(page.locator('#entriesList li').first()).toHaveText('0: hello');

      // Total entries should show 1
      await expect(page.locator('#totalEntries')).toHaveText('1');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Submit button uses input field value and clears input (SubmitInput event)', async ({ page }) => {
      const input = page.locator('#inputField');
      const submit = page.locator('#submit');

      // Type a valid input of length <= current maxLength (10)
      await input.fill('submit-me');
      // Confirm current input length UI updates due to input event listener
      await expect(page.locator('#currentInputLength')).toHaveText(String('submit-me'.length));

      // Click submit
      await submit.click();

      // After submit, an entry should be appended (this test assumes previous state may have 0 or 1 items)
      // Find last list item text and assert it ends with the submitted value
      const items = await page.locator('#entriesList li').allTextContents();
      expect(items.length).toBeGreaterThanOrEqual(1);
      const lastItem = items[items.length - 1];
      expect(lastItem).toContain('submit-me');

      // Input field should be cleared after successful submit
      await expect(input).toHaveValue('');

      // totalEntries span should equal number of li elements
      await expect(page.locator('#totalEntries')).toHaveText(String(items.length));

      // No page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Clearing and Refactoring (S2_EntriesCleared & S4_EntryRefactored)', () => {
    test('Clear All removes all entries (ClearAll event)', async ({ page }) => {
      // Prepare by adding two entries via prompt and submit to ensure there are entries
      page.once('dialog', async (d) => d.accept('first'));
      await page.click('#add');

      await page.fill('#inputField', 'second');
      await page.click('#submit');

      // Verify there are entries
      await expect(page.locator('#entriesList li')).toHaveCount(2);
      await expect(page.locator('#totalEntries')).toHaveText('2');

      // Click Clear All
      await page.click('#clear');

      // Entries list should be empty, totalEntries 0
      await expect(page.locator('#entriesList li')).toHaveCount(0);
      await expect(page.locator('#totalEntries')).toHaveText('0');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Refactor valid index updates entry text (RefactorEntry event)', async ({ page }) => {
      // Ensure we have entries to refactor: add two entries
      page.once('dialog', async (d) => d.accept('alpha'));
      await page.click('#add');
      page.once('dialog', async (d) => d.accept('beta'));
      await page.click('#add');

      // Verify two entries present
      await expect(page.locator('#entriesList li')).toHaveCount(2);

      // Set index to 1 and new value to 'BRAVO'
      await page.fill('#refactorIndex', '1');
      await page.fill('#refactorValue', 'BRAVO');

      // Click refactor
      await page.click('#refactor');

      // Entry at index 1 should now contain 'BRAVO'
      await expect(page.locator('#entriesList li').nth(1)).toHaveText('1: BRAVO');

      // Refactor inputs should be cleared
      await expect(page.locator('#refactorIndex')).toHaveValue('');
      await expect(page.locator('#refactorValue')).toHaveValue('');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Refactor with invalid index triggers alert (edge case)', async ({ page }) => {
      // Ensure entries are cleared first
      await page.click('#clear');
      await expect(page.locator('#entriesList li')).toHaveCount(0);

      // Fill an invalid index (e.g., 5) and a new value
      await page.fill('#refactorIndex', '5');
      await page.fill('#refactorValue', 'X');

      // Intercept alert dialog and assert its message indicates invalid index
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#refactor');
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Invalid index');
      await dialog.accept();

      // Entries still empty
      await expect(page.locator('#entriesList li')).toHaveCount(0);

      // No uncaught page errors produced from this flow
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    test('Add Entry via prompt that exceeds max length shows alert (edge case)', async ({ page }) => {
      // Set the maxLength slider to a small value (3)
      await page.locator('#maxLengthSlider').evaluate((el) => {
        el.value = '3';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect(page.locator('#maxLengthValue')).toHaveText('3');
      await expect(page.locator('#maxLength')).toHaveText('3');

      // Now attempt to add via prompt a string longer than 3
      page.once('dialog', async (dialog) => {
        // This first dialog is the prompt; give a too-long value
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('toolong');
      });

      // The page will show an alert due to length > maxLength; intercept that alert
      // Setup a listener for the subsequent alert
      const alertPromise = page.waitForEvent('dialog');
      await page.click('#add');
      const alertDialog = await alertPromise;
      expect(alertDialog.type()).toBe('alert');
      expect(alertDialog.message()).toContain('Entry must be less than or equal to'); // message should reference max length
      await alertDialog.accept();

      // Ensure no items were added
      await expect(page.locator('#entriesList li')).toHaveCount(0);

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Submit existing input that exceeds max length triggers alert', async ({ page }) => {
      // Set maxLength to 2
      await page.locator('#maxLengthSlider').evaluate((el) => {
        el.value = '2';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Type a too-long value into inputField
      await page.fill('#inputField', 'too-long');

      // Intercept the alert triggered by submit
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#submit');
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Input exceeds max length');

      await dialog.accept();

      // Ensure entry was not added and input still retains its value (implementation leaves input as-is on failure)
      await expect(page.locator('#entriesList li')).toHaveCount(0);
      await expect(page.locator('#inputField')).toHaveValue('too-long');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Observability: console logs and page errors', () => {
    test('should not emit uncaught exceptions during normal interactions', async ({ page }) => {
      // Basic interaction: type and submit valid input
      await page.fill('#inputField', 'ok');
      await page.click('#submit');

      // Expect no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Console messages may exist (e.g., from browser), but ensure no console error messages of severity 'error'
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('capture and report any runtime errors (if they occur)', async ({ page }) => {
      // This test demonstrates observability: perform a few actions and then assert that if pageErrors exist, they are reported by the test.
      // Perform clicks that exercise code paths
      page.once('dialog', (d) => d.accept('obs'));
      await page.click('#add');
      await page.fill('#refactorIndex', '0');
      await page.fill('#refactorValue', 'obs-changed');

      // If a dialog appears from refactor due to invalid index, accept it to continue
      const dialogHandler = page.waitForEvent('dialog').then(async (d) => {
        // if it's an alert, accept; if prompt, accept specialized handling
        await d.accept().catch(() => {});
      }).catch(() => { /* ignore timeouts if no dialog */ });

      await page.click('#refactor').catch(() => { /* click may not change anything; ignore */ });
      await dialogHandler;

      // Finally assert there are no uncaught exceptions; if there are, fail the test with their messages for debugging
      if (pageErrors.length > 0) {
        // Log the errors to make debugging easier (will be visible in test output)
        for (const err of pageErrors) {
          console.error('Captured page error:', err.message);
        }
      }
      expect(pageErrors.length).toBe(0);
    });
  });
});