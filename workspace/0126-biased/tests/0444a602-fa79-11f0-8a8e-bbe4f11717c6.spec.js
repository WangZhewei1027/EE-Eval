import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0444a602-fa79-11f0-8a8e-bbe4f11717c6.html';

// Utility to check for common JS error keywords in text
function containsJSErrorKeyword(text) {
  if (!text) return false;
  return /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(text);
}

test.describe('Type System interactive application - FSM validation (0444a602-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  let consoleMessages;
  let pageErrors;

  // Set up listeners and navigate before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages with their types and text
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err);
    });

    // Navigate to the app URL
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown: no special teardown required, but keep hook for clarity
  test.afterEach(async () => {
    // Nothing to clean up explicitly; arrays will be reinitialized next test
  });

  // Helper to assert that at least one JS runtime error was observed (console or pageerror)
  function assertJsRuntimeErrorObserved() {
    const consoleHasError = consoleMessages.some(
      (m) => m.type === 'error' || containsJSErrorKeyword(m.text)
    );
    const pageHasError = pageErrors.length > 0;
    if (!(consoleHasError || pageHasError)) {
      throw new Error(
        'Expected at least one JS runtime error (ReferenceError/TypeError/SyntaxError or console.error), but none were observed.\n' +
          `Console messages: ${JSON.stringify(consoleMessages, null, 2)}\n` +
          `Page errors: ${pageErrors.map((e) => e.toString()).join('\n')}`
      );
    }
  }

  test('Idle state renders initial UI - verifies S0_Idle evidence and renderPage entry', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle).
    // Checks presence and visibility of both primary buttons and basic DOM.
    // Also inspects console/page errors to verify renderPage() behavior was observed or errors occurred.
    const learnButton = await page.$('#learn-button');
    const playButton = await page.$('#play-button');
    const header = await page.$('h1');
    const exampleContainer = await page.$('.type-system-example');

    // Assert initial elements exist
    expect(learnButton, 'Learn More button should exist on Idle state').not.toBeNull();
    expect(playButton, 'Play with Types button should exist on Idle state').not.toBeNull();
    expect(header, 'Page header should exist').not.toBeNull();
    expect(exampleContainer, 'Example container should exist').not.toBeNull();

    // Assert button visible (attached and not hidden)
    await expect(page.locator('#learn-button')).toBeVisible();
    await expect(page.locator('#play-button')).toBeVisible();

    // Basic content checks
    const headerText = await header?.textContent();
    expect(headerText?.trim() || '', 'Header should include "Type System"').toContain('Type System');

    // The FSM entry action for S0_Idle lists renderPage()
    // We cannot modify page; we observe console or DOM changes. If errors occur while executing entry actions, we must assert they were observed.
    // Assert that either the example container is present (it is) AND at least one JS runtime error was observed (per instructions to observe and assert natural errors).
    assertJsRuntimeErrorObserved();
  });

  test('Transition S0_Idle -> S1_Learning on Learn More click - validates displayLearningContent behavior', async ({ page }) => {
    // This test validates clicking the Learn More button triggers the transition to S1_Learning.
    // It checks for DOM updates in the .type-system-example area or console logs indicating displayLearningContent(),
    // and also asserts that runtime errors (if any) were observed as required.
    const learnLocator = page.locator('#learn-button');
    await expect(learnLocator).toBeVisible();

    // Clear any previously collected logs for clarity (we will still inspect them)
    // Note: cannot remove listeners, but we reset the arrays used to collect copies for assertion
    // (they were initialized in beforeEach, so they currently reflect page load; keep that info)
    // Click the button
    await learnLocator.click();

    // After click, give the page a moment to react
    await page.waitForTimeout(250);

    // Check for potential learning content being rendered in the example area
    const exampleHTML = await page.locator('.type-system-example').innerHTML();
    const exampleText = (await page.locator('.type-system-example').innerText().catch(() => '')) || '';

    // Check console messages for a function or debug string indicating displayLearningContent
    const consoleShowsDisplay = consoleMessages.some((m) =>
      /displayLearningContent|display learning|Learning content/i.test(m.text)
    );

    // The FSM expects "Learning content displayed" as an observable.
    // Validate that either the example container was populated OR a relevant console message was emitted OR runtime errors happened.
    const learningObserved = (exampleHTML && exampleHTML.trim() !== '') || exampleText.trim() !== '' || consoleShowsDisplay || pageErrors.length > 0;

    if (!learningObserved) {
      throw new Error(
        'Clicking Learn More did not produce observable learning content, console message, or page error.\n' +
          `Example HTML: "${exampleHTML}"\n` +
          `Console messages: ${JSON.stringify(consoleMessages, null, 2)}\n` +
          `Page errors: ${pageErrors.map((e) => e.toString()).join('\n')}`
      );
    }

    // Additionally, per instructions, assert that JS runtime error(s) were observed (let them happen naturally)
    assertJsRuntimeErrorObserved();
  });

  test('Transition S0_Idle -> S2_Playing on Play with Types click - validates initiateTypePlay behavior', async ({ page }) => {
    // This test validates clicking the Play with Types button triggers transition to S2_Playing.
    // It checks DOM updates (type play interface) or console logs for initiateTypePlay(), and asserts runtime errors occurred.
    const playLocator = page.locator('#play-button');
    await expect(playLocator).toBeVisible();

    // Click the play button
    await playLocator.click();

    // Allow some time for any client-side actions to execute
    await page.waitForTimeout(250);

    // Inspect the example area for changes indicating a play interface
    const exampleHTML = await page.locator('.type-system-example').innerHTML();
    const exampleText = (await page.locator('.type-system-example').innerText().catch(() => '')) || '';

    // Check console for indications of initiateTypePlay
    const consoleShowsInitiate = consoleMessages.some((m) =>
      /initiateTypePlay|type play|Play with Types|type-play/i.test(m.text)
    );

    // Validate that either DOM changed to show play interface OR console shows initiate action OR page errors exist
    const playObserved = (exampleHTML && exampleHTML.trim() !== '') || exampleText.trim() !== '' || consoleShowsInitiate || pageErrors.length > 0;

    if (!playObserved) {
      throw new Error(
        'Clicking Play with Types did not produce observable play interface, console message, or page error.\n' +
          `Example HTML: "${exampleHTML}"\n` +
          `Console messages: ${JSON.stringify(consoleMessages, null, 2)}\n` +
          `Page errors: ${pageErrors.map((e) => e.toString()).join('\n')}`
      );
    }

    // Assert runtime error(s) observed as required
    assertJsRuntimeErrorObserved();
  });

  test('Edge cases: rapid interactions and double clicks do not crash the test harness (observe errors if any)', async ({ page }) => {
    // This test performs rapid interactions: double-click Learn More and Play with Types in quick succession.
    // It ensures the app either transitions gracefully or that we capture natural runtime errors (which we must assert).
    const learn = page.locator('#learn-button');
    const play = page.locator('#play-button');

    await expect(learn).toBeVisible();
    await expect(play).toBeVisible();

    // Perform rapid sequence of interactions
    await learn.dblclick().catch(() => {}); // swallow Playwright click-level errors but let page errors surface
    await page.waitForTimeout(50);
    await play.dblclick().catch(() => {});
    await page.waitForTimeout(250);

    // After rapid interactions, collect current DOM snapshots
    const exampleHTML = await page.locator('.type-system-example').innerHTML().catch(() => '');
    const exampleText = await page.locator('.type-system-example').innerText().catch(() => '');

    // If the rapid interactions caused exceptions, they should have been captured in pageErrors or consoleMessages with type 'error'
    const consoleHasError = consoleMessages.some((m) => m.type === 'error' || containsJSErrorKeyword(m.text));
    const pageHasError = pageErrors.length > 0;

    // We must assert that runtime errors occurred naturally (per instructions)
    if (!(consoleHasError || pageHasError)) {
      throw new Error(
        'Rapid interactions did not produce any observable runtime errors (expected at least one). ' +
          `Console messages: ${JSON.stringify(consoleMessages, null, 2)}\n` +
          `Page errors: ${pageErrors.map((e) => e.toString()).join('\n')}\n` +
          `Example area content: "${exampleText || exampleHTML}"`
      );
    }

    // Additionally, ensure the page remained interactive: buttons should still be present
    expect(await page.locator('#learn-button').count(), 'Learn button should still be present').toBeGreaterThan(0);
    expect(await page.locator('#play-button').count(), 'Play button should still be present').toBeGreaterThan(0);
  });

  test('OnEnter/OnExit actions observation - renderPage(), displayLearningContent(), initiateTypePlay() should be observable or errors captured', async ({ page }) => {
    // This test specifically looks for evidence of the entry actions listed in the FSM:
    // S0_Idle entry: renderPage()
    // S1_Learning entry: displayLearningContent()
    // S2_Playing entry: initiateTypePlay()
    //
    // We do not modify the page. We inspect console logs and DOM and assert at least one of these was observable or that runtime errors occurred.

    // Check logs/DOM after initial load for renderPage()
    const initialConsoleRender = consoleMessages.some((m) => /renderPage|render page/i.test(m.text));
    const initialExample = (await page.locator('.type-system-example').innerHTML().catch(() => '')).trim();
    const sawRenderEvidence = initialConsoleRender || initialExample.length > 0;

    // Trigger Learning and Playing transitions to observe their entry actions
    await page.locator('#learn-button').click().catch(() => {});
    await page.waitForTimeout(150);
    await page.locator('#play-button').click().catch(() => {});
    await page.waitForTimeout(150);

    const consoleHasDisplayLearning = consoleMessages.some((m) => /displayLearningContent|display learning|Learning content/i.test(m.text));
    const consoleHasInitiatePlay = consoleMessages.some((m) => /initiateTypePlay|initiate type/i.test(m.text));

    // Also consider page errors as acceptable "observed behavior" per instructions
    const anyPageError = pageErrors.length > 0;

    const observedAnyEntryAction = sawRenderEvidence || consoleHasDisplayLearning || consoleHasInitiatePlay || anyPageError;

    if (!observedAnyEntryAction) {
      throw new Error(
        'No observable evidence of entry actions renderPage(), displayLearningContent(), or initiateTypePlay(), and no runtime errors captured.\n' +
          `Console: ${JSON.stringify(consoleMessages, null, 2)}\nPage errors: ${pageErrors.map((e) => e.toString()).join('\n')}\n` +
          `Example container initial HTML: "${initialExample}"`
      );
    }

    // As required by instructions, assert that at least one JS runtime error occurred naturally
    assertJsRuntimeErrorObserved();
  });
});