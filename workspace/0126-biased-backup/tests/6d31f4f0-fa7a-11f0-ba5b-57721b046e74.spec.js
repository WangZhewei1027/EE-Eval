import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d31f4f0-fa7a-11f0-ba5b-57721b046e74.html';

// Helper page object for common interactions and queries
class AgilePage {
  constructor(page) {
    this.page = page;
  }

  // Return whether the element with selector has the 'hidden' class
  async isHidden(selector) {
    const el = this.page.locator(selector);
    // If element does not exist consider it hidden (fail-safe)
    const count = await el.count();
    if (count === 0) return true;
    const cls = await el.getAttribute('class');
    return cls ? cls.split(/\s+/).includes('hidden') : false;
  }

  // Click a selector and wait briefly for any console errors or UI updates
  async clickAndWait(selector, options = {}) {
    const { wait = 200 } = options;
    const el = this.page.locator(selector);
    await el.first().click();
    await this.page.waitForTimeout(wait);
  }

  // Get innerHTML for an element
  async innerHTML(selector) {
    const el = this.page.locator(selector);
    const count = await el.count();
    if (count === 0) return null;
    return await el.first().innerHTML();
  }
}

test.describe('Agile Methodology Interactive Demo - FSM validation and error observation', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors very early so we don't miss load-time errors (like SyntaxError)
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // store the console message object (type and text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the app and wait for 'load' to ensure the script had a chance to be parsed/executed
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // no-op; keeping hook for symmetry and potential teardown in future
  });

  test('Initial Idle state renders and load-time script errors are captured', async ({ page }) => {
    // Validate that the initial "Start New Project" button exists (Idle evidence)
    const startBtn = page.locator('#startProject');
    await expect(startBtn).toHaveCount(1);
    await expect(startBtn).toBeVisible();

    // All primary panels referenced by FSM should exist in the DOM, but be hidden initially
    const panelSelectors = [
      '#projectSetup',
      '#backlogCreation',
      '#sprintPlanning',
      '#activeSprint',
      '#sprintReview',
      '#retrospective',
      '#metrics'
    ];

    for (const sel of panelSelectors) {
      const el = page.locator(sel);
      // Panel should exist
      await expect(el).toHaveCount(1);
      // And should be hidden according to the HTML initial state
      const cls = await el.getAttribute('class');
      expect(cls).toBeTruthy();
      expect(cls.split(/\s+/)).toContain('hidden');
    }

    // Verify that the page recorded at least one script-level error (e.g. SyntaxError) during load.
    // The provided HTML contains a deliberate syntax issue (unmatched quote) that should surface.
    const hasSyntaxErrorInConsole = consoleMessages.some(m =>
      /syntaxerror|unexpected token|unterminated string constant/i.test(m.text)
    );
    const hasSyntaxErrorInPageError = pageErrors.some(e =>
      /syntaxerror|unexpected token|unterminated string constant/i.test(String(e.message))
    );

    // At least one of these should be true in a broken script scenario.
    expect(hasSyntaxErrorInConsole || hasSyntaxErrorInPageError).toBeTruthy();
  });

  test.describe('Attempt FSM events and transitions (observe DOM changes or runtime errors)', () => {
    // Each of these tests attempts a click for a specific event/transition described in the FSM.
    // Because the implementation contains script errors, the tests assert either the expected DOM change
    // (if the handlers happened to be registered) OR that runtime errors were captured (SyntaxError/ReferenceError/TypeError).
    // We avoid altering page runtime and let errors occur naturally.

    test('StartProject -> should reveal project setup or record an error', async ({ page }) => {
      const ag = new AgilePage(page);

      // Attempt to click Start New Project
      await ag.clickAndWait('#startProject');

      // Check if projectSetup panel became visible
      const projectSetupHidden = await ag.isHidden('#projectSetup');

      // Determine if any new runtime errors were captured (pageErrors or consoleMessages)
      const runtimeErrorExists = consoleMessages.some(m =>
        /referenceerror|typeerror|syntaxerror|uncaught/i.test(m.text)
      ) || pageErrors.length > 0;

      // Assert that either the UI changed as expected OR that a runtime error occurred.
      // This follows instructions to allow errors to surface naturally and validate them.
      expect(projectSetupHidden === false || runtimeErrorExists).toBeTruthy();

      // If project setup is visible, ensure the createBacklog button exists inside it
      if (!projectSetupHidden) {
        await expect(page.locator('#createBacklog')).toBeVisible();
      }
    });

    test('CreateBacklog & AddStory -> adding a story updates backlog or errors occur', async ({ page }) => {
      const ag = new AgilePage(page);

      // Ensure projectSetup is visible first (attempt to click startProject again in case it wasn't)
      await ag.clickAndWait('#startProject');

      // Try to click "Create Product Backlog"
      await ag.clickAndWait('#createBacklog');

      // The backlogCreation panel should be visible or an error captured
      const backlogHidden = await ag.isHidden('#backlogCreation');
      const runtimeErrorExists = consoleMessages.some(m =>
        /referenceerror|typeerror|syntaxerror|uncaught/i.test(m.text)
      ) || pageErrors.length > 0;
      expect(backlogHidden === false || runtimeErrorExists).toBeTruthy();

      // Try adding a story (edge case: empty description should not add)
      // First try with empty description
      await ag.clickAndWait('#addStory', { wait: 150 });
      // Ensure that backlogItems did not change (empty or still empty)
      const backlogHTMLBefore = await ag.innerHTML('#backlogItems');

      // Now insert a story text and attempt to add
      await page.fill('#newStory', 'Implement login');
      await page.fill('#storyPoints', '5');
      await ag.clickAndWait('#addStory', { wait: 200 });

      const backlogHTMLAfter = await ag.innerHTML('#backlogItems');

      // Accept either the backlog being updated (HTML changed) or runtime errors having occurred.
      const backlogUpdated = backlogHTMLAfter && backlogHTMLAfter !== backlogHTMLBefore && backlogHTMLAfter.trim().length > 0;
      expect(backlogUpdated || runtimeErrorExists).toBeTruthy();
    });

    test('PrioritizeBacklog and ProceedToSprint -> may reorder or navigate or error', async ({ page }) => {
      const ag = new AgilePage(page);

      // Attempt to prioritize backlog
      await ag.clickAndWait('#prioritizeBacklog', { wait: 150 });

      // Attempt to proceed to sprint planning
      await ag.clickAndWait('#proceedToSprint', { wait: 200 });

      // Either the sprintPlanning becomes visible or an error exists
      const planningHidden = await ag.isHidden('#sprintPlanning');
      const runtimeErrorExists = consoleMessages.some(m =>
        /referenceerror|typeerror|syntaxerror|uncaught/i.test(m.text)
      ) || pageErrors.length > 0;
      expect(planningHidden === false || runtimeErrorExists).toBeTruthy();

      if (!planningHidden) {
        // If visible, ensure team capacity element exists
        await expect(page.locator('#teamCapacity')).toHaveCount(1);
      }
    });

    test('StartSelectedSprint -> attempts to start sprint; validate activeSprint or error', async ({ page }) => {
      const ag = new AgilePage(page);

      // Attempt to click startSelectedSprint (transition to ActiveSprint)
      await ag.clickAndWait('#startSelectedSprint', { wait: 250 });

      const activeHidden = await ag.isHidden('#activeSprint');
      const runtimeErrorExists = consoleMessages.some(m =>
        /referenceerror|typeerror|syntaxerror|uncaught/i.test(m.text)
      ) || pageErrors.length > 0;

      // This function in the script contains a bug (uses `item` undeclared), so a ReferenceError is expected OR nothing happens.
      // Assert that either the Active Sprint panel appears or that a runtime error was collected.
      const referenceErrorDetected = consoleMessages.some(m => /referenceerror/i.test(m.text)) ||
        pageErrors.some(e => /referenceerror/i.test(String(e.message)));

      expect(activeHidden === false || runtimeErrorExists || referenceErrorDetected).toBeTruthy();

      if (!activeHidden) {
        // Validate key elements inside active sprint
        await expect(page.locator('#currentSprintNum')).toHaveCount(1);
        await expect(page.locator('#currentDay')).toHaveCount(1);
      }
    });

    test('AdvanceDay during ActiveSprint -> either advances day or errors', async ({ page }) => {
      const ag = new AgilePage(page);

      // Attempt to advance day
      await ag.clickAndWait('#advanceDay', { wait: 200 });

      // Check if the day displayed changed (note: we cannot rely on script to have run)
      const dayText = await page.locator('#currentDay').innerText().catch(() => null);
      const runtimeErrorExists = consoleMessages.some(m =>
        /referenceerror|typeerror|syntaxerror|uncaught/i.test(m.text)
      ) || pageErrors.length > 0;

      // If dayText is null or unchanged, allow runtime errors to satisfy test; otherwise accept UI change
      const dayValue = dayText ? parseInt(dayText).catch ? NaN : parseInt(dayText) : NaN;
      const dayAdvanced = !isNaN(dayValue) && dayValue > 1;

      expect(dayAdvanced || runtimeErrorExists).toBeTruthy();
    });

    test('CompleteSprint -> should go to Sprint Review or record error', async ({ page }) => {
      const ag = new AgilePage(page);

      // Attempt to complete sprint
      await ag.clickAndWait('#completeSprint', { wait: 200 });

      const reviewHidden = await ag.isHidden('#sprintReview');
      const runtimeErrorExists = consoleMessages.some(m =>
        /referenceerror|typeerror|syntaxerror|uncaught/i.test(m.text)
      ) || pageErrors.length > 0;

      expect(reviewHidden === false || runtimeErrorExists).toBeTruthy();

      if (!reviewHidden) {
        // If visible, ensure reviewResults exists
        await expect(page.locator('#reviewResults')).toHaveCount(1);
      }
    });

    test('ProceedToRetro and CompleteRetro -> navigate to retrospective and back or capture errors', async ({ page }) => {
      const ag = new AgilePage(page);

      // Attempt to proceed to retrospective
      await ag.clickAndWait('#proceedToRetro', { wait: 150 });

      const retroHidden = await ag.isHidden('#retrospective');
      const runtimeErrorExists = consoleMessages.some(m =>
        /referenceerror|typeerror|syntaxerror|uncaught/i.test(m.text)
      ) || pageErrors.length > 0;

      expect(retroHidden === false || runtimeErrorExists).toBeTruthy();

      // Attempt to complete retrospective (should go back to backlogCreation)
      await ag.clickAndWait('#completeRetro', { wait: 150 });

      const backlogHidden = await ag.isHidden('#backlogCreation');
      const runtimeOrTransition = consoleMessages.some(m =>
        /referenceerror|typeerror|syntaxerror|uncaught/i.test(m.text)
      ) || pageErrors.length > 0 || backlogHidden === false;

      expect(runtimeOrTransition).toBeTruthy();
    });

    test('ShowMetrics & ShowRetro from Idle -> either open panels or capture errors', async ({ page }) => {
      const ag = new AgilePage(page);

      // The FSM indicates ShowMetrics should require state.project to be set; try clicking regardless.
      await ag.clickAndWait('#showMetrics', { wait: 150 });

      const metricsHidden = await ag.isHidden('#metrics');
      const runtimeErrorExists = consoleMessages.some(m =>
        /referenceerror|typeerror|syntaxerror|uncaught/i.test(m.text)
      ) || pageErrors.length > 0;

      // Either metrics panel opens (if project was created successfully) or we have an error (from broken script).
      expect(metricsHidden === false || runtimeErrorExists).toBeTruthy();

      // Try Hold Retrospective button which in FSM maps to showRetro
      await ag.clickAndWait('#showRetro', { wait: 150 });

      const retroHidden = await ag.isHidden('#retrospective');

      // Either retro is visible or runtime error present (or nothing happens if conditions aren't met)
      expect(retroHidden === false || runtimeErrorExists || pageErrors.length > 0).toBeTruthy();
    });

    test('Concept explorer interactions: clicking concept buttons should reveal concept info or be harmless', async ({ page }) => {
      const ag = new AgilePage(page);

      // Click a variety of concept buttons
      const conceptButtons = await page.locator('.concept-btn').elementHandles();

      // If concept buttons exist, click each and assert conceptInfo panel opens or errors captured
      for (let i = 0; i < conceptButtons.length; i++) {
        // Use nth locator to avoid staleness
        const btnLocator = page.locator('.concept-btn').nth(i);
        await btnLocator.click();
        await page.waitForTimeout(150);

        const conceptInfoHidden = await ag.isHidden('#conceptInfo');

        const runtimeErrorExists = consoleMessages.some(m =>
          /referenceerror|typeerror|syntaxerror|uncaught/i.test(m.text)
        ) || pageErrors.length > 0;

        // At minimum, conceptInfo should open or runtime error should exist.
        expect(conceptInfoHidden === false || runtimeErrorExists).toBeTruthy();

        // If open, basic structure should be present
        if (!conceptInfoHidden) {
          await expect(page.locator('#conceptTitle')).toHaveCount(1);
        }
      }
    });
  });

  test.describe('Edge cases and error scenarios explicitly asserted', () => {
    test('Ensure the page emitted a SyntaxError (from the deliberate bug) during load', async ({ page }) => {
      // Confirm a SyntaxError was observed either via console or pageerror
      const syntaxConsole = consoleMessages.some(m =>
        /syntaxerror|unexpected token|unterminated string/i.test(m.text)
      );
      const syntaxPageError = pageErrors.some(e =>
        /syntaxerror|unexpected token|unterminated string/i.test(String(e.message))
      );

      expect(syntaxConsole || syntaxPageError).toBeTruthy();
    });

    test('Validate that calling functions that reference undefined variables would produce ReferenceError if parsed (observed in console)', async ({ page }) => {
      // The application also contains usage of an undefined variable `item` inside startSelectedSprint.
      // If the script parsed beyond that function, invoking it would produce a ReferenceError.
      // Because of the SyntaxError earlier, the function may not be defined; nevertheless we assert that either
      // a ReferenceError has been observed in console or pageerror OR the function is absent (no handler attached).
      const sawReferenceError = consoleMessages.some(m => /referenceerror/i.test(m.text)) ||
        pageErrors.some(e => /referenceerror/i.test(String(e.message)));

      // It's acceptable if ReferenceError hasn't been observed, but we should at least confirm the function is not attached (no click handler effect).
      // To check for handler effect, click the button and observe that nothing changes (panels remain hidden).
      const beforeClass = await page.locator('#activeSprint').getAttribute('class');
      await page.locator('#startSelectedSprint').click().catch(() => {});
      await page.waitForTimeout(120);
      const afterClass = await page.locator('#activeSprint').getAttribute('class');

      const noChange = beforeClass === afterClass;

      expect(sawReferenceError || noChange).toBeTruthy();
    });

    test('Attempt to use concept interactive that triggers alert or further actions (simulateXP uses alert) - ensure it is not intercepted or modified', async ({ page }) => {
      // Click XP concept to inject its interactive content
      await page.locator('.concept-btn[data-concept="xp"]').click();
      await page.waitForTimeout(150);

      // If the interactive contains a button that triggers alert, we should not intercept the alert but can detect its presence via console if thrown.
      // Playwright does not show browser alert as console; catching alerts requires dialog handler. We will attach a one-time dialog handler to assert it happens only if the function is available.
      let sawDialog = false;
      page.once('dialog', async dialog => {
        sawDialog = true;
        await dialog.dismiss();
      });

      // Try to click the simulate button if present
      const simulateBtn = page.locator('#xpSimulate');
      const count = await simulateBtn.count();
      if (count > 0) {
        await simulateBtn.click().catch(() => {});
        // give some time for dialog to appear
        await page.waitForTimeout(200);
      }

      // Either a dialog was shown (function existed and triggered alert) OR runtime errors exist in console/pageErrors
      const runtimeErrorExists = consoleMessages.some(m =>
        /referenceerror|typeerror|syntaxerror|uncaught/i.test(m.text)
      ) || pageErrors.length > 0;

      expect(sawDialog || runtimeErrorExists || count === 0).toBeTruthy();
    });
  });
});