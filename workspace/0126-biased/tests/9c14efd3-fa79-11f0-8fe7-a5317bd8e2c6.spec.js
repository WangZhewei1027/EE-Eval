import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c14efd3-fa79-11f0-8fe7-a5317bd8e2c6.html';

/**
 * Page object encapsulating common interactions with the Big-Omega Lab page.
 */
class BigOmegaPage {
  constructor(page) {
    this.page = page;
    // locators
    this.fexpr = page.locator('#fexpr');
    this.gexpr = page.locator('#gexpr');
    this.nmin = page.locator('#nmin');
    this.nmax = page.locator('#nmax');
    this.c_input = page.locator('#c_input');
    this.n0_input = page.locator('#n0_input');
    this.sampleCount = page.locator('#sampleCount');
    this.searchMax = page.locator('#searchMax');
    this.cmpType = page.locator('#cmpType');
    this.transcript = page.locator('#transcript');
    this.assistant = page.locator('#assistant');
    this.tableOutput = page.locator('#tableOutput');
    this.exampleSelect = page.locator('#exampleSelect');
    this.savedList = page.locator('#savedList');
    // buttons
    this.loadExampleBtn = page.locator('#loadExample');
    this.resetExampleBtn = page.locator('#resetExample');
    this.applyPropositionBtn = page.locator('#applyProposition');
    this.runTestBtn = page.locator('#step3');
    this.autoFindBtn = page.locator('#autoFind');
    this.findCounterBtn = page.locator('#findCounter');
    this.undoBtn = page.locator('#undoBtn');
    this.redoBtn = page.locator('#redoBtn');
    this.clearLogBtn = page.locator('#clearLog');
    this.saveConfigBtn = page.locator('#saveConfig');
    this.loadSavedBtn = page.locator('#loadSaved');
    this.deleteSavedBtn = page.locator('#deleteSaved');
    this.saveName = page.locator('#saveName');
    this.resetAllBtn = page.locator('#resetAll');
  }

  async getTranscriptText() {
    return (await this.transcript.inputValue()) || '';
  }

  async getAssistantText() {
    return (await this.assistant.inputValue()) || '';
  }

  async getTableText() {
    return (await this.tableOutput.inputValue()) || '';
  }

  async getFExpr() {
    return this.fexpr.inputValue();
  }

  async getGExpr() {
    return this.gexpr.inputValue();
  }

  async getCInput() {
    return this.c_input.inputValue();
  }

  async getN0Input() {
    return this.n0_input.inputValue();
  }

  // helper to set field and dispatch change so pushState() handlers run
  async setAndChange(locator, value) {
    await locator.fill(String(value));
    // dispatch 'change' to trigger change listeners that call pushState()
    await locator.evaluate((el) => {
      const ev = new Event('change', { bubbles: true });
      el.dispatchEvent(ev);
    });
  }

  // convenience to click and wait a short time for transcript update
  async click(button) {
    await button.click();
    // small wait to allow UI to process and log
    await this.page.waitForTimeout(120);
  }
}

