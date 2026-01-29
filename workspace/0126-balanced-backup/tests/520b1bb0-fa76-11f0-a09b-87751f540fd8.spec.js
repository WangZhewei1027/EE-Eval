import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b1bb0-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Software Development Life Cycle - FSM (Idle state) validations', () => {
  // Arrays to capture runtime console messages and page errors observed during navigation
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and categorize them
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture page errors (uncaught exceptions in the page)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application under test and wait for network idle
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Clear captured arrays (helpful if tests are extended)
    consoleMessages = [];
    pageErrors = [];
  });

  test('Idle state: page renders the main heading and life-cycle container', async ({ page }) => {
    // This test verifies the visual evidence of the Idle state:
    // - The <h2> heading with expected text is present
    // - The main container with .life-cycle exists
    const heading = await page.locator('.life-cycle h2');
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText('Software Development Life Cycle');

    const container = await page.locator('.life-cycle');
    await expect(container).toHaveCount(1);
  });

  test('Idle state: all phases (Phase 1..6) are present as strong elements', async ({ page }) => {
    // Validate that the content describing phases is present.
    const strongs = await page.locator('.life-cycle p strong').allTextContents();
    // Expect at least 6 strong entries, each including "Phase X"
    expect(strongs.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i <= 6; i++) {
      const expected = `Phase ${i}`;
      const found = strongs.some((text) => text.includes(expected));
      expect(found).toBeTruthy();
    }
  });

  test('Visual assets: images exist and have descriptive alt attributes', async ({ page }) => {
    // Verify there are multiple images and each has a non-empty alt attribute
    const imgs = await page.locator('.life-cycle img').elementHandles();
    expect(imgs.length).toBeGreaterThanOrEqual(6);

    for (const imgHandle of imgs) {
      const alt = await imgHandle.getAttribute('alt');
      expect(typeof alt).toBe('string');
      expect(alt.trim().length).toBeGreaterThan(0);
    }
  });

  test('Entry action "renderPage" is not defined on the page and calling it throws a ReferenceError/TypeError', async ({ page }) => {
    // The FSM mentions an entry action renderPage(), but the HTML/JS has no such function.
    // We intentionally attempt to call renderPage() inside the page context and assert that it rejects.
    // We do NOT inject or define renderPage; we allow the runtime to throw naturally.
    await expect(page.evaluate(() => {
      // Direct call without checking existence to allow a natural ReferenceError
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow(/renderPage|ReferenceError|is not a function|not defined/i);
  });

  test('Attempting to invoke a non-existent transition function throws (edge case)', async ({ page }) => {
    // FSM has no transitions, so transition functions should not exist. Call a made-up function.
    await expect(page.evaluate(() => {
      // Call a deliberately undefined function to let the runtime throw naturally.
      // eslint-disable-next-line no-undef
      return transitionToState();
    })).rejects.toThrow(/transitionToState|ReferenceError|is not a function|not defined/i);
  });

  test('There are no interactive elements like buttons/inputs/links present (as per extraction summary)', async ({ page }) => {
    // The FSM/extraction summary indicated no interactive elements were found.
    const interactiveCount = await page.evaluate(() => {
      return document.querySelectorAll('button, input, textarea, select, a').length;
    });
    expect(interactiveCount).toBe(0);
  });

  test('No runtime page errors were emitted during page load', async ({ page }) => {
    // Assert that no uncaught page errors occurred while loading the page
    expect(pageErrors.length).toBe(0);

    // Also assert there were no console messages of type 'error'
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: querying non-existent elements returns null and is handled gracefully', async ({ page }) => {
    // Ensure queries for elements that don't exist yield null and do not crash the environment
    const nonExistent = await page.evaluate(() => {
      const el = document.querySelector('.non-existent-element');
      return el === null;
    });
    expect(nonExistent).toBe(true);
  });

  test('Sanity check: number of paragraphs matches expected descriptive blocks', async ({ page }) => {
    // There are expected to be descriptive paragraphs for each phase (6) plus maybe extra content.
    const paragraphs = await page.locator('.life-cycle p').allTextContents();
    // Ensure at least 6 paragraphs describing the 6 phases
    expect(paragraphs.length).toBeGreaterThanOrEqual(6);
    // Basic content sanity: each paragraph should mention keywords like "phase" or descriptive verbs
    for (let i = 0; i < 6; i++) {
      const text = paragraphs[i].toLowerCase();
      const containsKeyword = text.includes('phase') || text.includes('gather') || text.includes('design') || text.includes('test') || text.includes('deploy') || text.includes('maintain') || text.includes('implementation');
      expect(containsKeyword).toBe(true);
    }
  });
});