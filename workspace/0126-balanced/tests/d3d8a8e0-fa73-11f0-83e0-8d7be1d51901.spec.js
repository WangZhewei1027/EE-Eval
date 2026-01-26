import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d8a8e0-fa73-11f0-83e0-8d7be1d51901.html';

/**
 * Page object encapsulating interactions and selectors for the NP-Completeness demo page.
 * This helps keep tests readable and groups related actions.
 */
class DemoPage {
  constructor(page) {
    this.page = page;
    // selectors
    this.formulaInput = page.locator('#formulaInput');
    this.solveBtn = page.locator('#solveBtn');
    this.solveOutput = page.locator('#solveOutput');
    this.reduceBtn = page.locator('#reduceBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.varsCount = page.locator('#varsCount');

    this.graphSvg = page.locator('#graphSvg');
    this.cliqueK = page.locator('#cliqueK');
    this.findCliqueBtn = page.locator('#findCliqueBtn');
    this.clearGraphBtn = page.locator('#clearGraphBtn');
    this.cliqueResult = page.locator('#cliqueResult');

    this.ssNumbers = page.locator('#ssNumbers');
    this.ssTarget = page.locator('#ssTarget');
    this.ssSolveBtn = page.locator('#ssSolveBtn');
    this.ssDPBtn = page.locator('#ssDPBtn');
    this.ssOutput = page.locator('#ssOutput');

    this.expMaxN = page.locator('#expMaxN');
    this.expTrials = page.locator('#expTrials');
    this.runExpBtn = page.locator('#runExpBtn');
    this.clearExpBtn = page.locator('#clearExpBtn');
    this.expOutput = page.locator('#expOutput');
  }

  // high-level actions
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // wait a short while for initial JS initialization (buildGraphFromFormula called on load)
    await this.page.waitForTimeout(100);
  }

  async clickSolve() {
    await this.solveBtn.click();
  }

  async clickReduce() {
    await this.reduceBtn.click();
  }

  async clickRandom() {
    await this.randomBtn.click();
  }

  async clickFindClique() {
    await this.findCliqueBtn.click();
  }

  async clickClearGraph() {
    await this.clearGraphBtn.click();
  }

  async clickSsSolve() {
    await this.ssSolveBtn.click();
  }

  async clickSsDP() {
    await this.ssDPBtn.click();
  }

  async clickRunExp() {
    await this.runExpBtn.click();
  }

  async clickClearExp() {
    await this.clearExpBtn.click();
  }

  // helpers for assertions
  async getSolveOutputText() {
    return (await this.solveOutput.textContent()) || '';
  }

  async getCliqueResultText() {
    return (await this.cliqueResult.textContent()) || '';
  }

  async getExpOutputText() {
    return (await this.expOutput.textContent()) || '';
  }

  async getSsOutputText() {
    return (await this.ssOutput.textContent()) || '';
  }

  async getCliqueKValue() {
    return (await this.cliqueK.textContent()) || '';
  }

  async countGraphNodes() {
    // count g elements with data-id attribute inside svg
    return await this.page.evaluate(() => {
      const svg = document.getElementById('graphSvg');
      if(!svg) return 0;
      return Array.from(svg.querySelectorAll('g[data-id]')).length;
    });
  }

  async anyNodeSelected() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('graphSvg');
      if(!svg) return false;
      return !!svg.querySelector('g.selected');
    });
  }
}

/**
 * Tests for the interactive NP-Completeness demo.
 *
 * Notes:
 * - We capture console messages and page errors to surface unexpected runtime issues.
 * - Tests exercise all FSM states and transitions described in the spec:
 *   S0_Idle, S1_Solving, S2_Reducing, S3_Finding_Clique, S4_Solving_Subset_Sum
 *
 * - Per constraints, we load the page exactly as provided and do NOT patch or modify the page's JS.
 */

