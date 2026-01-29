import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0a520-fa79-11f0-8075-e54a10595dde.html';

test.describe('Version Control Simulator (Application ID: 99d0a520-fa79-11f0-8075-e54a10595dde)', () => {
  // Arrays to collect runtime diagnostics for each test
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Collect console messages (type + text)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', error => {
      pageErrors.push(error && error.message ? error.message : String(error));
    });

    // Auto-accept and record dialogs (alerts)
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Ensure the page has loaded main elements before proceeding
    await expect(page.locator('#fileInput')).toBeVisible();
    await expect(page.locator('#commitBtn')).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic sanity: no unexpected page errors by default
    // Tests that expect errors will assert dialogs array instead.
    // We keep this lightweight and do not throw here to allow per-test assertions.
  });

  test.describe('Initial State (S0_Idle) and rendering', () => {
    test('renders expected controls and visuals in Idle state', async ({ page }) => {
      // Validate presence of UI elements as described in the FSM Idle state
      await expect(page.locator('#fileInput')).toHaveAttribute('placeholder', 'Enter file content');
      await expect(page.locator('#commitBtn')).toHaveText('Commit');
      await expect(page.locator('#revertBtn')).toHaveText('Revert Last Commit');
      await expect(page.locator('#resetBtn')).toHaveText('Reset to Base Version');
      await expect(page.locator('#viewHistoryBtn')).toHaveText('View Commit History');

      // Current value should show the base "No content" visual
      await expect(page.locator('#currentValue')).toHaveText('No content');

      // History div should initially be empty (per HTML)
      await expect(page.locator('#history')).toHaveText('', { timeout: 500 });

      // Log should be empty initially
      await expect(page.locator('#log')).toHaveText('', { timeout: 500 });

      // Verify renderPage() is not defined (FSM mentioned it as an entry action but the implementation doesn't define it)
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // Verify no uncaught page errors occurred during load
      expect(pageErrors).toHaveLength(0);
      // No console errors
      expect(consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
    });
  });

  test.describe('Commit (Commit event -> S1_Committed)', () => {
    test('committing content updates currentValue, log, and clears input', async ({ page }) => {
      // Comment: This test validates the Commit event transition from Idle to Committed
      const content = 'Hello v1';

      await page.fill('#fileInput', content);
      await page.click('#commitBtn');

      // After commit:
      // - currentValue.innerText should equal the committed content
      // - log.innerText should indicate "Committed version 1"
      // - fileInput should be cleared
      await expect(page.locator('#currentValue')).toHaveText(content);
      await expect(page.locator('#log')).toHaveText('Committed version 1');
      await expect(page.locator('#fileInput')).toHaveValue('');

      // View history should still be empty until explicitly clicked
      await expect(page.locator('#history')).toHaveText('', { timeout: 500 });

      // No uncaught page errors or console errors expected
      expect(pageErrors).toHaveLength(0);
      expect(consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
    });

    test('committing multiple times increments version and preserves prior commits for history', async ({ page }) => {
      // Commit first version
      await page.fill('#fileInput', 'Alpha');
      await page.click('#commitBtn');
      await expect(page.locator('#log')).toHaveText('Committed version 1');

      // Commit second version
      await page.fill('#fileInput', 'Beta');
      await page.click('#commitBtn');
      await expect(page.locator('#log')).toHaveText('Committed version 2');
      await expect(page.locator('#currentValue')).toHaveText('Beta');

      // View history should display both entries
      await page.click('#viewHistoryBtn');
      const historyLocator = page.locator('#history');
      await expect(historyLocator).toContainText('Version 1: Alpha');
      await expect(historyLocator).toContainText('Version 2: Beta');

      // Confirm two entries exist in the history container
      const entriesCount = await page.$$eval('#history > div', nodes => nodes.length);
      expect(entriesCount).toBe(2);

      // No page errors
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Revert (Revert event -> S2_Reverted)', () => {
    test('reverting with a single commit returns to No content and logs version 0', async ({ page }) => {
      // Commit once then revert
      await page.fill('#fileInput', 'SoloCommit');
      await page.click('#commitBtn');
      await expect(page.locator('#log')).toHaveText('Committed version 1');

      await page.click('#revertBtn');

      // After revert from single commit:
      // - currentValue should be 'No content'
      // - log should indicate reverted to version 0
      await expect(page.locator('#currentValue')).toHaveText('No content');
      await expect(page.locator('#log')).toHaveText('Reverted to version 0');

      // No console or page errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
    });

    test('reverting after multiple commits restores previous commit content and version', async ({ page }) => {
      // Commit two versions then revert once
      await page.fill('#fileInput', 'First');
      await page.click('#commitBtn');
      await expect(page.locator('#log')).toHaveText('Committed version 1');

      await page.fill('#fileInput', 'Second');
      await page.click('#commitBtn');
      await expect(page.locator('#log')).toHaveText('Committed version 2');

      // Revert last commit -> should restore First
      await page.click('#revertBtn');
      await expect(page.locator('#currentValue')).toHaveText('First');
      await expect(page.locator('#log')).toHaveText('Reverted to version 1');

      // View history should now contain only version 1
      await page.click('#viewHistoryBtn');
      await expect(page.locator('#history')).toContainText('Version 1: First');

      // No page errors
      expect(pageErrors).toHaveLength(0);
    });

    test('reverting with no commits triggers alert (edge case)', async ({ page }) => {
      // Ensure no commits present
      await page.click('#resetBtn'); // ensure a clean state

      // Clear any dialogs captured so far
      dialogs = [];

      // Click revert when commits array is empty -> should show alert "No commits to revert."
      await page.click('#revertBtn');

      // Verify that the alert dialog was shown with the expected message
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1]).toBe('No commits to revert.');

      // Ensure no page errors occurred
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Reset (Reset event -> S3_Reset)', () => {
    test('reset clears commits and sets currentValue to No content and logs reset message', async ({ page }) => {
      // Create a commit to observe reset behavior
      await page.fill('#fileInput', 'ToBeReset');
      await page.click('#commitBtn');
      await expect(page.locator('#currentValue')).toHaveText('ToBeReset');
      await expect(page.locator('#log')).toHaveText('Committed version 1');

      // Now reset
      await page.click('#resetBtn');

      // After reset:
      await expect(page.locator('#currentValue')).toHaveText('No content');
      await expect(page.locator('#log')).toHaveText('Reset to base version');

      // Viewing history should reflect no commits made yet.
      await page.click('#viewHistoryBtn');
      await expect(page.locator('#history')).toHaveText('No commits made yet.');

      // No page errors
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('ViewHistory (ViewHistory event, S0_Idle self-transition)', () => {
    test('view history when there are no commits shows informative message', async ({ page }) => {
      // Ensure starting clean
      await page.click('#resetBtn');

      // Click view history - should update history div with 'No commits made yet.'
      await page.click('#viewHistoryBtn');
      await expect(page.locator('#history')).toHaveText('No commits made yet.');

      // No errors
      expect(pageErrors).toHaveLength(0);
    });

    test('view history when commits exist renders a list of commits', async ({ page }) => {
      // Commit two items
      await page.fill('#fileInput', 'Entry1');
      await page.click('#commitBtn');
      await page.fill('#fileInput', 'Entry2');
      await page.click('#commitBtn');

      // Click view history
      await page.click('#viewHistoryBtn');

      // Validate the history contents
      const history = page.locator('#history');
      await expect(history).toContainText('Version 1: Entry1');
      await expect(history).toContainText('Version 2: Entry2');

      // Confirm two entries appended as div elements
      const count = await page.$$eval('#history > div', nodes => nodes.length);
      expect(count).toBe(2);

      // No page errors
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('committing with empty input triggers alert and does not change state', async ({ page }) => {
      // Ensure empty input
      await page.fill('#fileInput', '');
      dialogs = [];

      // Click commit with no content: should trigger alert
      await page.click('#commitBtn');

      // Validate the alert message
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1]).toBe('Please enter file content to commit.');

      // Confirm no change to currentValue or log
      await expect(page.locator('#currentValue')).toHaveText('No content');
      await expect(page.locator('#log')).toHaveText('', { timeout: 500 });

      // No uncaught page errors
      expect(pageErrors).toHaveLength(0);
    });

    test('no unexpected console errors or page errors across typical flows', async ({ page }) => {
      // Perform a sequence of actions: commit, commit, revert, viewHistory, reset
      await page.fill('#fileInput', 'One');
      await page.click('#commitBtn');

      await page.fill('#fileInput', 'Two');
      await page.click('#commitBtn');

      await page.click('#revertBtn');
      await page.click('#viewHistoryBtn');
      await page.click('#resetBtn');

      // Confirm no uncaught runtime errors collected
      expect(pageErrors).toHaveLength(0);

      // Ensure console did not record any messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });
  });
});