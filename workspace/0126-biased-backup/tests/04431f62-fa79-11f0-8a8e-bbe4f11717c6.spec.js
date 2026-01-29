import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04431f62-fa79-11f0-8a8e-bbe4f11717c6.html';

// Helper page object for the Branch and Bound app
class BranchAndBoundPage {
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleMessages = [];

    // Collect runtime page errors (uncaught exceptions)
    this.page.on('pageerror', (err) => {
      // err is an Error object -- record its name and message for assertions
      this.pageErrors.push({
        name: err?.name || 'Error',
        message: err?.message || String(err),
        stack: err?.stack || ''
      });
    });

    // Collect console messages for later inspection
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  }

  // Navigate to the app and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Get the generate button handle
  async generateButton() {
    return this.page.$('#generate-button');
  }

  // Get the canvas element handle
  async canvas() {
    return this.page.$('#graph-canvas');
  }

  // Read the canvas data URL (serializes current drawing)
  async getCanvasDataURL() {
    return this.page.evaluate(() => {
      const c = document.querySelector('#graph-canvas');
      if (!c) return null;
      try {
        return c.toDataURL();
      } catch (e) {
        // If toDataURL throws (e.g., cross-origin or other issues), propagate as string
        return `toDataURL-error:${e?.name || 'Error'}:${e?.message || String(e)}`;
      }
    });
  }
}

