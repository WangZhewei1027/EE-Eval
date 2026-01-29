import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d321c00-fa7a-11f0-ba5b-57721b046e74.html';

// Page object encapsulating common interactions with the Design Patterns Explorer page
class PatternsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      patternCategory: '#patternCategory',
      loadPatterns: '#loadPatterns',
      patternsContainer: '#patternsContainer',
      patternDetails: '#patternDetails',
      currentPatternName: '#currentPatternName',
      patternTabs: '#patternTabs',
      tab: '.tab',
      tabContent: '.tab-content',
      interactiveControls: '#interactiveControls',
      interactiveOutput: '#interactiveOutput',
      stateHistory: '#stateHistory',
      undoAction: '#undoAction',
      redoAction: '#redoAction',
      resetAll: '#resetAll'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure the initial scripts had a chance to run
    await this.page.waitForLoadState('load');
  }

  async getConsoleAndPageErrors() {
    // Returns arrays populated externally by test harness listeners
    return {
      consoleMessages: this.consoleMessages || [],
      pageErrors: this.pageErrors || []
    };
  }

  // Helpers that wrap locators and actions
  async selectCategory(categoryValue) {
    await this.page.selectOption(this.selectors.patternCategory, categoryValue);
  }

  async clickLoadPatterns() {
    await this.page.click(this.selectors.loadPatterns);
    // loadPatternList and saveState may execute synchronously; ensure UI updates
    await this.page.waitForTimeout(150);
  }

  async patternsContainerText() {
    return (await this.page.locator(this.selectors.patternsContainer).textContent()) || '';
  }

  async countPatternItems() {
    return await this.page.locator(`${this.selectors.patternsContainer} .pattern-item`).count();
  }

  async clickPatternByName(name) {
    const locator = this.page.locator(`${this.selectors.patternsContainer} .pattern-item`, { hasText: name });
    await expect(locator).toHaveCount(1, { timeout: 2000 });
    await locator.click();
    // showPatternDetails and saveState can be synchronous; wait briefly
    await this.page.waitForTimeout(150);
  }

  async isPatternDetailsVisible() {
    return await this.page.locator(this.selectors.patternDetails).evaluate(el => !el.classList.contains('hidden'));
  }

  async getCurrentPatternName() {
    return (await this.page.locator(this.selectors.currentPatternName).textContent()) || '';
  }

  async clickTab(tabDataName) {
    const tab = this.page.locator(`${this.selectors.tab}[data-tab="${tabDataName}"]`);
    await expect(tab).toHaveCount(1);
    await tab.click();
    // Tabs trigger saveState and also may initialize interactive controls; wait for UI change
    await this.page.waitForTimeout(150);
  }

  async interactiveOutputText() {
    return (await this.page.locator(this.selectors.interactiveOutput).textContent()) || '';
  }

  async clickInteractiveControl(selectorWithinInteractive) {
    // selectorWithinInteractive is a selector relative to #interactiveControls, like '#getInstance'
    const full = `#interactiveControls ${selectorWithinInteractive}`;
    await this.page.click(full);
    // Interactive handlers often update output synchronously; small wait
    await this.page.waitForTimeout(100);
  }

  async getStateHistoryText() {
    return (await this.page.locator(this.selectors.stateHistory).textContent()) || '';
  }

  async clickUndo() {
    await this.page.click(this.selectors.undoAction);
    // loadState uses timeouts internally; allow it to complete
    await this.page.waitForTimeout(350);
  }

  async clickRedo() {
    await this.page.click(this.selectors.redoAction);
    await this.page.waitForTimeout(350);
  }

  async clickResetAll() {
    await this.page.click(this.selectors.resetAll);
    await this.page.waitForTimeout(150);
  }
}

