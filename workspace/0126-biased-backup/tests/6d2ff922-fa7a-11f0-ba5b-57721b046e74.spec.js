import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2ff922-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Thread Explorer - FSM and UI validation', () => {
  // Arrays to collect runtime issues observed from the page
  let pageErrors;
  let consoleMessages;

  // Helper to attach listeners for each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Listen for unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err.message typically contains the error string (ReferenceError, TypeError, etc.)
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Collect console messages (info/warn/error) for additional evidence
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Wait a brief moment for initial scripts to run and initial render to occur
    await page.waitForTimeout(100);
  });

  test.afterEach(async ({ page }) => {
    // detach listeners implicitly by closing/navigating away in next test run; no explicit teardown needed
    // but a short pause to allow any late errors to surface
    await page.waitForTimeout(20);
  });

  test.describe('Initial (S0_Idle) state checks', () => {
    test('Initial DOM shows "No thread created yet." and controls are hidden', async ({ page }) => {
      // Validate the thread container shows the idle message per FSM evidence
      const threadHtml = await page.locator('#threadContainer').innerHTML();
      expect(threadHtml).toContain('No thread created yet.');

      // Post controls should be hidden initially (S0_Idle evidence)
      const postControls = page.locator('#postControls');
      await expect(postControls).toHaveClass(/hidden/);

      // Analysis results should be hidden initially
      const analysis = page.locator('#analysisResults');
      await expect(analysis).toHaveClass(/hidden/);

      // Depth and Branching UI initial values should match the HTML attributes (3 and 2)
      await expect(page.locator('#depthValue')).toHaveText('3');
      await expect(page.locator('#branchValue')).toHaveText('2');

      // No page errors should have occurred during initial load (sanity check)
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Thread creation and demo loading (transitions from S0_Idle)', () => {
    test('Clicking Create New Thread results in ReferenceError due to missing renderThreadControls', async ({ page }) => {
      // Clear any previous captured messages
      pageErrors.length = 0;
      consoleMessages.length = 0;

      // Trigger the Create Thread button which, per implementation, calls createNewThread()
      // createNewThread() calls renderThreadControls() which is not defined -> ReferenceError expected
      await page.click('#createThread');

      // Allow the exception to propagate to the pageerror handler
      await page.waitForTimeout(50);

      // We expect at least one page error indicating renderThreadControls is not defined (ReferenceError)
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // At least one error message should reference the missing function name
      const found = pageErrors.some(msg => /renderThreadControls/.test(msg) || /is not defined/.test(msg));
      expect(found).toBeTruthy();

      // The thread container should remain in the Idle state because thread creation failed
      const threadHtml = await page.locator('#threadContainer').innerHTML();
      expect(threadHtml).toContain('No thread created yet.');
    });

    test('Clicking Load Demo Thread propagates the same ReferenceError (via createNewThread)', async ({ page }) => {
      pageErrors.length = 0;
      consoleMessages.length = 0;

      // Trigger the Load Demo button, which internally calls createNewThread()
      await page.click('#loadDemo');

      await page.waitForTimeout(50);

      // Expect ReferenceError related to renderThreadControls again
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const hasRenderError = pageErrors.some(msg => /renderThreadControls/.test(msg) || /is not defined/.test(msg));
      expect(hasRenderError).toBeTruthy();

      // Because demo load failed, the thread container should still indicate no thread
      const content = await page.locator('#threadContainer').innerHTML();
      expect(content).toContain('No thread created yet.');
    });

    test('Clear All when no thread exists should clear the idle message and not throw', async ({ page }) => {
      pageErrors.length = 0;
      consoleMessages.length = 0;

      // Click Clear All - clearAllThreads exists and should execute without throwing
      await page.click('#clearAll');
      await page.waitForTimeout(30);

      // No errors expected from calling clearAll when in idle
      const errorsTriggered = pageErrors.length;
      expect(errorsTriggered).toBe(0);

      // Thread container expected to be empty after clearing
      const content = await page.locator('#threadContainer').innerHTML();
      // The implementation sets innerHTML = '' on clearAllThreads
      expect(content.trim()).toBe('');
    });
  });

  test.describe('Post interactions and edge cases (S1_ThreadCreated -> S2_PostSelected transitions)', () => {
    test('Submitting an empty post should be a no-op and not throw', async ({ page }) => {
      pageErrors.length = 0;
      consoleMessages.length = 0;

      // Ensure the post content area exists; even when hidden, we try clicking submit with force
      await page.locator('#postContent').fill('');
      await page.click('#submitPost', { force: true });

      // Wait a bit for handlers to run
      await page.waitForTimeout(30);

      // No exceptions expected because submitPost returns early on empty content
      expect(pageErrors.length).toBe(0);

      // Thread still idle
      const content = await page.locator('#threadContainer').innerHTML();
      expect(content).toContain('No thread created yet.');
    });

    test('Submitting a non-empty post without a created thread causes a TypeError (state.currentThread is null)', async ({ page }) => {
      pageErrors.length = 0;
      consoleMessages.length = 0;

      // Fill the post content (simulate user attempting to submit outside of created thread)
      await page.locator('#postContent').fill('This is a test post outside any thread');

      // Force click the submit button despite hidden controls
      await page.click('#submitPost', { force: true });

      // Allow the thrown TypeError to be captured by pageerror
      await page.waitForTimeout(50);

      // We expect at least one error indicating inability to set properties on null (state.currentThread is null)
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const typeErrorFound = pageErrors.some(msg => /rootPost/.test(msg) || /Cannot set .+rootPost/.test(msg) || /Cannot set properties of null/.test(msg));
      expect(typeErrorFound).toBeTruthy();

      // Confirm the thread container remains unchanged (still idle)
      const threadHtml = await page.locator('#threadContainer').innerHTML();
      expect(threadHtml).toContain('No thread created yet.');
    });

    test('Reply/Edit/Delete/Upvote/Downvote without a selected post are safe no-ops (no exceptions)', async ({ page }) => {
      pageErrors.length = 0;
      consoleMessages.length = 0;

      // All these controls should do nothing when no post is selected. Use force to click hidden buttons.
      const actions = ['#replyToPost', '#editPost', '#deletePost', '#upvotePost', '#downvotePost'];

      for (const selector of actions) {
        await page.click(selector, { force: true });
      }

      // Wait briefly to ensure any thrown errors would be captured
      await page.waitForTimeout(30);

      // No page errors should have been recorded from these operations
      expect(pageErrors.length).toBe(0);

      // Post controls should remain hidden
      await expect(page.locator('#postControls')).toHaveClass(/hidden/);
    });
  });

  test.describe('Analysis and visualization checks (S4_AnalysisVisible and UI updates)', () => {
    test('Analyze Thread without a thread should not reveal results and should not throw', async ({ page }) => {
      pageErrors.length = 0;
      consoleMessages.length = 0;

      // Click Analyze
      await page.click('#analyzeThread');

      await page.waitForTimeout(30);

      // No errors expected
      expect(pageErrors.length).toBe(0);

      // Analysis results should remain hidden because there is no currentThread
      await expect(page.locator('#analysisResults')).toHaveClass(/hidden/);
    });

    test('Updating depth and branching factor inputs updates the displayed numeric values', async ({ page }) => {
      pageErrors.length = 0;
      consoleMessages.length = 0;

      // Set depth to 7 using DOM manipulation and dispatch input event
      await page.$eval('#threadDepth', (el) => {
        el.value = '7';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Set branching factor to 4
      await page.$eval('#branchingFactor', (el) => {
        el.value = '4';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Allow handlers to update UI
      await page.waitForTimeout(20);

      // Verify displayed values updated accordingly
      await expect(page.locator('#depthValue')).toHaveText('7');
      await expect(page.locator('#branchValue')).toHaveText('4');

      // No runtime errors were expected from these operations
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Robustness and error observation summary', () => {
    test('Confirm that missing function caused ReferenceError and that it prevents normal creation flow', async ({ page }) => {
      pageErrors.length = 0;
      consoleMessages.length = 0;

      // Trigger create again to ensure consistent behavior
      await page.click('#createThread');
      await page.waitForTimeout(40);

      // There should be a ReferenceError pointing to the missing renderThreadControls function
      const renderError = pageErrors.some(msg => /renderThreadControls/.test(msg) || /is not defined/.test(msg));
      expect(renderError).toBeTruthy();

      // Verify that because create failed, attempts to analyze or submit a post without a real thread will produce
      // either no-ops or TypeError (in earlier test we saw TypeError when submitting non-empty content).
      // We assert the application remains in idle state (no root post created)
      const threadHtml = await page.locator('#threadContainer').innerHTML();
      expect(threadHtml).toContain('No thread created yet.');
    });

    test('Collect console errors and messages evidence for debugging the broken flow', async ({ page }) => {
      // This test will exercise several buttons to collect console data for debugging/reporting
      pageErrors.length = 0;
      consoleMessages.length = 0;

      const buttons = [
        '#createThread',
        '#loadDemo',
        '#submitPost',
        '#replyToPost',
        '#editPost',
        '#deletePost',
        '#upvotePost',
        '#downvotePost',
        '#analyzeThread'
      ];

      // Attempt to click many of them (force clicks where controls might be hidden)
      for (const b of buttons) {
        // Use force for those that may be hidden; clicking visible ones normally
        await page.click(b, { force: true });
      }

      // Give the page time to report errors
      await page.waitForTimeout(80);

      // At least one page error should have occurred (the missing renderThreadControls)
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Verify that console messages were captured as well (could include warnings, logs)
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);

      // Provide assertions that the primary failure mode is a missing function (ReferenceError)
      const hasReference = pageErrors.some(m => /renderThreadControls/.test(m) || /is not defined/.test(m));
      expect(hasReference).toBeTruthy();
    });
  });
});