test.describe('Branch and Bound FSM - 04431f62-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Basic smoke tests for initial state S0_Idle
  test('S0_Idle: Page renders initial UI (generate button and canvas) and entry action renderPage() is observed via runtime events', async ({ page }) => {
    // Arrange: create page object which attaches listeners for errors/console
    const app = new BranchAndBoundPage(page);

    // Act: navigate to the page
    await app.goto();

    // Assert: essential UI elements exist as per FSM evidence
    const button = await app.generateButton();
    const canvas = await app.canvas();

    // The Generate button should be present and visible
    expect(button).not.toBeNull();
    await expect(button).toBeVisible();

    // The canvas should be present in the DOM with expected dimensions
    expect(canvas).not.toBeNull();
    const canvasAttrs = await page.evaluate(() => {
      const c = document.querySelector('#graph-canvas');
      return c ? { width: c.getAttribute('width'), height: c.getAttribute('height') } : null;
    });
    expect(canvasAttrs).not.toBeNull();
    expect(canvasAttrs.width).toBe('800');
    expect(canvasAttrs.height).toBe('600');

    // The FSM S0 entry action mentions renderPage().
    // We cannot modify the page; we observe console logs and runtime page errors.
    // Verify that either:
    //  - a console message mentions 'renderPage' (indicating it logged), OR
    //  - a runtime page error occurred referencing renderPage (e.g., ReferenceError), OR
    //  - at minimum, some runtime error of type ReferenceError/TypeError/SyntaxError occurred during load.
    const consoleHasRender = app.consoleMessages.some(m => /renderPage/i.test(m.text));
    const pageErrorHasRender = app.pageErrors.some(e => /renderPage/i.test(e.message) || /renderPage/i.test(e.stack));
    const pageErrorIsCriticalType = app.pageErrors.some(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));

    // We assert that one of the observable outcomes regarding renderPage or at least a critical error occurred.
    expect(consoleHasRender || pageErrorHasRender || pageErrorIsCriticalType).toBeTruthy();

    // Additionally, produce a helpful debug output when expectations about errors fail.
    if (!(consoleHasRender || pageErrorHasRender || pageErrorIsCriticalType)) {
      // If none of the expected signs happened, include console/err details in the failure message
      const diagnostics = {
        consoleMessages: app.consoleMessages,
        pageErrors: app.pageErrors
      };
      throw new Error('Expected renderPage to be observable via console or page error, or a critical runtime error to occur. Diagnostics: ' + JSON.stringify(diagnostics, null, 2));
    }
  });

  // Test the GenerateClick event and the transition to S1_GraphGenerated
  test('GenerateClick: Clicking Generate should invoke generateGraph() and transition to Graph Generated (canvas drawing observed or errors reported)', async ({ page }) => {
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // Ensure starting canvas data as baseline
    const beforeDataURL = await app.getCanvasDataURL();
    expect(beforeDataURL).not.toBeNull();

    const button = await app.generateButton();
    expect(button).not.toBeNull();

    // Click the button to trigger transition
    await button.click();

    // Wait briefly to let any drawing or errors happen
    await page.waitForTimeout(500);

    // Observe console messages and page errors collected by our page object
    const consoleHasGenerate = app.consoleMessages.some(m => /generateGraph/i.test(m.text));
    const pageErrorHasGenerate = app.pageErrors.some(e => /generateGraph/i.test(e.message) || /generateGraph/i.test(e.stack));

    // Read canvas after clicking to detect visual change (serialized data URL)
    const afterDataURL = await app.getCanvasDataURL();

    // Determine whether the app visibly drew on the canvas: dataURL changed (and is not toDataURL-error)
    const dataURLChanged = (beforeDataURL !== afterDataURL) && afterDataURL && !afterDataURL.startsWith('toDataURL-error:');

    // Acceptable successful outcomes:
    //  - Canvas changed (graph drawn), OR
    //  - Console log indicates generateGraph was invoked, OR
    //  - A runtime error referencing generateGraph occurred (e.g., generateGraph is not defined -> ReferenceError)
    const successObserved = dataURLChanged || consoleHasGenerate || pageErrorHasGenerate;

    expect(successObserved).toBeTruthy();

    // If a canvas change was observed, assert that the "Graph Generated" state evidence (canvas present) remains true
    if (dataURLChanged) {
      const canvas = await app.canvas();
      expect(canvas).not.toBeNull();
      // If the canvas changed, ensure dataURL is a non-empty PNG data URI
      expect(afterDataURL).toMatch(/^data:image\/png;base64,/);
    } else {
      // Otherwise, ensure we captured errors or console evidence pointing to generateGraph
      if (!consoleHasGenerate && !pageErrorHasGenerate) {
        throw new Error('Clicking Generate did not change canvas nor produced observable console/page-error evidence for generateGraph. Console: ' + JSON.stringify(app.consoleMessages) + ' Errors: ' + JSON.stringify(app.pageErrors));
      }
    }
  });

  // Edge cases and error scenarios
  test('Edge cases: double-clicking Generate and missing implementations produce predictable runtime errors or safe no-ops', async ({ page }) => {
    const app = new BranchAndBoundPage(page);
    await app.goto();

    const button = await app.generateButton();
    expect(button).not.toBeNull();

    // Clear any previously collected errors/console messages by creating fresh arrays
    app.pageErrors.length = 0;
    app.consoleMessages.length = 0;

    // Double-click quickly to simulate an edge-case user interaction
    await button.dblclick();

    // Wait for potential errors or behavior to manifest
    await page.waitForTimeout(400);

    // We expect one of the following:
    // - Additional runtime errors occurred (ReferenceError/TypeError/SyntaxError), or
    // - The app handled double-click safely (no new critical errors). Because specification instructs to "observe console logs and page errors and assert that these errors occur",
    //   we will assert that either at least one critical page error was observed as a result of this interaction OR there are explicit console warnings/errors mentioning generateGraph/drawing.
    const criticalErrorObserved = app.pageErrors.some(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    const consoleIndicatesIssue = app.consoleMessages.some(m => /error|warn|generateGraph/i.test(m.text));

    expect(criticalErrorObserved || consoleIndicatesIssue).toBeTruthy();

    // Provide helpful diagnostics when neither errors nor console messages are present
    if (!(criticalErrorObserved || consoleIndicatesIssue)) {
      throw new Error('Double-click did not produce any console warnings/errors nor critical page errors. Diagnostics: ' + JSON.stringify({ console: app.consoleMessages, errors: app.pageErrors }, null, 2));
    }
  });
});