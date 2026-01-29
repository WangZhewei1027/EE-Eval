import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d8a8e1-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('P vs NP — Interactive Demonstration (d3d8a8e1-fa73-11f0-83e0-8d7be1d51901)', () => {
  // Shared arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages (info/warn/error) and page errors (uncaught exceptions)
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore inspection errors
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // The page's script triggers some clicks during load (show-example, gen-graph).
    // Wait a short time for initial UI wiring and initial actions to complete.
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({ page }) => {
    // At the end of each test, attach console and page error info to the output
    // so broken runs can be diagnosed. We still assert expected conditions in tests below.
    if (pageErrors.length > 0) {
      // Log the errors to the test trace / output for debug
      // (Do not modify runtime; just surface them)
      // eslint-disable-next-line no-console
      console.error('Captured page errors:', pageErrors);
    }
    if (consoleMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages (count=' + consoleMessages.length + '):', consoleMessages.slice(0, 10));
    }
  });

  test('Initial page loads with expected title and no uncaught errors', async ({ page }) => {
    // Validate page title and main heading presence
    await expect(page).toHaveTitle(/P vs NP/i);
    const heading = page.locator('h1');
    await expect(heading).toHaveText(/P vs NP — Interactive Demonstration/);

    // Ensure no uncaught JS exceptions were triggered during load
    expect(pageErrors.length, 'No uncaught page errors on load').toBe(0);
  });

  test.describe('SAT demo interactions', () => {
    test('Generate random SAT populates CNF textarea (S1_SAT_Generated)', async ({ page }) => {
      // Click generate-sat and confirm CNF textarea is populated with multiple clauses
      const generateBtn = page.locator('#generate-sat');
      const cnfTA = page.locator('#cnf');

      await generateBtn.click();
      await expect(cnfTA).not.toHaveText('', { timeout: 2000 });

      // Ensure there is at least one clause line
      const cnfValue = await cnfTA.inputValue();
      const lines = cnfValue.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      expect(lines.length, 'generate-sat produced at least one clause').toBeGreaterThan(0);

      // No uncaught errors during generation
      expect(pageErrors.length).toBe(0);
    });

    test('Verify assignment shows incomplete message when assignment is partial (S2_SAT_Verified)', async ({ page }) => {
      // Ensure example is loaded (the page auto-clicks show-example on load, but click again to be explicit)
      await page.locator('#show-example').click();
      const cnfTA1 = page.locator('#cnf');
      await expect(cnfTA).not.toHaveText('', { timeout: 1000 });

      // Provide an incomplete assignment and verify the verifier reports 'assignment is incomplete'
      const assignmentInput = page.locator('#assignment');
      const verifyBtn = page.locator('#verify-assignment');
      const satOutput = page.locator('#sat-output');

      await assignmentInput.fill('x1=1'); // deliberately incomplete
      await verifyBtn.click();

      await expect(satOutput).toContainText('Not a satisfying assignment', { timeout: 1000 });
      await expect(satOutput).toContainText('assignment is incomplete', { timeout: 1000 });

      expect(pageErrors.length).toBe(0);
    });

    test('Brute-force SAT finds or exhausts search; respects empty formula edge case (S3_SAT_BruteForce_Solving)', async ({ page }) => {
      const bruteforceBtn = page.locator('#bruteforce-solve');
      const cnfTA2 = page.locator('#cnf');
      const satOutput1 = page.locator('#sat-output');
      const satProgress = page.locator('#sat-progress');

      // 1) Edge case: empty CNF should result in "No clauses found."
      await cnfTA.fill('');
      await bruteforceBtn.click();
      await expect(satOutput).toContainText('No clauses found', { timeout: 1000 });

      // 2) Normal flow: load example CNF and run brute-force until it reports found/exhausted
      await page.locator('#show-example').click();
      await expect(cnfTA).not.toHaveText('', { timeout: 1000 });

      // Start brute-force search
      await bruteforceBtn.click();

      // Wait for either a satisfying assignment or an exhaustive failure message
      await page.waitForFunction(() => {
        const out = document.getElementById('sat-output');
        if (!out) return false;
        const txt = out.textContent || '';
        return txt.includes('Satisfying assignment found') || txt.includes('No satisfying assignment') || txt.includes('Cancelled');
      }, { timeout: 5000 });

      const outputText = await satOutput.textContent();
      expect(outputText, 'brute-force produced either found or not found message').toMatch(/Satisfying assignment found|No satisfying assignment|Cancelled/);

      // When finished, progress bar should be non-empty (likely 100% on finish)
      const progressWidth = await page.evaluate(el => (el.style && el.style.width) ? el.style.width : window.getComputedStyle(el).width, satProgress);
      expect(progressWidth.length).toBeGreaterThan(0);

      expect(pageErrors.length).toBe(0);
    });

    test('Backtracking (DPLL-like) solver runs and produces a result (S4_SAT_Backtracking_Solving)', async ({ page }) => {
      const dpllBtn = page.locator('#dpll-solve');
      const cnfTA3 = page.locator('#cnf');
      const satOutput2 = page.locator('#sat-output');
      const satProgress1 = page.locator('#sat-progress');

      // Ensure example CNF is present
      await page.locator('#show-example').click();
      await expect(cnfTA).not.toHaveText('', { timeout: 1000 });

      // Run DPLL/backtracking solver
      await dpllBtn.click();

      // Wait for outcome: solution found or proved UNSAT
      await page.waitForFunction(() => {
        const out1 = document.getElementById('sat-output');
        if (!out) return false;
        const txt1 = out.textContent || '';
        return txt.includes('Solution found') || txt.includes('Proved UNSAT') || txt.includes('Proved UNSAT'.toLowerCase()) || txt.includes('UNSAT') || txt.includes('Solution found') || txt.includes('Cancelled');
      }, { timeout: 5000 });

      const outText = await satOutput.textContent();
      expect(outText, 'DPLL produced a meaningful message').toMatch(/Solution found|UNSAT|Proved UNSAT|Cancelled/);

      // Progress bar should have some width set by the solver (visual feedback)
      const progWidth = await page.locator('#sat-progress').evaluate(el => el.style.width || '');
      expect(progWidth.length).toBeGreaterThan(0);

      expect(pageErrors.length).toBe(0);
    });

    test('Verify assignment after finding solution: copy from solver output into verifier (transition S1->S2)', async ({ page }) => {
      // Run brute-force to find an assignment, then verify using the assignment verifier
      const bruteforceBtn1 = page.locator('#bruteforce-solve');
      const verifyBtn1 = page.locator('#verify-assignment');
      const satOutput3 = page.locator('#sat-output');
      const assignmentInput1 = page.locator('#assignment');

      // Ensure example is present
      await page.locator('#show-example').click();

      // Start brute-force
      await bruteforceBtn.click();

      // Wait until a satisfying assignment is found
      await page.waitForFunction(() => {
        const out2 = document.getElementById('sat-output');
        if (!out) return false;
        return out.textContent && out.textContent.includes('Satisfying assignment found');
      }, { timeout: 5000 });

      const outputHtml = await satOutput.innerHTML();
      // Extract the assignment from the pre block inside output (format: x1=1, x2=0, ...)
      const match = outputHtml.match(/<pre>([\s\S]*?)<\/pre>/);
      expect(match, 'found assignment pre block in solver output').not.toBeNull();
      const assignmentText = match ? match[1].trim().replace(/\s+/g, ' ') : '';
      expect(assignmentText.length, 'assignment text non-empty').toBeGreaterThan(0);

      // Paste into assignment input (the verifier expects comma-separated like x1=1,x2=0,...)
      const normalized = assignmentText.replace(/\s+/g, '').replace(/,+/g, ',').replace(/,\s*$/,'');
      await assignmentInput.fill(normalized);
      await verifyBtn.click();

      // Expect verifier to confirm
      await expect(satOutput).toContainText('Assignment satisfies formula', { timeout: 2000 });

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Subset Sum interactions', () => {
    test('Generate numbers populates inputs (S5_SubsetSum_Generated)', async ({ page }) => {
      const genSub = page.locator('#gen-sub');
      const subArr = page.locator('#sub-arr');
      const subTarget = page.locator('#sub-target');

      await genSub.click();

      const arrVal = await subArr.inputValue();
      expect(arrVal.length).toBeGreaterThan(0);

      const targetVal = await subTarget.inputValue();
      expect(targetVal.length).toBeGreaterThan(0);

      expect(pageErrors.length).toBe(0);
    });

    test('Subset brute-force solver finds subset when present and handles empty input gracefully (S6_SubsetSum_BruteForce_Solving)', async ({ page }) => {
      const bruteBtn = page.locator('#solve-sub-brute');
      const subArr1 = page.locator('#sub-arr');
      const subTarget1 = page.locator('#sub-target');
      const subOut = page.locator('#sub-output');
      const subProgress = page.locator('#sub-progress');

      // Edge case: no numbers provided
      await subArr.fill('');
      await bruteBtn.click();
      await expect(subOut).toContainText('No numbers provided', { timeout: 1000 });

      // Normal: small instance with a provable subset
      await subArr.fill('1,2,3');
      await subTarget.fill('6');
      await bruteBtn.click();

      // Wait for either a found subset or a "No subset" message
      await page.waitForFunction(() => {
        const o = document.getElementById('sub-output');
        if (!o) return false;
        const t = o.textContent || '';
        return t.includes('Subset found') || t.includes('No subset') || t.includes('Cancelled');
      }, { timeout: 5000 });

      const outText1 = await subOut.textContent();
      expect(outText).toMatch(/Subset found|No subset|Cancelled/);

      // Progress bar should have been updated (non-empty)
      const prog = await subProgress.evaluate(el => el.style.width || '');
      expect(prog.length).toBeGreaterThan(0);

      expect(pageErrors.length).toBe(0);
    });

    test('Subset DP solver finds or reports no subset (S7_SubsetSum_DP_Solving)', async ({ page }) => {
      const dpBtn = page.locator('#solve-sub-dp');
      const subArr2 = page.locator('#sub-arr');
      const subTarget2 = page.locator('#sub-target');
      const subOut1 = page.locator('#sub-output');
      const subProgress1 = page.locator('#sub-progress');

      // Provide a small instance where DP can find subset: [2,4,6], T=6
      await subArr.fill('2,4,6');
      await subTarget.fill('6');
      await dpBtn.click();

      await page.waitForFunction(() => {
        const o1 = document.getElementById('sub-output');
        if (!o) return false;
        const t1 = o.textContent || '';
        return t.includes('DP found subset') || t.includes('No subset sums to target');
      }, { timeout: 2000 });

      const outText2 = await subOut.textContent();
      expect(outText).toMatch(/DP found subset|No subset sums to target/);

      // DP always sets progress to 100% visually in this implementation
      const prog1 = await subProgress.evaluate(el => el.style.width || '');
      expect(prog).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Graph / BFS interactions', () => {
    test('Generate graph produces a description and Run BFS returns a path or appropriate no-path message (S8_Graph_Generated -> S9_BFS_Running)', async ({ page }) => {
      const genGraph = page.locator('#gen-graph');
      const runBfs = page.locator('#run-bfs');
      const graphOutput = page.locator('#graph-output');
      const gN = page.locator('#g-n');
      const gP = page.locator('#g-p');

      // Generate a graph of modest size
      await gN.fill('10');
      await gP.fill('0.3');
      await genGraph.click();

      await expect(graphOutput).toContainText('Generated graph', { timeout: 1000 });

      // Run BFS - should either find a path or report no path; either is acceptable
      await runBfs.click();

      await page.waitForFunction(() => {
        const out3 = document.getElementById('graph-output');
        if (!out) return false;
        const t2 = out.textContent || '';
        return t.includes('Path found') || t.includes('No path from') || t.includes('No path');
      }, { timeout: 2000 });

      const outText3 = await graphOutput.textContent();
      expect(outText).toMatch(/Path found|No path from|No path/);

      expect(pageErrors.length).toBe(0);
    });

    test('Run BFS without generating graph is handled (edge case) — note: page initializes graph on load, so reload to attempt no-graph path', async ({ page }) => {
      // Reload page to reset state
      await page.reload({ waitUntil: 'load' });

      // Immediately attempt to click run-bfs. The page's script automatically generates a graph on load
      // so we cannot reliably ensure currentGraph is null without mutating page globals.
      // Instead, we assert that clicking run-bfs produces a deterministic message or path and no runtime errors.
      await page.locator('#run-bfs').click();

      const graphOutput1 = page.locator('#graph-output');
      await page.waitForFunction(() => {
        const out4 = document.getElementById('graph-output');
        return out && (out.textContent || '').length > 0;
      }, { timeout: 2000 });

      const outText4 = await graphOutput.textContent();
      expect(outText.length).toBeGreaterThan(0);

      expect(pageErrors.length).toBe(0);
    });
  });

  test('Misc edge cases: clicking action buttons with invalid/empty inputs produces user-facing messages not runtime exceptions', async ({ page }) => {
    // Clear CNF and click DPLL; should show 'No clauses found.' and not throw
    const dpllBtn1 = page.locator('#dpll-solve');
    const cnfTA4 = page.locator('#cnf');
    const satOut = page.locator('#sat-output');

    await cnfTA.fill('');
    await dpllBtn.click();
    await expect(satOut).toContainText('No clauses found', { timeout: 1000 });

    // Clear subset arr and click DP; should show 'No numbers provided.' only for brute-force,
    // DP expects numbers and will show 'No numbers provided.' by checking length==0 before running.
    const subArr3 = page.locator('#sub-arr');
    const dpBtn1 = page.locator('#solve-sub-dp');
    const subOut2 = page.locator('#sub-output');

    await subArr.fill('');
    await dpBtn.click();
    // DP path will detect arr.length===0 and show bad message
    await expect(subOut).toContainText('No numbers provided', { timeout: 1000 });

    // Ensure no uncaught JS runtime errors were recorded during these invalid interactions
    expect(pageErrors.length).toBe(0);
  });
});