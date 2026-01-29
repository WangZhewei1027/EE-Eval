import { test, expect } from '@playwright/test';

// Page Object Model for the Arrays demo page
class ArraysDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Buttons
    this.createBtn = page.locator('button[onclick="createArrays()"]');
    this.accessBtn = page.locator('button[onclick="accessElements()"]');
    this.modifyBtn = page.locator('button[onclick="modifyArrays()"]');
    this.methodsBtn = page.locator('button[onclick="arrayMethods()"]');
    this.iterateBtn = page.locator('button[onclick="iterateArrays()"]');
    this.destructBtn = page.locator('button[onclick="arrayDestructuring()"]');

    // Output areas
    this.createOutput = page.locator('#createArraysOutput');
    this.accessOutput = page.locator('#accessElementsOutput');
    this.modifyOutput = page.locator('#modifyArraysOutput');
    this.methodsOutput = page.locator('#arrayMethodsOutput');
    this.iterateOutput = page.locator('#iterateArraysOutput');
    this.destructOutput = page.locator('#arrayDestructuringOutput');
  }

  // Click actions
  async clickCreate() { await this.createBtn.click(); }
  async clickAccess() { await this.accessBtn.click(); }
  async clickModify() { await this.modifyBtn.click(); }
  async clickMethods() { await this.methodsBtn.click(); }
  async clickIterate() { await this.iterateBtn.click(); }
  async clickDestruct() { await this.destructBtn.click(); }

  // Helpers to read output text
  async getCreateText() { return this.createOutput.innerText(); }
  async getAccessText() { return this.accessOutput.innerText(); }
  async getModifyText() { return this.modifyOutput.innerText(); }
  async getMethodsText() { return this.methodsOutput.innerText(); }
  async getIterateText() { return this.iterateOutput.innerText(); }
  async getDestructText() { return this.destructOutput.innerText(); }

  // Helpers to count elements inside outputs
  async countCreateParagraphs() { return this.page.locator('#createArraysOutput p').count(); }
  async countIterateSectionListItems(sectionHeadingText) {
    // Count list items in a specific subsection created by iterateArrays (by heading)
    const heading = this.page.locator(`#iterateArraysOutput h3`, { hasText: sectionHeadingText });
    const list = heading.locator('xpath=following-sibling::ul[1]'); // first ul after the h3
    return list.locator('li').count();
  }
}

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3a5300-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('JavaScript Arrays Demo (FSM-driven tests)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  // Setup: navigate and attach listeners to capture console messages and page errors
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture runtime page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      // collect the error message and name to assert later
      pageErrors.push({ message: String(err.message), name: err.name, stack: err.stack || '' });
    });

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // For debugging during test runs, if there were page errors or console errors, dump them to the Playwright trace logs
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors);
      // eslint-disable-next-line no-console
      console.log('Captured console errors:', consoleErrors);
    }
  });

  test('S0_Idle: Page loads and Idle state has all expected controls', async ({ page }) => {
    // Validate initial UI elements (Idle state from FSM)
    const p = new ArraysDemoPage(page);

    // Ensure all six buttons are visible and have expected text
    await expect(p.createBtn).toBeVisible();
    await expect(p.createBtn).toHaveText('Create Arrays');

    await expect(p.accessBtn).toBeVisible();
    await expect(p.accessBtn).toHaveText('Access Elements');

    await expect(p.modifyBtn).toBeVisible();
    await expect(p.modifyBtn).toHaveText('Modify Arrays');

    await expect(p.methodsBtn).toBeVisible();
    await expect(p.methodsBtn).toHaveText('Show Array Methods');

    await expect(p.iterateBtn).toBeVisible();
    await expect(p.iterateBtn).toHaveText('Iterate Arrays');

    await expect(p.destructBtn).toBeVisible();
    await expect(p.destructBtn).toHaveText('Show Destructuring');

    // Assert there are no runtime errors or console errors immediately after load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Transitions from Idle -> specific states', () => {

    test('S0 -> S1 ArraysCreated: clicking Create Arrays renders fruit, numbers, empty and mixed arrays', async ({ page }) => {
      // This test validates the CreateArrays transition and evidence paragraphs
      const p1 = new ArraysDemoPage(page);

      // Click the button to trigger createArrays()
      await p.clickCreate();

      // The function sets innerHTML='' at start, then appends 4 <p> paragraphs.
      // Assert the correct number of paragraphs exist and specific content appears.
      await expect(p.createOutput.locator('p')).toHaveCount(4);

      const text = await p.getCreateText();
      // Check key evidence strings per FSM
      expect(text).toContain('Fruits array:');
      expect(text).toContain('Apple');
      expect(text).toContain('Numbers array:');
      expect(text).toContain('"1"'); // numbers array stringified contains 1, but ensure at least numbers present
      expect(text).toContain('Empty array: []');
      expect(text).toContain('Mixed array:');

      // Edge: clicking twice should not create duplicated content because the function clears the output at the start
      await p.clickCreate();
      // still 4 paragraphs
      await expect(p.createOutput.locator('p')).toHaveCount(4);

      // No runtime page errors from the click handler
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('S0 -> S2 ElementsAccessed: clicking Access Elements shows first/second/last color evidence', async ({ page }) => {
      // Validate accessElements() output
      const p2 = new ArraysDemoPage(page);

      await p.clickAccess();

      // Expect 4 paragraphs: Colors array + First + Second + Last
      await expect(p.accessOutput.locator('p')).toHaveCount(4);

      const text1 = await p.getAccessText();
      expect(text).toContain('Colors array:');
      expect(text).toContain('First color: Red');
      expect(text).toContain('Second color: Green');
      expect(text).toContain('Last color: Blue');

      // Edge case: click again quickly to ensure clearing works reliably
      await Promise.all([p.clickAccess(), p.clickAccess()]); // two quick clicks
      await expect(p.accessOutput.locator('p')).toHaveCount(4);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('S0 -> S3 ArraysModified: clicking Modify Arrays shows modification sequence including push/pop/unshift/shift', async ({ page }) => {
      // Validate modifyArrays() output
      const p3 = new ArraysDemoPage(page);

      await p.clickModify();

      // The function appends multiple <p> elements describing each step.
      // Check the presence of each step's evidence text
      const text2 = await p.getModifyText();
      expect(text).toContain('Original array:');
      expect(text).toContain('["Dog","Cat","Elephant"]'); // original array stringified
      expect(text).toContain('After modifying index 1:');
      expect(text).toContain('["Dog","Lion","Elephant"]');
      expect(text).toContain("After push('Giraffe')"); // evidence shows push
      expect(text).toContain('Giraffe');
      expect(text).toContain('After pop(): removed Giraffe'); // pop removed Giraffe
      expect(text).toContain("After unshift('Zebra')"); // unshift added Zebra
      expect(text).toContain('After shift(): removed'); // shift removed something (Zebra)

      // Edge case: ensure the output is cleared each call (so multiple clicks don't accumulate)
      await p.clickModify();
      await expect(p.modifyOutput.locator('p')).toHaveCount(6); // original + modify + push + pop + unshift + shift

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('S0 -> S4 ArrayMethodsShown: clicking Show Array Methods demonstrates join, slice, splice, concat, indexOf', async ({ page }) => {
      // Validate arrayMethods() output
      const p4 = new ArraysDemoPage(page);

      await p.clickMethods();

      const text3 = await p.getMethodsText();
      expect(text).toContain('Original array:');
      expect(text).toContain('Joined with \'-\': 1-2-3-4-5');
      expect(text).toContain('Sliced (1-4):'); // slice evidence
      expect(text).toContain('[2,3,4]'.replace(/,/g, ',')); // tolerant check; just ensure numbers present
      expect(text).toContain('After splice(2, 2, 6, 7): removed');
      expect(text).toContain('After concat([8, 9]):');
      expect(text).toContain('Index of 6: 2');

      // Edge: ensure indexOf found 6 (evidence included)
      await expect(p.methodsOutput).toContainText('Index of 6: 2');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('S0 -> S5 ArraysIterated: clicking Iterate Arrays shows for loop, for...of, forEach and map results', async ({ page }) => {
      // Validate iterateArrays() output: headings and lists existence plus map method (lengths)
      const p5 = new ArraysDemoPage(page);

      await p.clickIterate();

      const text4 = await p.getIterateText();
      expect(text).toContain('Languages array:');
      expect(text).toContain('for loop:');
      expect(text).toContain('for...of loop:');
      expect(text).toContain('forEach method:');
      expect(text).toContain('map method (lengths):');

      // Verify that each list has same number of items as languages array (4)
      const countForLoop = await p.countIterateSectionListItems('for loop:');
      const countForOf = await p.countIterateSectionListItems('for...of loop:');
      const countForEach = await p.countIterateSectionListItems('forEach method:');

      expect(countForLoop).toBe(4);
      expect(countForOf).toBe(4);
      expect(countForEach).toBe(4);

      // Map result should be JSON array of lengths [10,6,4,2]
      await expect(p.iterateOutput).toContainText('[10,6,4,2]'.replace(/,/g, ','));

      // Edge: click iterate again to ensure lists are regenerated and not nested incorrectly
      await p.clickIterate();
      const countForLoopAfter = await p.countIterateSectionListItems('for loop:');
      expect(countForLoopAfter).toBe(4);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('S0 -> S6 DestructuringShown: clicking Show Destructuring demonstrates basic destructuring, skipping and default values', async ({ page }) => {
      // Validate arrayDestructuring() output
      const p6 = new ArraysDemoPage(page);

      await p.clickDestruct();

      const text5 = await p.getDestructText();
      expect(text).toContain('Original array:');
      expect(text).toContain('Basic destructuring: first=Red, second=Green, third=Blue');
      expect(text).toContain('Skipping elements: r=Red, b=Blue');
      expect(text).toContain('With default values: color4=Black'); // default value is Black

      // Edge: clicking twice does not create duplicate "Original array" entries because output cleared each time
      await p.clickDestruct();
      await expect(p.destructOutput.locator('p')).toHaveCount(4); // Original + Basic + Skipping + With default

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Integration and edge-case flows', () => {
    test('Clicking multiple different buttons in quick succession updates each section independently', async ({ page }) => {
      // Ensure independent output areas remain coherent after rapid interactions
      const p7 = new ArraysDemoPage(page);

      // Rapidly trigger create, access, and destructuring
      await Promise.all([
        p.clickCreate(),
        p.clickAccess(),
        p.clickDestruct()
      ]);

      // Each output should contain their respective evidence
      await expect(p.createOutput).toContainText('Fruits array:');
      await expect(p.accessOutput).toContainText('First color: Red');
      await expect(p.destructOutput).toContainText('Basic destructuring: first=Red');

      // Validate counts to ensure no duplicated accumulation across sections
      await expect(p.createOutput.locator('p')).toHaveCount(4);
      await expect(p.accessOutput.locator('p')).toHaveCount(4);
      await expect(p.destructOutput.locator('p')).toHaveCount(4);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge: rapid double-click on all buttons sequentially does not produce JS runtime errors', async ({ page }) => {
      const p8 = new ArraysDemoPage(page);

      // Double-click each button quickly
      await p.clickCreate();
      await p.clickCreate();

      await p.clickAccess();
      await p.clickAccess();

      await p.clickModify();
      await p.clickModify();

      await p.clickMethods();
      await p.clickMethods();

      await p.clickIterate();
      await p.clickIterate();

      await p.clickDestruct();
      await p.clickDestruct();

      // No page errors or console error messages should have happened during the rapid interactions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test('Runtime error observability: assert there are no unexpected ReferenceError/SyntaxError/TypeError on load and interactions', async ({ page }) => {
    // This test explicitly verifies that the page does not produce common runtime errors.
    // We capture pageerror and console.error in the beforeEach and assert zero occurrences here.
    // If any ReferenceError / SyntaxError / TypeError occurred naturally, this test would fail,
    // surfacing the issues in CI.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});