import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cc7391-fa7c-11f0-ba20-415c525382ea.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.simulateButton = page.locator('#simulate-btn');
    this.output = page.locator('#demo-section');
  }

  // Navigate to the page and ensure core UI is present
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main interactive controls to be visible
    await expect(this.simulateButton).toBeVisible();
    await expect(this.output).toBeVisible();
  }

  // Click the simulate button
  async clickSimulate() {
    await this.simulateButton.click();
  }

  // Return the current demo output text content
  async getOutputText() {
    const t = await this.output.textContent();
    return (t ?? '').trim();
  }

  // Wait until the transaction simulation finishes (either success or a failure)
  async waitForSimulationEnd(timeout = 5000) {
    // The page writes one of these final lines when a run finishes:
    // - "Transaction committed successfully."
    // - "Transaction failed due to atomicity."
    // - "Transaction failed." (used in insufficient funds branch)
    await this.page.waitForFunction(() => {
      const el = document.getElementById('demo-section');
      if (!el) return false;
      const text = el.textContent || '';
      return /Transaction committed successfully\.|Transaction failed due to atomicity\.|Transaction failed\./.test(text);
    }, { timeout });
  }
}

test.describe('ACID Properties Demo - FSM state/transition validation', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect all console output from page context
    page.on('console', (msg) => {
      // store type and text for diagnostics/assertions
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught exceptions (page errors)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Provide helpful debug information if a test failed: dump recent console messages
    if (test.info().status !== 'passed') {
      // eslint-disable-next-line no-console
      console.log('Collected console messages:', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Collected page errors:', pageErrors);
    }
  });

  test('Initial state (S0_Idle): UI renders with button and initial message', async ({ page }) => {
    // This test verifies the Idle entry evidence: button exists and demo section initial text
    const demo = new DemoPage(page);
    await demo.goto();

    // Check the simulate button has the expected ARIA label and text
    await expect(demo.simulateButton).toHaveAttribute('aria-label', 'Simulate Transaction');
    await expect(demo.simulateButton).toHaveText('Simulate Transaction');

    // The demo section should contain the initial instruction text (evidence of Idle state)
    const text = await demo.getOutputText();
    expect(text).toContain('Transaction state messages will appear here...');

    // Ensure there are no uncaught JS errors just on load
    expect(pageErrors.length).toBe(0);
  });

  test('Single simulation run: validates transition logs and either success or system error path', async ({ page }) => {
    // This test validates the sequence of transitions for one click:
    // S1 TransactionStarted -> S2 CheckingFunds -> S4 SufficientFunds ->
    // S5 DebitingAccountA -> (either S6 SystemError OR S7 CreditingAccountB -> S8 TransactionCommitted)
    const demo = new DemoPage(page);
    await demo.goto();

    // Click to start simulation
    await demo.clickSimulate();

    // Wait until simulation indicates completion (success or failure)
    await demo.waitForSimulationEnd(5000);

    // Grab the output and assert expected messages and ordering
    const output = await demo.getOutputText();

    // Basic required logs that should always occur in order
    const idxStarting = output.indexOf('Starting transaction: Transfer $200 from Account A to Account B');
    expect(idxStarting).toBeGreaterThanOrEqual(0);

    const idxInitialBalances = output.indexOf('Initial balances -> Account A: $500, Account B: $300');
    expect(idxInitialBalances).toBeGreaterThan(idxStarting);

    const idxStep1 = output.indexOf('Step 1: Checking if Account A has sufficient funds...');
    expect(idxStep1).toBeGreaterThan(idxInitialBalances);

    // Given the page resets balances to 500, insufficient funds branch should NOT be taken.
    // So we expect "Sufficient funds available." after Step 1.
    const idxSufficient = output.indexOf('Sufficient funds available.');
    expect(idxSufficient).toBeGreaterThan(idxStep1);

    // Debiting Account A should follow
    const idxDebit = output.indexOf('Step 2: Debiting Account A...');
    expect(idxDebit).toBeGreaterThan(idxSufficient);

    // After debit we expect the new Account A balance to be $300 (500 - 200)
    const idxAccountANew = output.indexOf('Account A new balance: $300');
    expect(idxAccountANew).toBeGreaterThan(idxDebit);

    // Now there are two possible paths: system error (rollback) or success (credit + commit).
    const isSystemError = output.includes('System error: Failure occurred before crediting Account B.');
    const isCommitted = output.includes('Transaction committed successfully.');
    const isFailedGeneric = output.includes('Transaction failed.');

    // Assert that the run reached a terminal state (one of these)
    expect(isSystemError || isCommitted || isFailedGeneric).toBeTruthy();

    if (isSystemError) {
      // Validate the rollback messages and atomicity behavior
      expect(output).toContain('Rolling back transaction...');
      // After rollback, balance should be restored to $500
      expect(output).toContain('Account A balance restored to: $500');
      expect(output).toContain('Account B balance remains: $300');
      expect(output).toContain('Transaction failed due to atomicity.');
    } else if (isCommitted) {
      // Validate the crediting and commit messages
      expect(output).toContain('Step 3: Crediting Account B...');
      expect(output).toContain('Account B new balance: $500');
      expect(output).toContain('Committing transaction...');
      expect(output).toContain('Transaction committed successfully.');
      expect(output).toContain('Final balances -> Account A: $300, Account B: $500');
    } else {
      // This branch would correspond to insufficient funds / aborted earlier
      // In this implementation (initialBalanceA = 500), this is unlikely, but still handle it.
      expect(output).toContain('Error: Insufficient funds in Account A. Aborting transaction.');
      expect(output).toContain('Rolling back to original balances...');
      expect(output).toContain('Transaction failed.');
    }

    // Ensure no uncaught JS errors occurred during this interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Collect both success and system error outcomes across multiple attempts', async ({ page }) => {
    // This test repeatedly triggers the simulation to assert that both the success
    // commit path and the system error (rollback) path can be observed across runs.
    // Because the failure is randomized in the page (30% chance), we attempt multiple times.
    const demo = new DemoPage(page);
    await demo.goto();

    const maxAttempts = 15; // reasonable bound to observe randomness without excessive test time
    let successSeen = false;
    let failureSeen = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await demo.clickSimulate();
      // Wait for run to finish
      await demo.waitForSimulationEnd(4000);
      const out = await demo.getOutputText();

      if (out.includes('Transaction committed successfully.')) {
        successSeen = true;
      }
      if (out.includes('System error: Failure occurred before crediting Account B.')) {
        failureSeen = true;
      }

      // If both observed, we can stop early
      if (successSeen && failureSeen) break;
      // Small pause to allow UI to settle before next attempt
      await page.waitForTimeout(120);
    }

    // Assert that at least one success and one failure were observed across attempts
    // It is possible (extremely unlikely) that randomness yields only one outcome in the given attempts.
    // The test will fail if both outcomes are not observed.
    expect(successSeen).toBeTruthy();
    expect(failureSeen).toBeTruthy();

    // Also assert that "Insufficient funds" path is never taken in these runs (given initial balances)
    // This confirms the expected guard behavior for this environment
    // (FSM mentions InsufficientFunds, but page initial balances make it unreachable)
    // Ensure no output in any of the observed runs contained that message
    // We'll do one more click and assert it isn't present
    await demo.clickSimulate();
    await demo.waitForSimulationEnd(4000);
    const finalOut = await demo.getOutputText();
    expect(finalOut).not.toContain('Error: Insufficient funds in Account A. Aborting transaction.');

    // Confirm no uncaught errors during these multiple interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Event wiring evidence: clicking button triggers simulateTransaction handler (DOM updates)', async ({ page }) => {
    // Validate that the button is wired to the simulation handler by checking that clicking updates the demo-section
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure initial text is present
    const before = await demo.getOutputText();
    expect(before).toContain('Transaction state messages will appear here...');

    // Click and verify the demo-section updates (i.e., simulateTransaction was invoked)
    await demo.clickSimulate();

    // Wait for at least the starting log to appear
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-section');
      return el && el.textContent && el.textContent.includes('Starting transaction: Transfer $200 from Account A to Account B');
    }, { timeout: 3000 });

    const after = await demo.getOutputText();
    expect(after).toContain('Starting transaction: Transfer $200 from Account A to Account B');

    // This demonstrates the evidence line: btn.addEventListener('click', simulateTransaction);
    // There should also be no JS errors when wiring/click handler runs
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity check: DOM remains consistent and accessible after many interactions', async ({ page }) => {
    // This test performs a burst of interactions to ensure the DOM remains stable and accessible
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform multiple quick interactions
    for (let i = 0; i < 6; i++) {
      await demo.clickSimulate();
      await demo.waitForSimulationEnd(3000);
      const txt = await demo.getOutputText();

      // The output should always begin with the Starting transaction line after each run (log is cleared each time)
      expect(txt.startsWith('Starting transaction: Transfer $200 from Account A to Account B')).toBeTruthy();

      // Verify that the demo-section has the ARIA attributes as expected (accessibility evidence)
      await expect(demo.output).toHaveAttribute('aria-live', 'polite');
      await expect(demo.output).toHaveAttribute('aria-atomic', 'true');
    }

    // Confirm no uncaught exceptions during the burst
    expect(pageErrors.length).toBe(0);
  });
});