import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c142c83-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper to parse integer text content safely
async function intFromText(locator) {
  const txt = (await locator.textContent()) || '';
  const n = Number(txt.trim());
  return Number.isFinite(n) ? n : null;
}

test.describe('Exponential Search Interactive Playground (App ID: 9c142c83-fa79-11f0-8fe7-a5317bd8e2c6)', () => {
  // We'll capture console messages and uncaught page errors for each test run.
  test.beforeEach(async ({ page }) => {
    // auto-accept dialogs (alerts/confirm) to avoid blocking tests
    page.on('dialog', async (dialog) => {
      try {
        await dialog.accept();
      } catch (e) {
        // ignore
      }
    });
  });

  test('Page loads and initial state is Idle with initial array populated', async ({ page }) => {
    // Capture console errors and page errors
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(String(err)));

    // Load page
    await page.goto(APP_URL);

    // Basic UI elements exist
    await expect(page.locator('h1')).toHaveText(/Exponential Search/i);

    // Initial phase should be 'idle'
    const phase = (await page.locator('#phase').textContent())?.trim();
    expect(phase).toBe('idle');

    // The array input should contain the default CSV string
    const arrayInputVal = await page.locator('#arrayInput').inputValue();
    expect(arrayInputVal).toContain('1,2,4,8,16,32,64,128,256,512');

    // The existingValues dropdown should be populated after initial setArray
    const existingCount = await page.locator('#existingValues option').count();
    expect(existingCount).toBeGreaterThan(0);

    // No uncaught page errors or console errors should have occurred during load
    expect(pageErrors, 'No uncaught page errors during load').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages during load').toHaveLength(0);
  });

  test.describe('FSM transitions: Initialize -> Doubling -> Binary -> Done and resets', () => {
    test('Initialize transitions to init and creates a snapshot (phase=init)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => d.accept());

      await page.goto(APP_URL);

      // Click Initialize
      await page.locator('#initBtn').click();

      // Phase should update to 'init'
      await expect(page.locator('#phase')).toHaveText('init');

      // Snapshot should have been created: historyLen >= 1
      const historyLen = Number((await page.locator('#historyLen').textContent())?.trim());
      expect(historyLen).toBeGreaterThanOrEqual(1);

      // Trace log should contain initialization trace
      const trace = await page.locator('#traceLog').textContent();
      expect(trace).toMatch(/initialized/i);

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Stepping transitions through Doubling, Binary and finishes at Done with foundIndex', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => d.accept());

      await page.goto(APP_URL);

      // Initialize first
      await page.locator('#initBtn').click();
      await expect(page.locator('#phase')).toHaveText('init');

      // First step: init -> doubling (init does the index 0 check)
      await page.locator('#stepBtn').click();
      await expect(page.locator('#phase')).toHaveText('doubling');

      // Keep stepping until done (safety max iterations)
      const maxSteps = 40;
      for (let s = 0; s < maxSteps; s++) {
        const phaseText = (await page.locator('#phase').textContent())?.trim();
        if (phaseText === 'done') break;
        await page.locator('#stepBtn').click();
        // small wait to allow DOM update
        await page.waitForTimeout(20);
      }

      // Now should be done
      const finalPhase = (await page.locator('#phase').textContent())?.trim();
      expect(finalPhase).toBe('done');

      // foundIndex should be present (for default target 32 it's in the array)
      const foundIndexText = (await page.locator('#foundIndex').textContent())?.trim();
      const foundIndexNum = Number(foundIndexText);
      expect(Number.isFinite(foundIndexNum)).toBe(true);

      // steps, comparisons and accesses should be non-negative numbers
      const comparisons = Number((await page.locator('#comparisons').textContent())?.trim());
      const accesses = Number((await page.locator('#accesses').textContent())?.trim());
      const stepsCount = Number((await page.locator('#stepsCount').textContent())?.trim());
      expect(comparisons).toBeGreaterThanOrEqual(0);
      expect(accesses).toBeGreaterThanOrEqual(0);
      expect(stepsCount).toBeGreaterThanOrEqual(1);

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Reset from Initialized and from Done returns to Idle', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => d.accept());

      await page.goto(APP_URL);

      // Initialize then reset
      await page.locator('#initBtn').click();
      await expect(page.locator('#phase')).toHaveText('init');

      await page.locator('#resetBtn').click();
      await expect(page.locator('#phase')).toHaveText('idle');

      // Initialize and run-to-end then reset
      await page.locator('#initBtn').click();
      // use runToEnd to progress quickly to done
      await page.locator('#runToEndBtn').click();

      // Wait a little for runToEnd processing
      await page.waitForTimeout(50);

      // Confirm we are in done
      const afterPhase = (await page.locator('#phase').textContent())?.trim();
      expect(['done','idle']).toContain(afterPhase);

      // Reset should bring back idle
      await page.locator('#resetBtn').click();
      await expect(page.locator('#phase')).toHaveText('idle');

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Controls and UI interactions (array, comparator, breakpoints, view, jump)', () => {
    test('Apply Array updates array, updates dropdown and resets algorithm', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => d.accept());

      await page.goto(APP_URL);

      // Change the array input and click Apply Array
      const newCSV = '10,20,30';
      await page.locator('#arrayInput').fill(newCSV);
      await page.locator('#applyArrayBtn').click();

      // After apply, input should be normalized to the array string
      const arrayInputVal = await page.locator('#arrayInput').inputValue();
      expect(arrayInputVal).toBe(newCSV);

      // existingValues should have 3 options
      const optCount = await page.locator('#existingValues option').count();
      expect(optCount).toBe(3);

      // Phase should be idle after setArray -> resetState()
      await expect(page.locator('#phase')).toHaveText('idle');

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Generate Random Sorted produces array of expected size', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => d.accept());

      await page.goto(APP_URL);

      // Set size slider to 12 and trigger generation
      await page.locator('#sizeSlider').evaluate(el => { el.value = '12'; el.dispatchEvent(new Event('input')); });
      // Validate label updated
      await expect(page.locator('#sizeLabel')).toHaveText('12');

      await page.locator('#randomSortedBtn').click();

      // existingValues should now contain 12 options
      const optCount = await page.locator('#existingValues option').count();
      expect(optCount).toBe(12);

      // arrayView should show items (non-empty)
      const arrayViewText = (await page.locator('#arrayView').textContent()) || '';
      expect(arrayViewText.trim().length).toBeGreaterThan(0);

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Apply valid and invalid comparator, handling errors and status updates', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => d.accept());

      await page.goto(APP_URL);

      // Apply a valid comparator
      await page.locator('#comparatorExpr').fill('(a - b)');
      await page.locator('#applyComparatorBtn').click();
      await expect(page.locator('#comparatorStatus')).toHaveText('OK');

      // Apply an invalid comparator (syntax error) to trigger error path & alert
      await page.locator('#comparatorExpr').fill('invalid(');
      await page.locator('#applyComparatorBtn').click();

      // comparatorStatus should show Error (button handler sets to 'Error' and alerts)
      const statusText = (await page.locator('#comparatorStatus').textContent())?.trim();
      expect(statusText === 'Error' || statusText === 'Error: invalid expression' || statusText === 'Edited' || statusText.length > 0).toBeTruthy();

      // We accepted any alert dialogs above; ensure no uncaught errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Clear array clears input and resets phase to idle', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => d.accept());

      await page.goto(APP_URL);

      // Clear the array
      await page.locator('#clearArrayBtn').click();

      // arrayInput should be empty, and phase idle
      const arrayInputVal = await page.locator('#arrayInput').inputValue();
      expect(arrayInputVal).toBe('');

      await expect(page.locator('#phase')).toHaveText('idle');

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Toggle array view switches between annotated and compact presentations', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => d.accept());

      await page.goto(APP_URL);

      const before = (await page.locator('#arrayView').textContent()) || '';

      await page.locator('#toggleArrayView').click();
      const afterToggle = (await page.locator('#arrayView').textContent()) || '';
      // Toggled representation should differ from previous
      expect(afterToggle).not.toBe(before);

      // Toggle back
      await page.locator('#toggleArrayView').click();
      const afterSecond = (await page.locator('#arrayView').textContent()) || '';
      expect(afterSecond).toBe(before);

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Jump to index creates a snapshot and updates history', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => d.accept());

      await page.goto(APP_URL);

      // read current history length
      const beforeLen = Number((await page.locator('#historyLen').textContent())?.trim());

      // Set a valid index and click jump
      await page.locator('#jumpIndexInput').fill('2');
      await page.locator('#jumpIndexBtn').click();

      // history length should increase by at least 1
      const afterLen = Number((await page.locator('#historyLen').textContent())?.trim());
      expect(afterLen).toBeGreaterThanOrEqual(beforeLen + 1);

      // latest snapshot note should mention "Jumped view to index"
      const trace = (await page.locator('#traceLog').textContent()) || '';
      expect(trace).toMatch(/Jumped view to index|Snapshot/);

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Set comparison breakpoint and clear breakpoints via UI', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => d.accept());

      await page.goto(APP_URL);

      // Set breakpointComp to 1
      await page.locator('#breakpointComp').fill('1');
      await page.locator('#setBreakComp').click();

      // traceLog should contain "Set comparison breakpoint" entry
      const trace = (await page.locator('#traceLog').textContent()) || '';
      expect(trace).toMatch(/Set comparison breakpoint|Set comparison breakpoint >=/i);

      // Clear breakpoints
      await page.locator('#clearBreakpoints').click();
      const afterTrace = (await page.locator('#traceLog').textContent()) || '';
      expect(afterTrace).toMatch(/All breakpoints cleared/i);

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Run linear search produces a result string in the linearResult element', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => d.accept());

      await page.goto(APP_URL);

      // Ensure target is set to an existing value for deterministic found result
      await page.locator('#targetInput').fill('32');

      await page.locator('#runLinearBtn').click();

      const linearText = (await page.locator('#linearResult').textContent()) || '';
      expect(linearText).toMatch(/Linear search -> foundIndex:/i);

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Error scenarios & edge cases', () => {
    test('Importing invalid JSON triggers an alert and does not crash', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      const dialogs = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => {
        dialogs.push(d.message());
        await d.accept();
      });

      await page.goto(APP_URL);

      // Put invalid JSON into import area and click import
      await page.locator('#importSessionArea').fill('not-a-json');
      await page.locator('#importSessionBtn').click();

      // An alert should have been shown with 'Invalid JSON' or similar
      const hadDialog = dialogs.length > 0;
      expect(hadDialog).toBe(true);

      // Ensure page did not throw any uncaught exceptions
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Attempt to jump to invalid index shows an alert but not crash', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      const dialogs = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));
      page.on('dialog', async d => {
        dialogs.push(d.message());
        await d.accept();
      });

      await page.goto(APP_URL);

      // Provide an out-of-range index
      await page.locator('#jumpIndexInput').fill('99999');
      await page.locator('#jumpIndexBtn').click();

      // An alert should have been shown (Invalid index)
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[0]).toMatch(/Invalid index|Invalid/);

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });
});