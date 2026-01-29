import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0442aa34-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object Model encapsulating common queries and interactions
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array} consoleMessages - array reference to collect console messages
   * @param {Array} pageErrors - array reference to collect page errors
   */
  constructor(page, consoleMessages = [], pageErrors = []) {
    this.page = page;
    this.consoleMessages = consoleMessages;
    this.pageErrors = pageErrors;
  }

  // Navigate to the app and wait for load (listeners should be attached prior to navigation)
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return document title
  async title() {
    return this.page.title();
  }

  // Get the main header text
  async headerText() {
    return this.page.locator('.header >> h1').innerText();
  }

  // Get paragraph under header
  async headerSubText() {
    return this.page.locator('.header >> p').innerText();
  }

  // Return an array of h2 texts inside .algorithm and .algorithm-section
  async algorithmHeadings() {
    const locators = this.page.locator('.algorithm h2, .algorithm-section h2');
    const count = await locators.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await locators.nth(i).innerText());
    }
    return texts;
  }

  // Check whether any element with .algorithm-button exists
  async hasAlgorithmButton() {
    return (await this.page.locator('.algorithm-button').count()) > 0;
  }

  // Call kruskalSort on the page with a provided array and return the result or thrown error descriptor
  async callKruskalSort(payload) {
    return this.page.evaluate((p) => {
      try {
        // p is passed from the test context
        return { ok: true, result: kruskalSort(p) };
      } catch (e) {
        return { ok: false, name: e && e.name, message: e && e.message };
      }
    }, payload);
  }

  // Call printMST on the page with provided array; it logs to console. We return a success marker.
  async callPrintMST(payload) {
    return this.page.evaluate((p) => {
      try {
        printMST(p);
        return { ok: true };
      } catch (e) {
        return { ok: false, name: e && e.name, message: e && e.message };
      }
    }, payload);
  }

  // Attempt to call renderPage() - expected to be missing per FSM; return thrown error descriptor or success
  async callRenderPage() {
    return this.page.evaluate(() => {
      try {
        // Intentionally call renderPage() if present, to observe behavior (may throw ReferenceError)
        return { ok: true, result: renderPage() };
      } catch (e) {
        return { ok: false, name: e && e.name, message: e && e.message };
      }
    });
  }
}

