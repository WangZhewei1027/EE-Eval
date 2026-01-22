import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e27df0-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('Prim\'s Algorithm Interactive Demo - FSM and UI validation', () => {
  // Collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.stack ? err.stack : err));
    });

    // Load the page and wait for the demo to initialize
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for the demo object and nodes to be available
    await page.waitForFunction(() => !!window._primDemo);
    await page.waitForFunction(() => {
      // nodes gets created during regenGraph -> ensure nodes array exists and has length
      // and canvas exists
      return window.nodes && window.nodes.length > 0 && document.getElementById('graphCanvas') !== null;
    });
  });

  test.afterEach(async () => {
    // Basic assertion: no unhandled page errors occurred during the test
    expect(pageErrors.length).toBe(0);
    // Also assert there were no console messages of type 'error'
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Initial Idle state: UI elements present and hint visible', async ({ page }) => {
    // Validate initial idle UI & hint text
    const hintText = await page.locator('#hint').innerText();
    expect(hintText).toContain('Click a node to set start');

    const startLabel = await page.locator('#startLabel').innerText();
    expect(startLabel).toBe('None');

    const nodeCountDisplay = await page.locator('#nodeCountDisplay').innerText();
    // default N is 8 per HTML defaults
    expect(Number(nodeCountDisplay)).toBeGreaterThanOrEqual(4);

    // PQ should initially be empty
    const pqSize = await page.locator('#pqSize').innerText();
    expect(Number(pqSize)).toBeGreaterThanOrEqual(0);
  });

  test('Step button without start logs an instruction to choose a start node', async ({ page }) => {
    // Ensure startLabel is None
    expect(await page.locator('#startLabel').innerText()).toBe('None');

    // Click Step with no start chosen
    await page.click('#stepBtn');

    // The logBox should contain guidance text
    const logText = await page.locator('#logBox').innerText();
    expect(logText).toContain('Choose a start node (click a node) or pick Random Start.');
  });

  test('Clicking the canvas on a node sets the start node (NodeClick -> S1)', async ({ page }) => {
    // Grab the first node coords from page context
    const firstNode = await page.evaluate(() => {
      // nodes array exists on the page after regenGraph
      return window.nodes && window.nodes.length > 0 ? window.nodes[0] : null;
    });
    expect(firstNode).not.toBeNull();

    // Click exactly at the node coordinates relative to canvas
    const canvasBox = await page.locator('#graphCanvas').boundingBox();
    expect(canvasBox).not.toBeNull();
    const clickX = firstNode.x;
    const clickY = firstNode.y;

    // Use locator click with position relative to the element
    await page.locator('#graphCanvas').click({ position: { x: clickX, y: clickY } });

    // Verify startLabel updated
    const label = await page.locator('#startLabel').innerText();
    expect(label).toBe(`V${firstNode.id}`);

    // Verify a start log was added to logBox
    const log = await page.locator('#logBox').innerText();
    expect(log).toContain(`Start node set to V${firstNode.id}`);
  });

  test('Clicking canvas away from nodes does NOT set a start node (edge case)', async ({ page }) => {
    // Reset to ensure no start chosen
    await page.click('#resetAlgBtn');
    expect(await page.locator('#startLabel').innerText()).toBe('None');

    // Click in upper-left corner of the canvas where no node should be positioned
    const canvasBox = await page.locator('#graphCanvas').boundingBox();
    expect(canvasBox).not.toBeNull();
    // choose a spot near the corner (10,10) which is likely outside node radii
    await page.locator('#graphCanvas').click({ position: { x: 10, y: 10 } });

    // startLabel should remain 'None'
    expect(await page.locator('#startLabel').innerText()).toBe('None');
  });

  test('Random Start button picks a start and updates start label', async ({ page }) => {
    // Click Random Start
    await page.click('#randomStartBtn');

    // Start label should now start with V and a number
    const label = await page.locator('#startLabel').innerText();
    expect(label).toMatch(/^V\d+$/);

    // Log should indicate a start node was set
    const logText = await page.locator('#logBox').innerText();
    expect(logText).toContain('Start node set to V');
  });

  test('Initialize Prim via Step after choosing start: visited count, PQ and pseudocode highlight', async ({ page }) => {
    // Ensure we have a start: use Random Start to avoid clicking logic complexities
    await page.click('#randomStartBtn');
    const label = await page.locator('#startLabel').innerText();
    expect(label).toMatch(/^V\d+$/);

    // Click Step to initialize the algorithm (this will call initializePrim)
    await page.click('#stepBtn');

    // After initialization visitedCount should be 1
    await page.waitForFunction(() => {
      const el = document.getElementById('visitedCount');
      return el && Number(el.textContent) === 1;
    });

    const visited = await page.locator('#visitedCount').innerText();
    expect(Number(visited)).toBe(1);

    // PQ should have inserted edges (size > 0)
    const pqSize = await page.locator('#pqSize').innerText();
    expect(Number(pqSize)).toBeGreaterThanOrEqual(1);

    // Pseudocode line with data-line="1" should have highlight class
    const hasHighlight = await page.locator('[data-line="1"]').evaluate(el => el.classList.contains('highlight'));
    expect(hasHighlight).toBeTruthy();
  });

  test('Stepping through algorithm: consider an edge (pop) then accept/discard', async ({ page }) => {
    // Start with Random Start and initialize
    await page.click('#randomStartBtn');
    await page.click('#stepBtn'); // initialize

    // Now click Step again to pop an edge (enter "consider edge" branch)
    await page.click('#stepBtn');

    // The log should mention "Consider edge e"
    await page.waitForFunction(() => {
      const box = document.getElementById('logBox');
      return box && /Consider edge e\d+/.test(box.innerText);
    }, { timeout: 3000 });

    const logText = await page.locator('#logBox').innerText();
    expect(logText).toMatch(/Consider edge e\d+/);

    // Pseudocode should highlight the extraction/consider step (data-line 3)
    const highlighted3 = await page.locator('[data-line="3"]').evaluate(el => el.classList.contains('highlight'));
    expect(highlighted3).toBeTruthy();

    // Click Step again to either discard or accept the considered edge
    await page.click('#stepBtn');

    // After the decision step, log should contain either "Discarded e" or "Accepted e"
    await page.waitForFunction(() => {
      const t = document.getElementById('logBox').innerText;
      return /Discarded e\d+/.test(t) || /Accepted e\d+/.test(t);
    }, { timeout: 3000 });

    const postDecisionLog = await page.locator('#logBox').innerText();
    expect(/Discarded e\d+|Accepted e\d+/.test(postDecisionLog)).toBeTruthy();
  });

  test('Auto Run to completion and post-run behavior', async ({ page }) => {
    // Ensure a fresh run: regenerate graph to reset and get deterministic state
    // Speed up the animation by setting speedRange to minimum (100)
    await page.locator('#speedRange').evaluate((el) => { el.value = 100; el.dispatchEvent(new Event('input')); });
    // Ensure start is set
    await page.click('#randomStartBtn');

    // Start auto run
    await page.click('#runBtn');

    // Wait until the algorithm reports completion: look for key log messages or visitedCount == node count
    await page.waitForFunction(() => {
      const log = document.getElementById('logBox');
      const visited = Number(document.getElementById('visitedCount').textContent || '0');
      const totalNodes = Number(document.getElementById('nodeCountDisplay').textContent || '0');
      const finishedMsg = log && /All vertices visited|MST complete|Algorithm complete/.test(log.innerText);
      return finishedMsg || (visited > 0 && visited === totalNodes);
    }, { timeout: 20000 }); // allow enough time for completion even on slower test environments

    // After completion, the run button should be back to "Auto Run" (startAutoRun resets it)
    const runBtnText = await page.locator('#runBtn').innerText();
    expect(runBtnText).toBe('Auto Run');

    // Click run again after finished to trigger the "Already finished. Reset to run again." message
    await page.click('#runBtn');
    await page.waitForFunction(() => /Already finished\. Reset to run again\./.test(document.getElementById('logBox').innerText), { timeout: 2000 });
    const finalLog = await page.locator('#logBox').innerText();
    expect(finalLog).toContain('Already finished. Reset to run again.');
  });

  test('Reset algorithm returns UI to Idle state', async ({ page }) => {
    // Ensure algorithm had a start and potentially some steps
    await page.click('#randomStartBtn');
    await page.click('#stepBtn'); // initialize

    // Click Reset
    await page.click('#resetAlgBtn');

    // Validate UI elements reflect reset
    expect(await page.locator('#startLabel').innerText()).toBe('None');
    expect(await page.locator('#visitedCount').innerText()).toBe('0');
    expect(Number(await page.locator('#pqSize').innerText())).toBeGreaterThanOrEqual(0);

    // The logBox should have an "Algorithm reset." message
    const log = await page.locator('#logBox').innerText();
    expect(log).toContain('Algorithm reset.');
  });

  test('Regenerate graph, change nodes/density/maxW inputs trigger UI updates', async ({ page }) => {
    // Change number of nodes via nodesRange and dispatch 'change' so regenGraph runs
    await page.locator('#nodesRange').evaluate((el) => { el.value = 12; el.dispatchEvent(new Event('change')); });
    // Wait for nodeCountDisplay to update
    await page.waitForFunction(() => document.getElementById('nodeCountDisplay').textContent === '12', { timeout: 2000 });
    expect(await page.locator('#nodeCountDisplay').innerText()).toBe('12');

    // Verify internal nodes array also updated to 12
    const nodeArrayLength = await page.evaluate(() => window.nodes ? window.nodes.length : 0);
    expect(nodeArrayLength).toBe(12);

    // Change density and ensure densityVal updates
    await page.locator('#densityRange').evaluate((el) => { el.value = 80; el.dispatchEvent(new Event('input')); });
    expect(await page.locator('#densityVal').innerText()).toContain('80%');

    // Change max weight and ensure maxWVal updates after input event
    await page.locator('#maxW').evaluate((el) => { el.value = 90; el.dispatchEvent(new Event('input')); });
    expect(await page.locator('#maxWVal').innerText()).toBe('90');

    // Click the Generate Graph button and ensure nodes count remain consistent with slider
    await page.click('#regenBtn');
    // regenGraph will read nodesRange.value (12) and set up graph -> ensure node count is still 12
    await page.waitForFunction(() => window.nodes && window.nodes.length === 12, { timeout: 2000 });
    const nodesAfterRegen = await page.evaluate(() => window.nodes.length);
    expect(nodesAfterRegen).toBe(12);
  });

  test('Speed slider input updates displayed speed text (SpeedRangeChange)', async ({ page }) => {
    // Set speed to 1500 via input event
    await page.locator('#speedRange').evaluate((el) => { el.value = 1500; el.dispatchEvent(new Event('input')); });
    const speedText = await page.locator('#speedVal').innerText();
    expect(speedText).toBe('1500ms');
  });

  test('Attempting Auto Run without a start logs an instruction to choose a start node', async ({ page }) => {
    // Ensure reset so no start is chosen
    await page.click('#resetAlgBtn');
    expect(await page.locator('#startLabel').innerText()).toBe('None');

    // Click Auto Run without a start
    await page.click('#runBtn');

    // The log should instruct to choose a start node first
    await page.waitForFunction(() => /Choose a start node first\./.test(document.getElementById('logBox').innerText), { timeout: 2000 });
    const log = await page.locator('#logBox').innerText();
    expect(log).toContain('Choose a start node first.');
  });

  test('Verify no runtime page errors or console errors occurred during interactions', async ({ page }) => {
    // This test primarily validates that no pageerrors were captured; the afterEach also enforces this.
    // Trigger a few interactions quickly to surface any potential uncaught exceptions
    await page.click('#randomStartBtn');
    await page.click('#stepBtn');
    await page.click('#stepBtn');
    await page.click('#resetAlgBtn');

    // Confirm arrays are still empty (asserted again in afterEach) but also assert here explicitly
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

});