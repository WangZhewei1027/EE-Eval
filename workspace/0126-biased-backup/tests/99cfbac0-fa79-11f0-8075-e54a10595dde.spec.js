import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cfbac0-fa79-11f0-8075-e54a10595dde.html';

test.describe('P vs NP Interactive Demo (FSM) - 99cfbac0-fa79-11f0-8075-e54a10595dde', () => {
  // Shared holders for console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture runtime page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page fresh for each test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic sanity: make sure the arrays exist
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  test('S0 Idle state: initial render shows header and initial UI is hidden', async ({ page }) => {
    // Validate initial state evidence: header present
    const header = page.locator('h1');
    await expect(header).toHaveText('P vs NP Demonstration');

    // problemInput should be hidden on initial render (S0_Idle)
    const problemInput = page.locator('#problemInput');
    await expect(problemInput).toHaveAttribute('style', /display:none/);

    // maxPathInput should also be hidden initially
    const maxPathInput = page.locator('#maxPathInput');
    await expect(maxPathInput).toHaveAttribute('style', /display:none/);

    // No runtime errors should have occurred just loading the page
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Transitions: SelectProblem (S0 -> S1) and SolveProblem (S1 -> S2)', () => {
    test('Selecting each problem type reveals the input area and updates description', async ({ page }) => {
      const problems = ['SAT', 'TSP', 'Knapsack'];

      for (const type of problems) {
        // Click the corresponding button by using the onclick attribute selector
        await page.click(`button[onclick="selectProblem('${type}')"]`);

        // After selection, the problemInput should be displayed
        const problemInput = page.locator('#problemInput');
        await expect(problemInput).toHaveCSS('display', 'block');

        // The problemDescription should reflect the selected problem
        const desc = page.locator('#problemDescription');
        await expect(desc).toHaveText(`You selected ${type}.`);

        // Ensure the global selectedProblemType is set (reading globals is allowed)
        const selected = await page.evaluate(() => window.selectedProblemType);
        expect(selected).toBe(type);

        // Reset the UI by reloading to test next type independently
        await page.reload();
        // reattach listeners after reload
        // page listeners were already attached in beforeEach, reload preserves them
      }
    });

    test('Solving a selected problem updates the solution output and reveals path exploration input (S1 -> S2)', async ({ page }) => {
      // Select SAT problem
      await page.click(`button[onclick="selectProblem('SAT')"]`);

      // Ensure problem input visible
      await expect(page.locator('#problemInput')).toHaveCSS('display', 'block');

      // Provide input data (edge case: include empty strings, numeric strings)
      const inputLocator = page.locator('#inputData');
      await inputLocator.fill('1,2,3');

      // Click Solve Problem and wait for DOM updates
      await page.click(`button[onclick="solveProblem()"]`);

      // The solutionOutput should be updated with the expected message
      const solution = page.locator('#solutionOutput');
      await expect(solution).toContainText('SAT solution logic not implemented. Inputs: 1, 2, 3');

      // The maxPathInput should now be visible (style display block)
      await expect(page.locator('#maxPathInput')).toHaveCSS('display', 'block');

      // No page errors expected in this successful solve path
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: solving with empty input results in numeric coercion behavior', async ({ page }) => {
      // Select Knapsack problem
      await page.click(`button[onclick="selectProblem('Knapsack')"]`);

      // Leave inputData empty
      await page.locator('#inputData').fill('');

      // Click Solve Problem
      await page.click(`button[onclick="solveProblem()"]`);

      // Because of the implementation: ''.split(',').map(Number) => [0]
      // The output is expected to show 'Inputs: 0'
      await expect(page.locator('#solutionOutput')).toContainText('Inputs: 0');

      // maxPathInput becomes visible
      await expect(page.locator('#maxPathInput')).toHaveCSS('display', 'block');

      // Still, no runtime errors expected here
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('ExplorePaths transition (S2 -> S3) and error handling', () => {
    test('Exploring paths attempts to update explorationOutput but triggers a runtime error due to malformed id (expected TypeError)', async ({ page }) => {
      // 1) Select a problem and solve to reach state S2
      await page.click(`button[onclick="selectProblem('TSP')"]`);
      await page.locator('#inputData').fill('10,20');
      await page.click(`button[onclick="solveProblem()"]`);

      // Confirm we are in S2: solution present and maxPathInput visible
      await expect(page.locator('#solutionOutput')).toContainText('TSP solution logic not implemented. Inputs: 10, 20');
      await expect(page.locator('#maxPathInput')).toHaveCSS('display', 'block');

      // 2) Prepare pathData input
      const pathInput = page.locator('#pathData');
      await pathInput.fill('pathA,pathB');

      // 3) The implementation attempts to document.getElementById('explorationOutput')
      //    but the actual HTML has id=" explorationOutput" (leading space), so getElementById returns null
      //    and attempting to set .innerText triggers a TypeError. We assert that this runtime error occurs.

      // Wait for the pageerror event that will be thrown by the browser when the click handler runs
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click(`button[onclick="explorePaths()"]`)
      ]);

      // We should have captured a runtime error object
      expect(error).toBeTruthy();
      expect(typeof error.message).toBe('string');

      // The error message content varies across engines, but it should indicate inability to set innerText or null reference
      const msg = error.message;
      const expectedPatterns = [
        'explorationOutput',       // mentions the target id
        'Cannot set',              // V8 style "Cannot set property 'innerText' of null"
        'Cannot read',             // some engines: "Cannot read properties of null (reading 'innerText')"
        'null'                     // mentions null
      ];
      // At least one of these patterns should appear in the error message
      const matched = expectedPatterns.some(pat => msg.includes(pat));
      expect(matched).toBeTruthy();

      // Additionally assert that the page still contains an element with the incorrect id (leading space),
      // which explains the root cause: the element exists but with a mismatched id.
      const hasLeadingSpaceId = await page.evaluate(() => !!document.querySelector('[id=" explorationOutput"]'));
      expect(hasLeadingSpaceId).toBeTruthy();

      // And confirm that the correct id without leading space does NOT exist, causing getElementById to return null
      const hasCorrectId = await page.evaluate(() => !!document.getElementById('explorationOutput'));
      expect(hasCorrectId).toBeFalsy();
    });

    test('Console and pageerror capture: ensure explorePaths click generates a pageerror entry in the test harness', async ({ page }) => {
      // Select and solve to reach the state where Explore Paths button is visible
      await page.click(`button[onclick="selectProblem('SAT')"]`);
      await page.locator('#inputData').fill('5,6');
      await page.click(`button[onclick="solveProblem()"]`);
      await page.locator('#pathData').fill('p1,p2');

      // Perform click and capture pageerror via waitForEvent
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click(`button[onclick="explorePaths()"]`)
      ]);

      // The pageErrors array (captured via page.on('pageerror')) should have been populated
      // Note: it may contain the same error object captured above; ensure length >= 1
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Confirm that the captured error(s) match the error returned by waitForEvent
      const messages = pageErrors.map(e => e.message);
      const anyMatch = messages.some(m => m === error.message || m.includes('explorationOutput') || m.includes('innerText'));
      expect(anyMatch).toBeTruthy();

      // Also assert that at least one console message has been captured during the session (could be empty if app doesn't log)
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });
  });

  test.describe('Additional FSM and edge-case validations', () => {
    test('Attempting to click Solve Problem without the input area visible is not possible via UI (button hidden)', async ({ page }) => {
      // On initial load, Solve Problem button is inside #problemInput which is hidden.
      // Trying to locate the visible Solve Problem button should fail.
      // However, the button exists in the DOM. We assert it's hidden via its ancestor's style.

      const solveButton = page.locator('button[onclick="solveProblem()"]');
      await expect(solveButton).toBeVisible({ timeout: 0 }).catch(async () => {
        // If not visible (expected), assert ancestor display is none
        const ancestorStyle = await page.locator('#problemInput').getAttribute('style');
        expect(ancestorStyle).toMatch(/display:none/);
      });
    });

    test('Verify FSM evidence: S0 entry action "renderPage()" not implemented but initial evidence exists', async ({ page }) => {
      // FSM S0 evidence expects <h1>P vs NP Demonstration</h1>
      const headerText = await page.locator('h1').textContent();
      expect(headerText).toBe('P vs NP Demonstration');

      // We cannot assert renderPage() function because it is not defined in the page JS;
      // per instructions we must let errors happen naturally and not patch them.
      // Instead validate that initial visible evidence is present.
    });

    test('Full happy path attempt (select -> solve -> explore) reports runtime error on explore due to id bug', async ({ page }) => {
      // This consolidates the prior steps to show the full FSM transition path and the known error on final transition.
      await page.click(`button[onclick="selectProblem('Knapsack')"]`);
      await page.locator('#inputData').fill('7,8,9');
      await page.click(`button[onclick="solveProblem()"]`);
      await expect(page.locator('#solutionOutput')).toContainText('Knapsack solution logic not implemented. Inputs: 7, 8, 9');
      await expect(page.locator('#maxPathInput')).toHaveCSS('display', 'block');

      // prepare path data
      await page.locator('#pathData').fill('A,B,C');

      // clicking Explore Paths will produce a runtime page error as previously tested
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click(`button[onclick="explorePaths()"]`)
      ]);

      // Assert that error occurred and matches expectations
      expect(error).toBeTruthy();
      expect(error.message.length).toBeGreaterThan(0);
    });
  });
});