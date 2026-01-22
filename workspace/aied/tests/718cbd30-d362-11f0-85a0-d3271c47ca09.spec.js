import { test, expect } from '@playwright/test';

// Test file for Application ID: 718cbd30-d362-11f0-85a0-d3271c47ca09
// Location served at:
// http://127.0.0.1:5500/workspace/batch-1207/html/718cbd30-d362-11f0-85a0-d3271c47ca09.html
//
// This suite validates the single FSM state (S0_Idle) and checks that the static page
// content is rendered as expected. It also observes console messages and page errors
// without modifying the page runtime or injecting globals. Tests assert the presence
// or absence of expected artifacts and ensure there are no unexpected runtime errors.
//
// Note: The page is static and contains no interactive elements. The FSM entry action
// "renderPage()" is referenced in the FSM metadata but there is no script calling it
// in the HTML; we verify that no such global function exists and that no runtime
// error occurred as a result of entry actions.

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718cbd30-d362-11f0-85a0-d3271c47ca09.html';

// Simple page object encapsulating interactions/assertions for the app page.
class LinearRegressionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.heading = page.locator('h1');
    this.body = page.locator('body');
    this.pre = page.locator('pre'); // if code sample rendered in a <pre>
    this.codeTag = page.locator('code'); // in case code tag is used
  }

  async goto(options = {}) {
    await this.page.goto(APP_URL, options);
  }

  async getHeadingText() {
    return (await this.heading.textContent())?.trim();
  }

  async getBodyText() {
    return (await this.body.textContent()) || '';
  }

  async countButtons() {
    return await this.page.locator('button').count();
  }

  async countInputs() {
    return await this.page.locator('input, textarea, select').count();
  }

  async countAnchors() {
    return await this.page.locator('a').count();
  }

  async hasGlobalFunction(name) {
    return await this.page.evaluate((fnName) => {
      // Use typeof to avoid throwing; returns string 'function' if present
      return typeof window[fnName] === 'function';
    }, name);
  }

  async getGlobalValue(name) {
    return await this.page.evaluate((n) => window[n], name);
  }

  async getFirstCodeBlockText() {
    // Try common code container elements to extract the code sample text
    // This does not modify the page environment.
    const codeText = await this.page.evaluate(() => {
      // Prefer <pre><code> combos if present
      const codeEl = document.querySelector('pre code') || document.querySelector('code') || document.querySelector('pre');
      return codeEl ? codeEl.textContent : document.body.textContent;
    });
    return codeText || '';
  }
}

