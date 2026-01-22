import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3afd32-d360-11f0-b42e-71f0e7238799.html';

// Page Object to encapsulate interactions with the Union-Find app
class UFPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.element1 = page.locator('#element1');
    this.element2 = page.locator('#element2');
    this.unionButton = page.locator("button[onclick='union()']");
    this.findButton = page.locator("button[onclick='find()']");
    this.output = page.locator('#output');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setElement1(value) {
    // Use fill to set input (value can be empty string to clear)
    await this.element1.fill(String(value));
  }

  async setElement2(value) {
    await this.element2.fill(String(value));
  }

  async clickUnion() {
    await this.unionButton.click();
  }

  async clickFind() {
    await this.findButton.click();
  }

  async getOutputText() {
    const txt = await this.output.textContent();
    return txt === null ? '' : txt.trim();
  }

  async getHeadingText() {
    const txt = await this.heading.textContent();
    return txt === null ? '' : txt.trim();
  }

  // Access the underlying UnionFind data structure on the page
  async getUFParents() {
    return await this.page.evaluate(() => {
      // Access window.uf if it exists; do not modify it
      return window.uf ? window.uf.parent.slice() : null;
    });
  }

  async findRootViaUF(elem) {
    return await this.page.evaluate((e) => {
      return window.uf ? window.uf.find(Number(e)) : null;
    }, elem);
  }
}

test.describe('Union-Find (Disjoint Set) Visualization - FSM tests', () => {
  let page;
  let ufPage;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh page for each test to avoid cross-test state leakage
    page = await browser.newPage();
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors (JS runtime console.error)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught page errors (exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    ufPage = new UFPage(page);
    await ufPage.goto();
  });

  test.afterEach(async () => {
    // Assert that no console errors or page errors occurred during the test.
    // The app as provided should not produce runtime exceptions; this validates that.
    expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);

    // Clean up
    await page.close();
  });

  test('Initial Idle state renders page correctly (S0_Idle)', async () => {
    // Validate the app's initial rendering - corresponds to the S0_Idle state entry action renderPage()
    const heading = await ufPage.getHeadingText();
    expect(heading).toBe('Union-Find (Disjoint Set) Visualization');

    // Inputs exist and are empty
    expect(await page.locator('#element1').isVisible()).toBeTruthy();
    expect(await page.locator('#element2').isVisible()).toBeTruthy();
    expect(await page.locator('#element1').inputValue()).toBe('');
    expect(await page.locator('#element2').inputValue()).toBe('');

    // Output area should be empty initially
    const output = await ufPage.getOutputText();
    expect(output).toBe('');
  });

  test('Union transition: valid union updates output and UF structure (S1_UnionCompleted)', async () => {
    // This test validates the union event and the transition to S1_UnionCompleted
    // 1) Enter valid elements
    await ufPage.setElement1(2);
    await ufPage.setElement2(3);

    // 2) Click Union
    await ufPage.clickUnion();

    // 3) Output text should reflect completion
    const output = await ufPage.getOutputText();
    expect(output).toBe('Union of 2 and 3 completed.');

    // 4) Underlying UF structure should have 2 and 3 sharing the same root
    const root2 = await ufPage.findRootViaUF(2);
    const root3 = await ufPage.findRootViaUF(3);
    expect(root2).toBeDefined();
    expect(root3).toBeDefined();
    expect(root2).toBe(root3); // They should belong to same set after union
  });

  test('Find transition: returns correct root after unions (S2_FindCompleted)', async () => {
    // This test validates performing union(s) then a find and the transition to S2_FindCompleted

    // Create a union between 4 and 5 first
    await ufPage.setElement1(4);
    await ufPage.setElement2(5);
    await ufPage.clickUnion();
    expect(await ufPage.getOutputText()).toBe('Union of 4 and 5 completed.');

    // Now perform a find on element1 (using the find button which reads #element1)
    await ufPage.setElement1(5);
    // Ensure element2 not interfering (it is ignored by find)
    await ufPage.setElement2('');
    await ufPage.clickFind();

    // The output should indicate the root
    const findOutput = await ufPage.getOutputText();
    // Compute actual root via the in-page UF and assert the displayed text matches
    const actualRoot = await ufPage.findRootViaUF(5);
    expect(findOutput).toBe(`The root of 5 is ${actualRoot}.`);
  });

  test('Union: invalid inputs show error message (S3_InvalidInput) - out of range and empty', async () => {
    // Case A: out of range values
    await ufPage.setElement1(10); // invalid (>9)
    await ufPage.setElement2(-1); // invalid (<0)
    await ufPage.clickUnion();
    let output = await ufPage.getOutputText();
    expect(output).toBe('Please enter valid elements (0-9).');

    // Case B: empty inputs
    await ufPage.setElement1(''); // blank
    await ufPage.setElement2('');
    await ufPage.clickUnion();
    output = await ufPage.getOutputText();
    expect(output).toBe('Please enter valid elements (0-9).');
  });

  test('Find: invalid input shows error message (S3_InvalidInput) - empty and out of range', async () => {
    // Case A: empty input for find
    await ufPage.setElement1(''); // find reads element1
    await ufPage.clickFind();
    let output = await ufPage.getOutputText();
    expect(output).toBe('Please enter a valid element (0-9).');

    // Case B: out of range
    await ufPage.setElement1(11);
    await ufPage.clickFind();
    output = await ufPage.getOutputText();
    expect(output).toBe('Please enter a valid element (0-9).');
  });

  test('Edge case: union the same element and then find it (idempotent case)', async () => {
    // Union element with itself should still produce a completion message and not break UF
    await ufPage.setElement1(7);
    await ufPage.setElement2(7);
    await ufPage.clickUnion();
    expect(await ufPage.getOutputText()).toBe('Union of 7 and 7 completed.');

    // Finding 7 should return its root (likely 7)
    await ufPage.setElement1(7);
    await ufPage.clickFind();
    const findOutput = await ufPage.getOutputText();
    const actualRoot = await ufPage.findRootViaUF(7);
    expect(findOutput).toBe(`The root of 7 is ${actualRoot}.`);
  });

  test('Multiple unions create expected connected components (integration check)', async () => {
    // Perform a chain of unions: (0,1), (1,2), (2,3) and assert they all share same root
    await ufPage.setElement1(0);
    await ufPage.setElement2(1);
    await ufPage.clickUnion();
    expect(await ufPage.getOutputText()).toBe('Union of 0 and 1 completed.');

    await ufPage.setElement1(1);
    await ufPage.setElement2(2);
    await ufPage.clickUnion();
    expect(await ufPage.getOutputText()).toBe('Union of 1 and 2 completed.');

    await ufPage.setElement1(2);
    await ufPage.setElement2(3);
    await ufPage.clickUnion();
    expect(await ufPage.getOutputText()).toBe('Union of 2 and 3 completed.');

    // Validate via underlying UF parents that 0,1,2,3 have same root
    const r0 = await ufPage.findRootViaUF(0);
    const r1 = await ufPage.findRootViaUF(1);
    const r2 = await ufPage.findRootViaUF(2);
    const r3 = await ufPage.findRootViaUF(3);
    expect(r0).toBeDefined();
    expect(r0).toBe(r1);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });
});