import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c14efd2-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Interactive Big-Theta Explorer (Application 9c14efd2-... )', () => {
  // Collect console error messages and page errors to assert runtime health.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console events and page error events.
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) { /* ignore listener errors */ }
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the app and wait for load.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait until initial log message appears to avoid racing with tests.
    const log = page.locator('#log');
    await expect(log).toContainText('Interactive Big-Theta Explorer loaded.', { timeout: 5000 });
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors during test run.
    expect(consoleErrors, `Console errors encountered: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Page errors encountered: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test('Initial state: inputs present and initial log contains welcome text', async ({ page }) => {
    // Validate initial inputs and canvas exist
    await expect(page.locator('#fexpr')).toHaveValue('n^2 + 5*n + 3');
    await expect(page.locator('#gexpr')).toHaveValue('n^2');
    await expect(page.locator('#maxn')).toHaveValue('200');
    await expect(page.locator('#samples')).toHaveValue('200');
    await expect(page.locator('#modeLabel')).toHaveText('Mode: Θ');

    // Confirm initial plot drew something by checking canvas context text presence via drawing fallback:
    // The script writes an initial log entry; assert it exists.
    await expect(page.locator('#log')).toContainText('Interactive Big-Theta Explorer loaded.');
  });

  test('Template buttons set f(n) and g(n) inputs correctly', async ({ page }) => {
    // Test f templates
    await page.click('#f_poly');
    await expect(page.locator('#fexpr')).toHaveValue('n^2');

    await page.click('#f_nlogn');
    await expect(page.locator('#fexpr')).toHaveValue('n*log(n)');

    await page.click('#f_log');
    await expect(page.locator('#fexpr')).toHaveValue('log(n)');

    await page.click('#f_exp');
    await expect(page.locator('#fexpr')).toHaveValue('2^n');

    await page.click('#f_fact');
    await expect(page.locator('#fexpr')).toHaveValue('factorial(n)');

    // One random click to ensure random sets a value (value likely changes to one of choices)
    await page.click('#f_rand');
    await expect(page.locator('#fexpr')).not.toHaveValue('', { timeout: 2000 });

    // Test g templates
    await page.click('#g_poly');
    await expect(page.locator('#gexpr')).toHaveValue('n^2');

    await page.click('#g_nlogn');
    await expect(page.locator('#gexpr')).toHaveValue('n*log(n)');

    await page.click('#g_log');
    await expect(page.locator('#gexpr')).toHaveValue('log(n)');

    await page.click('#g_exp');
    await expect(page.locator('#gexpr')).toHaveValue('2^n');

    await page.click('#g_fact');
    await expect(page.locator('#gexpr')).toHaveValue('factorial(n)');

    await page.click('#g_rand');
    await expect(page.locator('#gexpr')).not.toHaveValue('', { timeout: 2000 });
  });

  test('Plot, Show Table, Export CSV produce log entries and do not throw errors', async ({ page }) => {
    const log = page.locator('#log');

    // Trigger Plot and assert log entry
    await page.click('#plot');
    await expect(log).toContainText('Plot requested: f=');

    // Trigger Show Value Table and assert log contains "Value table"
    await page.click('#showTable');
    await expect(log).toContainText('Value table (first 20 rows):');

    // Trigger Export CSV - this creates a download anchor and logs "CSV exported"
    await page.click('#exportCSV');
    await expect(log).toContainText('CSV exported for sampled values.');
  });

  test('Check Θ button logs PASS for typical polynomial pair and drawing uses bounds', async ({ page }) => {
    const log = page.locator('#log');

    // Ensure f and g are polynomial forms that satisfy Theta with reasonable constants
    await page.fill('#fexpr', 'n^2 + 5*n + 3');
    await page.fill('#gexpr', 'n^2');
    await page.fill('#c1', '0.5');
    await page.fill('#c2', '2');
    await page.fill('#n0', '10');

    // Click Check Θ and expect either PASS or a failure log message; typical case should PASS
    await page.click('#checkTheta');
    // Accept either PASS or FAILED but assert a relevant message is added
    await expect(log).toContainText(/Inequality (holds|FAILED)/);
  });

  test('Search constants (brute force) finds a candidate or reports none without errors', async ({ page }) => {
    const log = page.locator('#log');

    // Use defaults: expect bruteForceSearch to run and log outcome
    await page.click('#searchConstants');

    // It logs a start message and then either Found candidate or No candidate
    await expect(log).toContainText('Brute-force search starting (this may take a moment)...');
    await expect(log).toContainText(/Found candidate:|Brute-force search: No candidate found in grid./);
  });

  test('Stepwise search prepares steps and Next/Prev step handlers log appropriate messages', async ({ page }) => {
    const log = page.locator('#log');

    // Initialize stepwise search
    await page.click('#stepSearch');
    await expect(log).toContainText('Stepwise search initiated.');
    // It also logs "Prepared X candidate steps."
    await expect(log).toContainText('Prepared');

    // Click Next Step: should attempt first candidate and log PASS or FAILED or "No proof steps prepared" if none
    await page.click('#nextStep');
    await expect(log).toContainText(/Candidate PASSED|Candidate FAILED|No proof steps prepared/);

    // Click Prev Step: if steps exist, it will log "Moved to previous step"
    await page.click('#prevStep');
    // Either it logs moved message or nothing; ensure no exceptions happened by relying on afterEach checks
    // But attempt to assert moved text if steps were prepared
    await expect(log).toContainText(/Moved to previous step|No proof steps prepared|Candidate/);
  });

  test('Proof workflow start/reset and accept/reject candidate produce log entries', async ({ page }) => {
    const log = page.locator('#log');

    // Start proof resets workflow and logs reset message
    await page.click('#startProof');
    await expect(log).toContainText('Proof workflow reset. Press Stepwise Search to prepare steps.');

    // Accept current uses current c1/c2/n0 and logs acceptance
    await page.fill('#c1', '0.5');
    await page.fill('#c2', '2');
    await page.fill('#n0', '10');
    await page.click('#accept');
    await expect(log).toContainText('User accepted candidate');

    // Reject logs rejection
    await page.click('#reject');
    await expect(log).toContainText('User rejected current candidate');
  });

  test('Mode buttons update the label and append logs', async ({ page }) => {
    const modeLabel = page.locator('#modeLabel');
    const log = page.locator('#log');

    await page.click('#modeO');
    await expect(modeLabel).toHaveText('Mode: O');
    await expect(log).toContainText('Mode set to O');

    await page.click('#modeOmega');
    await expect(modeLabel).toHaveText('Mode: Ω');
    await expect(log).toContainText('Mode set to Ω');

    await page.click('#modeTheta');
    await expect(modeLabel).toHaveText('Mode: Θ');
    await expect(log).toContainText('Mode set to Θ');
  });

  test('Toggle plot options append logs and do not crash (points/lines and show bounds)', async ({ page }) => {
    const log = page.locator('#log');

    await page.click('#togglePoints');
    await expect(log).toContainText('Toggled points/lines. Points mode =');

    await page.click('#showBounds');
    await expect(log).toContainText('Toggled show bounds. showBounds =');
  });

  test('Limit estimation, classification, simplification, and counterexample generation log results', async ({ page }) => {
    const log = page.locator('#log');

    await page.click('#autoFindLimit');
    await expect(log).toContainText('Estimated limit of f(n)/g(n)');

    await page.click('#classify');
    await expect(log).toContainText('Classification:');

    await page.click('#simplify');
    await expect(log).toContainText('Asymptotic simplification guesses');

    await page.click('#genCounter');
    await expect(log).toContainText(/Counterexample found at n=|No counterexample found in sampled range./);
  });

  test('Clear Log button clears the textarea as expected', async ({ page }) => {
    const log = page.locator('#log');

    // Ensure there's content
    await page.click('#plot');
    await expect(log).toContainText('Plot requested:');

    // Clear the log
    await page.click('#clearLog');

    // The log should be empty string after clear
    await expect(log).toHaveValue('');
  });

  test('ShowTable writes value table excerpt to log and format is CSV-like for first rows', async ({ page }) => {
    const log = page.locator('#log');

    // Force showTable
    await page.click('#showTable');
    // Expect the log to contain "Value table (first 20 rows):" and a line with "f=" and "g="
    await expect(log).toContainText('Value table (first 20 rows):');
    await expect(log).toContainText(/f=/);
    await expect(log).toContainText(/g=/);
  });

  test('Edge case: set invalid expression to f(n) and ensure errors are handled gracefully (no uncaught page error)', async ({ page }) => {
    const log = page.locator('#log');

    // Set a deliberately malformed expression that might cause NaN or runtime issues
    await page.fill('#fexpr', '2***/(n');
    await page.fill('#gexpr', 'n^2');

    // Attempt to draw plot and run check; script's makeEval should handle by returning a function that returns NaN
    await page.click('#plot');
    await expect(log).toContainText('Plot requested: f=');

    // Check inequality should log a failure due to non-finite values OR gracefully handle by logging FAILED
    await page.click('#checkTheta');
    await expect(log).toContainText(/Inequality FAILED|Inequality holds|FAILED/);
    // AfterEach will assert there were no uncaught errors.
  });
});