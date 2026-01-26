import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b13782-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Setup listeners to capture console messages and page errors
  async attachListeners() {
    this.page.on('console', (msg) => {
      const text = msg.text();
      this.consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        this.consoleErrors.push({ type: msg.type(), text });
      }
    });

    this.page.on('pageerror', (err) => {
      // pageerror is typically an unhandled exception (ReferenceError/TypeError/etc.)
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getDemoButton() {
    return this.page.$('#demo-btn');
  }

  async getVisualContainer() {
    return this.page.$('#hash-table-visual');
  }

  async getVisualInnerHTML() {
    const el = await this.getVisualContainer();
    if (!el) return null;
    return el.innerHTML();
  }

  async clickDemoButton() {
    const btn = await this.getDemoButton();
    if (!btn) throw new Error('Demo button not found');
    await btn.click();
  }

  async countTablesInVisual() {
    const el = await this.getVisualContainer();
    if (!el) return 0;
    return await this.page.$$eval('#hash-table-visual table', (nodes) => nodes.length);
  }

  async getTextContentOfVisual() {
    const el = await this.getVisualContainer();
    if (!el) return '';
    return await this.page.$eval('#hash-table-visual', (node) => node.textContent || '');
  }

  resetCaptures() {
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
  }
}

// Grouping all tests related to the FSM for the Hash Table demo
test.describe('Hash Table Demonstration FSM (Application ID: f0b13782-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  let demoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.attachListeners();
    await demoPage.goto();
  });

  test.afterEach(async () => {
    // teardown: nothing explicit to close because Playwright handles pages per test
    demoPage.resetCaptures();
  });

  test('S0_Idle: initial state renders the page and shows Run Demonstration button', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) per the FSM.
    // It checks that the demo button is present and that the visual container shows the placeholder text.
    // It also captures console and page errors that may have occurred during load.

    const btn = await demoPage.getDemoButton();
    expect(btn).not.toBeNull(); // Button must exist in Idle state

    // Verify button text content matches the FSM/component definition
    const btnText = await page.$eval('#demo-btn', (b) => b.textContent && b.textContent.trim());
    expect(btnText).toBe('Run Demonstration');

    // Verify the hash table visual placeholder is present before any interaction
    const visual = await demoPage.getVisualContainer();
    expect(visual).not.toBeNull();
    const placeholderText = await demoPage.getTextContentOfVisual();
    expect(placeholderText).toContain('Hash table will appear here after clicking the button.');

    // Assert that no unhandled runtime errors occurred on initial load (e.g., missing functions like renderPage)
    // The FSM entry action mentions renderPage() but the implementation does not call it.
    // We assert that no page errors (ReferenceError, TypeError, SyntaxError) happened during load.
    expect(demoPage.pageErrors.length).toBe(0);
    // Also assert there were no console error messages
    expect(demoPage.consoleErrors.length).toBe(0);

    // Basic evidence that the DOM matches extraction summary: demo button exists
    const demoBtnHtml = await page.$eval('#demo-btn', (el) => el.outerHTML);
    expect(demoBtnHtml).toContain('id="demo-btn"');
  });

  test('RunDemonstration event transitions S0_Idle -> S1_DemonstrationRunning and renders visualization', async ({ page }) => {
    // This test validates the transition caused by clicking the #demo-btn.
    // It asserts that clicking the button updates the #hash-table-visual innerHTML to the expected visualization.

    // Click the demo button to trigger the transition
    await demoPage.clickDemoButton();

    // Wait for the visualization header to appear (entry action for S1_DemonstrationRunning: showHashTableVisualization)
    await page.waitForSelector('#hash-table-visual h3', { timeout: 2000 });

    // Verify that the visualization contains the expected heading and table
    const visualText = await demoPage.getTextContentOfVisual();
    expect(visualText).toContain('Hash Table Visualization (Size: 7)');
    expect(visualText).toContain('Explanation:'); // Explanation paragraph included by the implementation
    // Verify the table includes expected key-value pairs per the demo data
    expect(visualText).toContain('apple');
    expect(visualText).toContain('banana');
    expect(visualText).toContain('orange');
    expect(visualText).toContain('pear');
    expect(visualText).toContain('grape');
    expect(visualText).toContain('kiwi');

    // Inspect that the table rows correspond roughly to indices 0..6 (7 buckets)
    const tableCount = await demoPage.countTablesInVisual();
    expect(tableCount).toBe(1); // One table should be present inside the visualization

    // Verify that the collision example (pear and grape hashed to same index) appears in same cell text
    // We will check that the cell text for index 3 contains both "pear" and "grape"
    const cellIndex3Text = await page.$eval('#hash-table-visual table tr:nth-child(5) td:nth-child(2)', (td) => td.textContent && td.textContent.trim());
    // nth-child mapping: header row plus 4 data rows get us to the row with index 3. We carefully check content contains both keys.
    expect(cellIndex3Text).toMatch(/pear/i);
    expect(cellIndex3Text).toMatch(/grape/i);

    // Ensure no new runtime page errors surfaced on click
    expect(demoPage.pageErrors.length).toBe(0);
    expect(demoPage.consoleErrors.length).toBe(0);

    // Validate that innerHTML was updated (evidence: visual.innerHTML = `...`)
    const innerHTML = await demoPage.getVisualInnerHTML();
    expect(innerHTML).toContain('<table>');
    expect(innerHTML).toContain('</table>');
  });

  test('Clicking the demo button multiple times replaces (not duplicates) the visualization', async ({ page }) => {
    // This edge-case test verifies idempotence or replacement behavior when the Run Demonstration button is clicked multiple times.
    // It ensures the visualization does not accumulate duplicate tables or content on repeated clicks.

    // First click
    await demoPage.clickDemoButton();
    await page.waitForSelector('#hash-table-visual table', { timeout: 2000 });
    const tablesAfterFirstClick = await demoPage.countTablesInVisual();
    expect(tablesAfterFirstClick).toBe(1);

    // Capture content snapshot after first click
    const contentAfterFirst = await demoPage.getVisualInnerHTML();

    // Second click
    await demoPage.clickDemoButton();
    // Wait a short time for potential DOM updates
    await page.waitForTimeout(200);
    const tablesAfterSecondClick = await demoPage.countTablesInVisual();
    expect(tablesAfterSecondClick).toBe(1); // Should still be one table, not duplicated

    const contentAfterSecond = await demoPage.getVisualInnerHTML();
    // The implementation replaces innerHTML, so the content should be identical (or at least contain the same key parts)
    expect(contentAfterSecond).toContain('Hash Table Visualization (Size: 7)');
    expect(contentAfterSecond).toContain('<table>');
    // Ensure content remains consistent (not appended duplicates)
    // We check that the occurrence count of '<table>' is exactly 1
    const tableTagMatches = (contentAfterSecond.match(/<table/g) || []).length;
    expect(tableTagMatches).toBe(1);

    // Ensure no runtime errors during repeated clicks
    expect(demoPage.pageErrors.length).toBe(0);
    expect(demoPage.consoleErrors.length).toBe(0);
  });

  test('Interacting outside the Run Demonstration button does not trigger the visualization', async ({ page }) => {
    // This test checks that clicking elsewhere on the page does not accidentally trigger the Run Demonstration event.
    // It validates that the event binding is specific to #demo-btn.

    // Record initial visual content
    const initialContent = await demoPage.getVisualInnerHTML();
    // Click on the body (outside button)
    await page.click('body', { position: { x: 5, y: 5 } });
    // Wait briefly for any accidental side-effects
    await page.waitForTimeout(200);

    const contentAfterClick = await demoPage.getVisualInnerHTML();
    // No change should have occurred
    expect(contentAfterClick).toBe(initialContent);

    // Ensure no page errors were created by the click
    expect(demoPage.pageErrors.length).toBe(0);
    expect(demoPage.consoleErrors.length).toBe(0);
  });

  test('Accessibility and attributes: demo button is clickable and styled', async ({ page }) => {
    // This test validates presence of the component and some basic attributes/styles as visual feedback.
    const btn = await demoPage.getDemoButton();
    expect(btn).not.toBeNull();

    // Ensure the button is visible and enabled for clicking
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();

    // Basic style check: background-color should be the expected computed color (not enforcing exact color value across browsers,
    // but ensure some background-color is set)
    const bgColor = await page.$eval('#demo-btn', (el) => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toBeTruthy();

    // No errors should have occurred while querying styles
    expect(demoPage.pageErrors.length).toBe(0);
  });

  test('FSM evidence checks: verify extracted component and event handler behavior', async ({ page }) => {
    // This test cross-checks the FSM extraction summary / evidence:
    // - The demo button is present (component evidence)
    // - There is an event listener attached reacting to clicks (event evidence) by observing DOM change
    // - Transition observable (visualization appears) occurs

    // Component evidence
    const btnOuterHtml = await page.$eval('#demo-btn', (el) => el.outerHTML);
    expect(btnOuterHtml).toContain('Run Demonstration');

    // Event evidence: confirm that clicking causes the visual container to change from placeholder to a table
    const before = await demoPage.getTextContentOfVisual();
    expect(before).toContain('Hash table will appear here');

    await demoPage.clickDemoButton();
    await page.waitForSelector('#hash-table-visual table', { timeout: 2000 });
    const after = await demoPage.getTextContentOfVisual();
    expect(after).not.toContain('Hash table will appear here');
    expect(after).toContain('Hash Table Visualization (Size: 7)');

    // No runtime errors as part of this evidence collection
    expect(demoPage.pageErrors.length).toBe(0);
  });

  test('Edge case: ensure table cells for empty buckets indicate "(empty)" as expected', async ({ page }) => {
    // This test verifies that empty buckets are represented as "(empty)" per the implementation.
    await demoPage.clickDemoButton();
    await page.waitForSelector('#hash-table-visual table', { timeout: 2000 });

    const visualText = await demoPage.getTextContentOfVisual();
    // Implementation lists (empty) for indices 5 and 6; verify at least one "(empty)" appears
    expect(visualText).toContain('(empty)');

    // Check specific row for index 5 or 6 includes '(empty)' - a robust check across browsers
    const hasEmptyAtIndex5or6 = /5[\s\S]{0,120}\(empty\)|6[\s\S]{0,120}\(empty\)/i.test(visualText);
    expect(hasEmptyAtIndex5or6).toBeTruthy();

    // Ensure no errors surfaced
    expect(demoPage.pageErrors.length).toBe(0);
  });
});