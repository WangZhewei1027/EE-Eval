import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324dade2-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object Model for the Ternary Search demo page
class TernarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = '#arrayInput';
    this.targetInput = '#targetInput';
    this.searchButton = "button[onclick='performTernarySearch()']";
    this.resultDiv = '#result';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillArray(value) {
    await this.page.fill(this.arrayInput, value);
  }

  async fillTarget(value) {
    await this.page.fill(this.targetInput, value);
  }

  async clickSearch() {
    await Promise.all([
      // clicking may update DOM; wait for any potential navigation (none expected) or handlers
      this.page.waitForTimeout(10), // small wait to let click-triggered sync updates run
      this.page.click(this.searchButton)
    ]);
  }

  async getResultText() {
    return (await this.page.locator(this.resultDiv).innerText()).trim();
  }

  async waitForResultNonEmpty(timeout = 2000) {
    await this.page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.innerText && el.innerText.trim().length > 0;
    }, this.resultDiv, { timeout });
  }
}

test.describe('Ternary Search Demo - FSM and UI tests', () => {
  // Capture console error messages and page errors during each test
  test.beforeEach(async ({ page }) => {
    // Attach listeners to collect console.error messages and uncaught page errors
    page['_collectedConsoleErrors'] = [];
    page['_collectedPageErrors'] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        page['_collectedConsoleErrors'].push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', err => {
      page['_collectedPageErrors'].push(err);
    });
  });

  // Basic smoke test: Idle state verification
  test('S0_Idle: initial Idle state renders expected controls and no initial errors', async ({ page }) => {
    const app = new TernarySearchPage(page);
    // Navigate to the page (entry action of FSM S0 would have been renderPage() per model; page should render)
    await app.goto();

    // Validate that inputs and button exist and are visible (evidence of Idle state)
    await expect(page.locator(app.arrayInput)).toBeVisible();
    await expect(page.locator(app.targetInput)).toBeVisible();
    const button = page.locator(app.searchButton);
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Search');

    // result div should be present and initially empty
    await expect(page.locator(app.resultDiv)).toBeVisible();
    const initialResult = await page.locator(app.resultDiv).innerText();
    expect(initialResult.trim()).toBe('', 'Result div should be empty on initial Idle state');

    // Assert that no console.error or pageerror occurred during load
    expect(page['_collectedConsoleErrors'].length).toBe(0);
    expect(page['_collectedPageErrors'].length).toBe(0);
  });

  // Transition: Idle -> Searching -> Result (target present)
  test('S1_Searching -> S2_Result: clicking Search finds a present target and updates DOM', async ({ page }) => {
    const app1 = new TernarySearchPage(page);
    await app.goto();

    // Fill inputs with a sorted array and a target that exists
    await app.fillArray('1, 2, 3, 4, 5, 6, 7');
    await app.fillTarget('5');

    // Click the Search button (triggers performTernarySearch)
    await app.clickSearch();

    // Wait for result text to be set by the page script
    await app.waitForResultNonEmpty();

    const resultText = await app.getResultText();
    // Verify result indicates found and contains index and array evidence
    expect(resultText.toLowerCase()).toContain('found');
    expect(resultText).toContain('Target 5');
    expect(resultText).toContain('in the array');

    // Check that the reported index is correct for a sorted 1..7 (index should be 4)
    const indexMatch = resultText.match(/index:\s*([0-9]+)/);
    expect(indexMatch).not.toBeNull();
    const index = parseInt(indexMatch[1], 10);
    expect(index).toBe(4);

    // Ensure no runtime errors were emitted during this interaction
    expect(page['_collectedConsoleErrors'].length).toBe(0);
    expect(page['_collectedPageErrors'].length).toBe(0);
  });

  // Transition: Idle -> Searching -> NotFound (target absent)
  test('S1_Searching -> S3_NotFound: clicking Search reports not found for absent target', async ({ page }) => {
    const app2 = new TernarySearchPage(page);
    await app.goto();

    await app.fillArray('1,2,3,4,5');
    await app.fillTarget('10');

    await app.clickSearch();

    await app.waitForResultNonEmpty();
    const resultText1 = await app.getResultText();

    expect(resultText.toLowerCase()).toContain('not found');
    expect(resultText).toContain('Target 10');
    expect(resultText).toContain('in the array');

    // No errors expected
    expect(page['_collectedConsoleErrors'].length).toBe(0);
    expect(page['_collectedPageErrors'].length).toBe(0);
  });

  // Edge case: single-element array where target exists
  test('Edge: single-element array with matching target should be found (index 0)', async ({ page }) => {
    const app3 = new TernarySearchPage(page);
    await app.goto();

    await app.fillArray('42');
    await app.fillTarget('42');

    await app.clickSearch();

    await app.waitForResultNonEmpty();
    const resultText2 = await app.getResultText();

    expect(resultText.toLowerCase()).toContain('found');
    expect(resultText).toContain('index: 0');

    expect(page['_collectedConsoleErrors'].length).toBe(0);
    expect(page['_collectedPageErrors'].length).toBe(0);
  });

  // Edge case: array with duplicate values - target may be at any of the duplicate indices
  test('Edge: array with duplicates should report an index within the duplicate range', async ({ page }) => {
    const app4 = new TernarySearchPage(page);
    await app.goto();

    // duplicate 2s at indices 1..3 in a zero-based array
    await app.fillArray('1,2,2,2,3');
    await app.fillTarget('2');

    await app.clickSearch();

    await app.waitForResultNonEmpty();
    const resultText3 = await app.getResultText();

    expect(resultText.toLowerCase()).toContain('found');
    const indexMatch1 = resultText.match(/index:\s*([0-9]+)/);
    expect(indexMatch).not.toBeNull();
    const index1 = parseInt(indexMatch[1], 10);
    // The algorithm could return any index of the duplicates; ensure it's one of the valid positions
    expect(index).toBeGreaterThanOrEqual(1);
    expect(index).toBeLessThanOrEqual(3);

    expect(page['_collectedConsoleErrors'].length).toBe(0);
    expect(page['_collectedPageErrors'].length).toBe(0);
  });

  // Edge case: non-numeric inputs should not crash the page; expect "not found" behavior
  test('Edge: non-numeric array inputs do not throw and result in not-found', async ({ page }) => {
    const app5 = new TernarySearchPage(page);
    await app.goto();

    await app.fillArray('a, b, c');
    await app.fillTarget('1');

    await app.clickSearch();

    await app.waitForResultNonEmpty();
    const resultText4 = await app.getResultText();

    // Non-numeric parseInt() produces NaN; comparisons won't match, expect not found
    expect(resultText.toLowerCase()).toContain('not found');

    // Confirm no uncaught console errors or page errors emitted
    expect(page['_collectedConsoleErrors'].length).toBe(0);
    expect(page['_collectedPageErrors'].length).toBe(0);
  });

  // Edge case: empty input - ensure page handles gracefully and does not throw
  test('Edge: empty array and/or empty target handled without runtime errors', async ({ page }) => {
    const app6 = new TernarySearchPage(page);
    await app.goto();

    // Leave array and target empty
    await app.fillArray('');
    await app.fillTarget('');

    await app.clickSearch();

    await app.waitForResultNonEmpty();
    const resultText5 = await app.getResultText();

    // With empty inputs, parseInt produces NaN and result should indicate not found
    expect(resultText.toLowerCase()).toContain('not found');

    // Ensure no console errors or uncaught page errors occurred
    expect(page['_collectedConsoleErrors'].length).toBe(0);
    expect(page['_collectedPageErrors'].length).toBe(0);
  });

  // Verify the event binding evidence: the search button has the onclick attribute wired to performTernarySearch()
  test('Evidence: search button contains onclick attribute calling performTernarySearch()', async ({ page }) => {
    const app7 = new TernarySearchPage(page);
    await app.goto();

    const button1 = page.locator(app.searchButton);
    // Ensure the button exists and has the expected onclick attribute in the raw DOM
    const onclickAttr = await page.$eval(app.searchButton, el => el.getAttribute('onclick'));
    expect(onclickAttr).toBe('performTernarySearch()');

    // No runtime errors expected from just checking attributes
    expect(page['_collectedConsoleErrors'].length).toBe(0);
    expect(page['_collectedPageErrors'].length).toBe(0);
  });

  // Validate that performing many searches in sequence does not lead to uncaught errors (stability test)
  test('Stability: repeated searches do not produce uncaught runtime errors', async ({ page }) => {
    const app8 = new TernarySearchPage(page);
    await app.goto();

    const scenarios = [
      { arr: '1,2,3,4,5', t: '3', expectFound: true },
      { arr: '10,20,30', t: '25', expectFound: false },
      { arr: '5', t: '5', expectFound: true },
      { arr: 'a,b,c', t: '1', expectFound: false },
      { arr: '', t: '', expectFound: false }
    ];

    for (const s of scenarios) {
      await app.fillArray(s.arr);
      await app.fillTarget(s.t);
      await app.clickSearch();
      await app.waitForResultNonEmpty();
      const txt = (await app.getResultText()).toLowerCase();
      if (s.expectFound) {
        expect(txt).toContain('found');
      } else {
        expect(txt).toContain('not found');
      }
    }

    // Ensure the page stayed error-free throughout repeated interactions
    expect(page['_collectedConsoleErrors'].length).toBe(0);
    expect(page['_collectedPageErrors'].length).toBe(0);
  });
});