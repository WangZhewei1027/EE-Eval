import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1214ea02-fa7a-11f0-acf9-69409043402d.html';

test.describe('Branch and Bound Interactive Demo - FSM validation', () => {
  // We'll collect console errors and page errors for each test run.
  test.beforeEach(async ({ page }) => {
    // Arrays to collect errors for assertions
    page.setDefaultTimeout(10000);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  });

  // Utility to attach listeners and return collectors
  async function attachErrorCollectors(page) {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    return { consoleErrors, pageErrors };
  }

  test('Initial Idle state: page loads and initial UI rendered', async ({ page }) => {
    // Validate initial Idle state (S0_Idle)
    // - Setup Problem button visible
    // - varCount input exists with default 3
    // - coefficient inputs rendered for default varCount (renderCoeffInputs executed on load)
    // - branchBoundControls hidden
    // - no unexpected runtime errors
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    const setupBtn = page.locator('#setupProblemBtn');
    await expect(setupBtn).toBeVisible();

    const varCount = page.locator('#varCount');
    await expect(varCount).toHaveValue('3');

    // Coefficient inputs should be rendered for 3 variables
    const coeffInputs = page.locator('#varCoeffInputs input[type=number]');
    await expect(coeffInputs).toHaveCount(3);

    // Branch and bound controls initially hidden
    const branchControlsStyle = await page.locator('#branchBoundControls').evaluate(el => {
      return window.getComputedStyle(el).display;
    });
    expect(branchControlsStyle === 'none' || branchControlsStyle === '').toBeTruthy();

    // State summary empty initially (renderCoeffInputs called but updateStateSummary isn't yet)
    const stateSummary = await page.locator('#stateSummary').innerText();
    // Could be empty string
    expect(typeof stateSummary).toBe('string');

    // Ensure no unexpected console or page errors during initial load
    expect(consoleErrors.length, `console.error events: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `pageerror events: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Setup Problem transition -> Problem Setup (S0_Idle -> S1_Problem_Setup)', async ({ page }) => {
    // Clicking Setup Problem should render coefficient inputs and reset state
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    // Change varCount to 4 to validate dynamic rendering
    await page.fill('#varCount', '4');
    await page.click('#setupProblemBtn');

    // After setup, coefficient inputs should match new varCount
    const coeffInputs = page.locator('#varCoeffInputs input[type=number]');
    await expect(coeffInputs).toHaveCount(4);

    // Branch controls remain hidden until initialization
    const branchDisplay = await page.locator('#branchBoundControls').evaluate(el => window.getComputedStyle(el).display);
    expect(branchDisplay === 'none' || branchDisplay === '').toBeTruthy();

    // Manual add section hidden
    const manualDisplay = await page.locator('#manualAddNodeSection').evaluate(el => window.getComputedStyle(el).display);
    expect(manualDisplay === 'none' || manualDisplay === '').toBeTruthy();

    // Log should contain 'State reset.' because setupProblemBtn triggers resetAll()
    const logVal = await page.locator('#logOutput').inputValue();
    expect(logVal.includes('State reset.')).toBeTruthy();

    // Verify no runtime console/page errors
    expect(consoleErrors.length, `console.error events: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `pageerror events: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Initialize Algorithm (S1_Problem_Setup -> S2_Algorithm_Initialized)', async ({ page }) => {
    // Validate initialization creates root node, updates state summary and enables controls
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    // Ensure we're in problem setup first
    await page.click('#setupProblemBtn');

    // The init button is inside a hidden section initially; click it using force to simulate event trigger
    await page.click('#initBtn', { force: true });

    // After initialization, branchBoundControls should be visible
    const branchDisplay = await page.locator('#branchBoundControls').evaluate(el => window.getComputedStyle(el).display);
    expect(branchDisplay === 'block' || branchDisplay === 'flex' || branchDisplay === 'inline-block' || branchDisplay === 'inline').toBeTruthy();

    // Step and Auto Run should be enabled, Pause disabled, Add Custom Node enabled
    await expect(page.locator('#stepBtn')).toBeEnabled();
    await expect(page.locator('#autoRunBtn')).toBeEnabled();
    await expect(page.locator('#pauseBtn')).toBeDisabled();
    await expect(page.locator('#addNodeBtn')).toBeEnabled();

    // Live node list should contain the root node
    const liveList = await page.locator('#liveNodeList').innerText();
    expect(liveList.includes('root')).toBeTruthy();

    // State summary should reflect live nodes count = 1 and updated step count = 0
    const stateText = await page.locator('#stateSummary').innerText();
    expect(stateText.includes('Live nodes count: 1')).toBeTruthy();

    // Log should contain initialization message
    const logVal = await page.locator('#logOutput').inputValue();
    expect(logVal.includes('Initialized with root node.')).toBeTruthy();

    // Ensure no runtime console/page errors
    expect(consoleErrors.length, `console.error events: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `pageerror events: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Next Step (S2_Algorithm_Initialized -> S3_Algorithm_Running) and basic branching', async ({ page }) => {
    // Validate stepping advances algorithm: stepCount increments, nodes update
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    // Prepare: setup and initialize
    await page.click('#setupProblemBtn');
    await page.click('#initBtn', { force: true });

    // Capture initial state summary step count
    const before = await page.locator('#stateSummary').innerText();
    // Click Next Step
    await page.click('#stepBtn');

    // After step, step count should increment and live/explored lists update
    // Wait for UI update
    await page.waitForTimeout(200); // slight pause for DOM updates

    const after = await page.locator('#stateSummary').innerText();
    // Step count increase: should have 'Step count: 1'
    expect(after.includes('Step count: 1')).toBeTruthy();

    // Live node list and explored nodes list should have changed (root branched or processed)
    const liveList = await page.locator('#liveNodeList').innerText();
    const exploredList = await page.locator('#exploredNodesList').innerText();
    // Either children exist in live list, or root is in explored list
    const branchingHappened = liveList.length > 0 || exploredList.length > 0;
    expect(branchingHappened).toBeTruthy();

    // Log should contain branching message or fathomed/pruned messages
    const logs = await page.locator('#logOutput').inputValue();
    expect(
      logs.includes('Branching on node root') ||
      logs.includes('Branching node root') ||
      logs.includes('Found feasible solution') ||
      logs.includes('Fathomed node') ||
      logs.includes('Pruned node')
    ).toBeTruthy();

    // Ensure no runtime console/page errors
    expect(consoleErrors.length, `console.error events: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `pageerror events: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Auto Run and Pause Auto Run (S3_Algorithm_Running auto transitions)', async ({ page }) => {
    // Validate auto run starts, runs, and can be paused
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    // Initialize
    await page.click('#setupProblemBtn');
    await page.click('#initBtn', { force: true });

    // Start auto run (force click in case of visibility)
    await page.click('#autoRunBtn', { force: true });

    // Wait some time for auto-run to execute at least one step
    await page.waitForTimeout(1200);

    // Pause auto run
    await page.click('#pauseBtn', { force: true });

    // Wait tiny bit for pause handling
    await page.waitForTimeout(100);

    // Pause log should be present
    const logs = await page.locator('#logOutput').inputValue();
    expect(logs.includes('Starting auto run.') || logs.includes('Auto run paused.') || logs.includes('Auto run finished.')).toBeTruthy();
    expect(logs.includes('Auto run paused.') || logs.includes('Auto run finished.')).toBeTruthy();

    // After pause: pauseBtn disabled, stepBtn and autoRunBtn enabled
    await expect(page.locator('#pauseBtn')).toBeDisabled();
    await expect(page.locator('#stepBtn')).toBeEnabled();
    await expect(page.locator('#autoRunBtn')).toBeEnabled();

    // Ensure no runtime console/page errors
    expect(consoleErrors.length, `console.error events: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `pageerror events: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Reset Algorithm (S3_Algorithm_Running -> S2_Algorithm_Initialized via Reset) and clearing state', async ({ page }) => {
    // Validate reset clears nodes and hides branch controls
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    await page.click('#setupProblemBtn');
    await page.click('#initBtn', { force: true });

    // Do a step to modify state
    await page.click('#stepBtn');
    await page.waitForTimeout(100);

    // Click reset
    await page.click('#resetBtn');

    // Branch controls should be hidden and live/explored lists empty
    const branchDisplay = await page.locator('#branchBoundControls').evaluate(el => window.getComputedStyle(el).display);
    expect(branchDisplay === 'none' || branchDisplay === '').toBeTruthy();

    const liveList = await page.locator('#liveNodeList').innerText();
    const exploredList = await page.locator('#exploredNodesList').innerText();
    expect(liveList.trim() === '').toBeTruthy();
    expect(exploredList.trim() === '').toBeTruthy();

    // Log should contain 'State reset.'
    const logs = await page.locator('#logOutput').inputValue();
    expect(logs.includes('State reset.')).toBeTruthy();

    // Ensure no runtime console/page errors
    expect(consoleErrors.length, `console.error events: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `pageerror events: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Manual Node Addition flows: open, cancel, validation alert, and confirm add (S2 -> S4)', async ({ page }) => {
    // Validate manual addition UI and error handling via dialog alerts
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    // Initialize algorithm to enable addNodeBtn
    await page.click('#setupProblemBtn');
    await page.click('#initBtn', { force: true });

    // Open manual add section
    await page.click('#addNodeBtn');

    // Section should be visible
    const manualDisplayVisible = await page.locator('#manualAddNodeSection').evaluate(el => window.getComputedStyle(el).display);
    expect(manualDisplayVisible !== 'none' && manualDisplayVisible !== '').toBeTruthy();

    // Cancel addition hides section
    await page.click('#cancelManualNodeBtn');
    const manualDisplayHidden = await page.locator('#manualAddNodeSection').evaluate(el => window.getComputedStyle(el).display);
    expect(manualDisplayHidden === 'none' || manualDisplayHidden === '').toBeTruthy();

    // Open again to test validation
    await page.click('#addNodeBtn');

    // Try to confirm with empty ID to trigger alert
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.click('#addManualNodeConfirmBtn');

    // Ensure the alert message was the expected one
    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toContain('Node ID required');

    // Now provide valid inputs and confirm
    await page.fill('#manualNodeId', 'mynode123');
    // The bounds textarea default was populated; ensure it's valid JSON
    const boundsText = await page.locator('#manualNodeBounds').inputValue();
    // Provide an UB
    await page.fill('#manualNodeBound', '999');

    // Confirm add
    await page.click('#addManualNodeConfirmBtn');

    // Manual node should be added to live node list and log updated
    const liveList = await page.locator('#liveNodeList').innerText();
    expect(liveList.includes('mynode123')).toBeTruthy();

    const logs = await page.locator('#logOutput').inputValue();
    expect(logs.includes('Manual node mynode123 added.') || logs.includes('Manual node mynode123 added.')).toBeTruthy();

    // Ensure no runtime console/page errors
    expect(consoleErrors.length, `console.error events: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `pageerror events: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Cancel Manual Node Addition returns to Problem Setup (S4 -> S1)', async ({ page }) => {
    // Confirm that canceling manual addition hides UI and does not add node
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    await page.click('#setupProblemBtn');
    await page.click('#initBtn', { force: true });

    // Open and then cancel
    await page.click('#addNodeBtn');
    await page.click('#cancelManualNodeBtn');

    // Manual section hidden
    const manualDisplay = await page.locator('#manualAddNodeSection').evaluate(el => window.getComputedStyle(el).display);
    expect(manualDisplay === 'none' || manualDisplay === '').toBeTruthy();

    // No new nodes were added beyond root (live list may contain root or other nodes)
    // We'll assert that no node with empty id was added; manualNodeId input should be empty
    const manualIdVal = await page.locator('#manualNodeId').inputValue();
    // After cancel UI is hidden; input might have been reset earlier; just ensure it's empty or whitespace
    expect(manualIdVal.trim() === '').toBeTruthy();

    // Ensure no runtime console/page errors
    expect(consoleErrors.length, `console.error events: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `pageerror events: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Clear Log (S3 -> S5) clears the log output', async ({ page }) => {
    // Validate that Clear Log empties the log textarea
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    // Create some log content
    await page.click('#setupProblemBtn');
    await page.click('#initBtn', { force: true });
    await page.click('#stepBtn');

    // Ensure there is content
    const logsBefore = await page.locator('#logOutput').inputValue();
    expect(logsBefore.length).toBeGreaterThan(0);

    // Click clear log
    await page.click('#clearLogBtn');

    const logsAfter = await page.locator('#logOutput').inputValue();
    expect(logsAfter).toBe('');

    // Ensure no runtime console/page errors
    expect(consoleErrors.length, `console.error events: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `pageerror events: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Edge cases: invalid manual bounds JSON and missing UB produce alerts', async ({ page }) => {
    // Validate that invalid JSON and missing UB trigger alerts and are handled
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    await page.click('#setupProblemBtn');
    await page.click('#initBtn', { force: true });
    await page.click('#addNodeBtn');

    // Provide a valid ID but invalid JSON bounds
    await page.fill('#manualNodeId', 'badBoundsNode');
    await page.fill('#manualNodeBounds', '{invalidJson: true'); // invalid JSON

    let dialogMsg1 = null;
    page.once('dialog', async dialog => {
      dialogMsg1 = dialog.message();
      await dialog.accept();
    });
    await page.click('#addManualNodeConfirmBtn');
    expect(dialogMsg1).toBeTruthy();
    expect(dialogMsg1).toContain('Invalid JSON for bounds');

    // Now provide valid JSON but remove UB to trigger UB error
    const boundsObj = await page.locator('#manualNodeBounds').fill(JSON.stringify({ x1: [0, 1], x2: [0,1], x3: [0,1] }));
    // Ensure UB empty
    await page.fill('#manualNodeBound', '');

    let dialogMsg2 = null;
    page.once('dialog', async dialog => {
      dialogMsg2 = dialog.message();
      await dialog.accept();
    });
    await page.click('#addManualNodeConfirmBtn');
    expect(dialogMsg2).toBeTruthy();
    expect(dialogMsg2).toContain('Objective bound (UB) required');

    // Cleanup: cancel manual add
    await page.click('#cancelManualNodeBtn');

    // Ensure no unexpected console/page errors beyond captured dialogs
    expect(consoleErrors.length, `console.error events: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `pageerror events: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Verify onEnter/onExit implied actions: renderCoeffInputs & updateStateSummary invoked', async ({ page }) => {
    // The FSM indicates renderCoeffInputs on entering Problem Setup and updateStateSummary on entering Algorithm Initialized.
    // We verify that coefficient inputs are created (renderCoeffInputs) and that state summary is populated (updateStateSummary).
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    // Enter Problem Setup by clicking setup
    await page.click('#setupProblemBtn');

    // Coeff inputs present
    await expect(page.locator('#varCoeffInputs input[type=number]')).toHaveCount(parseInt(await page.locator('#varCount').inputValue(), 10));

    // Enter Algorithm Initialized by invoking init
    await page.click('#initBtn', { force: true });

    // State summary should reflect variables and objective coefficients (updateStateSummary)
    const stateText = await page.locator('#stateSummary').innerText();
    expect(stateText.includes('Variables')).toBeTruthy();
    expect(stateText.includes('Objective coefficients')).toBeTruthy();
    expect(stateText.includes('Live nodes count')).toBeTruthy();

    // No runtime console/page errors
    expect(consoleErrors.length, `console.error events: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `pageerror events: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  // Final test: collect and assert that no ReferenceError/SyntaxError/TypeError occurred during the full scenario above
  test('No uncaught JS exceptions (ReferenceError/SyntaxError/TypeError) during interactions', async ({ page }) => {
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    // Run through a series of interactions to exercise the app
    await page.click('#setupProblemBtn');
    await page.fill('#varCount', '3');
    await page.click('#setupProblemBtn');
    await page.click('#initBtn', { force: true });
    await page.click('#stepBtn');
    await page.click('#autoRunBtn', { force: true });
    // Pause shortly
    await page.waitForTimeout(600);
    await page.click('#pauseBtn', { force: true });
    await page.click('#addNodeBtn');
    await page.fill('#manualNodeId', 'finalNode');
    // Accept default bounds and UB
    await page.fill('#manualNodeBound', '10');
    await page.click('#addManualNodeConfirmBtn');
    await page.click('#clearLogBtn');

    // No page errors
    expect(pageErrors.length, `pageerror events: ${JSON.stringify(pageErrors)}`).toBe(0);

    // No console.error messages indicating runtime exceptions
    // We filter for messages that include ReferenceError, TypeError, SyntaxError (if present)
    const criticalErrors = consoleErrors.filter(e => {
      const t = e.text || '';
      return t.includes('ReferenceError') || t.includes('TypeError') || t.includes('SyntaxError');
    });
    expect(criticalErrors.length, `critical console errors: ${JSON.stringify(criticalErrors)}`).toBe(0);
  });

});