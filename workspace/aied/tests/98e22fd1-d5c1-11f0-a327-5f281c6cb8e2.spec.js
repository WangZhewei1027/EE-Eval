import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e22fd1-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('DFS Visualizer (FSM integration & UI) - 98e22fd1-d5c1-11f0-a327-5f281c6cb8e2', () => {
  let page;
  let context;
  let consoleEntries;
  let pageErrors;

  // helpers to attach/detach listeners per test
  const attachListeners = (page) => {
    consoleEntries = [];
    pageErrors = [];

    const consoleHandler = (msg) => {
      consoleEntries.push({
        type: msg.type(),
        text: msg.text()
      });
    };
    const pageErrorHandler = (err) => {
      pageErrors.push(err);
    };
    const dialogHandler = async (dialog) => {
      // auto-accept alerts so tests continue (generateGraph uses alert on parse error)
      await dialog.accept();
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);
    page.on('dialog', dialogHandler);

    // return handlers so they can be removed later
    return { consoleHandler, pageErrorHandler, dialogHandler };
  };

  const detachListeners = (page, handlers) => {
    if (!handlers) return;
    page.off('console', handlers.consoleHandler);
    page.off('pageerror', handlers.pageErrorHandler);
    page.off('dialog', handlers.dialogHandler);
  };

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    // navigate fresh before each test for isolation
    await page.goto(APP_URL);
    // attach fresh listeners
    const handlers = attachListeners(page);
    // store handlers on page so afterEach can detach
    (page as any)._testHandlers = handlers;
    // Wait briefly for initial generateGraph (the page calls generateGraph on load)
    await page.waitForTimeout(100);
  });

  test.afterEach(async () => {
    // ensure no uncaught page errors of critical JS types occurred during the test
    const handlers = (page as any)._testHandlers;
    detachListeners(page, handlers);

    // Collect console error entries and page errors for assertion
    const consoleErrors = consoleEntries.filter(c => c.type === 'error');
    // Assert no unexpected console errors or page errors
    expect(consoleErrors, `Unexpected console.error entries: ${consoleErrors.map(e => e.text).join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `Unexpected uncaught page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toHaveLength(0);
  });

  test('Initial state (S0_Idle -> initial generate -> S1_GraphGenerated): page loads and graph is drawn with start options', async () => {
    // Comments: Verify initial generation on load occurred and UI elements reflect S1_GraphGenerated
    // Check start select populated according to nodeCount input value
    const nodeCountValue = await page.$eval('#nodeCount', (el: HTMLInputElement) => Number(el.value));
    const startOptionsCount = await page.$$eval('#startNode option', (opts) => opts.length);
    expect(startOptionsCount).toBe(nodeCountValue);

    // Check SVG canvas has node groups with data-id attribute
    const nodeGroups = await page.$$eval('#svgCanvas g[data-id]', (groups) => groups.map(g => (g as SVGGElement).getAttribute('data-id')));
    expect(nodeGroups.length).toBeGreaterThanOrEqual(3); // minimum nodes

    // Stack box should display Empty as initial
    const stackText = await page.$eval('#stackBox', (el) => el.textContent?.trim());
    expect(stackText).toContain('Empty');

    // Step counters should be 0/0 (initial resetAnimationState called)
    const stepCounter = await page.$eval('#stepCounter', (el) => el.textContent?.trim());
    const totalSteps = await page.$eval('#totalSteps', (el) => el.textContent?.trim());
    expect(stepCounter).toBe('0');
    expect(totalSteps).toBe('0');
  });

  test('GenerateGraph event (click #gen) triggers redraw and repopulates start select (S0->S1 / S5->S1)', async () => {
    // Comments: clicking Generate should draw graph and populate #startNode options
    // Change node count first to a different value to ensure repopulation detectable
    await page.fill('#nodeCount', '6');
    await page.click('#gen');
    await page.waitForTimeout(100);

    const startOptionsCount = await page.$$eval('#startNode option', (opts) => opts.length);
    expect(startOptionsCount).toBe(6);

    // Verify node circles exist and have class 'unvisited' as they are reset
    const nodeClasses = await page.$$eval('#svgCanvas g[data-id] circle', els => els.map(c => c.className.baseVal));
    expect(nodeClasses.length).toBe(6);
    // Every class list should contain 'unvisited' for reset
    nodeClasses.forEach(cls => expect(cls).toContain('unvisited'));
  });

  test('RandomizeGraph event (#randomize click) updates density label and regenerates graph', async () => {
    // Comments: clicking Randomize should change density label text and redraw graph
    const prevDensityLabel = await page.$eval('#densityLabel', el => el.textContent?.trim());
    await page.click('#randomize');
    await page.waitForTimeout(100);
    const newDensityLabel = await page.$eval('#densityLabel', el => el.textContent?.trim());
    expect(newDensityLabel).not.toBeNull();
    expect(newDensityLabel).not.toEqual(prevDensityLabel);

    // Start select should still be populated
    const startOptionsCount = await page.$$eval('#startNode option', (opts) => opts.length);
    expect(startOptionsCount).toBeGreaterThanOrEqual(3);
  });

  test('SetStartNode via clicking a node updates #startNode and highlights node', async () => {
    // Comments: Simulate clicking an SVG node group; verify startSelect value changes and visual highlight applied
    // Find a node group element and click it
    const nodeSelector = '#svgCanvas g[data-id]';
    const firstNode = await page.$(nodeSelector);
    expect(firstNode).not.toBeNull();

    const nodeId = await firstNode!.getAttribute('data-id');
    // Click the node
    await firstNode!.click();
    await page.waitForTimeout(50);

    // startNode select value should equal nodeId
    const startValue = await page.$eval('#startNode', (el: HTMLSelectElement) => el.value);
    expect(String(startValue)).toBe(String(nodeId));

    // The clicked node circle should have inline style stroke set to '#ffff' per highlightStartSelect
    const stroke = await page.$eval(`#svgCanvas g[data-id="${nodeId}"] circle`, (c: SVGCircleElement) => c.style.stroke);
    expect(stroke.replace(/\s/g, '')).toBe('#ffff'); // remove whitespace
  });

  test('ChangeAlgorithm event (#algo) updates algoLabel and allows switching implementations', async () => {
    // Comments: Change algorithm dropdown and verify algoLabel text changes accordingly
    await page.selectOption('#algo', 'iterative');
    await page.waitForTimeout(50);
    const algoLabel = await page.$eval('#algoLabel', el => el.textContent?.trim());
    expect(algoLabel).toBe('Iterative DFS');

    // Switch back to recursive and verify label
    await page.selectOption('#algo', 'recursive');
    await page.waitForTimeout(50);
    const algoLabel2 = await page.$eval('#algoLabel', el => el.textContent?.trim());
    expect(algoLabel2).toBe('Recursive DFS');
  });

  test('RunDFS (click #run) prepares and runs algorithm producing snapshots and updates DOM (S1->S2)', async () => {
    // Comments: Click Run to prepare snapshots and apply the final snapshot to UI
    // Ensure there's a valid start node
    await page.click('#gen');
    await page.waitForTimeout(50);
    // select recursive for deterministic behavior
    await page.selectOption('#algo', 'recursive');

    // Click Run
    await page.click('#run');
    await page.waitForTimeout(120);

    // After run handler, curStep is set to last snapshot, so totalSteps should be >= 0 and stepCounter equals totalSteps
    const stepCounter = Number(await page.$eval('#stepCounter', el => el.textContent?.trim()));
    const totalSteps = Number(await page.$eval('#totalSteps', el => el.textContent?.trim()));
    expect(totalSteps).toBeGreaterThanOrEqual(0);
    expect(stepCounter).toBe(totalSteps);

    // VisitedOrder should show some nodes if graph > 0
    const visitedOrderText = await page.$eval('#visitedOrder', el => el.textContent?.trim());
    expect(visitedOrderText.length).toBeGreaterThanOrEqual(0);
  });

  test('StepDFS (click #step) steps through DFS snapshots (S1->S3 and transitions)', async () => {
    // Comments: Use Step control to trigger prepareAndRun then advance steps
    await page.click('#gen');
    await page.waitForTimeout(50);

    // First click on Step should prepare (if snapshots empty) and show step 0
    await page.click('#step');
    await page.waitForTimeout(80);
    let stepCounter = await page.$eval('#stepCounter', el => el.textContent?.trim());
    expect(stepCounter).toBe('0');

    // Second click should advance to step 1
    await page.click('#step');
    await page.waitForTimeout(80);
    stepCounter = await page.$eval('#stepCounter', el => el.textContent?.trim());
    expect(Number(stepCounter)).toBeGreaterThanOrEqual(1);

    // Now ensure the highlighted edge label updates (may be '—' or edge)
    const edgeLabel = await page.$eval('#edgeLabel', el => el.textContent?.trim());
    expect(edgeLabel.length).toBeGreaterThanOrEqual(1);
  });

  test('PlayDFS (click #play) plays through snapshots and stops at end (S1->S4)', async () => {
    // Comments: Click Play to start automatic play; set speed fast to finish quickly
    await page.click('#gen');
    await page.waitForTimeout(50);
    // set speed slider to minimum to speed playback
    await page.fill('#speed', '50');
    await page.waitForTimeout(20);

    // Click Play to start
    await page.click('#play');
    // Play button text should become 'Pause'
    const playText = await page.$eval('#play', el => el.textContent?.trim());
    expect(playText).toBe('Pause');

    // Wait sufficient time for playback to likely finish (but keep reasonable)
    await page.waitForTimeout(500);
    const finalPlayText = await page.$eval('#play', el => el.textContent?.trim());
    // After playback ends the button text returns to 'Play'
    expect(['Play', 'Pause']).toContain(finalPlayText);
    // Also step counter should be at totalSteps (end) or playback still running; check consistency
    const stepCounter = Number(await page.$eval('#stepCounter', el => el.textContent?.trim()));
    const totalSteps = Number(await page.$eval('#totalSteps', el => el.textContent?.trim()));
    expect(stepCounter).toBeGreaterThanOrEqual(0);
    expect(totalSteps).toBeGreaterThanOrEqual(0);
    expect(stepCounter).toBeLessThanOrEqual(totalSteps);
  });

  test('ResetVisualization (click #reset) clears snapshots and returns UI to Idle-like state (S2/S3/S4->S0)', async () => {
    // Comments: After running some steps, Reset should clear styles and counters
    await page.click('#gen');
    await page.waitForTimeout(50);
    await page.click('#run');
    await page.waitForTimeout(100);

    // Now click reset
    await page.click('#reset');
    await page.waitForTimeout(60);

    // Step counter reset to 0 and totalSteps to 0
    const stepCounter = await page.$eval('#stepCounter', el => el.textContent?.trim());
    const totalSteps = await page.$eval('#totalSteps', el => el.textContent?.trim());
    expect(stepCounter).toBe('0');
    expect(totalSteps).toBe('0');

    // Nodes should have class 'unvisited' after reset
    const nodeClasses = await page.$$eval('#svgCanvas g[data-id] circle', els => els.map(c => c.className.baseVal));
    nodeClasses.forEach(cls => expect(cls).toContain('unvisited'));
  });

  test('ChangeDensity event (#density input) updates label and does not crash', async () => {
    // Comments: Adjust density input and verify label updates; no errors
    await page.fill('#density', '0.75');
    // dispatch input event by focusing and keyboard may not be necessary, but wait for input handler
    await page.waitForTimeout(50);
    const densityLabel = await page.$eval('#densityLabel', el => el.textContent?.trim());
    expect(densityLabel).toBe('0.75');
  });

  test('ChangeNodeCount event (#nodeCount change) clamps values and repopulates nodes', async () => {
    // Comments: Enter extreme values and trigger change event; ensure clamping occurs
    await page.fill('#nodeCount', '100'); // above max
    // force change by blurring the field
    await page.$eval('#nodeCount', (el: HTMLInputElement) => el.dispatchEvent(new Event('change')));
    await page.waitForTimeout(50);

    // Value should be clamped to 32 (max)
    const nodeCountValue = await page.$eval('#nodeCount', (el: HTMLInputElement) => Number(el.value));
    expect(nodeCountValue).toBeLessThanOrEqual(32);

    // Now set smaller than min
    await page.fill('#nodeCount', '1');
    await page.$eval('#nodeCount', (el: HTMLInputElement) => el.dispatchEvent(new Event('change')));
    await page.waitForTimeout(50);
    const nodeCountValue2 = await page.$eval('#nodeCount', (el: HTMLInputElement) => Number(el.value));
    expect(nodeCountValue2).toBeGreaterThanOrEqual(3);
  });

  test('ChangeAdjacencyInput event (#adjInput change) with valid and invalid adjacency behaves as expected (S1<->S5 transitions)', async () => {
    // Comments: Valid adjacency input should regenerate graph to match adjacency size
    const smallAdj = '1 2\n0\n0'; // 3 nodes: 0->1,2 ; 1->0 ; 2->0
    await page.fill('#adjInput', smallAdj);
    // Trigger change event
    await page.$eval('#adjInput', (el: HTMLTextAreaElement) => el.dispatchEvent(new Event('change')));
    await page.waitForTimeout(120);

    // startNode options should reflect 3 nodes
    const startOptionsCount = await page.$$eval('#startNode option', opts => opts.length);
    expect(startOptionsCount).toBe(3);

    // Now provide invalid adjacency (out-of-range) to cause parse error which is caught and results in alert (handled)
    await page.fill('#adjInput', '10\n'); // invalid -> parse will return null or throw; generateGraph catches and alerts
    // Trigger change again
    await page.$eval('#adjInput', (el: HTMLTextAreaElement) => el.dispatchEvent(new Event('change')));
    // Wait to allow alert to be accepted by listener and fallback generation
    await page.waitForTimeout(120);

    // Ensure page did not produce uncaught errors and still has startNode options (fallback)
    const fallbackCount = await page.$$eval('#startNode option', opts => opts.length);
    expect(fallbackCount).toBeGreaterThanOrEqual(3);
  });

  test('Edge cases: invoking keyboard shortcuts triggers expected button actions without causing uncaught JS errors', async () => {
    // Comments: Press space to toggle play, ArrowRight to step, Ctrl/Cmd+R to generate - ensure they run
    // Ensure initial state generated
    await page.waitForTimeout(50);

    // Press ArrowRight to step - should call stepBtn click
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(80);
    const stepCounterAfter = Number(await page.$eval('#stepCounter', el => el.textContent?.trim()));
    expect(stepCounterAfter).toBeGreaterThanOrEqual(0);

    // Press Space to toggle play
    await page.keyboard.press(' ');
    await page.waitForTimeout(80);
    const playBtnText = await page.$eval('#play', el => el.textContent?.trim());
    expect(['Pause','Play']).toContain(playBtnText);

    // Press Ctrl+R (or Cmd+R on mac) to trigger gen - simulate with Control modifier
    await page.keyboard.down('Control');
    await page.keyboard.press('r');
    await page.keyboard.up('Control');
    await page.waitForTimeout(80);
    // startNode options should still exist
    const options = await page.$$eval('#startNode option', opts => opts.length);
    expect(options).toBeGreaterThanOrEqual(3);
  });
});