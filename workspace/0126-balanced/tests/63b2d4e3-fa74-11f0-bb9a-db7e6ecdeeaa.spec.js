import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b2d4e3-fa74-11f0-bb9a-db7e6ecdeeaa.html';

/**
 * Page Object for the SQL Concept Demonstration application.
 * Encapsulates common interactions and queries against the page.
 */
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getTitleText() {
    return this.page.textContent('h1');
  }

  async getRunButton() {
    return this.page.locator("button[onclick='runQueries()']");
  }

  async clickRunButton() {
    const btn = await this.getRunButton();
    await btn.click();
  }

  async getOutputText() {
    return this.page.locator('pre#output').textContent();
  }

  async waitForOutputNonEmpty(timeout = 3000) {
    await this.page.waitForFunction(() => {
      const pre = document.querySelector('pre#output');
      return pre && pre.textContent && pre.textContent.trim().length > 0;
    }, { timeout });
  }

  // Helpers to evaluate functions existence/typeof in page context
  async typeofGlobal(name) {
    return this.page.evaluate((n) => typeof window[n], name);
  }

  async getButtonOnclickAttribute() {
    return this.page.getAttribute("button[onclick='runQueries()']", 'onclick');
  }
}

test.describe('SQL Concept Demonstration - FSM and interaction tests', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('S0_Idle: initial idle state - UI renders and expected globals (renderPage missing as in FSM)', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle).
    // It checks that the main UI elements are present and verifies the FSM-declared entry action 'renderPage'
    // is not present in the actual implementation (we assert it is undefined).
    const app = new AppPage(page);
    await app.goto();

    // Basic UI checks
    await expect(page).toHaveTitle(/SQL Concept Demonstration/);
    const title = await app.getTitleText();
    expect(title.trim()).toBe('SQL Concept Demonstration');

    // Button must exist with the exact onclick attribute expected by the FSM
    const btn1 = await app.getRunButton();
    await expect(btn).toBeVisible();
    const btnOnclick = await app.getButtonOnclickAttribute();
    expect(btnOnclick).toBe("runQueries()");

    // Output pre should initially be empty
    const initialOutput = (await app.getOutputText()) || '';
    expect(initialOutput.trim()).toBe('');

    // The actual implementation defines runQueries, check it exists.
    const typeRunQueries = await app.typeofGlobal('runQueries');
    expect(typeRunQueries).toBe('function');

    // FSM mentioned an entry action "renderPage()" for S0_Idle, but the HTML doesn't define it.
    // Verify that renderPage is undefined (this asserts difference between FSM entry action and implementation).
    const typeRenderPage = await app.typeofGlobal('renderPage');
    expect(typeRenderPage).toBe('undefined');

    // Also verify that no uncaught page errors occurred during load.
    expect(pageErrors.length).toBe(0);
    // And no console.error messages were emitted during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Queries_Ran: clicking the Run button triggers runQueries and output is populated correctly', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_Queries_Ran triggered by the RunQueries event.
    // It clicks the button and asserts the output contains expected query labels and resulting JSON.
    const app1 = new AppPage(page);
    await app.goto();

    // Ensure displayQueryResults (FSM's S1 entry action) is not implemented in the page.
    // We assert it is undefined rather than attempting to call it.
    const typeDisplayQueryResults = await app.typeofGlobal('displayQueryResults');
    expect(typeDisplayQueryResults).toBe('undefined');

    // Click the run button and wait for output to populate
    await app.clickRunButton();
    await app.waitForOutputNonEmpty(3000);

    // After clicking verify output content
    const output = await app.getOutputText();
    expect(output).toBeTruthy();

    // It should contain labeled sections 1..5 from the implementation
    expect(output).toContain('1. SELECT * FROM Employees;');
    expect(output).toContain('2. SELECT Name, Salary FROM Employees WHERE Department = \'Engineering\';');
    expect(output).toContain('3. UPDATE Employees SET Salary = Salary * 1.1 WHERE Department = \'Marketing\';');
    expect(output).toContain('4. DELETE FROM Employees WHERE ID = 4;');
    expect(output).toContain('5. SELECT Department, AVG(Salary) AS AvgSalary FROM Employees GROUP BY Department;');

    // Validate JSON contents for each step by parsing segments where appropriate.
    // Extract first JSON array (SELECT *)
    const matchAll = output.match(/1\. SELECT \* FROM Employees;\n([\s\S]*?)\n\n/);
    expect(matchAll).not.toBeNull();
    const selectAllJson = matchAll[1];
    const employeesAll = JSON.parse(selectAllJson);
    // Expect 4 employees initially with expected names
    expect(Array.isArray(employeesAll)).toBe(true);
    const names = employeesAll.map(e => e.Name).sort();
    expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'Dana'].sort());

    // Check engineering selection includes Alice and Charlie with their salaries
    const matchEng = output.match(/2\. SELECT Name, Salary FROM Employees WHERE Department = 'Engineering';\n([\s\S]*?)\n\n/);
    expect(matchEng).not.toBeNull();
    const engineeringJson = matchEng[1];
    const engineering = JSON.parse(engineeringJson);
    const engNames = engineering.map(e => e.Name).sort();
    expect(engNames).toEqual(['Alice', 'Charlie'].sort());
    const engSalaries = engineering.map(e => e.Salary).sort((a,b)=>a-b);
    expect(engSalaries).toEqual([75000, 80000].sort((a,b)=>a-b));

    // Check updatedEmployees: Marketing salary should be increased (Bob from 50000 -> 55000)
    const matchUpdated = output.match(/3\. UPDATE Employees[\s\S]*?\n([\s\S]*?)\n\n/);
    expect(matchUpdated).not.toBeNull();
    const updatedJson = matchUpdated[1];
    const updatedEmployees = JSON.parse(updatedJson);
    const bob = updatedEmployees.find(e => e.Name === 'Bob');
    expect(bob).toBeTruthy();
    expect(bob.Salary).toBe(55000);

    // After deletion, Dana (ID) should be removed
    const matchAfterDeletion = output.match(/4\. DELETE FROM Employees WHERE ID = 4;\n([\s\S]*?)\n\n/);
    expect(matchAfterDeletion).not.toBeNull();
    const afterDeletionJson = matchAfterDeletion[1];
    const afterDeletion = JSON.parse(afterDeletionJson);
    const hasDana = afterDeletion.some(e => e.Name === 'Dana' || e.ID === 4);
    expect(hasDana).toBe(false);

    // Average salary by department should reflect removed Dana and updated Marketing salary
    const matchAvg = output.match(/5\. SELECT Department, AVG\(Salary\) AS AvgSalary[\s\S]*?\n([\s\S]*?)\n\n/);
    expect(matchAvg).not.toBeNull();
    const avgJson = matchAvg[1];
    const avgArray = JSON.parse(avgJson);
    // Convert to mapping for assertions
    const avgMap = avgArray.reduce((m, item) => { m[item.Department] = item.AvgSalary; return m; }, {});
    // Engineering: Alice (75000) + Charlie (80000) => avg 77500
    expect(avgMap['Engineering']).toBe(77500);
    // Marketing: Bob (55000) => avg 55000
    expect(avgMap['Marketing']).toBe(55000);
    // HR should not be present because Dana (HR) was deleted
    expect(avgMap['HR']).toBeUndefined();

    // Ensure no uncaught page errors were produced during the click and processing.
    expect(pageErrors.length).toBe(0);
    const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: repeated clicks produce stable output and no runtime errors', async ({ page }) => {
    // This test validates idempotency: clicking the Run button multiple times should produce the same output
    // and must not cause exceptions or different outputs (the implementation uses non-mutating patterns).
    const app2 = new AppPage(page);
    await app.goto();

    // First click
    await app.clickRunButton();
    await app.waitForOutputNonEmpty(3000);
    const output1 = (await app.getOutputText()) || '';

    // Clear any collected console messages/errors from first run for clarity of second run capture
    // Note: We cannot clear Playwright's 'page.on' arrays here, but we have collected them in consoleMessages and pageErrors arrays in the test fixture.
    // We'll just record lengths to detect new errors.
    const errorsBeforeSecondClick = pageErrors.length;
    const consoleErrorsBefore = consoleMessages.filter(m => m.type === 'error').length;

    // Second click - should update the pre#output but produce same content
    await app.clickRunButton();
    await app.waitForOutputNonEmpty(3000);
    const output2 = (await app.getOutputText()) || '';

    expect(output2).toBe(output1);

    // Confirm no additional page errors were added by the second click
    expect(pageErrors.length).toBe(errorsBeforeSecondClick);
    const consoleErrorsAfter = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorsAfter).toBe(consoleErrorsBefore);
  });

  test('Observability: console messages and page errors are captured and contain no unexpected error-level messages', async ({ page }) => {
    // This test demonstrates observation of console and page errors and asserts that the page behaves cleanly.
    const app3 = new AppPage(page);
    await app.goto();

    // No output yet and no errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);

    // Trigger run
    await app.clickRunButton();
    await app.waitForOutputNonEmpty(3000);

    // After run ensure still no page errors and no console.error entries
    expect(pageErrors.length).toBe(0);
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);

    // Also assert that there were some informative console logs or other console activity (not required, but if present they are recorded).
    // This is non-fatal: we only assert that no 'error' type messages exist.
    // Example: if there are console.info/debug messages we accept them.
    const otherConsoleCount = consoleMessages.filter(m => m.type !== 'error').length;
    expect(otherConsoleCount).toBeGreaterThanOrEqual(0);
  });
});