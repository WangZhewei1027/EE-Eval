import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b1ea81-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Helper to parse ranks from the table into an object { A: 0.2, ... }
async function getRanksFromTable(page) {
  return await page.$$eval('#rankTable tbody tr', (rows) => {
    const out = {};
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const name = cells[0].textContent.trim();
        const rankText = cells[1].textContent.trim();
        out[name] = parseFloat(rankText);
      }
    }
    return out;
  });
}

// Helper to compute if all values in object are equal (within epsilon)
function allValuesEqual(obj, epsilon = 1e-9) {
  const vals = Object.values(obj);
  if (vals.length === 0) return true;
  return vals.every((v) => Math.abs(v - vals[0]) <= epsilon);
}

test.describe('PageRank Demonstration - FSM and UI integration tests', () => {
  // Collect console messages and page errors for each test to assert later
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for the main elements to be present
    await Promise.all([
      page.waitForSelector('#svgGraph'),
      page.waitForSelector('#rankTable tbody'),
      page.waitForSelector('#stepBtn'),
      page.waitForSelector('#autoBtn'),
      page.waitForSelector('#resetBtn'),
      page.waitForSelector('#damping'),
      page.waitForSelector('#dampingValue'),
      page.waitForSelector('#iterationsCount'),
    ]);
  });

  test.afterEach(async () => {
    // After each test we ensure no uncaught page errors occurred during the run.
    // This validates that any ReferenceError/SyntaxError/TypeError would surface and be captured.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e && e.message).join('; ')}`).toBe(0);
  });

  test('Initial Idle state: drawGraph() and resetRanks() on load', async ({ page }) => {
    // This test validates the S0_Idle entry actions: drawGraph() and resetRanks()

    // Check damping default shown
    const dampingText = await page.$eval('#dampingValue', (el) => el.textContent.trim());
    expect(dampingText).toBe('0.85');

    // Iteration count should be zero
    const iterCount = await page.$eval('#iterationsCount', (el) => el.textContent.trim());
    expect(iterCount).toBe('0');

    // Rank table should have 5 rows (one per page)
    const rows = await page.$$eval('#rankTable tbody tr', (r) => r.length);
    expect(rows).toBe(5);

    // All ranks should be equal to 1/N = 0.2 initially (within tolerance)
    const ranks = await getRanksFromTable(page);
    expect(Object.keys(ranks).length).toBe(5);
    expect(allValuesEqual(ranks, 1e-6)).toBeTruthy();
    // Check numeric equality approximately
    for (const v of Object.values(ranks)) {
      expect(v).toBeCloseTo(1 / 5, 4);
    }

    // Graph should have node elements for each page (visual evidence of drawGraph)
    const nodeCount = await page.$$eval('.node', (nodes) => nodes.length);
    expect(nodeCount).toBe(5);

    // Buttons should be present and initial labels expected
    const stepText = await page.$eval('#stepBtn', (b) => b.textContent.trim());
    expect(stepText).toContain('Iterate');
    const autoText = await page.$eval('#autoBtn', (b) => b.textContent.trim());
    expect(autoText).toContain('Auto');

    // Ensure no console errors were produced during initialization
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('StepClick transitions to Iterating and updates ranks and iteration count', async ({ page }) => {
    // This test validates the S0_Idle -> S1_Iterating transition triggered by #stepBtn click.

    // Get initial ranks snapshot
    const initialRanks = await getRanksFromTable(page);

    // Click step button once
    await page.click('#stepBtn');

    // iteration count should be 1
    await page.waitForFunction(() => document.getElementById('iterationsCount').textContent.trim() === '1', null, { timeout: 2000 });
    const iterCount = await page.$eval('#iterationsCount', (el) => el.textContent.trim());
    expect(iterCount).toBe('1');

    // Ranks should be updated (not all equal to initial uniform distribution)
    const newRanks = await getRanksFromTable(page);
    // There must be at least one page with a different rank than initial
    const allSame = Object.keys(initialRanks).every((k) => Math.abs(initialRanks[k] - newRanks[k]) < 1e-9);
    expect(allSame).toBeFalsy();

    // Click step a second time and verify iterations increment
    await page.click('#stepBtn');
    await page.waitForFunction(() => document.getElementById('iterationsCount').textContent.trim() === '2', null, { timeout: 2000 });
    const iterCount2 = await page.$eval('#iterationsCount', (el) => el.textContent.trim());
    expect(iterCount2).toBe('2');
  });

  test('AutoClick starts auto iterations and toggles back to idle on second click', async ({ page }) => {
    // This test validates S0_Idle -> S2_AutoIterating on first #autoBtn click
    // and S2_AutoIterating -> S0_Idle when clicking again.

    // Start auto
    await page.click('#autoBtn');

    // auto button text should change to indicate "Stop"
    await page.waitForFunction(() => document.getElementById('autoBtn').textContent.includes('Stop') || document.getElementById('autoBtn').textContent.includes('Stop'), null, { timeout: 1000 });
    const autoTextAfterStart = await page.$eval('#autoBtn', (b) => b.textContent.trim());
    expect(autoTextAfterStart).toContain('Stop');

    // Step button should be disabled while auto is running
    const stepDisabledWhileAuto = await page.$eval('#stepBtn', (b) => b.disabled);
    expect(stepDisabledWhileAuto).toBeTruthy();

    // Wait for at least one automatic iteration to occur.
    // AUTO_INTERVAL_MS in app is 1500ms, so wait slightly longer than that.
    await page.waitForTimeout(1800);

    const iterCountAfterAuto = await page.$eval('#iterationsCount', (el) => parseInt(el.textContent.trim(), 10));
    expect(iterCountAfterAuto).toBeGreaterThanOrEqual(1);

    // Stop auto by clicking again
    await page.click('#autoBtn');

    // auto button text should revert and step enabled
    await page.waitForFunction(() => document.getElementById('autoBtn').textContent.includes('Auto') && !document.getElementById('stepBtn').disabled, null, { timeout: 1000 });
    const autoTextAfterStop = await page.$eval('#autoBtn', (b) => b.textContent.trim());
    expect(autoTextAfterStop).toContain('Auto');

    const stepDisabledAfterStop = await page.$eval('#stepBtn', (b) => b.disabled);
    expect(stepDisabledAfterStop).toBeFalsy();
  });

  test('ResetClick resets ranks and iteration count; also stops auto if running', async ({ page }) => {
    // Start auto
    await page.click('#autoBtn');
    await page.waitForTimeout(500); // small wait for state to change

    // Ensure auto started
    const autoStarted = await page.$eval('#autoBtn', (b) => b.textContent.includes('Stop'));
    expect(autoStarted).toBeTruthy();

    // Click reset while auto is running (edge: should stop auto and reset)
    await page.click('#resetBtn');

    // auto should be stopped and step enabled
    await page.waitForFunction(() => document.getElementById('autoBtn').textContent.includes('Auto') && !document.getElementById('stepBtn').disabled, null, { timeout: 1000 });
    const iterAfterReset = await page.$eval('#iterationsCount', (el) => el.textContent.trim());
    expect(iterAfterReset).toBe('0');

    // Ranks should be reset to uniform distribution again
    const ranks = await getRanksFromTable(page);
    expect(allValuesEqual(ranks, 1e-9)).toBeTruthy();
    for (const v of Object.values(ranks)) {
      expect(v).toBeCloseTo(1 / 5, 4);
    }
  });

  test('DampingInput updates damping factor display and resets ranks', async ({ page }) => {
    // Change damping to 0.60 via the input element and dispatch input event
    await page.evaluate(() => {
      const slider = document.getElementById('damping');
      slider.value = '0.6';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // dampingValue should update to 0.60
    await page.waitForFunction(() => document.getElementById('dampingValue').textContent.trim() === '0.60', null, { timeout: 1000 });
    const dampingText = await page.$eval('#dampingValue', (el) => el.textContent.trim());
    expect(dampingText).toBe('0.60');

    // iteration should be reset to 0
    const iterCount = await page.$eval('#iterationsCount', (el) => el.textContent.trim());
    expect(iterCount).toBe('0');

    // ranks reset to uniform
    const ranks = await getRanksFromTable(page);
    expect(allValuesEqual(ranks, 1e-9)).toBeTruthy();
  });

  test('Edge case: setting non-numeric damping value via script does not crash page and displays NaN', async ({ page }) => {
    // This intentionally sets an invalid value to the range input to exercise error scenarios.
    // We do NOT patch or fix any page code: we simply interact with the DOM as a user/script might.

    // Set damping to an invalid string and dispatch input
    await page.evaluate(() => {
      const slider = document.getElementById('damping');
      // Force an invalid value not normally available via UI
      slider.value = 'not-a-number';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // The page's code uses parseFloat and toFixed; this should produce a visible "NaN" text but not throw
    // Wait briefly for update
    await page.waitForTimeout(200);

    const dampingText = await page.$eval('#dampingValue', (el) => el.textContent.trim());
    // toFixed on NaN results in "NaN" string; assert that page handled it without throwing
    expect(['NaN', 'NaN']).toContain(dampingText);

    // Ensure no uncaught exceptions were thrown at the page-level for this edge case
    // (The afterEach will assert pageErrors length is zero)
  });

  test('Rapid step clicks perform multiple iterations without DOM errors', async ({ page }) => {
    // Click the step button rapidly 3 times
    await page.click('#stepBtn');
    await page.click('#stepBtn');
    await page.click('#stepBtn');

    // Wait for the iteration count to reach 3
    await page.waitForFunction(() => parseInt(document.getElementById('iterationsCount').textContent.trim(), 10) >= 3, null, { timeout: 2000 });
    const iterCount = await page.$eval('#iterationsCount', (el) => parseInt(el.textContent.trim(), 10));
    expect(iterCount).toBeGreaterThanOrEqual(3);

    // Verify ranks table still has 5 rows and valid numbers
    const rows = await page.$$eval('#rankTable tbody tr', (r) => r.length);
    expect(rows).toBe(5);
    const ranks = await getRanksFromTable(page);
    for (const v of Object.values(ranks)) {
      expect(typeof v).toBe('number');
      expect(Number.isFinite(v)).toBeTruthy();
    }

    // Ensure no console error messages occurred during rapid interactions
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Visual / Accessibility checks: nodes have aria-labels and svg has role img', async ({ page }) => {
    // Ensure svg has role=img and accessible label
    const svgRole = await page.$eval('#svgGraph', (el) => el.getAttribute('role'));
    expect(svgRole).toBe('img');
    const ariaLabel = await page.$eval('#svgGraph', (el) => el.getAttribute('aria-label'));
    expect(ariaLabel).toContain('Graph');

    // Nodes should expose aria-label for accessibility
    const nodeAriaLabels = await page.$$eval('.node', (nodes) => nodes.map((n) => n.getAttribute('aria-label')));
    expect(nodeAriaLabels.length).toBe(5);
    for (const label of nodeAriaLabels) {
      expect(label).toMatch(/^Page [A-E]$/);
    }
  });
});