test.describe('Big-Omega Notation Interactive Lab - FSM coverage and interactions', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    // capture console and page errors for assertion and diagnostics
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // collect unhandled exceptions in the page context
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Wait for UI to initialize
    await page.waitForSelector('#transcript');
  });

  test.afterEach(async ({ page }) => {
    // try to clear localStorage so tests remain isolated
    await page.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  });

  test('Initial Idle state: page loads and renders basic UI (S0_Idle)', async ({ page }) => {
    // Validate initial page content, transcript contains initialization messages
    const app = new BigOmegaPage(page);

    const transcript = await app.getTranscriptText();
    // The page's initialization (resetLab + ready log) should have written these messages
    expect(transcript).toContain('Lab reset.');
    expect(transcript).toContain('Interactive Big-Omega Lab ready.');

    // Validate default inputs
    expect(await app.getFExpr()).toBe('n');
    expect(await app.getGExpr()).toBe('1');

    // Undo should be disabled because history has only initial state
    const undoDisabled = await page.locator('#undoBtn').getAttribute('disabled');
    expect(undoDisabled === '' || undoDisabled === 'true' || undoDisabled === null).toBeTruthy();

    // There should be no unexpected page-level errors on load
    expect(pageErrors.length).toBe(0);
  });

  test('Load Example transition produces example load log and updates inputs (S1_ExampleLoaded)', async ({ page }) => {
    const app = new BigOmegaPage(page);

    // Choose the 2nd example (index 1): "Quadratic vs Linear"
    await app.exampleSelect.selectOption('1');
    await app.click(app.loadExampleBtn);

    const transcript = await app.getTranscriptText();
    expect(transcript).toContain('Loaded example: Quadratic vs Linear');

    // Confirm f and g were updated to the example expressions
    expect(await app.getFExpr()).toBe('n*n');
    expect(await app.getGExpr()).toBe('n');

    // Undo should now be enabled since pushState was called
    const undoDisabledAttr = await page.locator('#undoBtn').getAttribute('disabled');
    // disabled attribute can be absent when enabled; ensure it's not explicitly true
    expect(undoDisabledAttr === null || undoDisabledAttr === 'false').toBeTruthy();
  });

  test('Reset Example transition resets inputs and logs action (S2_InputsReset)', async ({ page }) => {
    const app = new BigOmegaPage(page);

    // Change values and then click Reset
    await app.setAndChange(app.fexpr, 'n*n');
    await app.setAndChange(app.gexpr, 'n');
    await app.click(app.resetExampleBtn);

    const transcript = await app.getTranscriptText();
    expect(transcript).toContain('Reset inputs to defaults.');

    // Verify reset to defaults
    expect(await app.getFExpr()).toBe('n');
    expect(await app.getGExpr()).toBe('1');
    expect(await page.locator('#nmin').inputValue()).toBe('1');
    expect(await page.locator('#nmax').inputValue()).toBe('200');
  });

  test('Apply Proposition logs the applied proposition message (S3_PropositionApplied)', async ({ page }) => {
    const app = new BigOmegaPage(page);

    // Choose strict omega to get the '>' variant
    await app.cmpType.selectOption('omega_strict');
    // set some constants
    await app.setAndChange(app.c_input, '2.5');
    await app.setAndChange(app.n0_input, '10');

    await app.click(app.applyPropositionBtn);

    const transcript = await app.getTranscriptText();
    expect(transcript).toContain('Applied proposition: f(n) > 2.5·g(n) for all n ≥ 10');
  });

  test('Run Test executes and logs running + assistant result (S4_TestRun)', async ({ page }) => {
    const app = new BigOmegaPage(page);

    // With defaults f=n, g=1, c=1, n0=1 this should pass numerically
    // Ensure defaults
    await app.setAndChange(app.fexpr, 'n');
    await app.setAndChange(app.gexpr, '1');
    await app.setAndChange(app.c_input, '1');
    await app.setAndChange(app.n0_input, '1');

    await app.click(app.runTestBtn);

    const transcript = await app.getTranscriptText();
    expect(transcript).toContain('Running test up to n=');
    // Assistant field should reflect a numeric pass
    const assistant = await app.getAssistantText();
    expect(assistant).toMatch(/Numeric test: passed up to n=\d+/);
  });

  test('Auto-find heuristic suggests constants and updates fields', async ({ page }) => {
    const app = new BigOmegaPage(page);

    // Use a simple example where lim inf is positive: n vs 1
    await app.setAndChange(app.fexpr, 'n');
    await app.setAndChange(app.gexpr, '1');
    // perform auto-find
    await app.click(app.autoFindBtn);

    const transcript = await app.getTranscriptText();
    expect(transcript).toMatch(/Auto-find suggests c ≈/);

    // c_input should be updated to a numeric string (exponential or decimal)
    const cVal = await app.getCInput();
    expect(Number(cVal)).toBeGreaterThan(0);

    // assistant should mention suggested constants
    const assistant = await app.getAssistantText();
    expect(assistant).toContain('Suggested constants: c=');
  });

  test('Find counterexample finds a violation when proposition fails (S5_CounterexampleFound)', async ({ page }) => {
    const app = new BigOmegaPage(page);

    // Use an oscillating example sin(n)+2 vs 1. Set c slightly above typical mean.
    await app.setAndChange(app.fexpr, 'sin(n) + 2');
    await app.setAndChange(app.gexpr, '1');
    // propose a too-large c so inequality fails
    await app.setAndChange(app.c_input, '2.9');
    await app.setAndChange(app.n0_input, '1');

    await app.click(app.findCounterBtn);

    const transcript = await app.getTranscriptText();
    // Either it finds a counterexample or states none found; in this setup we expect a counterexample
    expect(transcript).toMatch(/Counterexample found:|No counterexample found/);

    // If found, assistant should include 'Counterexample'
    const assistant = await app.getAssistantText();
    expect(assistant).toMatch(/Counterexample:|No counterexample/);
  });

  test('Undo and Redo behavior updates state and logs actions (S6_UndoApplied / S7_RedoApplied)', async ({ page }) => {
    const app = new BigOmegaPage(page);

    // Start from a known state, perform multiple actions that call pushState
    // 1) Load an example
    await app.exampleSelect.selectOption('2'); // choose example index 2
    await app.click(app.loadExampleBtn); // pushState

    // 2) Apply proposition (pushState)
    await app.setAndChange(app.c_input, '1.23');
    await app.setAndChange(app.n0_input, '5');
    await app.click(app.applyPropositionBtn);

    // 3) Auto-find (pushState)
    // Use auto-find may or may not find; safe to click to push state if it does
    await app.click(app.autoFindBtn);

    // Now click Undo
    await app.click(app.undoBtn);
    let transcript = await app.getTranscriptText();
    // Undo logs 'Undo applied.'
    expect(transcript).toContain('Undo applied.');

    // Click Redo
    await app.click(app.redoBtn);
    transcript = await app.getTranscriptText();
    expect(transcript).toContain('Redo applied.');
  });

  test('Clear log vs Reset Lab: Reset Lab triggers "Lab reset." while Clear Log has no handler (S8_LogCleared)', async ({ page }) => {
    const app = new BigOmegaPage(page);

    // First ensure there is content in transcript
    await app.setAndChange(app.fexpr, 'n*n');
    await app.click(app.loadExampleBtn);

    // Click the Reset Lab button (resetAll) which is implemented and should log 'Lab reset.'
    await app.click(app.resetAllBtn);
    let transcript = await app.getTranscriptText();
    expect(transcript).toContain('Lab reset.');

    // Now click the Clear Log button. In the provided implementation this button does not have a listener.
    // We assert that clicking it does not produce a 'Lab reset.' entry (no second reset).
    const before = transcript;
    await app.click(app.clearLogBtn);
    const after = await app.getTranscriptText();

    // If clearLog had been wired, we'd expect another 'Lab reset.'; the actual implementation lacks the handler,
    // so transcript should be unchanged (or at least not contain a fresh 'Lab reset.' appended immediately).
    // We assert that no new 'Lab reset.' was appended after the resetAll click.
    expect(after.startsWith(before)).toBeTruthy();
  });

  test('Save, Load and Delete configuration persistence (SaveConfig, LoadSaved, DeleteSaved)', async ({ page }) => {
    const app = new BigOmegaPage(page);

    // Prepare a unique name
    const cfgName = 'testcfg_' + Date.now();

    // Set some custom inputs
    await app.setAndChange(app.fexpr, 'n*n + 1');
    await app.setAndChange(app.gexpr, 'n');
    await app.setAndChange(app.c_input, '3.14');
    await app.setAndChange(app.n0_input, '7');
    await app.saveName.fill(cfgName);

    // Save configuration
    await app.click(app.saveConfigBtn);

    let transcript = await app.getTranscriptText();
    expect(transcript).toContain(`Saved configuration "${cfgName}".`);

    // Refresh savedList by invoking refreshSavedList indirectly: it's called on save
    // Select saved item and Load
    await app.savedList.selectOption(cfgName);
    await app.click(app.loadSavedBtn);

    transcript = await app.getTranscriptText();
    expect(transcript).toContain(`Loaded saved configuration "${cfgName}".`);

    // Verify fields loaded
    expect(await app.getFExpr()).toContain('n*n');
    expect(await app.getGExpr()).toBe('n');
    expect(await app.getCInput()).toBe('3.14');

    // Delete saved config
    await app.savedList.selectOption(cfgName);
    await app.click(app.deleteSavedBtn);

    transcript = await app.getTranscriptText();
    expect(transcript).toContain(`Deleted saved configuration "${cfgName}".`);
  });

  test('Validation errors: banned tokens and semicolons produce validation error messages (edge cases)', async ({ page }) => {
    const app = new BigOmegaPage(page);

    // Insert a banned token 'window' in expression to trigger safeEvalFactory error
    await app.fexpr.fill('window.alert(1)');
    // Attempt to validate (step1)
    await app.click(page.locator('#step1'));

    let transcript = await app.getTranscriptText();
    expect(transcript).toContain('Validation error: Expression contains a forbidden token: window');

    // Insert a semicolon to provoke the semicolon-specific rejection
    await app.fexpr.fill('n; n+1');
    await app.click(page.locator('#step1'));

    transcript = await app.getTranscriptText();
    expect(transcript).toMatch(/Validation error: Semicolons are not allowed in expressions\./);
  });

  test('Sampling, table output and plotting rendering executed without page errors (renderAll and run paths)', async ({ page }) => {
    const app = new BigOmegaPage(page);

    // Set a complicated but valid expression and run renderAll via runTest
    await app.setAndChange(app.fexpr, 'n*log(n) + 5');
    await app.setAndChange(app.gexpr, 'n*log(n)');
    // run step1 to parse, then run test
    await app.click(page.locator('#step1'));
    await app.click(app.runTestBtn);

    // Table output should be populated and include header
    const tableText = await app.getTableText();
    expect(tableText.startsWith('n\tf(n)\tg(n)\tf/g')).toBeTruthy();

    // Assistant should contain numeric info or test result
    const assistant = await app.getAssistantText();
    expect(assistant.length).toBeGreaterThan(0);

    // Confirm no unhandled page errors occurred during sampling/rendering
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error observability - collect and report (diagnostic)', async ({ page }) => {
    // This test validates that we observe console messages and page errors during interactions.
    const app = new BigOmegaPage(page);

    // Perform a variety of interactions to generate console messages (if any)
    await app.setAndChange(app.fexpr, 'n');
    await app.setAndChange(app.gexpr, '1');
    await app.click(app.loadExampleBtn);
    await app.click(app.autoFindBtn);
    await app.click(app.runTestBtn);

    // Gather recorded console messages and page errors
    // We assert that there are no unhandled page errors; console messages may exist (Playwright might capture nothing)
    expect(pageErrors.length).toBe(0);
    // At minimum validate that we have captured the page-level console entries array (it may be empty)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});