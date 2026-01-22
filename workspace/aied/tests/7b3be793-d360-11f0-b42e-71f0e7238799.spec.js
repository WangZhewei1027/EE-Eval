import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3be793-d360-11f0-b42e-71f0e7238799.html';

// Page object for the Floyd-Warshall demo page
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.textarea = page.locator('#matrixInput');
    this.runButton = page.locator("button[onclick='runFloydWarshall()']");
    this.resultTable = page.locator('#resultTable');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillMatrix(text) {
    await this.textarea.fill(text);
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getResultDisplayStyle() {
    return await this.page.$eval('#resultTable', el => getComputedStyle(el).display);
  }

  // Calls parseInput in page context and returns a stringified version of values to avoid NaN/Infinity serialization pitfalls
  async parsedMatrixAsStrings() {
    return await this.page.evaluate(() => {
      try {
        const parsed = parseInput();
        return parsed.map(row => row.map(v => String(v)));
      } catch (e) {
        return { __error__: String(e) };
      }
    });
  }

  // Directly invoke displayResults on the page with a provided matrix
  async invokeDisplayResults(dist) {
    return await this.page.evaluate((d) => {
      // call the function defined in the page
      displayResults(d);
      // return the final computed style for verification
      const resultTable = document.getElementById('resultTable');
      return {
        display: getComputedStyle(resultTable).display,
        innerText: resultTable.innerText
      };
    }, dist);
  }
}

test.describe('Floyd-Warshall FSM Tests (Application ID: 7b3be793-...)', () => {
  // Ensure a fresh page before each test
  test.beforeEach(async ({ page }) => {
    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test('Idle state: initial render shows input, button, and hidden results table', async ({ page }) => {
    // Validate that initial Idle state elements are present and visible/hidden as expected.
    const fw = new FloydWarshallPage(page);

    // Textarea should be visible
    await expect(fw.textarea).toBeVisible();

    // Button should be visible and have the correct text
    await expect(fw.runButton).toBeVisible();
    await expect(fw.runButton).toHaveText('Run Floyd-Warshall Algorithm');

    // Result table exists but is hidden (display: none) per implementation
    await expect(fw.resultTable).toBeVisible(); // the element exists in DOM; visibility for locator returns true for presence
    // Check computed style is 'none'
    const displayStyle = await fw.getResultDisplayStyle();
    expect(displayStyle).toBe('none');
  });

  test('Processing state: clicking Run triggers runFloydWarshall and results in a ReferenceError (as implemented)', async ({ page }) => {
    // This test verifies that clicking the Run button transitions to Processing,
    // causing the page to execute runFloydWarshall(), which (due to a bug in the implementation)
    // raises a ReferenceError referencing an undefined variable 'i'. We observe pageerror.
    const fw = new FloydWarshallPage(page);

    // Prepare a valid small adjacency matrix to ensure parseInput returns reasonable numbers
    await fw.fillMatrix('0,1\n1,0');

    // Listen for pageerror event which should capture the uncaught ReferenceError from runFloydWarshall
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'), // wait for the runtime error to surface
      fw.clickRun() // trigger the failing function
    ]);

    // Validate that an error occurred and that it's a ReferenceError related to 'i'
    expect(pageError).toBeTruthy();
    // The message may vary depending on engine, but it should reference 'i' not being defined
    const msg = String(pageError.message || pageError);
    expect(msg.toLowerCase()).toMatch(/i is not defined|i is undefined|referenceerror/);

    // Because the algorithm failed, results should not be displayed (still style 'none')
    const displayStyleAfter = await fw.getResultDisplayStyle();
    expect(displayStyleAfter).toBe('none');
  });

  test('ResultsDisplayed state: invoking displayResults directly shows table with expected headers and values', async ({ page }) => {
    // This test bypasses the broken runFloydWarshall and directly calls displayResults to validate
    // the "displayResults(dist)" entry action and that the table rendering logic works as intended.
    const fw = new FloydWarshallPage(page);

    // Provide a small distance matrix that includes Infinity to ensure special symbol is used
    const sampleDist = [
      [0, Infinity, 5],
      [Infinity, 0, 2],
      [5, 2, 0]
    ];

    const result = await fw.invokeDisplayResults(sampleDist);

    // The table should now be made visible by displayResults()
    expect(result.display).toBe('table');

    // The innerText should include header 'Nodes' and at least the node indices '0', '1', '2'
    expect(result.innerText).toContain('Nodes');
    expect(result.innerText).toContain('0');
    expect(result.innerText).toContain('1');
    expect(result.innerText).toContain('2');

    // Infinity should be represented by the '∞' symbol per implementation
    expect(result.innerText).toContain('∞');
  });

  test('Edge case: parseInput should correctly parse "Infinity" into Infinity values', async ({ page }) => {
    // Validate parseInput behavior: the string "Infinity" should be parsed as JS Infinity
    const fw = new FloydWarshallPage(page);

    await fw.fillMatrix('0,Infinity\nInfinity,0');

    const parsedStrings = await fw.parsedMatrixAsStrings();
    // We expect the internal stringified representation to contain 'Infinity' entries
    expect(Array.isArray(parsedStrings)).toBeTruthy();
    expect(parsedStrings.length).toBe(2);
    expect(parsedStrings[0][1]).toBe('Infinity');
    expect(parsedStrings[1][0]).toBe('Infinity');
  });

  test('Edge case: malformed input produces NaN entries from parseInput (and no crash on parse)', async ({ page }) => {
    // Provide malformed non-numeric input and check parseInput yields 'NaN' strings in the matrix
    const fw = new FloydWarshallPage(page);

    await fw.fillMatrix('a,b\nc,d');

    const parsedStrings = await fw.parsedMatrixAsStrings();
    // Expect parsing to succeed but produce 'NaN' for non-numeric tokens
    expect(parsedStrings[0][0]).toBe('NaN');
    expect(parsedStrings[0][1]).toBe('NaN');
    expect(parsedStrings[1][0]).toBe('NaN');
    expect(parsedStrings[1][1]).toBe('NaN');
  });

  test('Console and runtime errors are observable: capture console messages and page errors when clicking Run', async ({ page }) => {
    // This test attaches listeners to capture console messages (errors included) and page errors,
    // ensuring the testing harness can observe runtime failures triggered by user actions.
    const fw = new FloydWarshallPage(page);

    // Collection arrays for captured events
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(String(err.message || err));
    });

    // Provide a simple matrix and click the run button to induce the known error
    await fw.fillMatrix('0,1\n1,0');
    await fw.clickRun();

    // Give a short pause to allow events to propagate (the error is synchronous but allow event loop)
    await page.waitForTimeout(200);

    // We should have at least one captured page error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // The console may or may not capture the same message depending on engine, ensure we at least captured an error-type console or pageerror
    const pageErrorText = pageErrors.join('\n').toLowerCase();
    expect(pageErrorText).toMatch(/i is not defined|referenceerror/);

    // Optionally assert console captured something; if none, that's acceptable but we record what's observed.
    // At minimum we assert that our pageErrors array contains the ReferenceError text.
  });
});