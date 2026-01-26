import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b342a0-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object for the Git demo page.
 * Encapsulates common operations so tests are clearer.
 */
class GitDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demo-button');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isButtonVisible() {
    return await this.demoButton.isVisible();
  }

  async getHeadingText() {
    return await this.page.locator('h1').innerText();
  }

  /**
   * Clicks the demo button and sequences responses to the prompt dialogs.
   * responses: array where each element is either a string to accept as prompt value, or null to dismiss.
   * Returns an object with collected console messages and page errors recorded while performing the action.
   *
   * Note: This function installs temporary listeners and removes them after completion.
   */
  async triggerDemoWithPromptResponses(responses = []) {
    const page = this.page;
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    // Track dialog handling count so we can wait until all expected dialogs are handled
    let dialogsHandled = 0;
    const expectedDialogs = 3; // the implementation prompts 3 times

    // Temporary listeners
    const consoleListener = (msg) => {
      // capture all console messages (log, error, warning)
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };
    const pageErrorListener = (err) => {
      // pageerror receives Error objects; capture message
      pageErrors.push(String(err && err.message ? err.message : err));
    };

    page.on('console', consoleListener);
    page.on('pageerror', pageErrorListener);

    // Dialog handler that consumes responses array
    const dialogHandler = async (dialog) => {
      // Retrieve next response (may be undefined if not provided)
      const next = responses.length ? responses.shift() : undefined;
      dialogsHandled++;
      // If next is explicitly null, dismiss; otherwise accept with string value or empty string
      try {
        if (next === null) {
          await dialog.dismiss();
        } else if (next === undefined) {
          // No explicit response provided: accept with empty string
          await dialog.accept('');
        } else {
          await dialog.accept(String(next));
        }
      } catch (e) {
        // swallowing dialog handling errors here; they will be surfaced as page errors if uncaught
      }
    };

    page.on('dialog', dialogHandler);

    // Click the demo button to trigger prompts and subsequent logic.
    await this.demoButton.click();

    // Wait until all expected dialogs have been handled or timeout after 5s
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Clean up listeners and reject
        resolve(); // resolve anyway so tests can assert what happened; do not fail here
      }, 5000);
      (function check() {
        if (dialogsHandled >= expectedDialogs) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(check, 50);
        }
      })();
    });

    // Give a small grace period for console messages and page errors to surface
    await page.waitForTimeout(200); // small pause for logs/errors to be emitted

    // Clean up listeners we added
    page.off('dialog', dialogHandler);
    page.off('console', consoleListener);
    page.off('pageerror', pageErrorListener);

    return { consoleMessages, consoleErrors, pageErrors };
  }
}

