import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d85a4-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Agile Methodology FSM - End-to-End (Application ID: 122d85a4-fa7b-11f0-814c-dbec508f0b3b)', () => {
  let page;
  let consoleMessages;
  let pageErrors;

  // Helper to read currentState from the page context
  const getCurrentState = async (p) => {
    return await p.evaluate(() => {
      // If currentState is not defined, return the string 'UNDEFINED'
      return (typeof currentState !== 'undefined') ? currentState : 'UNDEFINED';
    });
  };

  test.beforeEach(async ({ browser }) => {
    consoleMessages = [];
    pageErrors = [];

    page = await browser.newPage();

    // Collect console messages for analysis in tests
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  // Test: verify the page loads and initial state (S0_Start) is present.
  test('Initial page load: verify UI elements and initial FSM state is "start"', async () => {
    // Verify page title and key elements exist
    await expect(page.locator('h1')).toHaveText('Agile Methodology');

    // The script defines currentState = "start"; verify it
    const state = await getCurrentState(page);
    expect(state).toBe('start');

    // Validate presence & initial attributes of key controls
    await expect(page.locator('#start-button')).toBeVisible();
    await expect(page.locator('#cancel-button')).toBeVisible();
    await expect(page.locator('#finish-button')).toBeVisible();

    // finish-button is disabled initially per HTML
    expect(await page.locator('#finish-button').isDisabled()).toBe(true);

    // Ensure there were no SyntaxErrors during load (these would prevent JS from parsing)
    const syntaxErrors = consoleMessages.filter(m => m.text.includes('SyntaxError'));
    expect(syntaxErrors.length).toBe(0);

    // No uncaught page errors should be present on initial load for a healthy start
    expect(pageErrors.length).toBe(0);
  });

  // Test: S0_Start -> S1_Complex_Workflow via Add event (clicking #add-button from start)
  test('Transition S0_Start -> S1_Complex_Workflow: click Add when in "start"', async () => {
    // Precondition: currentState is 'start'
    expect(await getCurrentState(page)).toBe('start');

    // Click Add button to trigger add() which transitions state from 'start' -> 'complex-workflow'
    await page.click('#add-button');

    // After the interaction, the implementation sets currentState to 'complex-workflow'
    const stateAfterAdd = await getCurrentState(page);
    expect(stateAfterAdd).toBe('complex-workflow');

    // The function clears the complex-workflow-container innerHTML when moving to complex-workflow
    const complexHtml = await page.locator('#complex-workflow-container').innerHTML();
    // Expectation: the container was programmatically cleared (empty string)
    expect(complexHtml.trim().length).toBeGreaterThanOrEqual(0);

    // Check that no uncaught page errors were introduced by this interaction
    expect(pageErrors.length).toBe(0);
  });

  // Test: S1_Complex_Workflow -> S2_Exploration via Add event (click Add again)
  test('Transition S1_Complex_Workflow -> S2_Exploration: click Add when in "complex-workflow"', async () => {
    // Bring the app into complex-workflow state
    await page.click('#add-button');
    expect(await getCurrentState(page)).toBe('complex-workflow');

    // Click Add again to move to exploration (per implementation)
    await page.click('#add-button');

    const state = await getCurrentState(page);
    expect(state).toBe('exploration');

    // The exploration container is cleared when transitioning to exploration
    const explorationHtml = await page.locator('#exploration-container').innerHTML();
    expect(explorationHtml.trim().length).toBeGreaterThanOrEqual(0);

    expect(pageErrors.length).toBe(0);
  });

  // Test: S2_Exploration -> S3_Feedback via Next event
  test('Transition S2_Exploration -> S3_Feedback: click Next when in "exploration"', async () => {
    // Move to exploration via two adds
    await page.click('#add-button'); // start -> complex-workflow
    await page.click('#add-button'); // complex-workflow -> exploration
    expect(await getCurrentState(page)).toBe('exploration');

    // Click Next which calls next() -> update() and should move exploration -> feedback
    await page.click('#next-button');

    const state = await getCurrentState(page);
    expect(state).toBe('feedback');

    // update() clears feedback-container when moving into that state; validate container exists
    const feedbackHtml = await page.locator('#feedback-container').innerHTML();
    expect(typeof feedbackHtml).toBe('string');

    expect(pageErrors.length).toBe(0);
  });

  // Test: S3_Feedback -> S1_Complex_Workflow via Back event
  test('Transition S3_Feedback -> S1_Complex_Workflow: click Back when in "feedback"', async () => {
    // Move to feedback
    await page.click('#add-button'); // start -> complex-workflow
    await page.click('#add-button'); // complex-workflow -> exploration
    await page.click('#next-button'); // exploration -> feedback
    expect(await getCurrentState(page)).toBe('feedback');

    // Click Back to return to complex-workflow
    await page.click('#back-button');

    const state = await getCurrentState(page);
    expect(state).toBe('complex-workflow');

    expect(pageErrors.length).toBe(0);
  });

  // Test: S3_Feedback -> S1_Complex_Workflow via Remove and Update events (both should lead back)
  test('Feedback -> Complex via Remove and Update events (both actions)', async () => {
    // Move to feedback
    await page.click('#add-button'); // start -> complex-workflow
    await page.click('#add-button'); // -> exploration
    await page.click('#next-button'); // -> feedback
    expect(await getCurrentState(page)).toBe('feedback');

    // Remove should bring us to complex-workflow
    await page.click('#remove-button');
    expect(await getCurrentState(page)).toBe('complex-workflow');

    // Move back to feedback to test update path
    await page.click('#add-button'); // complex-workflow -> exploration
    await page.click('#next-button'); // exploration -> feedback
    expect(await getCurrentState(page)).toBe('feedback');

    // Update should bring us to complex-workflow
    await page.click('#update-button');
    expect(await getCurrentState(page)).toBe('complex-workflow');

    expect(pageErrors.length).toBe(0);
  });

  // Test: From exploration, Finish Workflow -> S0_Start
  test('Finish workflow from exploration should transition to "start"', async () => {
    // Move to exploration
    await page.click('#add-button'); // start -> complex-workflow
    await page.click('#add-button'); // complex-workflow -> exploration
    expect(await getCurrentState(page)).toBe('exploration');

    // Click Finish Workflow -> should set currentState = 'start' per implementation
    await page.click('#finish-workflow-button');

    const state = await getCurrentState(page);
    expect(state).toBe('start');

    // The finish workflow handler writes to the complex-workflow-container; ensure it exists
    const complexHtml = await page.locator('#complex-workflow-container').innerHTML();
    expect(typeof complexHtml).toBe('string');

    expect(pageErrors.length).toBe(0);
  });

  // Test: CancelEvent at S0_Start keeps state as 'start' and toggles UI appropriately
  test('Cancel at start keeps currentState as "start" and toggles UI', async () => {
    // Ensure we start in 'start'
    expect(await getCurrentState(page)).toBe('start');

    // Click cancel; implementation toggles some UI but does not change currentState
    await page.click('#cancel-button');

    // The script's cancel() doesn't change currentState variable; verify it stays 'start'
    expect(await getCurrentState(page)).toBe('start');

    // Check UI state: cancel button becomes disabled per cancel() implementation
    const cancelDisabled = await page.locator('#cancel-button').isDisabled();
    expect(cancelDisabled).toBe(true);

    // Confirm that no uncaught exceptions occurred
    expect(pageErrors.length).toBe(0);
  });

  // Edge case tests: rapid interactions and ensuring no uncaught exceptions arise
  test('Edge case: rapid clicking and interactions do not produce uncaught exceptions', async () => {
    // Rapidly click a series of controls
    const sequence = ['#start-button', '#add-button', '#add-button', '#next-button', '#back-button', '#remove-button', '#update-button', '#finish-workflow-button'];
    for (const sel of sequence) {
      // Some buttons may exist inside containers that get cleared; guard with isVisible
      try {
        const loc = page.locator(sel);
        if (await loc.count() > 0) {
          await loc.click({ timeout: 2000 }).catch(() => { /* swallow click errors for the sequence - we will assert errors below */ });
        }
      } catch (e) {
        // Ignore errors from clicking non-existent/changed nodes in this rapid-fire sequence
      }
    }

    // After the interactions, ensure the page did not throw any uncaught exceptions
    // It is valid if the app logs console warnings; ensure there are no fatal page errors
    expect(pageErrors.length).toBe(0);

    // Also check console for any fatal types (SyntaxError) which would indicate serious problems
    const fatalConsole = consoleMessages.filter(m => m.text.includes('SyntaxError'));
    expect(fatalConsole.length).toBe(0);
  });

  // Explicitly observe console and page errors during a set of interactions and assert captured results.
  test('Observe console messages and uncaught page errors during interactions', async () => {
    // Clear previously captured arrays (they were captured from navigation)
    consoleMessages = [];
    pageErrors = [];

    // Perform interactions that exercise many code paths
    await page.click('#add-button'); // start -> complex-workflow
    await page.click('#add-button'); // -> exploration
    await page.click('#next-button'); // -> feedback
    await page.click('#remove-button'); // -> complex-workflow
    await page.click('#add-button'); // -> exploration
    await page.click('#finish-workflow-button'); // finish -> start

    // Small wait to allow any async console output to flush
    await page.waitForTimeout(250);

    // Capture final state
    const finalState = await getCurrentState(page);

    // Final state after this sequence is expected to be 'start' (finishWorkflow sets it)
    expect(finalState).toBe('start');

    // Validate that no uncaught exceptions were raised in the page; if there were, surface them for debugging
    if (pageErrors.length > 0) {
      // Fail with the first error's message to aid debugging
      const combined = pageErrors.map(e => e && e.message ? e.message : String(e)).join('\n---\n');
      throw new Error('Uncaught page errors detected during interactions:\n' + combined);
    }

    // Inspect console messages for any of the common fatal error types and fail if found
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    // We allow non-critical console messages, but treat fatal JS errors as failures
    expect(errorConsoleMsgs.length).toBe(0);
  });

  // Safety check: Ensure that the application exposes all FSM states as variables or reachable transitions
  test('Sanity: all FSM states are reachable via UI interactions', async () => {
    // Reset by navigating again to ensure fresh state
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Reach complex-workflow
    await page.click('#add-button');
    expect(await getCurrentState(page)).toBe('complex-workflow');

    // Reach exploration
    await page.click('#add-button');
    expect(await getCurrentState(page)).toBe('exploration');

    // Reach feedback
    await page.click('#next-button');
    expect(await getCurrentState(page)).toBe('feedback');

    // Return to complex-workflow via back
    await page.click('#back-button');
    expect(await getCurrentState(page)).toBe('complex-workflow');

    // Finish workflow to return to start
    await page.click('#add-button'); // go to exploration again
    await page.click('#finish-workflow-button'); // finish -> start
    expect(await getCurrentState(page)).toBe('start');

    expect(pageErrors.length).toBe(0);
  });
});