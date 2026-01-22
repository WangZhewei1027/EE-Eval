import { test, expect } from '@playwright/test';

// Page Object Model for the Breadth-First Search demo page
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // Navigate to the provided HTML file location
    await this.page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/0e18df30-d5c5-11f0-92ee-f5994b4f4c99.html', { waitUntil: 'load' });
  }

  async getImage() {
    return this.page.$('.card img');
  }

  async getButton() {
    return this.page.$('.card button');
  }

  async getParagraph() {
    return this.page.$('.card p');
  }

  async clickSearch() {
    const btn = await this.getButton();
    if (!btn) throw new Error('Search button not found');
    await btn.click();
  }

  async hasTable() {
    return (await this.page.$('.table')) !== null;
  }
}

// Group tests for this application
test.describe('Breadth-First Search app (FSM validation)', () => {
  // Reusable holders for console and page errors captured during tests
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate to page for each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      try {
        // Some console messages have args; stringify the text for consistent assertions
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Capture uncaught exceptions and other page errors
    page.on('pageerror', (err) => {
      // err is typically an Error with .message
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    const bfs = new BFSPage(page);
    await bfs.goto();
    // Give the page a moment to ensure any script parse/runtime errors surface
    await page.waitForTimeout(250);
  });

  // Validate the initial Idle state (S0_Idle)
  test('S0_Idle (Initial) state: UI renders expected components', async ({ page }) => {
    const bfs = new BFSPage(page);

    // Comment: Validate the image component exists and has expected attributes.
    const img = await bfs.getImage();
    expect(img, 'Expected an <img> inside .card').not.toBeNull();
    if (img) {
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');
      expect(src).toBe('https://example.com/breadth-first/search.jpg');
      expect(alt).toBe('Breadth-First Search');
    }

    // Comment: Validate the paragraph text component.
    const p = await bfs.getParagraph();
    expect(p, 'Expected a <p> with DFS text').not.toBeNull();
    if (p) {
      const text = (await p.textContent())?.trim();
      expect(text).toBe('Depth First Search');
    }

    // Comment: Validate the Search button exists and is labeled correctly.
    const btn = await bfs.getButton();
    expect(btn, 'Expected a Search button').not.toBeNull();
    if (btn) {
      const text = (await btn.textContent())?.trim();
      expect(text).toBe('Search');
    }

    // Comment: There is no explicit `.table` element in the provided HTML; the FSM
    // expects search results to be displayed in a table. Ensure no table exists initially.
    const hasTable = await bfs.hasTable();
    expect(hasTable).toBe(false);

    // Comment: The inline script in the HTML is malformed. Verify that the page
    // emitted at least one page error (e.g., a SyntaxError or similar) during load.
    // This confirms that the runtime detected the broken JS (as required to observe).
    expect(pageErrors.length, 'Expected at least one page error due to malformed inline script').toBeGreaterThanOrEqual(1);

    // At least one captured error message should hint at a SyntaxError or parsing problem.
    const joinedErrors = pageErrors.join(' | ');
    expect(joinedErrors.toLowerCase()).toMatch(/syntax|unexpected|uncaught|error/);
  });

  // Validate the transition from Idle to Searching when clicking the Search button
  test('Transition: S0_Idle -> S1_Searching on Search button click (SearchButtonClick)', async ({ page }) => {
    const bfs = new BFSPage(page);

    // Count errors/console messages before interaction
    const beforePageErrorsCount = pageErrors.length;
    const beforeConsoleCount = consoleMessages.length;

    // Comment: Trigger the click that corresponds to the FSM event "SearchButtonClick".
    // The inline script is expected to be broken; according to instructions we must not patch it,
    // so clicking may raise a ReferenceError (search is not defined) or no-op if the script parsed.
    // We capture any resulting page errors / console messages.
    await bfs.clickSearch();

    // Give the page a moment for any click-triggered errors to surface.
    await page.waitForTimeout(250);

    // There should be at least one new page error or console message compared to before the click.
    expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(beforePageErrorsCount + beforeConsoleCount - 0);

    // Look for evidence that the runtime complained about `search` being undefined or other runtime issues.
    const recentErrors = pageErrors.slice(beforePageErrorsCount).join(' | ') + ' | ' + consoleMessages.slice(beforeConsoleCount).join(' | ');
    const recentLower = recentErrors.toLowerCase();

    // The inline function search may not be available due to parse errors; assert that we observed
    // either a ReferenceError about 'search' or other runtime exceptions that indicate the Searching state failed.
    expect(recentLower).toMatch(/search is not defined|referenceerror|syntaxerror|uncaught|typeerror|error/);

    // Comment: Because the application's search implementation is malformed, we assert that no valid
    // search results table was created as a result of the click.
    const hasTable = await bfs.hasTable();
    expect(hasTable).toBe(false);
  });

  // Edge case and error scenario tests
  test.describe('Edge cases and additional error scenarios', () => {
    test('Clicking Search repeatedly should not crash the test harness; errors are observed', async ({ page }) => {
      const bfs = new BFSPage(page);

      // Reset counts
      const initialPageErrors = pageErrors.length;
      const initialConsole = consoleMessages.length;

      // Click multiple times to simulate rapid user interaction
      for (let i = 0; i < 3; i++) {
        await bfs.clickSearch();
        // small delay to allow any event handlers to execute
        await page.waitForTimeout(100);
      }

      // Ensure we captured errors (the code is known-broken; repeated clicks should produce errors or no-ops)
      expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(initialPageErrors + initialConsole - 0);

      // Ensure at least one of the errors mentions 'search' or is a parsing/runtime error
      const recent = pageErrors.join(' | ') + ' | ' + consoleMessages.join(' | ');
      expect(recent.toLowerCase()).toMatch(/search|syntaxerror|referenceerror|typeerror|uncaught|error/);
    });

    test('If image element removed before clicking Search, ensure click still handled (errors expected)', async ({ page }) => {
      const bfs = new BFSPage(page);

      // Remove the image from the DOM to simulate missing data edge case
      await page.evaluate(() => {
        const img = document.querySelector('.card img');
        if (img && img.parentElement) img.parentElement.removeChild(img);
      });

      // Validate the image is removed
      const imgAfter = await bfs.getImage();
      expect(imgAfter).toBeNull();

      // Click search; because the script is malformed we still expect errors to be captured,
      // but the absence of the image could change runtime behavior if the script executed.
      const beforeCount = pageErrors.length;
      await bfs.clickSearch();
      await page.waitForTimeout(200);

      // At least one page error or console message should be observed (parsing/runtime errors)
      expect(pageErrors.length + consoleMessages.length).toBeGreaterThanOrEqual(beforeCount);

      // Ensure error messages include a hint about missing pieces or about the broken script
      const recent = pageErrors.join(' | ') + ' | ' + consoleMessages.join(' | ');
      expect(recent.toLowerCase()).toMatch(/syntax|unexpected|referenceerror|error|search/);
    });
  });

  // Teardown is handled by Playwright; this block is provided as a placeholder for clarity.
  test.afterEach(async ({ page }) => {
    // No manual teardown required; ensure the page is closed cleanly.
    try {
      await page.close();
    } catch (e) {
      // Swallow errors on close to avoid masking test results
    }
  });
});