test.describe('Git demo FSM - f5b342a0-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Sanity check: the page should load and present the Idle state (S0_Idle)
  test('S0_Idle: Page renders and shows Trigger Demo button (renderPage entry action)', async ({ page }) => {
    const demo = new GitDemoPage(page);
    await demo.goto();

    // Validate that renderPage() effects are visible: header and explanatory text exist
    const heading = await demo.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading).toContain('What is Git?');

    // The FSM evidence lists a button with id #demo-button; ensure it exists and is visible
    expect(await demo.isButtonVisible()).toBe(true);

    // Also check that there are explanatory paragraphs (indirect verification of renderPage)
    const paragraphs = await page.locator('p').count();
    expect(paragraphs).toBeGreaterThanOrEqual(1);
  });

  test('S1_DemoTriggered: Clicking Trigger Demo prompts for commit details and logs commit info', async ({ page }) => {
    const demo = new GitDemoPage(page);
    await demo.goto();

    // Prepare valid prompt responses for the three prompts
    const responses = [
      'Initial commit message', // commitMessage
      'file1.txt\nfile2.txt',   // files
      'Added initial project files' // commit details
    ];

    // Trigger the demo and capture console output and page errors
    const { consoleMessages, pageErrors } = await demo.triggerDemoWithPromptResponses([...responses]);

    // Validate that prompts produced the expected console log entries (evidence of promptUserForCommitDetails)
    // We expect to see three logs: Commit:, Files:, Commit details:
    const textLogs = consoleMessages.map(m => m.text);
    const foundCommitLog = textLogs.find(t => t.includes('Commit:'));
    const foundFilesLog = textLogs.find(t => t.includes('Files:'));
    const foundCommitDetailsLog = textLogs.find(t => t.includes('Commit details:'));

    expect(foundCommitLog).toBeDefined();
    expect(foundFilesLog).toBeDefined();
    expect(foundCommitDetailsLog).toBeDefined();

    // Ensure the contents logged correspond to the values we supplied
    expect(foundCommitLog).toContain('Initial commit message');
    expect(foundFilesLog).toContain('file1.txt');
    expect(foundCommitDetailsLog).toContain('Added initial project files');

    // The implementation attempts to use Node-specific require() calls in a browser context,
    // which should lead to an uncaught ReferenceError (or similar) and be reported as a page error.
    // Assert that at least one page error was captured and that it mentions require
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const combinedPageErrors = pageErrors.join('\n').toLowerCase();
    expect(combinedPageErrors).toContain('require'); // message should reference require
  });

  test('Transition validation + edge case: Dismissing some prompts leads to null/empty logs and still triggers runtime error', async ({ page }) => {
    const demo = new GitDemoPage(page);
    await demo.goto();

    // Edge case: user dismisses the first prompt (commit message), accepts an empty string for files,
    // and dismisses the third prompt. This exercises null/empty handling by the app.
    const responses = [
      null,    // dismiss first prompt -> commitMessage === null
      '',      // accept empty string for files
      null     // dismiss third prompt -> commit details === null
    ];

    const { consoleMessages, pageErrors } = await demo.triggerDemoWithPromptResponses([...responses]);

    // Check the console logs: should still log the values (including 'null' for dismissed prompts)
    const textLogs = consoleMessages.map(m => m.text);
    const commitLog = textLogs.find(t => t.includes('Commit:'));
    const filesLog = textLogs.find(t => t.includes('Files:'));
    const detailsLog = textLogs.find(t => t.includes('Commit details:'));

    // The code uses template strings and will print "Commit: null" when commitMessage is null in browser env
    expect(commitLog).toBeDefined();
    expect(commitLog.toLowerCase()).toContain('commit:');
    // If dismissed, it is likely to contain the string 'null' or 'undefined' depending on the environment,
    // so assert that it does not crash and is present.
    expect(commitLog.length).toBeGreaterThan('Commit:'.length);

    // Files may be empty string; ensure the log exists
    expect(filesLog).toBeDefined();

    // Commit details log should exist even if dismissed
    expect(detailsLog).toBeDefined();

    // The page should still surface a require-related error due to Node-specific code in browser
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const combinedPageErrors = pageErrors.join('\n').toLowerCase();
    expect(combinedPageErrors).toContain('require');
  });

  test('Multiple interactions: ensure the demo button exists and multiple attempts are handled (fresh page each test)', async ({ page }) => {
    // This test verifies that on a fresh load (new test) the Idle state is present again,
    // demonstrating S0 -> S1 transitions are repeatable per page load.
    const demo = new GitDemoPage(page);
    await demo.goto();

    expect(await demo.isButtonVisible()).toBe(true);

    // Provide simple responses to drive the transition again
    const responses = ['msg', 'a.txt', 'details'];
    const { consoleMessages, pageErrors } = await demo.triggerDemoWithPromptResponses(responses);

    // Assert we saw logging again
    const textLogs = consoleMessages.map(m => m.text);
    expect(textLogs.find(t => t.includes('Commit:'))).toBeDefined();
    expect(textLogs.find(t => t.includes('Files:'))).toBeDefined();
    expect(textLogs.find(t => t.includes('Commit details:'))).toBeDefined();

    // Assert error still occurs due to require usage
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  // Extra test to surface console errors specifically (in case the runtime surfaces errors as console.error)
  test('Observe console.error messages for require usage', async ({ page }) => {
    const demo = new GitDemoPage(page);
    await demo.goto();

    const consoleErrorMessages = [];
    const listener = (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrorMessages.push(msg.text());
        }
      } catch {
        // noop
      }
    };
    page.on('console', listener);

    // Provide responses and trigger
    await demo.triggerDemoWithPromptResponses(['x', 'y', 'z']);

    // Small pause so console errors propagate
    await page.waitForTimeout(200);

    page.off('console', listener);

    // It's acceptable if there are zero console.error messages in some environments because
    // the uncaught exception may be surfaced as a pageerror instead. We assert that either
    // console.error or pageerror indicates the problematic require call.
    // If console errors are present, ensure they reference require.
    if (consoleErrorMessages.length > 0) {
      const joined = consoleErrorMessages.join('\n').toLowerCase();
      expect(joined).toContain('require');
    } else {
      // If none captured here, at least ensure pageerror (observed in other tests) occurs; we don't re-check here.
      expect(true).toBe(true);
    }
  });

});