// Test suite
test.describe('Design Patterns Explorer - FSM and Interactive Behaviors', () => {
  let page;
  let patternsPage;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Capture console messages for inspection (info, error, warning, etc.)
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // store both text and type for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture unhandled exceptions
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    patternsPage = new PatternsPage(page);
    await patternsPage.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('S0 Idle: initial load executes loadPatternList("creational") and populates patterns container', async () => {
    // Validate that the entry action loadPatternList('creational') executed on page load.
    const containerText = await patternsPage.patternsContainerText();
    expect(containerText).toContain('Creational Patterns');

    // There should be at least the patterns defined under creational (3 in the HTML)
    const count = await patternsPage.countPatternItems();
    expect(count).toBeGreaterThanOrEqual(3);

    // The FSM initial entry action did not call saveState automatically in the implementation,
    // so stateHistory should be empty initially.
    const stateHistoryText = await patternsPage.getStateHistoryText();
    expect(stateHistoryText.trim()).toBe('');

    // No unexpected unhandled page errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('LOAD_PATTERNS -> S1 PatternsLoaded: changing category and clicking Load Patterns updates UI and state history', async () => {
    // Switch to Behavioral category and click load
    await patternsPage.selectCategory('behavioral');
    await patternsPage.clickLoadPatterns();

    const containerText = await patternsPage.patternsContainerText();
    expect(containerText).toContain('Behavioral Patterns');

    // Confirm patterns list shows items for behavioral patterns
    const count = await patternsPage.countPatternItems();
    expect(count).toBeGreaterThan(0);

    // The click should have saved a state entry
    const historyText = await patternsPage.getStateHistoryText();
    expect(historyText).toContain('behavioral');

    // Ensure the last history entry is bold (current state) by checking DOM for bold style
    const currentBold = await page.locator('#stateHistory div').nth(-1).evaluate(node => window.getComputedStyle(node).fontWeight);
    // fontWeight might be '700' or 'bold' depending on UA; accept both ranges
    expect(['700', 'bold', 'bolder'].includes(currentBold) || parseInt(currentBold || '400', 10) >= 700).toBeTruthy();

    // No unexpected unhandled page errors
    expect(pageErrors.length).toBe(0);
  });

  test('SELECT_PATTERN -> S2 PatternDetailsVisible: selecting a pattern shows details and initializes interactive controls', async () => {
    // Load creational patterns explicitly to ensure deterministic selection
    await patternsPage.selectCategory('creational');
    await patternsPage.clickLoadPatterns();

    // Click the "Singleton" pattern item
    await patternsPage.clickPatternByName('Singleton');

    // After selecting, patternDetails should be visible
    expect(await patternsPage.isPatternDetailsVisible()).toBeTruthy();

    // The currentPatternName should reflect the selected pattern
    const name = await patternsPage.getCurrentPatternName();
    expect(name).toBe('Singleton');

    // Interactive controls are populated for the pattern
    const interactiveControlsHtml = await page.locator('#interactiveControls').innerHTML();
    expect(interactiveControlsHtml).toContain('getInstance');

    // State history should have been updated to include the selection
    const history = await patternsPage.getStateHistoryText();
    expect(history).toContain('Singleton');

    // No unhandled page errors
    expect(pageErrors.length).toBe(0);
  });

  test('TAB_SWITCH -> S3 InteractiveExample: switching to interactive tab initializes interactive and performs interactions (Singleton & Observer)', async () => {
    // -- Test Singleton interactive flow --
    await patternsPage.selectCategory('creational');
    await patternsPage.clickLoadPatterns();
    await patternsPage.clickPatternByName('Singleton');

    // Switch to interactive tab
    await patternsPage.clickTab('interactive');

    // Click the Singleton getInstance button and verify output
    await patternsPage.clickInteractiveControl('#getInstance');

    const singletonOutput = await patternsPage.interactiveOutputText();
    expect(singletonOutput).toContain('Singleton instance created at:');

    // -- Test Observer interactive flow (behavioral) to validate multiple interactions and output formatting --
    await patternsPage.selectCategory('behavioral');
    await patternsPage.clickLoadPatterns();
    await patternsPage.clickPatternByName('Observer');
    await patternsPage.clickTab('interactive');

    // Add two observers
    await patternsPage.clickInteractiveControl('#addObserver');
    await patternsPage.clickInteractiveControl('#addObserver');

    // Notify observers with a custom message
    await page.fill('#notificationData', 'hello observers');
    await patternsPage.clickInteractiveControl('#notifyObservers');

    const observerOutput = await patternsPage.interactiveOutputText();
    // Output should show both "Added observer" lines and both notifications
    expect(observerOutput).toContain('Added observer 1');
    expect(observerOutput).toContain('Added observer 2');
    expect(observerOutput).toContain('Observer 1 received: hello observers');
    expect(observerOutput).toContain('Observer 2 received: hello observers');

    // Clear observers and ensure the interactive output indicates clearing
    await patternsPage.clickInteractiveControl('#clearObservers');
    const clearedText = await patternsPage.interactiveOutputText();
    expect(clearedText).toContain('All observers cleared');

    // No unhandled page errors
    expect(pageErrors.length).toBe(0);
  });

  test('UNDO and REDO actions in S3_InteractiveExample update state history and UI (with edge checks)', async () => {
    // Build a sequence of actions that produce multiple saved states:
    // 1) Load Structural patterns -> saves state
    // 2) Click Adapter pattern -> saves state
    // 3) Click interactive tab -> saves state
    await patternsPage.selectCategory('structural');
    await patternsPage.clickLoadPatterns(); // state 1
    await patternsPage.clickPatternByName('Adapter'); // state 2
    await patternsPage.clickTab('interactive'); // state 3

    // Confirm we have at least 3 states recorded
    const historyInitial = await patternsPage.getStateHistoryText();
    const lines = historyInitial.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(3);

    // Capture the current selected history text (should be the last entry)
    const lastEntryBeforeUndo = lines[lines.length - 1];

    // Perform Undo: should move currentStateIndex to previous and update the UI
    await patternsPage.clickUndo();

    const historyAfterUndo = await patternsPage.getStateHistoryText();
    const linesAfterUndo = historyAfterUndo.split('\n').filter(Boolean);
    // The bold entry should now be the previous one (index length-2)
    // Validate that currentPatternName or active tab corresponds to a prior state (we can check that current tab may no longer be 'interactive')
    const currentPatternNameAfterUndo = (await patternsPage.getCurrentPatternName()).trim();
    expect(currentPatternNameAfterUndo.length).toBeGreaterThan(0);

    // Try undo at earliest state: click undo repeatedly until no change expected
    // Record state history before extra undos
    const historyBeforeExtraUndos = await patternsPage.getStateHistoryText();
    // Click undo several times to attempt to go before 0
    await patternsPage.clickUndo();
    await patternsPage.clickUndo();
    // Ensure no unhandled errors and history still in a consistent state
    expect(pageErrors.length).toBe(0);
    const historyAfterExtraUndos = await patternsPage.getStateHistoryText();
    expect(historyAfterExtraUndos).toBeTruthy();

    // Now test Redo: restore forward
    await patternsPage.clickRedo();
    // After redo, ensure UI has some state and no page errors
    const historyAfterRedo = await patternsPage.getStateHistoryText();
    expect(historyAfterRedo).toBeTruthy();
    expect(pageErrors.length).toBe(0);
  });

  test('RESET_ALL returns to S0 Idle: clears UI and state history', async () => {
    // Create some state: load patterns and select one
    await patternsPage.selectCategory('creational');
    await patternsPage.clickLoadPatterns();
    await patternsPage.clickPatternByName('Builder');
    await patternsPage.clickTab('interactive');

    // Ensure we have state entries
    const beforeResetHistory = await patternsPage.getStateHistoryText();
    expect(beforeResetHistory).toContain('Builder');

    // Click reset all
    await patternsPage.clickResetAll();

    // patternsContainer should be empty
    const containerHtml = await page.locator('#patternsContainer').innerHTML();
    expect(containerHtml.trim()).toBe('');

    // patternDetails should be hidden
    expect(await patternsPage.isPatternDetailsVisible()).toBeFalsy();

    // stateHistory should be empty
    const afterResetHistory = await patternsPage.getStateHistoryText();
    expect(afterResetHistory.trim()).toBe('');

    // No unexpected unhandled errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge error scenario: Adapter "Use Old System Directly" produces handled TypeError and displays message', async () => {
    // Load structural patterns and select Adapter
    await patternsPage.selectCategory('structural');
    await patternsPage.clickLoadPatterns();
    await patternsPage.clickPatternByName('Adapter');
    await patternsPage.clickTab('interactive');

    // Click the "Use Old System Directly" button - this flow intentionally calls oldSystem.request() which does not exist
    await patternsPage.clickInteractiveControl('#useOldSystem');

    // The handler catches the error and writes to interactiveOutput; assert that message appears
    const output = await patternsPage.interactiveOutputText();
    expect(output).toContain('Error:');
    expect(output.toLowerCase()).toContain('request is not a function');

    // This was a handled error; confirm that no unhandled page errors were raised
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Undo/Redo when there is no history should be no-op and not throw', async () => {
    // First reset everything to ensure no history
    await patternsPage.clickResetAll();

    // Clear captured errors
    pageErrors = [];

    // Click undo and redo; these should not throw nor generate unhandled page errors
    await patternsPage.clickUndo();
    await patternsPage.clickRedo();

    expect(pageErrors.length).toBe(0);

    // State history remains empty
    const history = await patternsPage.getStateHistoryText();
    expect(history.trim()).toBe('');
  });

  test('Observe console logs while performing several interactions (diagnostic - not asserting specific log contents)', async () => {
    // Perform a few interactions to generate console messages if any exist
    await patternsPage.selectCategory('creational');
    await patternsPage.clickLoadPatterns();
    await patternsPage.clickPatternByName('Factory Method');
    await patternsPage.clickTab('interactive');

    // Trigger a product creation (should not throw)
    await page.selectOption('#productType', 'A');
    await patternsPage.clickInteractiveControl('#createProduct');

    // Allow short time for handlers
    await page.waitForTimeout(100);

    // Collect captured console messages
    const captured = consoleMessages;
    // We do not require specific console messages for correctness, but ensure capturing worked
    expect(Array.isArray(captured)).toBeTruthy();

    // And still no unhandled page errors
    expect(pageErrors.length).toBe(0);
  });
});