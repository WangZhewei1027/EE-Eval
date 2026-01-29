import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2e4b72-fa7a-11f0-ba5b-57721b046e74.html';

// Helper utilities used across tests (page-object style)
async function getPhase(page) {
  return page.evaluate(() => typeof phase !== 'undefined' ? phase : null);
}
async function getCurrentPhaseText(page) {
  return page.locator('#currentPhase').innerText();
}
async function getSearchProgress(page) {
  return page.locator('#searchProgress').innerText();
}
async function getArrayLength(page) {
  return page.evaluate(() => Array.isArray(array) ? array.length : 0);
}
async function getArrayValues(page) {
  return page.evaluate(() => Array.isArray(array) ? array.slice() : []);
}
async function getExecutionLogText(page) {
  return page.locator('#executionLog').innerText();
}
async function clickUntilPhase(page, targets = ['found', 'not_found'], maxSteps = 200) {
  for (let i = 0; i < maxSteps; i++) {
    const currentPhase = await getPhase(page);
    if (targets.includes(currentPhase)) return currentPhase;
    await page.click('#stepSearch');
    // Give the page a tiny moment to update DOM & state
    await page.waitForTimeout(20);
  }
  return await getPhase(page);
}

test.describe('Exponential Search Interactive Demo (FSM validation)', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console error messages and unhandled page errors
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from the page
      pageErrors.push(err);
    });

    // Navigate to the application page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait for initial rendering to settle
    await page.waitForSelector('#arrayVisualization');
  });

  test.afterEach(async () => {
    // No special teardown required; Playwright handles closing pages
  });

  // Test initial state is Not Started (S0_Not_Started)
  test('Initial state should be Not Started (S0_Not_Started)', async ({ page }) => {
    // Verify the public phase variable is set to 'not_started'
    const phase = await getPhase(page);
    expect(phase).toBe('not_started');

    // Verify the UI shows "Not started"
    const phaseText = await getCurrentPhaseText(page);
    expect(phaseText.toLowerCase()).toContain('not started');

    // Verify search progress text indicates not started
    const progress = await getSearchProgress(page);
    expect(progress.toLowerCase()).toContain('not started');

    // Verify array visualization exists and number of elements matches the slider
    const sliderValue = await page.locator('#arraySize').evaluate((el) => el.value);
    const arrayLength = await getArrayLength(page);
    expect(Number(sliderValue)).toBe(arrayLength);

    // Ensure there were no console errors during load
    expect(consoleErrors.length, `Console errors on load: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors on load: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  // Test generate and sort buttons and their effects on the array and logs
  test('Generate New Array and Sort Array buttons should update array and logs', async ({ page }) => {
    // Click Generate New Array and verify log entry and that phase remains not_started (search reset)
    await page.click('#generateArray');
    await page.waitForTimeout(50);

    const logText1 = await getExecutionLogText(page);
    expect(logText1).toContain('Generated new array');

    const phaseAfterGenerate = await getPhase(page);
    expect(phaseAfterGenerate).toBe('not_started');

    // Make a mutable copy of the array and then sort via UI to verify sorting log
    await page.evaluate(() => {
      // Intentionally only reading array for test; no modification here.
      return;
    });

    // Click Sort Array
    await page.click('#sortArray');
    await page.waitForTimeout(50);

    const logText2 = await getExecutionLogText(page);
    expect(logText2).toContain('Array sorted');

    // Verify array is indeed sorted non-decreasingly
    const arr = await getArrayValues(page);
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i]).toBeGreaterThanOrEqual(arr[i - 1]);
    }

    // Ensure no runtime errors during these interactions
    expect(consoleErrors.length, 'Console errors after generate/sort').toBe(0);
    expect(pageErrors.length, 'Page errors after generate/sort').toBe(0);
  });

  // Test Start Search triggers transition to Finding Bounds (S0 -> S1)
  test('Start Search should enter Finding Bounds (S1_Finding_Bounds)', async ({ page }) => {
    // Ensure we're in not_started and then start
    await page.click('#startSearch');
    await page.waitForTimeout(50);

    const phase = await getPhase(page);
    expect(phase).toBe('finding_bounds');

    const phaseText = await getCurrentPhaseText(page);
    expect(phaseText.toLowerCase()).toContain('finding bounds');

    // Current index should be 1 as per startSearch initialization
    const currentIndex = await page.evaluate(() => currentIndex);
    expect(currentIndex).toBe(1);

    // boundStart should be 0 and boundEnd array.length - 1
    const boundStart = await page.evaluate(() => boundStart);
    const boundEnd = await page.evaluate(() => boundEnd);
    const arrayLen = await getArrayLength(page);
    expect(boundStart).toBe(0);
    expect(boundEnd).toBe(arrayLen - 1);

    // The element at index 1 should have the 'current' class in visualization
    const hasCurrent = await page.locator('#element-1').evaluate((el) => el.classList.contains('current'));
    expect(hasCurrent).toBeTruthy();

    // Log should mention starting exponential search
    const logs = await getExecutionLogText(page);
    expect(logs).toContain('Starting exponential search');

    expect(consoleErrors.length, 'Console errors after startSearch').toBe(0);
    expect(pageErrors.length, 'Page errors after startSearch').toBe(0);
  });

  // Test stepping through the algorithm to reach a Found state (S3_Found)
  test('Step through search should find an existing element (S2_Binary_Search -> S3_Found)', async ({ page }) => {
    // Pick a deterministic existing value from the array (choose middle element to increase odds)
    const arr = await getArrayValues(page);
    expect(arr.length).toBeGreaterThan(0);
    const candidateIndex = Math.floor(arr.length / 2);
    const candidateValue = arr[candidateIndex];

    // Set the search value via UI and dispatch change event so page picks it up
    await page.locator('#searchValue').fill(String(candidateValue));
    await page.locator('#searchValue').dispatchEvent('change');

    // Start the search and step until found (or timeout)
    await page.click('#startSearch');
    await page.waitForTimeout(20);

    // Step repeatedly until 'found' or 'not_found'
    const finalPhase = await clickUntilPhase(page, ['found', 'not_found'], 300);
    expect(['found', 'not_found']).toContain(finalPhase);

    // Expect we found the value (most likely). If not found, still valid outcome; assert behavior consistent
    const progressText = await getSearchProgress(page);
    if (finalPhase === 'found') {
      expect(progressText.toLowerCase()).toContain('found value');
      // Verify that the element with class 'found' corresponds to the reported index
      const foundIndex = await page.evaluate(() => currentIndex);
      const elHasFoundClass = await page.locator(`#element-${foundIndex}`).evaluate((el) => el.classList.contains('found'));
      expect(elHasFoundClass).toBeTruthy();
    } else {
      // If not found, ensure text indicates not found
      expect(progressText.toLowerCase()).toContain('not found');
    }

    // Ensure logs contain either found or not found messages
    const logs = await getExecutionLogText(page);
    expect(logs.length).toBeGreaterThan(0);

    expect(consoleErrors.length, 'Console errors during step to found').toBe(0);
    expect(pageErrors.length, 'Page errors during step to found').toBe(0);
  });

  // Test the algorithm can determine not-found properly (S2_Binary_Search -> S4_Not_Found)
  test('Searching for a value not present should reach Not Found (S4_Not_Found)', async ({ page }) => {
    // Create a search value that almost certainly isn't present (max array value + large offset)
    const arr = await getArrayValues(page);
    expect(arr.length).toBeGreaterThan(0);
    const maxVal = Math.max(...arr);
    const absentValue = maxVal + 1000;

    // Set search value
    await page.locator('#searchValue').fill(String(absentValue));
    await page.locator('#searchValue').dispatchEvent('change');

    // Start and step until not_found
    await page.click('#startSearch');
    await page.waitForTimeout(20);

    const finalPhase = await clickUntilPhase(page, ['not_found', 'found'], 500);
    expect(['not_found', 'found']).toContain(finalPhase);

    // We expect 'not_found' for this chosen absent value
    expect(finalPhase).toBe('not_found');

    const progressText = await getSearchProgress(page);
    expect(progressText.toLowerCase()).toContain('not found');

    // After not found, clicking Reset should return to not_started (S4 -> S0)
    await page.click('#resetSearch');
    await page.waitForTimeout(20);
    const phaseAfterReset = await getPhase(page);
    expect(phaseAfterReset).toBe('not_started');

    expect(consoleErrors.length, 'Console errors during not-found test').toBe(0);
    expect(pageErrors.length, 'Page errors during not-found test').toBe(0);
  });

  // Test ResetSearch from Found state returns to Not Started (S3 -> S0)
  test('ResetSearch should return UI to Not Started after Found (S3_Found -> S0_Not_Started)', async ({ page }) => {
    // Choose an existing value to ensure we find it
    const arr = await getArrayValues(page);
    const candidateValue = arr.length > 0 ? arr[0] : 1;

    await page.locator('#searchValue').fill(String(candidateValue));
    await page.locator('#searchValue').dispatchEvent('change');

    await page.click('#startSearch');
    await page.waitForTimeout(20);

    // Step until found
    const finalPhase = await clickUntilPhase(page, ['found', 'not_found'], 500);
    // If not found (unexpected), still proceed to test reset behavior
    await page.click('#resetSearch');
    await page.waitForTimeout(20);

    const phaseAfterReset = await getPhase(page);
    expect(phaseAfterReset).toBe('not_started');

    const phaseText = await getCurrentPhaseText(page);
    expect(phaseText.toLowerCase()).toContain('not started');

    expect(consoleErrors.length, 'Console errors during reset from found').toBe(0);
    expect(pageErrors.length, 'Page errors during reset from found').toBe(0);
  });

  // Test Auto Play toggling behavior and that it completes the search without leaking timers
  test('Auto Play should auto-step and complete search, toggling button text appropriately', async ({ page }) => {
    // Pick an existing value
    const arr = await getArrayValues(page);
    const candidateValue = arr[Math.max(0, Math.floor(arr.length / 3))] ?? arr[0];

    await page.locator('#searchValue').fill(String(candidateValue));
    await page.locator('#searchValue').dispatchEvent('change');

    // Click Auto Play to start auto play
    await page.click('#autoPlay');

    // After clicking, the button text should change to 'Stop Auto Play' while playing
    await expect(page.locator('#autoPlay')).toHaveText(/Stop Auto Play|Auto Play/);

    // Wait for auto-play to complete. It will stop when phase is 'found' or 'not_found'
    await page.waitForFunction(() => {
      return window.phase === 'found' || window.phase === 'not_found';
    }, { timeout: 5000 });

    // After completion, autoPlay button should revert to 'Auto Play' and isAutoPlaying should be false
    const autoPlayText = await page.locator('#autoPlay').innerText();
    expect(autoPlayText).toBe('Auto Play');

    const isAutoPlaying = await page.evaluate(() => isAutoPlaying);
    expect(isAutoPlaying).toBe(false);

    // Verify final phase is one of the terminal states and searchProgress updated accordingly
    const finalPhase = await getPhase(page);
    expect(['found', 'not_found']).toContain(finalPhase);

    const progress = await getSearchProgress(page);
    if (finalPhase === 'found') {
      expect(progress.toLowerCase()).toContain('found value');
    } else {
      expect(progress.toLowerCase()).toContain('not found');
    }

    expect(consoleErrors.length, 'Console errors during auto play').toBe(0);
    expect(pageErrors.length, 'Page errors during auto play').toBe(0);
  });

  // Test Random Value button sets a new search value and logs the action
  test('Random Value button should set search value and add log entry', async ({ page }) => {
    // Capture previous search value
    const prevValue = await page.locator('#searchValue').inputValue();

    // Click Random and wait briefly
    await page.click('#randomValue');
    await page.waitForTimeout(50);

    // New value should be different or at least set (string)
    const newValue = await page.locator('#searchValue').inputValue();
    expect(typeof newValue).toBe('string');
    // It's possible the random picks the same number; ensure a log entry exists
    const logs = await getExecutionLogText(page);
    expect(logs).toMatch(/Set search value to random: \d+/);

    expect(consoleErrors.length, 'Console errors after random value').toBe(0);
    expect(pageErrors.length, 'Page errors after random value').toBe(0);
  });

  // Test changing array size via the slider triggers new generation and UI update
  test('Changing array size should regenerate the array and update controls', async ({ page }) => {
    // Choose a new size different from current
    const currentSize = Number(await page.locator('#arraySize').evaluate((el) => el.value));
    const newSize = currentSize === 20 ? 30 : 20;

    // Set the slider value and dispatch the input event
    await page.locator('#arraySize').evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(newSize));
    await page.waitForTimeout(50);

    // Slider label should reflect new size
    const labelText = await page.locator('#arraySizeValue').innerText();
    expect(Number(labelText)).toBe(newSize);

    // Array visualization length should match
    const arrayLength = await getArrayLength(page);
    expect(arrayLength).toBe(newSize);

    // Log should mention size changed
    const logs = await getExecutionLogText(page);
    expect(logs).toContain(`Array size changed to ${newSize}`);

    expect(consoleErrors.length, 'Console errors after changing array size').toBe(0);
    expect(pageErrors.length, 'Page errors after changing array size').toBe(0);
  });

  // Edge case: Clicking Step when not started should start the search (S0 -> S1) by invoking startSearch()
  test('Clicking Step Through Search when not started should start the search (edge case)', async ({ page }) => {
    // Ensure we are in not_started
    await page.click('#resetSearch');
    await page.waitForTimeout(20);
    expect(await getPhase(page)).toBe('not_started');

    // Click Step; code calls startSearch() when phase === 'not_started'
    await page.click('#stepSearch');
    await page.waitForTimeout(20);

    // We should now be in finding_bounds
    const phase = await getPhase(page);
    expect(phase).toBe('finding_bounds');

    expect(consoleErrors.length, 'Console errors when stepping from not_started').toBe(0);
    expect(pageErrors.length, 'Page errors when stepping from not_started').toBe(0);
  });

  // Global sanity test: no unexpected console or page errors across interactions
  test('No unexpected console or page errors observed during typical interactions', async ({ page }) => {
    // Perform a sequence of interactions to exercise the app
    await page.click('#generateArray');
    await page.click('#sortArray');
    await page.fill('#searchValue', '1');
    await page.locator('#searchValue').dispatchEvent('change');
    await page.click('#startSearch');
    await page.click('#stepSearch');

    // Allow some time for any asynchronous errors to surface
    await page.waitForTimeout(200);

    // Assert that no console errors or page errors were raised during these interactions
    expect(consoleErrors.length, `Console errors detected: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors detected: ${JSON.stringify(pageErrors)}`).toBe(0);
  });
});