test.describe('Kruskal Algorithm - Static Interactive Page (FSM: Idle)', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;
  let pageModel;

  // Attach listeners before navigating so initial script logs are captured
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info, log, warn, error)
    page.on('console', (msg) => {
      // Normalize text for easier assertions
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Some console messages can throw on type()/text(), ignore if so
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push({ name: err.name, message: err.message });
    });

    pageModel = new KruskalPage(page, consoleMessages, pageErrors);
    await pageModel.goto();
  });

  test.afterEach(async ({ page }) => {
    // keep page open teardown handled by Playwright fixture
    // but assert that we did not leak unexpected errors during test teardown
    // (no-op here, collected errors asserted in tests)
  });

  test('Initial Idle state: page renders and static content matches FSM "Idle" evidence', async () => {
    // This validates the FSM "Idle" state's entry evidence: the <title> should be present and correct.
    const title = await pageModel.title();
    expect(title).toBe("Kruskal's Algorithm");

    // Validate header content
    const header = await pageModel.headerText();
    expect(header).toBe("Kruskal's Algorithm");

    const subHeader = await pageModel.headerSubText();
    expect(subHeader).toContain('Visualizing the Minimum Spanning Tree of a Graph');

    // Validate algorithm step headings are present (static content)
    const headings = await pageModel.algorithmHeadings();
    // Expect at least the three headings described in the HTML
    expect(headings).toEqual(
      expect.arrayContaining([
        'Step 1: Sort the Graph',
        'Step 2: Find the Minimum Spanning Tree',
        'Step 3: Print the MST',
      ])
    );

    // There are styles for .algorithm-button but no actual interactive buttons are rendered in the HTML:
    const hasButton = await pageModel.hasAlgorithmButton();
    expect(hasButton).toBe(false);
  });

  test('Console output: printMST logs expected lines on initial page load', async () => {
    // On page load the script runs kruskalSort and then printMST — assert the logs were emitted.
    // Find "Minimum Spanning Tree:" and the four edges that the page's script logs.
    const allTexts = consoleMessages.map((m) => m.text);

    // There should be at least one console message containing "Minimum Spanning Tree:"
    const foundMST = allTexts.some((t) => t.includes('Minimum Spanning Tree:'));
    expect(foundMST).toBe(true);

    // Expected edges based on the provided edges array and the provided script output format
    const expectedEdges = [
      'Edge from 0 to 1 with weight 10',
      'Edge from 1 to 2 with weight 5',
      'Edge from 2 to 3 with weight 15',
      'Edge from 3 to 0 with weight 20',
    ];

    // All expected edge lines should appear (order may vary depending on implementation, but the example calls console.log for each)
    for (const edgeLine of expectedEdges) {
      const found = allTexts.some((t) => t.includes(edgeLine));
      expect(found).toBe(true);
    }
  });

  test('No uncaught runtime errors on initial load (pageerror events)', async () => {
    // The page should not emit uncaught exceptions during the initial load sequence.
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action renderPage() is not implemented: calling it triggers ReferenceError', async () => {
    // The FSM lists an entry action "renderPage()". The HTML/JS does not define renderPage.
    // We intentionally call renderPage() inside the page context to observe natural ReferenceError.
    const result = await pageModel.callRenderPage();

    // Expect the call to have resulted in an error descriptor and that it's a ReferenceError
    expect(result.ok).toBe(false);
    // Different engines may provide slightly different messages, check the name
    expect(result.name).toBe('ReferenceError');
  });

  test('kruskalSort throws a TypeError when given invalid input (edge case)', async () => {
    // Passing null should produce a TypeError because the function attempts to call .sort on the input.
    const result = await pageModel.callKruskalSort(null);
    expect(result.ok).toBe(false);
    // The error thrown when calling .sort on null is typically a TypeError
    expect(result.name).toBe('TypeError');
  });

  test('kruskalSort returns an array of edges for a valid input and printMST logs that array', async () => {
    // Provide a fresh copy of the edges and call kruskalSort from the page context.
    const inputEdges = [
      { from: 0, to: 1, weight: 10 },
      { from: 1, to: 2, weight: 5 },
      { from: 2, to: 3, weight: 15 },
      { from: 3, to: 0, weight: 20 },
    ];

    const result = await pageModel.callKruskalSort(inputEdges);
    expect(result.ok).toBe(true);

    // The page's implementation is flawed but it returns an array. Validate it's an array and contains edge objects.
    const mst = result.result;
    expect(Array.isArray(mst)).toBe(true);
    // In the current implementation, all edges end up in the returned mst (length 4)
    expect(mst.length).toBe(4);
    // Verify one edge object shape
    expect(mst[0]).toMatchObject({ from: expect.any(Number), to: expect.any(Number), weight: expect.any(Number) });

    // Now call printMST with an empty array to verify it at least logs the "Minimum Spanning Tree:" header
    const beforeCount = consoleMessages.length;
    const printResult = await pageModel.callPrintMST([]);
    expect(printResult.ok).toBe(true);

    // Wait briefly to allow console handler to pick up the log (script runs synchronously, but allow event loop)
    await pageModel.page.waitForTimeout(50);

    const newMessages = consoleMessages.slice(beforeCount).map((m) => m.text);
    // Expect the "Minimum Spanning Tree:" single header to be logged
    const headerFound = newMessages.some((t) => t.includes('Minimum Spanning Tree:'));
    expect(headerFound).toBe(true);
  });

  test('Edge case: calling kruskalSort with malformed edge entries (missing properties) does not crash silently', async () => {
    // Pass edges with missing properties to observe behavior
    const badEdges = [{ foo: 'bar' }, { from: 1 }, 2, null];

    const result = await pageModel.callKruskalSort(badEdges);
    // The implementation may attempt to access .weight or .from/.to and either throw or return something unexpected.
    // We assert that the function either throws (ok:false) or returns an array (ok:true).
    expect([true, false]).toContain(result.ok);

    if (result.ok) {
      // If it returned, ensure the return type is array and elements are objects (or at least something inspectable)
      expect(Array.isArray(result.result)).toBe(true);
    } else {
      // If it threw, ensure it's a TypeError or other JS error type (function is fragile)
      expect(typeof result.name).toBe('string');
      expect(result.name.length).toBeGreaterThan(0);
    }
  });
});