test.describe('Linear Regression Static Page and FSM (S0_Idle)', () => {
  // Capture console messages and page errors for each test to assert no unexpected runtime errors.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages
    page.on('console', (msg) => {
      // Record all console events for inspection
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Listen to uncaught exceptions in the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });
  });

  test('renders expected static content (FSM S0_Idle entry should display page)', async ({ page }) => {
    // This test verifies the static content of the page is present as evidence for S0_Idle state.
    const app = new LinearRegressionPage(page);

    // Navigate to the page and wait for load
    await app.goto({ waitUntil: 'load' });

    // Assert the main heading exists and matches the FSM evidence
    await expect(app.heading).toHaveCount(1);
    const headingText = await app.getHeadingText();
    expect(headingText).toBe('Linear Regression');

    // The FSM evidence also mentions a paragraph describing linear regression.
    const bodyText = await app.getBodyText();
    expect(bodyText).toContain('Linear regression is a statistical method used to predict the value of a dependent variable');
    expect(bodyText).toContain('The code for linear regression can be written in JavaScript');

    // Verify the code sample is present as text (the page contains a code snippet with "require('mathjs')")
    const codeText = await app.getFirstCodeBlockText();
    // The sample shows require('mathjs') as plain text in the HTML; ensure it appears in the page content.
    expect(codeText).toContain("require('mathjs')");
    expect(codeText).toContain('const regression = new math.LinearRegression()');

    // Verify there are no runtime page errors recorded during load for this static page.
    expect(pageErrors.length).toBe(0);

    // Ensure no unexpected console error messages occurred
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM entry action "renderPage()" is referenced but not executed (verify absence)', async ({ page }) => {
    // This test checks that the FSM entry action renderPage() is not present as a global function
    // on the page and that no runtime errors occur because of it.
    const app = new LinearRegressionPage(page);

    // Navigate to the page
    await app.goto({ waitUntil: 'load' });

    // The FSM entry action lists renderPage(). Confirm that the page does not expose a global renderPage function.
    const hasRenderPage = await app.hasGlobalFunction('renderPage');
    expect(hasRenderPage).toBe(false);

    // Also ensure that no accidental global 'renderPage' value exists (could be undefined)
    const renderPageVal = await app.getGlobalValue('renderPage');
    expect(renderPageVal === undefined || renderPageVal === null).toBe(true);

    // Confirm that the page content still rendered correctly (the entry action may be conceptual)
    await expect(app.heading).toHaveText('Linear Regression');

    // Confirm there are no page errors reported
    expect(pageErrors.length).toBe(0);
    // And no console error/warning messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('no interactive elements or transitions exist (FSM has no events/transitions)', async ({ page }) => {
    // FSM indicates zero events/transitions and extractionSummary notes no interactive elements.
    // This test verifies the DOM contains no buttons/inputs/interactive controls to trigger transitions.
    const app = new LinearRegressionPage(page);

    await app.goto({ waitUntil: 'load' });

    const buttonCount = await app.countButtons();
    const inputCount = await app.countInputs();
    const anchorCount = await app.countAnchors();

    // Expect no form controls or buttons; anchors may exist but the extraction summary said none were detected.
    // We allow anchors but assert there are zero buttons and zero inputs/selects/textareas.
    expect(buttonCount).toBe(0);
    expect(inputCount).toBe(0);

    // Also assert that there are no elements with attributes suggesting transitions (data-transition, data-event)
    const transitionAttrCount = await page.locator('[data-transition], [data-event], [data-action]').count();
    expect(transitionAttrCount).toBe(0);

    // Confirm that events/transitions are absent per FSM
    // (There are no transitions defined in the FSM; just ensure the UI provides no means to trigger transitions.)
    expect((await page.locator('button, input, textarea, select, [role="button"]').count())).toBe(0);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('observe console and page errors during load and assert none are present (edge-case check)', async ({ page }) => {
    // This test explicitly captures console messages and page errors while loading the page.
    // It ensures that code snippets that include "require" do not execute in the browser and do not cause errors.
    const app = new LinearRegressionPage(page);

    // (Listeners were added in beforeEach)
    await app.goto({ waitUntil: 'load' });

    // Inspect captured console messages for suspicious content (like ReferenceError or SyntaxError)
    const errorLikeMessages = consoleMessages.filter((m) => {
      const txt = m.text.toLowerCase();
      return txt.includes('referenceerror') || txt.includes('syntaxerror') || txt.includes('typeerror') || m.type === 'error';
    });

    // There should be no runtime errors produced by the static code block with `require('mathjs')`,
    // because it's not executed by the browser. Assert none found.
    expect(errorLikeMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // For extra safety, assert that a 'math' global was not created by the page (the code sample will not have run)
    const mathGlobal = await app.getGlobalValue('math');
    expect(mathGlobal === undefined || mathGlobal === null).toBe(true);
  });

  test('edge case: ensure calling undefined global functions is not attempted by the page', async ({ page }) => {
    // This test verifies that the page did not attempt to call undefined functions such as renderPage()
    // by ensuring no console error message indicates "renderPage is not defined" or similar.
    const app = new LinearRegressionPage(page);

    await app.goto({ waitUntil: 'load' });

    // Search captured console messages for references to 'renderPage'
    const renderPageConsole = consoleMessages.filter((m) => m.text.includes('renderPage'));
    expect(renderPageConsole.length).toBe(0);

    // If the page had tried to call renderPage() while it wasn't defined, we'd expect to see an error in pageErrors
    const relatedPageErrors = pageErrors.filter((e) => e.message && e.message.includes('renderPage'));
    expect(relatedPageErrors.length).toBe(0);

    // Confirm page still contains expected paragraph evidence indicating S0_Idle was rendered
    const bodyText = await app.getBodyText();
    expect(bodyText).toContain('This code demonstrates how to use linear regression to make predictions');
  });
});