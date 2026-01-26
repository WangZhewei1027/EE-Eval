import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d02ff3-fa79-11f0-8075-e54a10595dde.html';

test.describe('ACID Properties Interactive Demo (FSM validation) - 99d02ff3-fa79-11f0-8075-e54a10595dde', () => {
  // Per-test storage for console and page errors to assert later
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for each test
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
    // Ensure the page loaded the expected title so tests proceed only when loaded
    await expect(page).toHaveTitle(/ACID Properties Interactive Demo/);
  });

  test.afterEach(async () => {
    // After each test, assert no uncaught page errors occurred
    // This verifies we observed console/page errors (we expect none for a healthy run)
    expect(pageErrors.length).toBe(0);
  });

  test('Initial Idle state is rendered correctly', async ({ page }) => {
    // Validate initial "Idle" state evidence: paragraph text shows "No transactions yet"
    const currentState = page.locator('#currentState');
    await expect(currentState).toHaveText('No transactions yet');

    // Buttons that should be hidden initially
    await expect(page.locator('#commit')).toBeHidden();
    await expect(page.locator('#rollback')).toBeHidden();
    await expect(page.locator('#addData')).toBeHidden();

    // Data and history lists should be empty
    await expect(page.locator('#dataList')).toHaveCount(1); // the UL element exists
    await expect(page.locator('#dataList li')).toHaveCount(0);
    await expect(page.locator('#transactionHistory li')).toHaveCount(0);

    // Confirm global flag isTransactionActive is false initially (read-only check)
    const isActive = await page.evaluate(() => typeof isTransactionActive !== 'undefined' ? isTransactionActive : null);
    expect(isActive).toBe(false);
  });

  test.describe('Start Transaction and Active State transitions', () => {
    test('Start Transaction shows active UI and sets isTransactionActive=true', async ({ page }) => {
      // Click Start Transaction
      await page.click('#beginTransaction');

      // Verify UI updated to "Transaction in progress..."
      await expect(page.locator('#currentState')).toHaveText('Transaction in progress...');

      // Buttons should now be visible
      await expect(page.locator('#commit')).toBeVisible();
      await expect(page.locator('#rollback')).toBeVisible();
      await expect(page.locator('#addData')).toBeVisible();

      // Global flag should be true
      const isActive = await page.evaluate(() => isTransactionActive);
      expect(isActive).toBe(true);
    });

    test('Add Data while transaction is active updates data list and history but stays in active state', async ({ page }) => {
      // Begin transaction
      await page.click('#beginTransaction');

      // Enter data and click Add Data
      await page.fill('#dataInput', 'first entry');
      await page.click('#addData');

      // Data list should have the new entry
      await expect(page.locator('#dataList li')).toHaveCount(1);
      await expect(page.locator('#dataList li').first()).toHaveText('first entry');

      // Transaction history should have "Added: first entry"
      await expect(page.locator('#transactionHistory li')).toHaveCount(1);
      await expect(page.locator('#transactionHistory li').first()).toHaveText('Added: first entry');

      // Still in transaction active state
      await expect(page.locator('#currentState')).toHaveText('Transaction in progress...');
      const isActive = await page.evaluate(() => isTransactionActive);
      expect(isActive).toBe(true);
    });

    test('Add Data with empty input does nothing (edge case)', async ({ page }) => {
      await page.click('#beginTransaction');

      // Ensure input empty
      await page.fill('#dataInput', '');
      // Click Add Data (should do nothing)
      await page.click('#addData');

      // No entries added
      await expect(page.locator('#dataList li')).toHaveCount(0);
      await expect(page.locator('#transactionHistory li')).toHaveCount(0);

      // Still active
      await expect(page.locator('#currentState')).toHaveText('Transaction in progress...');
    });
  });

  test.describe('Commit and Rollback transitions (final states)', () => {
    test('Commit Transaction persists data if present and finalizes the transaction', async ({ page }) => {
      // Start transaction and add data via input before committing (simulate user flow)
      await page.click('#beginTransaction');
      await page.fill('#dataInput', 'to commit');
      // Click Commit - commit handler will read input value and push to dataEntries/transactionHistory
      await page.click('#commit');

      // After commit, currentState should read "Transaction committed."
      await expect(page.locator('#currentState')).toHaveText('Transaction committed.');

      // Buttons should be hidden after finalizing
      await expect(page.locator('#commit')).toBeHidden();
      await expect(page.locator('#rollback')).toBeHidden();
      await expect(page.locator('#addData')).toBeHidden();

      // Data list should include committed data
      await expect(page.locator('#dataList li')).toHaveCount(1);
      await expect(page.locator('#dataList li').first()).toHaveText('to commit');

      // Transaction history should include "Committed: to commit"
      await expect(page.locator('#transactionHistory li')).toHaveCount(1);
      await expect(page.locator('#transactionHistory li').first()).toHaveText('Committed: to commit');

      // Global flag should be false after finalizeTransaction (onExit action)
      const isActive = await page.evaluate(() => isTransactionActive);
      expect(isActive).toBe(false);
    });

    test('Rollback Transaction finalizes transaction without committing new input', async ({ page }) => {
      // Start transaction but do NOT add/commit data
      await page.click('#beginTransaction');

      // Optionally fill input and then rollback to ensure uncommitted input is not committed automatically
      await page.fill('#dataInput', 'will be rolled back');
      await page.click('#rollback');

      // After rollback, currentState should read "Transaction rolled back."
      await expect(page.locator('#currentState')).toHaveText('Transaction rolled back.');

      // Buttons hidden
      await expect(page.locator('#commit')).toBeHidden();
      await expect(page.locator('#rollback')).toBeHidden();
      await expect(page.locator('#addData')).toBeHidden();

      // Because we never used Add Data or Commit to push the value into dataEntries/transactionHistory,
      // the lists should remain unchanged (empty)
      await expect(page.locator('#dataList li')).toHaveCount(0);
      await expect(page.locator('#transactionHistory li')).toHaveCount(0);

      // Global flag should be false after finalizeTransaction
      const isActive = await page.evaluate(() => isTransactionActive);
      expect(isActive).toBe(false);
    });
  });

  test.describe('Edge cases: interacting when no active transaction', () => {
    test('Clicking Commit when no transaction is active should do nothing', async ({ page }) => {
      // Ensure starting state
      await expect(page.locator('#currentState')).toHaveText('No transactions yet');

      // Programmatically click commit even though it's hidden; commit handler returns early when not active.
      // Use page.evaluate to invoke the click handler regardless of visibility.
      await page.evaluate(() => {
        const commitBtn = document.getElementById('commit');
        if (commitBtn) commitBtn.click();
      });

      // State should remain unchanged
      await expect(page.locator('#currentState')).toHaveText('No transactions yet');
      await expect(page.locator('#dataList li')).toHaveCount(0);
      await expect(page.locator('#transactionHistory li')).toHaveCount(0);

      // Confirm isTransactionActive still false
      const isActive = await page.evaluate(() => isTransactionActive);
      expect(isActive).toBe(false);
    });

    test('Clicking Rollback when no transaction is active should do nothing', async ({ page }) => {
      await expect(page.locator('#currentState')).toHaveText('No transactions yet');

      // Invoke rollback click handler programmatically
      await page.evaluate(() => {
        const rb = document.getElementById('rollback');
        if (rb) rb.click();
      });

      // State unchanged
      await expect(page.locator('#currentState')).toHaveText('No transactions yet');
      const isActive = await page.evaluate(() => isTransactionActive);
      expect(isActive).toBe(false);
    });

    test('Clicking Add Data when no transaction is active should do nothing', async ({ page }) => {
      // Enter some text and programmatically click addData
      await page.fill('#dataInput', 'ghost data');

      await page.evaluate(() => {
        const ad = document.getElementById('addData');
        if (ad) ad.click();
      });

      // No data should be added
      await expect(page.locator('#dataList li')).toHaveCount(0);
      await expect(page.locator('#transactionHistory li')).toHaveCount(0);

      // Current state still idle
      await expect(page.locator('#currentState')).toHaveText('No transactions yet');
    });
  });

  test('Fsm evidence: finalizeTransaction function effects on exit', async ({ page }) => {
    // Start transaction and then commit to trigger finalizeTransaction which is an exit action per FSM
    await page.click('#beginTransaction');
    await page.click('#commit');

    // finalizeTransaction should set isTransactionActive to false (evidence)
    const isActive = await page.evaluate(() => isTransactionActive);
    expect(isActive).toBe(false);

    // Also currentState should reflect "committed" (evidence)
    await expect(page.locator('#currentState')).toHaveText('Transaction committed.');
  });

  test('No uncaught runtime errors or console errors were emitted during interactions', async ({ page }) => {
    // Perform a representative sequence of interactions to surface potential errors
    await page.click('#beginTransaction');
    await page.fill('#dataInput', 'x');
    await page.click('#addData');
    await page.fill('#dataInput', 'y');
    await page.click('#commit');

    // Wait a tick for any async errors to surface
    await page.waitForTimeout(100);

    // Assert no page errors were captured
    // pageErrors is asserted in afterEach as well; we check console messages for error-level entries here
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // General sanity checks: data and history show committed entry
    await expect(page.locator('#dataList li')).toHaveCount(1);
    await expect(page.locator('#transactionHistory li')).toHaveCount(1);
  });
});