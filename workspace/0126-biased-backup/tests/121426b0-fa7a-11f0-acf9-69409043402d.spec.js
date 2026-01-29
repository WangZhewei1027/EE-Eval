import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121426b0-fa7a-11f0-acf9-69409043402d.html';

test.describe('Interpolation Search Interactive Demo - FSM validation', () => {
  // Shared variables to capture console and page errors
  let consoleMessages;
  let pageErrors;

  // Setup a fresh page for each test and capture console/page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  // Utility helpers
  const getText = async (page, selector) => {
    const el = page.locator(selector);
    return (await el.textContent()) ?? '';
  };

  const setInputValue = async (page, selector, value) => {
    const el = page.locator(selector);
    await el.fill(''); // clear
    await el.type(String(value));
  };

  // Test initial Idle state (S0_Idle)
  test('Initial state on load: Idle (resetAll applied)', async ({ page }) => {
    // The resetAll() entry action should have run on load.
    // Validate UI reflects "Status: Not started" and buttons initial enabled/disabled states.
    const stateInfo = await getText(page, '#state-info');
    expect(stateInfo.trim()).toBe('Status: Not started');

    // parse-array button should be enabled by resetAll()
    const parseDisabled = await page.locator('#parse-array-btn').isDisabled();
    expect(parseDisabled).toBe(false);

    // Start Search and step controls should be disabled
    expect(await page.locator('#start-search-btn').isDisabled()).toBe(true);
    expect(await page.locator('#reset-btn').isDisabled()).toBe(true);
    expect(await page.locator('#step-forward-btn').isDisabled()).toBe(true);

    // Ensure no uncaught page errors occurred during load
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Array loading and validation (S0_Idle -> S1_ArrayLoaded)', () => {
    test('Load valid array via input and click Load Array', async ({ page }) => {
      // Use the default input value already present or set explicit
      await setInputValue(page, '#array-input', '10 20 30 40 50');
      await page.click('#parse-array-btn');

      const arrayDisplay = await getText(page, '#array-display');
      expect(arrayDisplay).toContain('Array loaded. Length: 5');
      expect(await page.locator('#start-search-btn').isDisabled()).toBe(false);
      expect(await page.locator('#reset-btn').isDisabled()).toBe(false);

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('Parse invalid array triggers error message (edge case)', async ({ page }) => {
      // Invalid numeric entry should show error
      await setInputValue(page, '#array-input', '10 a 30');
      await page.click('#parse-array-btn');

      const arrayError = await getText(page, '#array-error');
      expect(arrayError.toLowerCase()).toContain('invalid number');

      // Empty array edge case
      await setInputValue(page, '#array-input', '');
      await page.click('#parse-array-btn');
      const emptyError = await getText(page, '#array-error');
      expect(emptyError).toContain('Array is empty.');

      expect(pageErrors.length).toBe(0);
    });

    test('Load example from select populates array and enables search', async ({ page }) => {
      // Select an example array
      await page.selectOption('#example-select', 'basic');

      const arrayDisplay = await getText(page, '#array-display');
      expect(arrayDisplay).toContain('Example "basic" loaded. Length: 10');
      expect(await page.locator('#start-search-btn').isDisabled()).toBe(false);
      expect(await page.locator('#reset-btn').isDisabled()).toBe(false);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Search lifecycle: start, step, found and not-found transitions', () => {
    test('Start search and step to FOUND -> S1_ArrayLoaded -> S2_SearchStarted -> S3_SearchCompleted', async ({ page }) => {
      // Load array (use example)
      await page.selectOption('#example-select', 'basic');

      // Enter a key that is present
      await setInputValue(page, '#search-key-input', '50');

      // Start search
      await page.click('#start-search-btn');

      // After clicking start, stateInfo should show "Search started"
      let stateInfo = await getText(page, '#state-info');
      expect(stateInfo).toContain('Status: Search started');

      // Step forward until found. Limit iterations to avoid infinite loop.
      let found = false;
      for (let i = 0; i < 20; i++) {
        stateInfo = await getText(page, '#state-info');
        if (stateInfo.includes('FOUND key at index')) {
          found = true;
          break;
        }
        // If step-forward button is disabled, break
        if (await page.locator('#step-forward-btn').isDisabled()) break;
        await page.click('#step-forward-btn');
        // small wait for UI
        await page.waitForTimeout(50);
      }

      expect(found).toBe(true);
      // After found, step-forward should be disabled
      expect(await page.locator('#step-forward-btn').isDisabled()).toBe(true);

      // Ensure log contains entries for the run
      const logText = await getText(page, '#log');
      expect(logText).toContain('Starting Interpolation Search for key');

      expect(pageErrors.length).toBe(0);
    });

    test('Start search and step to NOT FOUND -> S2_SearchStarted -> S4_SearchNotFound', async ({ page }) => {
      // Load example array
      await page.selectOption('#example-select', 'basic');

      // Enter a key that is NOT present
      await setInputValue(page, '#search-key-input', '9999');

      // Start search
      await page.click('#start-search-btn');

      // Step forward until not found
      let notFound = false;
      for (let i = 0; i < 30; i++) {
        const stateInfo = await getText(page, '#state-info');
        if (stateInfo.includes('Key NOT FOUND')) {
          notFound = true;
          break;
        }
        if (await page.locator('#step-forward-btn').isDisabled()) break;
        await page.click('#step-forward-btn');
        await page.waitForTimeout(30);
      }

      expect(notFound).toBe(true);
      // After not found, forward should be disabled
      expect(await page.locator('#step-forward-btn').isDisabled()).toBe(true);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Run to end and pause/resume behavior (S2 <-> S5)', () => {
    test('Run to end then pause and resume, verifying Paused state updates text', async ({ page }) => {
      // Load array and choose a key
      await page.selectOption('#example-select', 'uniform'); // longer array
      await setInputValue(page, '#search-key-input', '35'); // likely present

      // Start search
      await page.click('#start-search-btn');

      // Set faster speed to allow test to progress quickly
      await page.fill('#speed-range', '200');
      // Trigger input event to ensure internal autoStepSpeed updated
      await page.dispatchEvent('#speed-range', 'input');

      // Kick off run to end
      await page.click('#run-to-end-btn');

      // Wait a small moment to let auto-run start
      await page.waitForTimeout(150);

      // Pause while running
      await page.click('#pause-btn');

      // State info should include (Paused)
      let stateInfo = await getText(page, '#state-info');
      expect(stateInfo).toContain('(Paused)');

      // Resume by clicking pause/resume button again
      await page.click('#pause-btn');

      // After resume, the '(Paused)' suffix should be removed eventually
      // wait briefly to allow replacement
      await page.waitForTimeout(80);
      stateInfo = await getText(page, '#state-info');
      expect(stateInfo.includes('(Paused)')).toBe(false);

      expect(pageErrors.length).toBe(0);
    }, { timeout: 10000 });
  });

  test.describe('Reset and exports/imports', () => {
    test('Reset All returns UI to Idle (S2 -> S0_Idle)', async ({ page }) => {
      // Load array and start a search
      await page.selectOption('#example-select', 'basic');
      await setInputValue(page, '#search-key-input', '50');
      await page.click('#start-search-btn');

      // Ensure search started
      expect((await getText(page, '#state-info')).toLowerCase()).toContain('search started');

      // Click reset
      await page.click('#reset-btn');

      // Validate UI back to initial idle state
      expect(await getText(page, '#state-info')).toBe('Status: Not started');
      expect(await page.locator('#start-search-btn').isDisabled()).toBe(true);
      expect(await page.locator('#parse-array-btn').isDisabled()).toBe(false);

      expect(pageErrors.length).toBe(0);
    });

    test('Export state triggers blob download logic (no exception thrown)', async ({ page }) => {
      // Load example and start search so export buttons become enabled
      await page.selectOption('#example-select', 'basic');
      await setInputValue(page, '#search-key-input', '20');
      await page.click('#start-search-btn');

      // export-state-btn should be enabled
      expect(await page.locator('#export-state-btn').isDisabled()).toBe(false);

      // Click export-state; since it uses anchor click and URL.createObjectURL,
      // ensure no exceptions are thrown (caught via page errors)
      await page.click('#export-state-btn');

      // Click export-log too
      await page.click('#export-log-btn');

      expect(pageErrors.length).toBe(0);
    });

    test('Import state loads provided JSON and updates UI', async ({ page }) => {
      // Construct a valid import state JSON payload
      const importState = {
        array: [1, 2, 3, 4, 5, 10, 20],
        searchKey: 3,
        steps: [
          {
            low: 0,
            high: 6,
            pos: 2,
            valLow: 1,
            valHigh: 20,
            valPos: 3,
            compareResult: 0,
            explanation: 'mock'
          }
        ],
        currentStepIndex: 0
      };
      const payload = JSON.stringify(importState, null, 2);

      // Set file to import-file-input. setInputFiles triggers change event.
      await page.setInputFiles('#import-file-input', {
        name: 'import_state.json',
        mimeType: 'application/json',
        buffer: Buffer.from(payload)
      });

      // The change handler reads file and updates UI. Wait shortly for processing.
      await page.waitForTimeout(100);

      // After import, UI should show array loaded from import
      const arrayDisplay = await getText(page, '#array-display');
      expect(arrayDisplay).toContain('Array loaded from import. Length: 7');

      // searchKeyInput should reflect searchKey
      const keyVal = await page.locator('#search-key-input').inputValue();
      expect(keyVal).toBe('3');

      // stateInfo should have been applied based on applyStep
      const stateInfo = await getText(page, '#state-info');
      expect(stateInfo).toContain('Step 1/1');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Auto-generation and auto-fill UI', () => {
    test('Auto-fill checkbox toggles auto-gen settings and generates array', async ({ page }) => {
      // Click auto-fill checkbox to enable auto-gen controls
      await page.click('#auto-fill-checkbox');

      // auto-gen settings should be visible (style.display !== 'none')
      const styleDisplay = await page.locator('#auto-gen-settings').evaluate(el => el.style.display);
      expect(styleDisplay === '' || styleDisplay === 'block' || styleDisplay === 'inline').toBeTruthy();

      // Ensure array input gets disabled
      expect(await page.locator('#array-input').isDisabled()).toBe(true);

      // Click generate array
      await page.click('#auto-gen-btn');

      // After generation, arrayDisplay should contain "Auto-generated array"
      const arrDisp = await getText(page, '#array-display');
      expect(arrDisp).toContain('Auto-generated array');

      // Start search button should be enabled after generation
      expect(await page.locator('#start-search-btn').isDisabled()).toBe(false);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and UI robustness', () => {
    test('Attempting to start search with invalid key shows error', async ({ page }) => {
      await page.selectOption('#example-select', 'basic');

      // Leave search key empty then click start
      await setInputValue(page, '#search-key-input', '');
      await page.click('#start-search-btn');

      // Should show invalid key message
      const keyError = await getText(page, '#search-key-error');
      expect(keyError).toContain('Invalid search key');

      expect(pageErrors.length).toBe(0);
    });

    test('Backwards stepping works when available', async ({ page }) => {
      await page.selectOption('#example-select', 'basic');
      await setInputValue(page, '#search-key-input', '30');
      await page.click('#start-search-btn');

      // Step forward twice (if available)
      if (!(await page.locator('#step-forward-btn').isDisabled())) {
        await page.click('#step-forward-btn');
        await page.waitForTimeout(20);
      }
      if (!(await page.locator('#step-forward-btn').isDisabled())) {
        await page.click('#step-forward-btn');
        await page.waitForTimeout(20);
      }

      // Now try stepping backward
      if (!(await page.locator('#step-backward-btn').isDisabled())) {
        await page.click('#step-backward-btn');
        // Validate stateInfo changed (not strictly deterministic text, but no error)
        const stateInfo = await getText(page, '#state-info');
        expect(stateInfo.length).toBeGreaterThan(0);
      }

      expect(pageErrors.length).toBe(0);
    });
  });

  // After all tests, ensure no unexpected exceptions leaked to page error handler
  test.afterEach(async () => {
    // This afterEach runs in test context, but pageErrors is asserted inside each test too.
    // We keep this here as an extra fail-safe: ensure pageErrors remains empty after each test's completion.
    // (If a test expected errors to be present, that test would assert accordingly.)
    expect(pageErrors.length).toBe(0);
  });
});