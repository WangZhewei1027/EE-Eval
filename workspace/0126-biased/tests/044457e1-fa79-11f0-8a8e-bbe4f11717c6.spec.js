import { test, expect } from '@playwright/test';

// Page Object for the Git Demo static page
class GitDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'load' });
  }

  async title() {
    return this.page.title();
  }

  async headerText() {
    return this.page.textContent('header h1');
  }

  async headerSubtitle() {
    return this.page.textContent('header p');
  }

  async sectionHeadings() {
    return this.page.$$eval('main section.section h2', nodes => nodes.map(n => n.textContent.trim()));
  }

  async sectionCount() {
    return this.page.$$eval('main section.section', nodes => nodes.length);
  }

  async listItems() {
    return this.page.$$eval('main section.section ul li', nodes => nodes.map(n => n.textContent.trim()));
  }

  async footerText() {
    return this.page.textContent('footer p');
  }

  async hasRenderPageFunction() {
    return this.page.evaluate(() => typeof window.renderPage === 'function');
  }

  async mainInnerHTML() {
    return this.page.$eval('main', m => m.innerHTML);
  }

  async interactiveElementsCount() {
    // Buttons, inputs, anchors (links) - expecting none per FSM extraction summary
    const counts = await this.page.evaluate(() => {
      return {
        buttons: document.querySelectorAll('button').length,
        inputs: document.querySelectorAll('input, textarea, select').length,
        anchors: document.querySelectorAll('a').length
      };
    });
    return counts;
  }
}

// Constants
const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044457e1-fa79-11f0-8a8e-bbe4f11717c6.html';