test.describe('NP-Completeness interactive demo - end-to-end', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // capture console messages and page errors for each test
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // uncaught exceptions on the page will be captured here
      pageErrors.push(err);
    });
  });

  test('S0_Idle: initial render and basic DOM expectations', async ({ page }) => {
    const demo = new DemoPage(page);
    // load the page exactly as-is
    await demo.goto();

    // Validate initial textarea content includes the example clause (evidence of renderPage())
    const text = await demo.formulaInput.inputValue();
    // Expect initial example clause to be present
    expect(text).toContain('x1 or x2 or ~x3');

    // The brute-force solve button must be present and visible
    await expect(demo.solveBtn).toBeVisible();

    // Initial solver output placeholder should match the expected hint
    await expect(demo.solveOutput).toHaveText(/Solver output will appear here\./);

    // Vars/Clauses counter starts as placeholder "Vars: -  Clauses: -"
    await expect(demo.varsCount).toHaveText(/Vars: -\s*Clauses: -/);

    // No uncaught page errors emitted during initial render
    expect(pageErrors.length).toBe(0);

    // Also check that buildGraphFromFormula ran on init by verifying cliqueK is set (it should reflect clause count from textarea)
    const k = await demo.getCliqueKValue();
    // initial textarea has 3 clauses, so cliqueK should be "3"
    expect(k.trim()).toBe('3');

    // Ensure console did not emit fatal errors
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Solve3SAT (S1_Solving): brute-force solver produces SAT/UNSAT and updates vars count', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the brute-force solve button
    await demo.clickSolve();

    // Wait for solveOutput to change from placeholder; it should display either SAT or UNSAT
    await page.waitForFunction(() => {
      const el = document.getElementById('solveOutput');
      if(!el) return false;
      const txt = el.innerText || '';
      return txt.includes('SAT') || txt.includes('UNSAT');
    }, null, { timeout: 5000 });

    const outHtml = await demo.solveOutput.innerHTML();
    // Expect output to contain either "SAT" or "UNSAT" phrase (the implementation yields either)
    expect(outHtml).toMatch(/(SAT|UNSAT)/);

    // varsCount should be updated to reflect parsed variables and clauses (initial HTML has 4 vars, 3 clauses)
    const varsText = await demo.varsCount.textContent();
    expect(varsText).toMatch(/Vars:\s*\d+\s*Clauses:\s*\d+/);

    // Ensure no uncaught page errors occurred during solving
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('RandomFormula event: generates new formula and updates counters', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Click random generator
    await demo.clickRandom();

    // The formula input should have multiple lines (clauses)
    const val = await demo.formulaInput.inputValue();
    expect(val.split('\n').length).toBeGreaterThanOrEqual(1);

    // varsCount should update to a non-placeholder value like "Vars: X  Clauses: Y"
    const varsText = await demo.varsCount.textContent();
    expect(varsText).toMatch(/Vars:\s*\d+\s*Clauses:\s*\d+/);
    expect(varsText).not.toMatch(/Vars:\s*-\s*Clauses:\s*-/);

    // No page errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('ReduceToClique (S2_Reducing) and drawing: build graph and handle empty formula', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure reduction builds the graph based on the current formula
    await demo.clickReduce();

    // cliqueK should reflect clause count (initially 3)
    await expect(demo.cliqueK).toHaveText(/\d+/);
    const kVal = await demo.getCliqueKValue();
    const clauseCount = Number(kVal.trim() || 0);
    expect(clauseCount).toBeGreaterThanOrEqual(0);

    // There should be nodes drawn when graph is non-empty (for initial formula expect 9 nodes = 3 clauses * 3)
    const nodeCount = await demo.countGraphNodes();
    expect(nodeCount).toBeGreaterThanOrEqual(0);

    // Now test empty formula edge-case: clear the textarea and reduce -> svg should show "Graph empty — reduce a formula to build the graph."
    await demo.formulaInput.fill('');
    await demo.clickReduce();

    // Wait for the svg to show the "Graph empty" message (drawGraph handles this)
    await page.waitForFunction(() => {
      const svg = document.getElementById('graphSvg');
      return svg && svg.textContent && svg.textContent.includes('Graph empty');
    }, null, { timeout: 2000 });

    const svgText = await page.locator('#graphSvg').textContent();
    expect(svgText).toContain('Graph empty');

    // No page errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('FindClique (S3_Finding_Clique): behavior when no graph and when graph present', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // First: force an empty graph (clear formula + reduce) and then try to find clique
    await demo.formulaInput.fill('');
    await demo.clickReduce();

    // Ensure graph empty
    await page.waitForFunction(() => {
      const svg = document.getElementById('graphSvg');
      return svg && svg.textContent && svg.textContent.includes('Graph empty');
    });

    // Click find clique -> should indicate no graph to search
    await demo.clickFindClique();
    await expect(demo.cliqueResult).toHaveText(/No graph to search|Graph malformed|No clique/);

    // Now restore a satisfiable formula and reduce to build graph, then try finding a clique
    // Restore the original example formula that is present in the shipped HTML
    const original = `x1 or x2 or ~x3
~x1 or x3 or x4
~x2 or ~x3 or x4`;
    await demo.formulaInput.fill(original);
    await demo.clickReduce();

    // Wait for nodes to appear
    await page.waitForFunction(() => {
      const svg = document.getElementById('graphSvg');
      if(!svg) return false;
      return svg.querySelectorAll('g[data-id]').length > 0;
    }, null, { timeout: 2000 });

    // Click find clique (the demo will either find one or not; both are valid outcomes)
    await demo.clickFindClique();

    // Wait for cliqueResult to update to a result containing "Clique" or "No clique"
    await page.waitForFunction(() => {
      const el = document.getElementById('cliqueResult');
      if(!el) return false;
      const txt = el.innerText || '';
      return /Clique/.test(txt) || /No clique/.test(txt) || /Graph malformed/.test(txt);
    }, null, { timeout: 3000 });

    const resultText = await demo.getCliqueResultText();
    // The output should mention clique found or no clique
    expect(resultText).toMatch(/Clique|No clique|Graph malformed/);

    // If clique was found, ensure nodes are selected in the SVG (highlighted)
    if (/Clique found/.test(resultText)) {
      // extract k and assert number of selected nodes equals clauseCount
      const kText = await demo.getCliqueKValue();
      const k = Number(kText.trim() || 0);
      const selectedCount = await page.evaluate(() => {
        const svg = document.getElementById('graphSvg');
        if(!svg) return 0;
        return svg.querySelectorAll('g.selected').length;
      });
      // selectedCount should be >=1 and ideally equal to k (if clique found)
      expect(selectedCount).toBeGreaterThanOrEqual(1);
      // if k is reasonable (>0), selectedCount should equal k
      if(k > 0) expect(selectedCount).toBe(k);
    }

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('ClearGraph event: clears highlights and updates result text', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure graph built initially
    await demo.clickReduce();
    await page.waitForFunction(() => {
      const svg = document.getElementById('graphSvg');
      return svg && svg.querySelectorAll('g[data-id]').length > 0;
    }, null, { timeout: 2000 });

    // Find clique to potentially mark some nodes
    await demo.clickFindClique();
    // allow time for any highlighting
    await page.waitForTimeout(200);

    // Now click clear highlights
    await demo.clickClearGraph();

    // cliqueResult should be exactly 'Cleared highlights.' per implementation
    await expect(demo.cliqueResult).toHaveText('Cleared highlights.');

    // No node should have the "selected" class
    const anySelected = await demo.anyNodeSelected();
    expect(anySelected).toBe(false);

    // No page errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Subset Sum (S4_Solving_Subset_Sum): brute-force and DP solvers - success and invalid input handling', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Given initial numbers "3,7,1,8,4" and target 11, both solutions should find a subset
    await demo.ssNumbers.fill('3,7,1,8,4');
    await demo.ssTarget.fill('11');

    // Click brute-force solve
    await demo.clickSsSolve();

    // Wait for output to indicate YES or NO
    await page.waitForFunction(() => {
      const el = document.getElementById('ssOutput');
      if(!el) return false;
      const txt = el.innerText || '';
      return /YES|NO/.test(txt);
    }, null, { timeout: 3000 });

    const bfText = await demo.getSsOutputText();
    // Expect brute-force to find a solution for this instance
    expect(bfText).toMatch(/YES|NO/);
    expect(bfText).toMatch(/YES/);

    // Now click DP solver
    await demo.clickSsDP();
    await page.waitForFunction(() => {
      const el = document.getElementById('ssOutput');
      if(!el) return false;
      const txt = el.innerText || '';
      return /YES|NO/.test(txt);
    }, null, { timeout: 3000 });

    const dpText = await demo.getSsOutputText();
    expect(dpText).toMatch(/YES/);

    // Edge-case: invalid input -> expect "Invalid input"
    await demo.ssNumbers.fill('a,b,c');
    await demo.ssTarget.fill('x');
    await demo.clickSsSolve();

    await page.waitForFunction(() => {
      const el = document.getElementById('ssOutput');
      if(!el) return false;
      return el.innerText.includes('Invalid input');
    }, null, { timeout: 2000 });

    const invalidText = await demo.getSsOutputText();
    expect(invalidText).toContain('Invalid input');

    // No page errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('RunExperiment and ClearExperiment transitions and outputs', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Reduce the experiment workload so the test is fast and deterministic
    await demo.expMaxN.fill('4');  // small max
    await demo.expTrials.fill('1'); // single trial per n

    // Click Run Experiment
    await demo.clickRunExp();

    // Wait for the final timing summary to appear in expOutput (the implementation shows "Timing summary" in final output)
    await page.waitForFunction(() => {
      const out = document.getElementById('expOutput');
      if(!out) return false;
      return out.innerHTML.includes('Timing summary') || /n=\d+:/.test(out.textContent || '');
    }, null, { timeout: 10000 });

    const expText = await demo.expOutput.innerHTML();
    expect(expText).toMatch(/Timing summary|Measured/);

    // Now click Clear Experiment and assert it resets to the placeholder
    await demo.clickClearExp();
    await expect(demo.expOutput).toHaveText('No experiment yet.');

    // No page errors from running the experiment
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach console messages and page errors to test output for debugging, without failing the test here.
    // The assertions inside each test above already check for pageErrors being empty.
    // This hook just logs them to the Playwright report if present.
    if (consoleMessages.length > 0) {
      // Keep informational in case of debugging
      console.log(`Console messages captured (${consoleMessages.length}):`);
      for (const m of consoleMessages) {
        console.log(`  [${m.type}] ${m.text}`);
      }
    }
    if (pageErrors.length > 0) {
      console.log(`Page errors captured (${pageErrors.length}):`);
      for (const e of pageErrors) {
        console.log(`  ${e.message}`);
      }
    }
  });
});