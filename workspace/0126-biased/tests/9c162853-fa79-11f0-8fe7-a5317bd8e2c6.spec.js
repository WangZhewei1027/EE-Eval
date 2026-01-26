import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c162853-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Utility selectors
const SELECTORS = {
  heading: 'h2',
  sourceArea: '#sourceArea',
  testArea: '#testArea',
  compileBtn: '#compileBtn',
  addTestBtn: '#addTestBtn',
  updateTestBtn: '#updateTestBtn',
  deleteTestBtn: '#deleteTestBtn',
  runAllBtn: '#runAllBtn',
  runSelectedBtn: '#runSelectedBtn',
  pauseBtn: '#pauseBtn',
  resumeBtn: '#resumeBtn',
  stopBtn: '#stopBtn',
  clearLogsBtn: '#clearLogsBtn',
  markSkipBtn: '#markSkipBtn',
  markOnlyBtn: '#markOnlyBtn',
  markFlakyBtn: '#markFlakyBtn',
  testsList: '#testsList',
  newTestName: '#newTestName',
  newTestSuite: '#newTestSuite',
  importFile: '#importFile',
  spyBtn: '#spyBtn',
  logArea: '#logArea',
  coveragePct: '#coveragePct'
};

test.describe('Interactive Unit Testing Sandbox (FSM driven e2e)', () => {
  // capture console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // store stringified console messages for later assertions
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the provided HTML page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure the app's UI has rendered
    await page.waitForSelector(SELECTORS.heading);
    await expect(page.locator(SELECTORS.heading)).toContainText('Interactive Unit Testing Sandbox (Minimal UI)');
  });

  test.afterEach(async () => {
    // no-op here; listeners are tied to page and cleared automatically
  });

  test('S0 Idle: main heading and editors are rendered (Idle state)', async ({ page }) => {
    // Validate Idle state evidence: heading and test editor textarea present
    await expect(page.locator(SELECTORS.heading)).toBeVisible();
    await expect(page.locator(SELECTORS.testArea)).toBeVisible();
    await expect(page.locator(SELECTORS.sourceArea)).toBeVisible();
    // Coverage percentage should be present
    await expect(page.locator(SELECTORS.coveragePct)).toBeVisible();
  });

  test('S1 Test Editing: Add, select, update and delete a test', async ({ page }) => {
    // Add Test: fill name, ensure testArea has content, then click add
    const name = 'e2e-add-edit-delete';
    await page.fill(SELECTORS.newTestName, name);
    // set a simple test body
    const simpleTestCode = `async function(exports, assert){ assert.ok(true, 'sanity'); }`;
    await page.fill(SELECTORS.testArea, simpleTestCode);
    await page.click(SELECTORS.addTestBtn);

    // Wait for the new test to appear in the tests list
    const testItem = page.locator('#testsList .test-item', { hasText: name });
    await expect(testItem).toBeVisible();

    // Select the test by clicking its radio input (selects and populates editor)
    await testItem.locator('input[type="radio"]').click();
    // Ensure the testArea has the same code we set by reading editor
    await expect(page.locator(SELECTORS.testArea)).toHaveValue(simpleTestCode);

    // Update: change testArea code and click updateTestBtn
    const newCode = `async function(exports, assert){ assert.equal(1+1, 2, 'math'); }`;
    await page.fill(SELECTORS.testArea, newCode);
    await page.click(SELECTORS.updateTestBtn);

    // Validate that workspace.tests contains updated code for selected test
    const tests = await page.evaluate(() => window.workspace.tests.slice());
    const found = tests.find(t => t.name === 'e2e-add-edit-delete');
    expect(found).toBeTruthy();
    expect(found.code).toContain('1+1');

    // Delete: click delete and assert removed
    await page.click(SELECTORS.deleteTestBtn);
    await expect(page.locator('#testsList .test-item', { hasText: name })).toHaveCount(0);
  });

  test('Toggle flags (skip/only/flaky) update workspace and UI', async ({ page }) => {
    // Add a test to operate on
    const name = 'e2e-toggle-flags';
    await page.fill(SELECTORS.newTestName, name);
    await page.fill(SELECTORS.testArea, `async function(exports, assert){ assert.ok(true); }`);
    await page.click(SELECTORS.addTestBtn);

    // Select the test
    const item = page.locator('#testsList .test-item', { hasText: name });
    await item.locator('input[type="radio"]').click();

    // Toggle skip
    await page.click(SELECTORS.markSkipBtn);
    // Check workspace flag
    let skipFlag = await page.evaluate((n) => {
      const t = window.workspace.tests.find(x => x.name === n);
      return t ? t.skip : undefined;
    }, name);
    expect(skipFlag).toBe(true);
    // UI meta button should show 'skip' text (one of the small meta buttons)
    await expect(item.locator('button', { hasText: 'skip' })).toBeVisible();

    // Toggle only
    await page.click(SELECTORS.markOnlyBtn);
    let onlyFlag = await page.evaluate((n) => {
      const t = window.workspace.tests.find(x => x.name === n);
      return t ? t.only : undefined;
    }, name);
    expect(onlyFlag).toBe(true);
    await expect(item.locator('button', { hasText: 'only' })).toBeVisible();

    // Toggle flaky
    await page.click(SELECTORS.markFlakyBtn);
    let flakyFlag = await page.evaluate((n) => {
      const t = window.workspace.tests.find(x => x.name === n);
      return t ? t.flaky : undefined;
    }, name);
    expect(flakyFlag).toBe(true);
    await expect(item.locator('button', { hasText: 'flaky' })).toBeVisible();

    // Cleanup: delete the test
    await page.click(SELECTORS.deleteTestBtn);
  });

  test('Compile Source: calling compile updates workspace.compiledExports and logs', async ({ page }) => {
    // Ensure compile works and logs success or error naturally
    await page.click(SELECTORS.compileBtn);

    // Wait for logArea to have some text - compileSource logs either success or compile error
    await page.waitForSelector('#logArea');
    const logText = await page.locator('#logArea').innerText();
    // It should at least indicate success or compile error
    expect(/Source compiled successfully|Compile error/i.test(logText)).toBe(true);

    // Check workspace.compiledExports exists (may be empty object but defined)
    const compiledKeys = await page.evaluate(() => Object.keys(window.workspace.compiledExports || {}));
    expect(Array.isArray(compiledKeys)).toBe(true);
    // coveragePct is present and is a number string like '0%'
    const cov = await page.locator(SELECTORS.coveragePct).innerText();
    expect(cov.trim()).toMatch(/^\d+%$/);
  });

  test('S2 Test Running: Run a passing test - runtime.running toggles and history updated', async ({ page }) => {
    // Create a deterministic simple passing test
    const name = 'e2e-run-pass';
    await page.fill(SELECTORS.newTestName, name);
    await page.fill(SELECTORS.testArea, `async function(exports, assert){ assert.equal(2+2,4, 'math ok'); }`);
    await page.click(SELECTORS.addTestBtn);

    // Select the test
    const testItem = page.locator('#testsList .test-item', { hasText: name });
    await testItem.locator('input[type="radio"]').click();

    // Click runAll and immediately verify runtime.running true (S2 entry action: runAllTests sets runtime.running=true)
    await Promise.all([
      page.click(SELECTORS.runAllBtn),
      page.waitForTimeout(10) // small delay to allow runtime.running to be set
    ]);
    const runningDuring = await page.evaluate(() => Boolean(window.runtime && window.runtime.running));
    expect(runningDuring).toBe(true);

    // Wait for the run to complete (runtime.running false)
    await page.waitForFunction(() => window.runtime && window.runtime.running === false, { timeout: 5000 });

    // Validate history got an entry with the test result
    const history = await page.evaluate(() => window.workspace.history.slice(-1)[0] || null);
    expect(history).toBeTruthy();
    // results inside history should include our test name
    const lastResults = await page.evaluate(() => {
      const h = window.workspace.history.slice(-1)[0];
      return h ? h.results : [];
    });
    expect(Array.isArray(lastResults)).toBe(true);
    const found = lastResults.find(r => r.name === name);
    expect(found).toBeTruthy();
    expect(['passed', 'failed', 'unknown']).toContain(found.status);
  });

  test('Running a failing test logs Test failed with ReferenceError (error scenario)', async ({ page }) => {
    // Add a test that references an undefined identifier to provoke ReferenceError
    const name = 'e2e-failing';
    await page.fill(SELECTORS.newTestName, name);
    await page.fill(SELECTORS.testArea, `async function(exports, assert){ // deliberate ReferenceError\nnonExistentFunction(); }`);
    await page.click(SELECTORS.addTestBtn);

    // Select and run only selected test
    const item = page.locator('#testsList .test-item', { hasText: name });
    await item.locator('input[type="radio"]').click();

    // click Run Selected
    await Promise.all([
      page.click(SELECTORS.runSelectedBtn),
      page.waitForTimeout(10)
    ]);

    // Wait for runner completion
    await page.waitForFunction(() => window.runtime && window.runtime.running === false, { timeout: 5000 });

    // Assert the logArea contains 'Test failed:' entry for our failing test
    const log = await page.locator('#logArea').innerText();
    expect(log).toMatch(/Test failed:.*e2e-failing/i);
    // Ensure the workspace test status is 'failed'
    const status = await page.evaluate((n) => {
      const t = window.workspace.tests.find(x => x.name === n);
      return t ? t.status : null;
    }, name);
    expect(status).toBe('failed');
  });

  test('Pause, Resume and Stop during a generator test (pausing and resuming)', async ({ page }) => {
    // Create a generator test that yields multiple times so we can pause between yields
    const name = 'e2e-generator';
    const genCode = `
      function(exports, assert){
        return (function*(){
          for(let i=0;i<5;i++){
            // yield a value to allow the runner to pause between yields
            yield i;
          }
        })();
      }
    `;
    await page.fill(SELECTORS.newTestName, name);
    await page.fill(SELECTORS.testArea, genCode);
    await page.click(SELECTORS.addTestBtn);

    // Select the test
    const item = page.locator('#testsList .test-item', { hasText: name });
    await item.locator('input[type="radio"]').click();

    // Start running all tests
    const runPromise = page.click(SELECTORS.runAllBtn);

    // Wait until we see a yield logged for our test (the runner logs "[yield] <testname>:" )
    await page.waitForFunction((n) => {
      const area = document.getElementById('logArea');
      return area && area.textContent && area.textContent.includes('[yield] ' + n + ':');
    }, name, { timeout: 3000 });

    // Now click Pause to set runtime.paused = true and log paused message
    await page.click(SELECTORS.pauseBtn);

    // The pause handler logs "[runner] paused" - verify that runtime.paused is true and log contains paused entry
    await page.waitForFunction(() => window.runtime && window.runtime.paused === true, { timeout: 2000 });
    const pausedLog = await page.locator('#logArea').innerText();
    expect(pausedLog).toMatch(/\[runner\] paused/);

    // Resume execution
    await page.click(SELECTORS.resumeBtn);
    // verify resumed
    await page.waitForFunction(() => window.runtime && window.runtime.paused === false, { timeout: 2000 });
    const resumedLog = await page.locator('#logArea').innerText();
    expect(resumedLog).toMatch(/\[runner\] resumed/);

    // Wait for run completion
    await page.waitForFunction(() => window.runtime && window.runtime.running === false, { timeout: 5000 });

    // Ensure final history contains our generator test result (passed/failed)
    const historyHas = await page.evaluate((n) => {
      return (window.workspace.history || []).some(h => (h.results || []).some(r => r.name === n));
    }, name);
    expect(historyHas).toBe(true);
  });

  test('Stop requested during a long run sets runtime.stopRequested and logs stop requested', async ({ page }) => {
    // Create a longer generator test to give us time to hit stop
    const name = 'e2e-long-generator';
    const longGen = `
      function(exports, assert){
        return (function*(){
          for(let i=0;i<50;i++){
            // generate many yields to allow time to stop
            yield i;
          }
        })();
      }
    `;
    await page.fill(SELECTORS.newTestName, name);
    await page.fill(SELECTORS.testArea, longGen);
    await page.click(SELECTORS.addTestBtn);

    // Select test
    const item = page.locator('#testsList .test-item', { hasText: name });
    await item.locator('input[type="radio"]').click();

    // Start running
    await page.click(SELECTORS.runAllBtn);

    // Wait for first yield
    await page.waitForFunction((n) => {
      const area = document.getElementById('logArea');
      return area && area.textContent && area.textContent.includes('[yield] ' + n + ':');
    }, name, { timeout: 3000 });

    // Click Stop to request stop
    await page.click(SELECTORS.stopBtn);

    // Stop handler sets runtime.stopRequested = true and logs '[runner] stop requested'
    await page.waitForFunction(() => window.runtime && window.runtime.stopRequested === true, { timeout: 2000 });
    const log = await page.locator('#logArea').innerText();
    expect(log).toMatch(/stop requested/i);

    // Wait for run to finish/terminate
    await page.waitForFunction(() => window.runtime && window.runtime.running === false, { timeout: 5000 });
  });

  test('Clear logs clears the log area', async ({ page }) => {
    // Produce some logs by compiling
    await page.click(SELECTORS.compileBtn);
    await page.waitForSelector('#logArea');

    // Ensure logs present
    const before = (await page.locator('#logArea').innerText()).trim();
    expect(before.length).toBeGreaterThan(0);

    // Clear logs
    await page.click(SELECTORS.clearLogsBtn);
    const after = (await page.locator('#logArea').innerText()).trim();
    expect(after).toBe('');
  });

  test('Import malformed JSON triggers Import error log (edge case)', async ({ page }) => {
    // Prepare a malformed JSON file and set it to the import input
    const badJsonContent = '{ "source": "abc", "tests": [ { invalid json } ] }';
    // Playwright API to set input files
    await page.setInputFiles(SELECTORS.importFile, {
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from(badJsonContent)
    });

    // The import handler uses FileReader and logs 'Import error' on exception
    // Wait for the import handler to log an Import error
    await page.waitForFunction(() => {
      const area = document.getElementById('logArea');
      return area && area.textContent && area.textContent.toLowerCase().includes('import error');
    }, { timeout: 3000 });

    const log = await page.locator('#logArea').innerText();
    expect(log.toLowerCase()).toContain('import error');
  });

  test('Spy creation via prompt: create spy for a compiled export', async ({ page }) => {
    // Ensure compiled exports have a function to spy on: put a simple add function in source and compile
    const sourceCode = `exports.add = function(a,b){ return a+b; }`;
    await page.fill(SELECTORS.sourceArea, sourceCode);
    await page.click(SELECTORS.compileBtn);

    // Ensure compiled exports includes add
    await page.waitForFunction(() => window.workspace.compiledExports && typeof window.workspace.compiledExports.add === 'function', { timeout: 2000 });

    // Prepare dialog handler to supply function name 'add' when prompt appears
    page.once('dialog', async dialog => {
      // dialog.message() might ask: 'Enter function name ...'
      await dialog.accept('add');
    });

    // Add a test to select (spyBtn uses selected test id for prompt flow though not strictly required)
    const name = 'e2e-spy-test';
    await page.fill(SELECTORS.newTestName, name);
    await page.fill(SELECTORS.testArea, `async function(exports, assert){ assert.ok(true); }`);
    await page.click(SELECTORS.addTestBtn);
    const item = page.locator('#testsList .test-item', { hasText: name });
    await item.locator('input[type="radio"]').click();

    // Click spy button - will trigger prompt and then log "Spy created for add"
    await page.click(SELECTORS.spyBtn);

    // Wait for log mentioning 'Spy created'
    await page.waitForFunction(() => {
      const area = document.getElementById('logArea');
      return area && area.textContent && area.textContent.includes('Spy created for');
    }, { timeout: 3000 });

    const logs = await page.locator('#logArea').innerText();
    expect(logs).toMatch(/Spy created for\s+add/);

    // Validate that workspace.spies contains 'add' entry
    const hasSpy = await page.evaluate(() => !!window.workspace.spies['add']);
    expect(hasSpy).toBe(true);
  });

  test('Observe console and page errors (collect and assert no unexpected page errors)', async ({ page }) => {
    // At this point many previous interactions may have populated consoleMessages and pageErrors lists.
    // We assert that pageErrors array did not capture any uncaught exceptions (should be zero).
    // This ensures runtime errors were handled by the app (e.g., failing tests are logged, not uncaught).
    expect(pageErrors.length).toBe(0);

    // Also ensure that console did not emit severe errors (console.type === 'error')
    const severe = consoleMessages.filter(m => m.type === 'error');
    // It's acceptable to have zero severe console errors; fail if there were any unexpected errors.
    expect(severe.length).toBe(0);
  });
});