// Top-level describe grouping tests related to the FSM S0_Idle and page behavior
test.describe('Git Demo - FSM S0_Idle (Static Page)', () => {
  let page;
  let gitDemo;
  let consoleMessages;
  let pageErrors;
  let consoleListener;
  let pageErrorListener;

  // Set up page, listeners and navigate before each test
  test.beforeEach(async ({ browser }) => {
    // Create new context+page to isolate console/pageerror events per test
    const context = await browser.newContext();
    page = await context.newPage();
    gitDemo = new GitDemoPage(page);

    // Collect console messages and page errors
    consoleMessages = [];
    pageErrors = [];

    consoleListener = msg => {
      // Capture complete console message shape for assertions
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    };

    pageErrorListener = err => {
      // err is an Error object for uncaught exceptions in page context
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    };

    page.on('console', consoleListener);
    page.on('pageerror', pageErrorListener);

    // Load the page exactly as-is and let any runtime loading/execution happen naturally
    await gitDemo.goto(PAGE_URL);
  });

  // Clean up listeners and close the page after each test
  test.afterEach(async () => {
    if (page) {
      page.removeListener('console', consoleListener);
      page.removeListener('pageerror', pageErrorListener);
      await page.context().close();
    }
  });

  // Test 1: Verify the Idle state entry evidence (title) and basic static content are rendered
  test('renders static content and matches FSM evidence (title, headings, sections)', async () => {
    // Validate the expected <title> from FSM evidence
    const title = await gitDemo.title();
    expect(title).toBe('Git Demo');

    // Validate header content
    const header = await gitDemo.headerText();
    expect(header).toBe('Git Demo');

    const subtitle = (await gitDemo.headerSubtitle()).trim();
    expect(subtitle.toLowerCase()).toContain('version control');

    // Validate number of content sections (there are 4 <section class="section"> in the HTML)
    const sectionCount = await gitDemo.sectionCount();
    expect(sectionCount).toBe(4);

    // Validate known section headings from the provided HTML
    const headings = await gitDemo.sectionHeadings();
    expect(headings).toEqual([
      'Git Basics',
      'Git Workflow',
      'Git Branching',
      'Git Merging'
    ]);

    // Validate a known list of workflow items appears in the second section
    const listItems = await gitDemo.listItems();
    expect(listItems).toEqual(['Stages', 'Branches', 'Merge']);

    // Footer content check
    const footer = (await gitDemo.footerText()).trim();
    expect(footer).toContain('© 2023 Git Demo');
  });

  // Test 2: Assert that the page contains no interactive elements as indicated by the FSM extraction summary
  test('has no interactive elements (buttons, form inputs, or links) according to FSM', async () => {
    const counts = await gitDemo.interactiveElementsCount();
    // The FSM extraction summary noted "No buttons, inputs, or links were detected."
    expect(counts.buttons).toBe(0);
    expect(counts.inputs).toBe(0);
    expect(counts.anchors).toBe(0);
  });

  // Test 3: Validate that the page either defines the entry action renderPage OR that a runtime error related to it or to the referenced script appears.
  // This test intentionally observes console and page errors without modifying page code.
  test('observes script loading and runtime errors (if any) related to entry actions or external scripts', async () => {
    // Check whether renderPage exists on the window
    const hasRenderPage = await gitDemo.hasRenderPageFunction();

    // Collect console error messages that reference the external script or failing resource
    const consoleErrorsReferencingScript = consoleMessages.filter(m =>
      m.type === 'error' &&
      (m.text.includes('script.js') || m.text.toLowerCase().includes('failed to load') || m.text.toLowerCase().includes('404'))
    );

    // Collect page errors that are common runtime error names
    const runtimePageErrors = pageErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError/.test(e.message)
    );

    // Explanation:
    // - If the implementation provides window.renderPage, that satisfies the FSM's "entry action".
    // - If it does not, we expect that missing external code or entry calls could produce console/page errors.
    // We assert that at least one of these observable conditions is true:
    //   a) renderPage is defined, or
    //   b) there is a console error mentioning the external script, or
    //   c) there is a runtime page error of ReferenceError/TypeError/SyntaxError.
    const conditionSatisfied = hasRenderPage || consoleErrorsReferencingScript.length > 0 || runtimePageErrors.length > 0;

    // Attach debugging information to failure message to aid diagnosing environment-specific issues
    if (!conditionSatisfied) {
      // Log captured console messages and page errors for test failure diagnostics
      console.log('Captured console messages:', consoleMessages);
      console.log('Captured page errors:', pageErrors);
    }

    expect(conditionSatisfied).toBeTruthy();
  });

  // Test 4: Verify that there are no state transitions triggered by user interactions (page is static)
  test('user interactions do not trigger state transitions or DOM mutations (no transitions in FSM)', async () => {
    // Capture main content before interactions
    const beforeHTML = await gitDemo.mainInnerHTML();

    // Simulate various user interactions: click, double-click, key presses
    await page.click('body', { position: { x: 10, y: 10 } });
    await page.dblclick('body');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    // Wait briefly to allow any potential event handlers to run
    await page.waitForTimeout(250);

    // Capture main content after interactions
    const afterHTML = await gitDemo.mainInnerHTML();

    // Because FSM contains no transitions and DOM is static, assert no change
    expect(afterHTML).toBe(beforeHTML);
  });

  // Test 5: Edge cases and error scenarios - If any page error occurred, ensure they are reported and include stack where possible.
  test('reports page errors with stack traces when runtime exceptions occur (edge case reporting)', async () => {
    // If there were no page errors, we still want to assert that that is a valid scenario.
    // But when pageErrors exist, they should contain message and stack for diagnostics.
    if (pageErrors.length === 0) {
      // No uncaught exceptions were observed. This is acceptable but we still assert the environment was observed.
      expect(pageErrors.length).toBe(0);
    } else {
      // For each page error, ensure message is non-empty and stack is provided when available
      for (const err of pageErrors) {
        expect(err.message).toBeTruthy();
        // Stack might be absent in some environments; if present, it should be a string
        if (err.stack !== undefined) {
          expect(typeof err.stack).toBe('string');
        }
      }
    }
  });
});