import { test, expect } from '@playwright/test';

// Page Object for the P vs NP demo page
class PvsNPPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e9840-fa73-11f0-a9d0-d7a1991987c6.html';
    this.solvePButton = "button[onclick='solveP()']";
    this.solveNPButton = "button[onclick='solveNP()']";
    this.pResult = '#pResult';
    this.npResult = '#npResult';
    this.pBox = '#pBox';
    this.npBox = '#npBox';
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async clickSolveP() {
    await this.page.click(this.solvePButton);
  }

  async clickSolveNP() {
    await this.page.click(this.solveNPButton);
  }

  async getPResultText() {
    return (await this.page.locator(this.pResult).innerText()).trim();
  }

  async getNPResultText() {
    return (await this.page.locator(this.npResult).innerText()).trim();
  }
}

test.describe('P vs NP Demonstration - FSM states and transitions', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for observation/diagnostics
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Clean up listeners after each test (Playwright handles page closure between tests)
  test.afterEach(async ({ page }) => {
    // Optionally expose collected logs when a test fails (Playwright will show attachments)
    if (pageErrors.length > 0) {
      console.error('Page errors captured during test:', pageErrors.map(e => e.toString()));
    }
    if (consoleMessages.some(m => m.type === 'error')) {
      console.error('Console errors captured during test:', consoleMessages.filter(m => m.type === 'error'));
    }
  });

  test('Initial Idle state: buttons present and result areas empty', async ({ page }) => {
    // Validate the Idle state: both buttons exist and result <pre> elements are empty
    const app = new PvsNPPage(page);
    await app.goto();

    // Check buttons exist
    await expect(page.locator(app.solvePButton)).toBeVisible();
    await expect(page.locator(app.solveNPButton)).toBeVisible();

    // Check that result areas are present and initially empty
    await expect(page.locator(app.pResult)).toBeVisible();
    await expect(page.locator(app.npResult)).toBeVisible();

    const pText = await page.locator(app.pResult).innerText();
    const npText = await page.locator(app.npResult).innerText();
    expect(pText.trim()).toBe('', 'pResult should be empty in Idle state');
    expect(npText.trim()).toBe('', 'npResult should be empty in Idle state');

    // Ensure onclick attributes (event handlers per FSM) are present on the buttons
    const pOnclick = await page.locator(app.solvePButton).getAttribute('onclick');
    const npOnclick = await page.locator(app.solveNPButton).getAttribute('onclick');
    expect(pOnclick).toBe('solveP()');
    expect(npOnclick).toBe('solveNP()');

    // Confirm no unexpected page errors occurred just from loading
    expect(pageErrors.length).toBe(0);
    // Confirm no console error level messages were logged on load
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Transition: Solve a P problem -> P Problem Solved state', async ({ page }) => {
    // This test validates that clicking the Solve P button updates #pResult with the sorted array and timing info
    const app = new PvsNPPage(page);
    await app.goto();

    // Click Solve P and wait for pResult to be populated
    await app.clickSolveP();

    // Wait for the pre element's innerText to be non-empty
    await page.waitForFunction(
      selector => document.querySelector(selector).innerText.trim().length > 0,
      {},
      app.pResult
    );

    const pResultText = await app.getPResultText();

    // Validate expected content structure as per FSM evidence
    expect(pResultText).toContain('Sorted Array:', 'pResult should mention Sorted Array');
    expect(pResultText).toContain('Time taken to sort:', 'pResult should include timing info');

    // Validate the actual sorted array value (sorting [5,3,8,1,2] => 1,2,3,5,8)
    expect(pResultText).toMatch(/Sorted Array:\s*1,2,3,5,8/);

    // Validate time taken is a number with "ms"
    expect(pResultText).toMatch(/Time taken to sort:\s*\d+(\.\d+)?\s*ms/);

    // Ensure no uncaught page errors were thrown during the transition
    expect(pageErrors.length).toBe(0);

    // No console error-level messages expected during a normal run
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Transition: Solve an NP problem -> NP Problem Solved state', async ({ page }) => {
    // This test validates that clicking the Solve NP button updates #npResult with verification result and timing
    const app = new PvsNPPage(page);
    await app.goto();

    // Click Solve NP and wait for npResult to be populated
    await app.clickSolveNP();

    await page.waitForFunction(
      selector => document.querySelector(selector).innerText.trim().length > 0,
      {},
      app.npResult
    );

    const npResultText = await app.getNPResultText();

    // Validate expected content structure as per FSM evidence
    expect(npResultText).toContain('Solution found:', 'npResult should mention Solution found');
    expect(npResultText).toContain('Time taken for verification:', 'npResult should include timing info');

    // Given the provided array and target, a pair exists (e.g., 2 + 8 = 10), so expect true
    expect(npResultText).toMatch(/Solution found:\s*true/);

    // Validate time taken is a number with "ms"
    expect(npResultText).toMatch(/Time taken for verification:\s*\d+(\.\d+)?\s*ms/);

    // Ensure no uncaught page errors were thrown during the transition
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Edge case: multiple rapid clicks update results consistently', async ({ page }) => {
    // This test clicks both buttons multiple times in quick succession to ensure results update deterministically
    const app = new PvsNPPage(page);
    await app.goto();

    // Rapidly click Solve P three times, then Solve NP three times
    for (let i = 0; i < 3; i++) {
      await app.clickSolveP();
    }
    for (let i = 0; i < 3; i++) {
      await app.clickSolveNP();
    }

    // Wait for both results to be populated
    await page.waitForFunction(
      sel => document.querySelector(sel).innerText.trim().length > 0,
      {},
      app.pResult
    );
    await page.waitForFunction(
      sel => document.querySelector(sel).innerText.trim().length > 0,
      {},
      app.npResult
    );

    const pText = await app.getPResultText();
    const npText = await app.getNPResultText();

    // Validate that both contain expected markers and are well-formed
    expect(pText).toContain('Sorted Array:');
    expect(pText).toMatch(/Time taken to sort:\s*\d+(\.\d+)?\s*ms/);

    expect(npText).toContain('Solution found:');
    expect(npText).toMatch(/Time taken for verification:\s*\d+(\.\d+)?\s*ms/);

    // Ensure repeated interactions do not cause runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('State transitions reflect expected FSM evidence strings and formatting', async ({ page }) => {
    // This test uses the FSM evidence formats to assert the exact presence of expected substrings
    const app = new PvsNPPage(page);
    await app.goto();

    // Click Solve P and assert the exact evidence-like substring appears
    await app.clickSolveP();
    await page.waitForFunction(
      sel => document.querySelector(sel).innerText.includes('Sorted Array:'),
      {},
      app.pResult
    );
    const pText = await app.getPResultText();
    // Evidence expects: document.getElementById('pResult').innerText = `Sorted Array: ${sortedArray}\nTime taken to sort: ${timeTaken} ms`;
    expect(pText).toMatch(/^Sorted Array: .*[\r\n]+Time taken to sort: \d+(\.\d+)? ms$/m);

    // Click Solve NP and assert the exact evidence-like substring appears
    await app.clickSolveNP();
    await page.waitForFunction(
      sel => document.querySelector(sel).innerText.includes('Solution found:'),
      {},
      app.npResult
    );
    const npText = await app.getNPResultText();
    // Evidence expects: document.getElementById('npResult').innerText = `Solution found: ${isSolution}\nTime taken for verification: ${timeTaken} ms`;
    expect(npText).toMatch(/^Solution found: (true|false)[\r\n]+Time taken for verification: \d+(\.\d+)? ms$/m);

    // No page errors expected
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture console messages and page errors (should be none)', async ({ page }) => {
    // This test explicitly demonstrates how console and page errors are observed.
    // It asserts there are no SyntaxError/ReferenceError/TypeError occurrences during normal operation.
    const app = new PvsNPPage(page);
    await app.goto();

    // Perform actions that exercise the app
    await app.clickSolveP();
    await app.clickSolveNP();

    // Short wait to ensure any asynchronous errors surface to the page
    await page.waitForTimeout(200);

    // Gather any page errors and check their types if present
    const errorTypes = pageErrors.map(e => {
      // err.name is typically the error constructor name (e.g., ReferenceError)
      try {
        return e.name || e.constructor.name || String(e);
      } catch {
        return String(e);
      }
    });

    // Assert that no fatal runtime errors occurred (ReferenceError, SyntaxError, TypeError)
    const fatalErrors = errorTypes.filter(t => /ReferenceError|SyntaxError|TypeError/i.test(t));
    expect(fatalErrors.length).toBe(0);

    // Also assert no console-level errors were emitted
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });
});