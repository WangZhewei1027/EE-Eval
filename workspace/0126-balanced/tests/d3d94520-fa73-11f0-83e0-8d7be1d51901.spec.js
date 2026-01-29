import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d94520-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Virtual Memory Simulator (FSM validation) - d3d94520-fa73-11f0-83e0-8d7be1d51901', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages from page (useful for debugging runtime console.* logs)
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the application exactly as-is
    await page.goto(APP_URL);

    // Wait for initial initialization log produced by initStructures() on load
    const logLocator = page.locator('#log');
    await expect(logLocator).toBeAttached();

    // The script calls initStructures() on load and logs a line with "Initialized:"
    // Wait up to a short timeout for that message to appear in the log
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      if(!log) return false;
      return Array.from(log.children).some(c => c.textContent && c.textContent.includes('Initialized:'));
    }, { timeout: 2000 });
  });

  test.afterEach(async () => {
    // Basic check: there should be no uncaught page errors (Runtime exceptions)
    // We assert that pageErrors length is 0; if there are errors, tests will fail and show them.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' || ')}`).toBe(0);
  });

  test('S0 -> S1 InitClick transitions to Initialized and sets up structures', async ({ page }) => {
    // Validate that the initial initStructures() has run on page load (S0 entry -> S1_Initialized)
    const firstLog = await page.locator('#log div').first().textContent();
    expect(firstLog).toContain('Initialized:');

    // Change some inputs to non-defaults to ensure init uses current settings
    await page.fill('#virtualPages', '32');
    await page.fill('#pageSize', '128');
    await page.fill('#numFrames', '6');
    await page.selectOption('#algorithm', 'LRU');

    // Click Init to trigger InitClick event (transition S0_Idle -> S1_Initialized or re-init)
    await page.click('#initBtn');

    // After clicking Init, a new "Initialized:" log entry should appear
    await page.waitForFunction(() => {
      const log1 = document.getElementById('log1');
      return Array.from(log.children).some(c => c.textContent && c.textContent.includes('Initialized: 32 pages'));
    }, { timeout: 2000 });

    // Verify UI reflects the algorithm change (onEnter evidence: algNameEl.textContent update)
    const algName = await page.locator('#algName').textContent();
    expect(algName).toBe('LRU');

    // Verify page table was built for 32 virtual pages (pageTable has 5 header items + 32 rows)
    const pageTableChildren = await page.locator('#pageTable').locator('div').count();
    expect(pageTableChildren).toBeGreaterThanOrEqual(5 + 32);

    // Confirm stats were reset by initStructures()
    await expect(page.locator('#stAccesses')).toHaveText('0');
    await expect(page.locator('#stFaults')).toHaveText('0');
  });

  test('ResetClick clears sequence and logs reset (S1_Initialized -> S1_Initialized)', async ({ page }) => {
    // Prefill sequence to ensure reset clears it
    await page.fill('#sequence', '10,20,30');
    // Click Reset button
    await page.click('#resetBtn');

    // Sequence textarea should be empty
    await expect(page.locator('#sequence')).toHaveValue('');

    // Log should contain "Reset simulation."
    const logTexts = await page.locator('#log div').allTextContents();
    const found = logTexts.some(t => t.includes('Reset simulation.'));
    expect(found).toBeTruthy();
  });

  test('GenRandomClick populates sequence and re-initializes (S1_Initialized -> S1_Initialized)', async ({ page }) => {
    // Click Generate Random
    await page.click('#genRandom');

    // After clicking, sequence textarea should be non-empty
    const seqVal = await page.locator('#sequence').inputValue();
    expect(seqVal.trim().length).toBeGreaterThan(0);

    // Also, the UI should have re-initialized (an "Initialized:" log entry should exist after button click)
    const logTexts1 = await page.locator('#log div').allTextContents();
    const initFound = logTexts.some(t => t.includes('Initialized:'));
    expect(initFound).toBeTruthy();
  });

  test('StepClick advances one access and updates stats (S1_Initialized -> S4_Stepping)', async ({ page }) => {
    // Ensure a known sequence is present (the app prefilled one at load)
    const seqVal1 = await page.locator('#sequence').inputValue();
    expect(seqVal.length).toBeGreaterThan(0);

    // Click Step once
    await page.click('#stepBtn');

    // After step, there should be an "Accessing addr=" log entry and Accesses stat increments to >=1
    await page.waitForFunction(() => {
      const sa = document.getElementById('stAccesses');
      return sa && parseInt(sa.textContent) >= 1;
    }, { timeout: 2000 });

    const logTexts2 = await page.locator('#log div').allTextContents();
    expect(logTexts.some(t => t.includes('Accessing addr='))).toBeTruthy();
  });

  test('RunClick starts automatic execution and PauseClick triggers pauseRun exit action (S1_Initialized -> S2_Running -> S3_Paused)', async ({ page }) => {
    // Ensure sequence exists and reset seqIdx by re-initializing
    await page.click('#initBtn');

    // Set speed to minimum for faster test and click Run
    await page.fill('#speed', '100');
    // Use input event instead of direct property change to match UI handlers
    await page.locator('#speed').evaluate((el, val) => el.value = val, '100');
    await page.dispatchEvent('#speed', 'input');

    // Click Run
    await page.click('#runBtn');

    // Wait briefly to allow a few automatic steps to run
    await page.waitForTimeout(400);

    // Accesses should have increased (at least 2 if interval ~100ms)
    const accessesAfterRun = parseInt(await page.locator('#stAccesses').textContent());
    expect(accessesAfterRun).toBeGreaterThanOrEqual(2);

    // Now click Pause to trigger exit action pauseRun (should log "Run paused.")
    await page.click('#pauseBtn');

    // The log should contain 'Run paused.'
    const logTexts3 = await page.locator('#log div').allTextContents();
    const pausedFound = logTexts.some(t => t.includes('Run paused.'));
    expect(pausedFound).toBeTruthy();

    // Record current accesses then wait and ensure they don't increase (paused)
    const accessesBeforeWait = parseInt(await page.locator('#stAccesses').textContent());
    await page.waitForTimeout(300);
    const accessesAfterWait = parseInt(await page.locator('#stAccesses').textContent());
    expect(accessesAfterWait).toBe(accessesBeforeWait);
  });

  test('AccessClick validates input and shows error for invalid address and for missing input', async ({ page }) => {
    // Case 1: Missing address -> should log error "Enter a valid address to access."
    await page.fill('#singleAddr', '');
    await page.click('#accessBtn');

    const logs1 = await page.locator('#log div').allTextContents();
    expect(logs1.some(t => t.includes('Enter a valid address to access.'))).toBeTruthy();

    // Case 2: Out-of-range address -> should log error "Address ... out of range."
    // Compute a definitely out-of-range address (numVirtualPages * pageSize)
    const numVirtualPages = parseInt(await page.locator('#virtualPages').inputValue());
    const pageSize = parseInt(await page.locator('#pageSize').inputValue());
    const outOfRangeAddr = numVirtualPages * pageSize + 1000;
    await page.fill('#singleAddr', String(outOfRangeAddr));
    await page.click('#accessBtn');

    const logs2 = await page.locator('#log div').allTextContents();
    expect(logs2.some(t => t.includes('out of range'))).toBeTruthy();
  });

  test('AlgorithmChange updates UI (S1_Initialized event AlgorithmChange)', async ({ page }) => {
    // Change algorithm to "Clock" via select element
    await page.selectOption('#algorithm', 'Clock');

    // The visible algorithm name (#algName) should update to "Clock"
    await expect(page.locator('#algName')).toHaveText('Clock');
  });

  test('TLB hit scenario: repeated access eventually produces "TLB hit" log (S4_Stepping internal behavior)', async ({ page }) => {
    // Re-init to ensure starting fresh
    await page.click('#initBtn');

    // Use the prefilled sequence which includes repeated addresses (10 appears more than once)
    // Step through sequence up to a reasonable limit looking for "TLB hit"
    const maxSteps = 10;
    let tlbHitObserved = false;
    for (let i = 0; i < maxSteps; i++) {
      await page.click('#stepBtn');
      // Small delay to let DOM update
      await page.waitForTimeout(80);
      const logs = await page.locator('#log div').allTextContents();
      if (logs.some(t => t.includes('TLB hit'))) {
        tlbHitObserved = true;
        break;
      }
    }
    expect(tlbHitObserved, 'Expected to observe a TLB hit after stepping repeated addresses').toBeTruthy();
  });

  test('Edge case: Running speed change while running triggers restart behavior (S2_Running SpeedChange -> S2_Running)', async ({ page }) => {
    // Re-init and ensure sequence is present
    await page.click('#initBtn');

    // Set speed low and run
    await page.fill('#speed', '150');
    await page.dispatchEvent('#speed', 'input');
    await page.click('#runBtn');

    // Wait briefly for some progress
    await page.waitForTimeout(250);
    const accessesBefore = parseInt(await page.locator('#stAccesses').textContent());

    // Change speed input while running - event listener should pause and restart run
    await page.fill('#speed', '120');
    await page.dispatchEvent('#speed', 'input');

    // Wait briefly and verify accesses continue to increase (run restarted)
    await page.waitForTimeout(300);
    const accessesAfter = parseInt(await page.locator('#stAccesses').textContent());
    expect(accessesAfter).toBeGreaterThanOrEqual(accessesBefore);

    // Finally pause to clean up
    await page.click('#pauseBtn');
    await page.waitForTimeout(100);
    const logs1 = await page.locator('#log div').allTextContents();
    expect(logs.some(t => t.includes('Run paused.'))).toBeTruthy();
  });

  test('Verify UI reflects page table/frame changes after accesses (visual feedback)', async ({ page }) => {
    // Start fresh and ensure a predictable environment
    await page.fill('#virtualPages', '8');
    await page.fill('#pageSize', '64');
    await page.fill('#numFrames', '2');
    await page.click('#initBtn');

    // Fill the sequence with three distinct page addresses to force evictions when frames < pages
    // Addresses: page 0 (addr 10), page 2 (addr 130), page 4 (addr 4*64 + 1 = 257) -> force evictions with 2 frames
    await page.fill('#sequence', '10, 130, 257');
    await page.click('#stepBtn'); // load page 0
    await page.click('#stepBtn'); // load page 2
    await page.click('#stepBtn'); // should evict one page to load page 4

    // After these steps, page table should show some pages as swapped or some frames occupied
    const framesTexts = await page.locator('#framesArea .frame').allTextContents();
    // At least two frames should be present and show either free or a mapping
    expect(framesTexts.length).toBeGreaterThanOrEqual(2);

    // Check swap area: if a dirty page was evicted there may be entries, but at minimum swap area exists
    const swapAreaText = await page.locator('#swapArea').textContent();
    expect(swapAreaText.length).toBeGreaterThan(0);

    // Stats should reflect page faults (stFaults > 0)
    const faults = parseInt(await page.locator('#stFaults').textContent());
    expect(faults).toBeGreaterThanOrEqual(1);
  });
});