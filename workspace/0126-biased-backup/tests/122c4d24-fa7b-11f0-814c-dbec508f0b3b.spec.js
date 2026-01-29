import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c4d24-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object encapsulating interactions with the Branch and Bound page
class BranchAndBoundPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      xInput: '#x',
      yInput: '#y',
      solveButton: '#solve',
      backButton: '#back',
      output: '#output'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getOutputText() {
    // Use textContent to read visible text content
    return (await this.page.locator(this.selectors.output).textContent()) ?? '';
  }

  async clickSolve() {
    await this.page.click(this.selectors.solveButton);
  }

  async clickBack() {
    await this.page.click(this.selectors.backButton);
  }

  async elementExists(selector) {
    return await this.page.locator(selector).count() > 0;
  }

  // Read the global variables x and y defined by the page script.
  // We will only read values, not inject new globals or redefine functions.
  async readGlobals() {
    return await this.page.evaluate(() => {
      return {
        x: typeof x !== 'undefined' ? x : undefined,
        y: typeof y !== 'undefined' ? y : undefined,
        max: typeof max !== 'undefined' ? max : undefined
      };
    });
  }
}

test.describe('Branch and Bound interactive application (FSM validation)', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial page and Idle state (S0_Idle)', () => {
    test('renders the page with expected components and no initial errors', async ({ page }) => {
      // Validate that the page loads and the main components are present
      const view = new BranchAndBoundPage(page);
      await view.goto();

      // Verify components exist according to the FSM "evidence"
      expect(await view.elementExists(view.selectors.solveButton)).toBeTruthy();
      expect(await view.elementExists(view.selectors.backButton)).toBeTruthy();
      expect(await view.elementExists(view.selectors.xInput)).toBeTruthy();
      expect(await view.elementExists(view.selectors.yInput)).toBeTruthy();
      expect(await view.elementExists(view.selectors.output)).toBeTruthy();

      // The output should initially be empty (Idle state's renderPage)
      const outputText = await view.getOutputText();
      expect(outputText.trim()).toBe('');

      // Assert there are no uncaught page errors on initial render
      expect(pageErrors.length, 'expected no page errors on initial load').toBe(0);

      // Log console messages for debugging, and assert none are errors
      const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(errorConsole.length, `expected no console error/warning messages, got: ${JSON.stringify(errorConsole)}`).toBe(0);
    });
  });

  test.describe('Solve and transition behavior', () => {
    test('Solve button triggers algorithm and leads to "Maximum value reached!" for default globals (S0_Idle -> S1_Solved)', async ({ page }) => {
      // This test validates the primary transition S0 -> S1 when starting values produce a zero during processing.
      const view = new BranchAndBoundPage(page);
      await view.goto();

      // Read initial globals to confirm implementation defaults
      const globalsBefore = await view.readGlobals();
      // The implementation sets x=10 and y=50 in the script; just assert they exist and are numbers
      expect(typeof globalsBefore.x).toBe('number');
      expect(typeof globalsBefore.y).toBe('number');

      // Click Solve to run the algorithm
      await view.clickSolve();

      // After running solve() with x=10,y=50 as implemented, the code reduces until one variable becomes zero.
      const outputText = await view.getOutputText();
      expect(outputText).toBe('Maximum value reached!');

      // Ensure that the implementation did not display the path in this case (S2 not taken)
      // Path display would include comma-separated coordinate pairs; assert those are absent.
      expect(outputText.includes(','), 'expected no comma-separated coordinates in output for solved state').toBe(false);

      // No uncaught page errors should have occurred during solve
      expect(pageErrors.length, 'expected no uncaught page errors during solve').toBe(0);
    });

    test('Clicking Solve multiple times remains stable and does not produce errors', async ({ page }) => {
      // Clicking Solve repeatedly should be safe: after the first run one coordinate is zero; subsequent runs keep "Maximum value reached!"
      const view = new BranchAndBoundPage(page);
      await view.goto();

      await view.clickSolve();
      const output1 = await view.getOutputText();
      expect(output1).toBe('Maximum value reached!');

      // Click Solve again
      await view.clickSolve();
      const output2 = await view.getOutputText();
      expect(output2).toBe('Maximum value reached!');

      // No page errors introduced by repeated clicking
      expect(pageErrors.length).toBe(0);
    });

    test('Back resets output and global variables to max (S3_Reset), and subsequent Solve behaves accordingly', async ({ page }) => {
      // This test validates the Back transition: S0 -> S3 via BackClick, and ensures x and y are set to max and output cleared.
      const view = new BranchAndBoundPage(page);
      await view.goto();

      // First run solve to mutate globals
      await view.clickSolve();
      expect(await view.getOutputText()).toBe('Maximum value reached!');

      // Click Back to reset state
      await view.clickBack();

      // Output should be cleared as per evidence
      expect((await view.getOutputText()).trim()).toBe('');

      // Now read global variables to ensure they were reset to max (max is declared as 100 in script)
      const globalsAfterBack = await view.readGlobals();
      expect(globalsAfterBack.max).toBe(100);
      expect(globalsAfterBack.x).toBe(100);
      expect(globalsAfterBack.y).toBe(100);

      // Clicking Back again should be idempotent and not cause errors (covers S3_Reset -> S0_Idle via BackClick)
      await view.clickBack();
      expect((await view.getOutputText()).trim()).toBe('');

      // Now click Solve again: with x=y=100 the algorithm should still eventually set one to zero and show "Maximum value reached!"
      await view.clickSolve();
      expect(await view.getOutputText()).toBe('Maximum value reached!');

      // No page errors throughout this reset cycle
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('FSM branches, unreachable behaviors, and edge-case observations', () => {
    test('Path-displayed branch (S2_PathDisplayed) is not reachable with the provided implementation from default globals; assert behavior and document it', async ({ page }) => {
      // The FSM includes a Path Displayed state where output.innerHTML is set to a newline-separated list of coordinates.
      // The implementation's loop continues while x>0 && y>0 and then explicitly checks if (x===0 || y===0) to show "Maximum value reached!".
      // This means the "else" branch that would display the path is effectively unreachable for positive starting globals.
      // This test asserts that given the shipped implementation, solving produces the "Maximum value reached!" message and not a path.
      const view = new BranchAndBoundPage(page);
      await view.goto();

      // Click Solve
      await view.clickSolve();

      const out = await view.getOutputText();
      // Confirm the S1 Solved evidence is observed, not the S2 path listing
      expect(out).toBe('Maximum value reached!');
      expect(out.includes(','), 'path-like output should not be present in this scenario').toBe(false);

      // Confirm no runtime errors occurred during the attempt to reach the path branch
      expect(pageErrors.length).toBe(0);
    });

    test('Interacting with form elements (inputs) does not affect internal globals because the implementation reads globals, not inputs', async ({ page }) => {
      // This test documents an important implementation detail: the input elements (#x and #y) exist in DOM but the solve() uses internal global variables x and y.
      // Changing the DOM input values should not change the algorithm behavior unless the page code reads them (which it does not).
      const view = new BranchAndBoundPage(page);
      await view.goto();

      // Change DOM input values
      await page.fill(view.selectors.xInput, '1');
      await page.evaluate(() => {
        // change the range input's value property in DOM only
        document.getElementById('y').value = '1';
      });

      // Read globals (these are internal script variables, not the DOM inputs)
      const globalsBefore = await view.readGlobals();
      // Implementation defaults are numbers; changing inputs should not have changed the internal globals yet.
      expect(globalsBefore.x).toBe(10);
      expect(globalsBefore.y).toBe(50);

      // Solve with DOM inputs changed would still operate on internal globals
      await view.clickSolve();
      const out = await view.getOutputText();
      expect(out).toBe('Maximum value reached!');

      // There should be no page errors during these interactions
      expect(pageErrors.length).toBe(0);
    });

    test('No unexpected console errors or page errors across tests (observability)', async ({ page }) => {
      // This final test in the group verifies the collected console messages and page errors are sane.
      const view = new BranchAndBoundPage(page);
      await view.goto();

      // Perform some interactions
      await view.clickSolve();
      await view.clickBack();
      await view.clickSolve();
      await view.clickBack();

      // Ensure there were no uncaught exceptions
      expect(pageErrors.length, `expected no page errors but found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

      // Check console messages for error types (if any)
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `expected no console.error messages; found: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });
});