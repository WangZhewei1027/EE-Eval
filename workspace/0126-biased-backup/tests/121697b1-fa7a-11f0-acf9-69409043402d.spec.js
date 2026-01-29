import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121697b1-fa7a-11f0-acf9-69409043402d.html';

test.describe('Interactive REST API Explorer - FSM and UI interaction tests', () => {
  // Collect console and page errors for each test so we can assert on them / observe them.
  test.beforeEach(async ({ page }) => {
    // Arrays to capture console events and page errors, attached to page as properties for access in tests.
    page['_consoleMessages'] = [];
    page['_consoleErrors'] = [];
    page['_pageErrors'] = [];

    page.on('console', msg => {
      const entry = { type: msg.type(), text: msg.text() };
      page['_consoleMessages'].push(entry);
      if (msg.type() === 'error') page['_consoleErrors'].push(entry);
    });

    page.on('pageerror', err => {
      // pageerror provides an Error object
      page['_pageErrors'].push(String(err && err.stack ? err.stack : err));
    });

    // Auto-accept or auto-dismiss dialogs in tests where appropriate.
    // Tests will set up one-off dialog handlers where they need to assert the dialog text.
    await page.goto(APP_URL);
    // Ensure initial page is fully loaded
    await expect(page.locator('h1')).toHaveText('Interactive REST API Explorer');
  });

  test.afterEach(async ({ page }) => {
    // If there are uncaught page errors, fail the test with diagnostic output.
    // This is a soft assertion to help surface runtime errors during test runs.
    if (page['_pageErrors'] && page['_pageErrors'].length > 0) {
      // Attach the errors to the test result by throwing a descriptive error.
      throw new Error('Detected page errors: \n' + page['_pageErrors'].join('\n\n'));
    }
  });

  test.describe('Idle state (S0_Idle) and initial rendering', () => {
    test('renders main heading and default inputs (Idle state evidence)', async ({ page }) => {
      // Verify main heading and URL input default value exist per S0_Idle evidence.
      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
      await expect(heading).toHaveText('Interactive REST API Explorer');

      const urlInput = page.locator('#urlInput');
      await expect(urlInput).toBeVisible();
      await expect(urlInput).toHaveValue('https://jsonplaceholder.typicode.com/posts');

      const methodSelect = page.locator('#methodSelect');
      await expect(methodSelect).toBeVisible();
      await expect(methodSelect).toHaveValue('GET');
    });
  });

  test.describe('Query params and headers management', () => {
    test('Add query parameter creates an input pair', async ({ page }) => {
      // Count existing query param rows, click "Add Query Parameter", assert increased count.
      const container = page.locator('#queryParamsContainer');
      const initialCount = await container.locator('div').count();

      await page.click('#addQueryParam');

      const newCount = await container.locator('div').count();
      expect(newCount).toBeGreaterThan(initialCount);
    });

    test('Add header creates an input pair', async ({ page }) => {
      // Count existing header rows, click add header, assert increased count.
      const container = page.locator('#headersContainer');
      const initialCount = await container.locator('div').count();

      await page.click('#addHeader');

      const newCount = await container.locator('div').count();
      expect(newCount).toBeGreaterThan(initialCount);
    });
  });

  test.describe('HTTP method selection and request body behavior', () => {
    test('Changing method to POST shows body fieldset (MethodChange event)', async ({ page }) => {
      // Switch method to POST and ensure body fieldset becomes visible
      await page.selectOption('#methodSelect', 'POST');
      const bodyFieldset = page.locator('#bodyFieldset');
      await expect(bodyFieldset).toBeVisible();
    });

    test('Pretty-print toggle triggers validation and shows INVALID JSON for malformed body', async ({ page }) => {
      // Change to POST for body availability
      await page.selectOption('#methodSelect', 'POST');
      const requestBody = page.locator('#requestBody');
      const bodyError = page.locator('#bodyError');
      const prettyPrint = page.locator('#prettyPrintRequest');

      // Enter malformed JSON
      await requestBody.fill('{ invalidJson: 123, }');

      // Toggle pretty print checkbox to invoke validation routine
      await prettyPrint.check();

      // Expect an INVALID JSON message to appear (validateRequestBody sets bodyErrorDiv)
      await expect(bodyError).toBeVisible();
      await expect(bodyError).toContainText('INVALID JSON');
    });
  });

  test.describe('Send request flow and response exploration (S0 -> S1 -> S2)', () => {
    test('Send request updates status, body, headers and JSON explorer (S1_RequestSent -> S2_ResponseReceived)', async ({ page }) => {
      // Ensure starting state: status = N/A
      const status = page.locator('#responseStatus');
      await expect(status).toHaveText('N/A');

      // Spy for dialog that may appear (e.g., clipboard or network alerts). We'll capture and accept any alerts.
      let lastDialogMessage = null;
      page.once('dialog', async dialog => {
        lastDialogMessage = dialog.message();
        await dialog.accept();
      });

      // Click send request. This will:
      // - call clearResponse()
      // - perform fetch to the default URL
      // - populate response status, headers, body
      await Promise.all([
        page.click('#sendRequest'),
        // Wait for status to change from N/A to something else (either numeric status or Network/Fetch Error)
        page.waitForFunction(() => {
          const s = document.getElementById('responseStatus');
          return s && s.textContent && s.textContent.trim() !== 'N/A';
        }, { timeout: 10000 })
      ]);

      // Assert status is non-empty and not N/A
      const statusText = await status.textContent();
      expect(statusText && statusText.trim().length).toBeGreaterThan(0);
      expect(statusText.trim()).not.toBe('N/A');

      // Response body textarea should have some content (for JSONPlaceholder posts endpoint it's JSON)
      const bodyTA = page.locator('#responseBody');
      const bodyText = (await bodyTA.inputValue()).trim();
      expect(bodyText.length).toBeGreaterThan(0);

      // Response headers textarea should be present (may be empty depending on CORS), but ensure it's a textarea element
      const headersTA = page.locator('#responseHeaders');
      await expect(headersTA).toBeVisible();

      // Verify that the JSON explorer is updated: details element exists and should not be hidden if JSON parsed
      const explorer = page.locator('details');
      const explorerDisplay = await explorer.evaluate(node => {
        // If style.display === 'none' explorer is hidden
        return window.getComputedStyle(node).display;
      });

      // If the response body could be parsed as JSON, explorer should be displayed (style not 'none').
      // For a JSON response from jsonplaceholder, explorer should be visible.
      expect(explorerDisplay).not.toBe('none');

      // Confirm that the explorer content is either non-empty or informs that response isn't valid JSON
      const explorerContentText = await page.locator('details pre').innerText();
      expect(explorerContentText.length).toBeGreaterThan(0);

      // If a dialog occurred (e.g., clipboard or network alert), we captured it above in lastDialogMessage.
      // We don't require a specific dialog here, but record it to the console so diagnostics are available.
      // (No assertion to fail on dialog presence since both success and failure alerts are valid outcomes.)
    });

    test('Copy response triggers a dialog indicating copy success or failure (CopyResponse event)', async ({ page }) => {
      // Ensure we have a response by sending one if necessary.
      const status = page.locator('#responseStatus');
      const bodyTA = page.locator('#responseBody');
      const sendBtn = page.locator('#sendRequest');

      const needSend = (await status.textContent()).trim() === 'N/A' || (await bodyTA.inputValue()).trim() === '';
      if (needSend) {
        // Send request and wait for status change
        await Promise.all([
          sendBtn.click(),
          page.waitForFunction(() => {
            const s = document.getElementById('responseStatus');
            return s && s.textContent && s.textContent.trim() !== 'N/A';
          }, { timeout: 10000 })
        ]);
      }

      // Now click Copy Body to Clipboard and capture the alert dialog (success or failure)
      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      await page.click('#copyResponse');

      // If there was content, we expect a dialog to eventually appear; wait a short time for dialog handler to run.
      await page.waitForTimeout(200); // small wait for dialog handler to fire

      // If no dialog was shown, dialogMessage will remain null. The page's copy function uses navigator.clipboard,
      // which might succeed or fail; either outcome is fine. Assert that either:
      // - a dialog was shown with success/failure message, OR
      // - there was no dialog because response body was empty (but we ensured it wasn't)
      // We expect either a success or failure message when copying non-empty body.
      expect(dialogMessage).not.toBeNull();
      // Accept either success or failure message variants (both are used in the app).
      expect(dialogMessage).toMatch(/(copied to clipboard|Failed to copy|copied:)/i);
    });

    test('Clearing the response returns to Idle (S2_ResponseReceived -> S0_Idle)', async ({ page }) => {
      // Ensure a response exists first
      const status = page.locator('#responseStatus');
      const bodyTA = page.locator('#responseBody');
      const sendBtn = page.locator('#sendRequest');

      const needSend = (await status.textContent()).trim() === 'N/A' || (await bodyTA.inputValue()).trim() === '';
      if (needSend) {
        await Promise.all([
          sendBtn.click(),
          page.waitForFunction(() => {
            const s = document.getElementById('responseStatus');
            return s && s.textContent && s.textContent.trim() !== 'N/A';
          }, { timeout: 10000 })
        ]);
      }

      // Click clear response and assert status resets and body cleared
      await page.click('#clearResponse');

      await expect(status).toHaveText('N/A');
      const afterBody = (await bodyTA.inputValue()).trim();
      expect(afterBody).toBe('');
      // JSON explorer should be hidden (style.display === 'none') after clearResponse and updateJsonExplorer
      const explorerDisplay = await page.locator('details').evaluate(node => window.getComputedStyle(node).display);
      expect(explorerDisplay).toBe('none');
    });
  });

  test.describe('History management and edge cases', () => {
    test('After sending a request an entry is added to history; clearHistory confirms and removes entries', async ({ page }) => {
      // Ensure there is at least one history entry by sending a request
      const historyDiv = page.locator('#history');
      const sendBtn = page.locator('#sendRequest');

      // Send request if history shows "(No history)"
      const historyTextBefore = (await historyDiv.textContent()).trim();
      if (historyTextBefore.includes('(No history)')) {
        // Send request to generate history
        await Promise.all([
          sendBtn.click(),
          page.waitForFunction(() => {
            const s = document.getElementById('responseStatus');
            return s && s.textContent && s.textContent.trim() !== 'N/A';
          }, { timeout: 10000 })
        ]);
      }

      // After sending, history should contain at least one clickable div (not the "(No history)" message)
      const entryCount = await historyDiv.locator('div').count();
      expect(entryCount).toBeGreaterThanOrEqual(1);

      // Click clear history and accept the confirm dialog
      let seenDialog = false;
      page.once('dialog', async dialog => {
        seenDialog = true;
        // The confirm text should ask about clearing history
        expect(dialog.message()).toMatch(/Clear all request history\?/i);
        await dialog.accept();
      });

      await page.click('#clearHistory');

      // Give some time for DOM refresh after dialog acceptance
      await page.waitForTimeout(200);

      const historyTextAfter = (await historyDiv.textContent()).trim();
      expect(seenDialog).toBe(true);
      expect(historyTextAfter).toContain('(No history)');
    });

    test('Dismiss clear history confirmation keeps history intact', async ({ page }) => {
      // Ensure we have at least one history entry
      const historyDiv = page.locator('#history');
      const sendBtn = page.locator('#sendRequest');

      const historyTextBefore = (await historyDiv.textContent()).trim();
      if (historyTextBefore.includes('(No history)')) {
        await Promise.all([
          sendBtn.click(),
          page.waitForFunction(() => {
            const s = document.getElementById('responseStatus');
            return s && s.textContent && s.textContent.trim() !== 'N/A';
          }, { timeout: 10000 })
        ]);
      }

      const beforeCount = await historyDiv.locator('div').count();
      expect(beforeCount).toBeGreaterThanOrEqual(1);

      // Click clear history but dismiss the confirm dialog
      let seenDialog = false;
      page.once('dialog', async dialog => {
        seenDialog = true;
        await dialog.dismiss();
      });

      await page.click('#clearHistory');

      // Wait shortly for any potential changes
      await page.waitForTimeout(200);

      const afterCount = await historyDiv.locator('div').count();
      expect(seenDialog).toBe(true);
      // History should remain unchanged because we dismissed the confirmation
      expect(afterCount).toBe(beforeCount);
    });

    test('Sending a request with empty URL triggers an alert (edge case)', async ({ page }) => {
      // Save current URL value and clear it
      const urlInput = page.locator('#urlInput');
      const originalUrl = await urlInput.inputValue();
      await urlInput.fill('');

      // Capture the alert dialog triggered by the app when URL is empty
      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      await page.click('#sendRequest');

      // Wait shortly for dialog
      await page.waitForTimeout(200);

      expect(dialogMessage).toBeTruthy();
      expect(dialogMessage).toMatch(/URL is required/i);

      // Restore URL to original for safety in subsequent tests
      await urlInput.fill(originalUrl);
    });

    test('Network error during fetch is handled and stored in history (edge case)', async ({ page }) => {
      // Use an obviously invalid URL (non-routable port) to provoke a fetch/network error.
      // Note: Depending on environment/network stack this may either fail quickly or hang; use a short timeout.
      const urlInput = page.locator('#urlInput');
      const originalUrl = await urlInput.inputValue();

      // Choose an unreachable host/port to provoke a fetch error
      await urlInput.fill('http://127.0.0.1:9/nonexistent');

      // Intercept the dialog alert that the app will show on network error
      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Click send request; the app catches fetch exceptions and shows an alert.
      await page.click('#sendRequest');

      // Wait until responseStatusSpan is updated to "Network/Fetch Error" (app sets this in catch block)
      await page.waitForFunction(() => {
        const el = document.getElementById('responseStatus');
        return el && el.textContent && el.textContent.includes('Network/Fetch Error');
      }, { timeout: 5000 });

      const statusText = await page.locator('#responseStatus').textContent();
      expect(statusText).toContain('Network/Fetch Error');

      // Ensure a dialog was shown with network error message
      expect(dialogMessage).toBeTruthy();
      expect(dialogMessage).toMatch(/Network error or fetch failed/i);

      // The history should contain an entry for the failed request
      const historyDiv = page.locator('#history');
      const entryCount = await historyDiv.locator('div').count();
      expect(entryCount).toBeGreaterThanOrEqual(1);

      // Restore URL
      await urlInput.fill(originalUrl);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('Capture console errors and page errors (observability)', async ({ page }) => {
      // At this point the beforeEach already attached listeners and navigated to the page.
      // Ensure console messages array exists and is an array.
      const consoleMessages = page['_consoleMessages'] || [];
      const consoleErrors = page['_consoleErrors'] || [];
      const pageErrors = page['_pageErrors'] || [];

      // These assertions ensure our listeners captured arrays even if empty.
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(consoleErrors)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // For the purposes of this test suite we do not force a ReferenceError/SyntaxError/TypeError,
      // but we assert that none of those critical runtime errors occurred during initial load.
      const combinedErrorsText = consoleErrors.map(e => e.text).join('\n') + '\n' + pageErrors.join('\n');
      // Fail the test if a ReferenceError/SyntaxError/TypeError stack or message is present.
      const hasSevereError = /ReferenceError|SyntaxError|TypeError/i.test(combinedErrorsText);
      expect(hasSevereError).toBe(false);
    });
  });
});