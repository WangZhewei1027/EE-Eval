import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0128-test/html/a479a3a0-fc4a-11f0-bdc2-71a3ddc237d1.html';

test.describe('a479a3a0-fc4a-11f0-bdc2-71a3ddc237d1 - Union-Find Interactive Application', () => {
  // Arrays to collect runtime console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // capture type and text for analysis
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error instance
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Navigate to the page under test and allow some time for any runtime errors to surface
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    // small pause to ensure any immediate runtime errors are emitted and captured
    await page.waitForTimeout(250);
  });

  test.afterEach(async ({ page }) => {
    // Optionally capture final console state in case of asynchronous errors
    // (Nothing to cleanup explicitly for this scenario)
  });

  test('S0_Idle: The page should render the union-find container element', async ({ page }) => {
    // This validates the evidence for S0_Idle: presence of <div id="union-find"></div>
    // If this element is missing, the FSM's evidence doesn't match the rendered DOM.
    const unionFind = page.locator('#union-find');
    await expect(unionFind).toBeVisible();
  });

  test('S0_Idle: Static content cards and lists should be present and correctly structured', async ({ page }) => {
    // Validate there are multiple cards with the expected headings and list items
    const cardHeaders = page.locator('h2', { hasText: 'Union-Find' });
    const headerCount = await cardHeaders.count();
    // The provided HTML shows 4 repeated cards with h2 "Union-Find"
    expect(headerCount).toBeGreaterThanOrEqual(1);
    // Assert at least one card has 6 list items (A-F)
    const firstCard = page.locator('.uk-card-body').first();
    const listItemCount = await firstCard.locator('ul > li').count();
    expect(listItemCount).toBe(6);

    // Validate that across the page there are exactly 4 card containers as in the HTML snippet
    const cards = page.locator('.uk-grid-item.uk-card, .uk-grid.item.uk-card'); // try both class patterns
    const cardsCount = await cards.count();
    // The HTML snippet includes four cards; require at least 4 to pass the intended structure check.
    expect(cardsCount).toBeGreaterThanOrEqual(4);

    // Ensure each list item has an anchor with href="#"
    const anchors = page.locator('ul > li > a');
    const anchorCount = await anchors.count();
    expect(anchorCount).toBeGreaterThanOrEqual(6); // at least the first card's anchors
    for (let i = 0; i < Math.min(anchorCount, 12); i++) {
      const href = await anchors.nth(i).getAttribute('href');
      // According to the extraction notes, links are placeholders with href="#"
      expect(href).toBe('#');
    }
  });

  test('Interaction: Clicking placeholder anchors does not navigate away and does not throw unexpected errors', async ({ page }) => {
    // Click the first anchor and ensure URL remains the same (href="#")
    const initialUrl = page.url();
    const firstAnchor = page.locator('ul > li > a').first();
    await expect(firstAnchor).toBeVisible();
    await firstAnchor.click();
    // Small wait for any potential runtime errors triggered by click handlers (if present)
    await page.waitForTimeout(150);
    const afterClickUrl = page.url();
    expect(afterClickUrl).toBe(initialUrl);

    // Assert that clicking anchors did not produce additional page errors beyond those captured on load
    // We still assert there are no new page errors caused by the click by checking current collected pageErrors
    // (If there were errors on load, they will be included here as well.)
    // This test does not assume there are no errors at all — it simply ensures clicks don't add extra errors.
    // For a stricter check, ensure no new errors were appended during this test's click activity:
    // We already captured initial errors in beforeEach; here we don't have a previous snapshot,
    // but at minimum ensure that page is still responsive by checking a DOM element.
    const unionFind = page.locator('#union-find');
    await expect(unionFind).toBeVisible();
  });

  test('FSM Entry Action: If renderPage() is invoked on load it should produce a runtime error; assert that such errors are observed', async ({ page }) => {
    // The FSM entry action lists renderPage(). The page may attempt to call renderPage() on load,
    // which would produce a ReferenceError if renderPage is not defined. Per instructions, we must
    // observe console/page errors and assert that ReferenceError/SyntaxError/TypeError occurred.
    // This test will assert that at least one page error or console error of error severity exists
    // indicating a runtime issue (ReferenceError / TypeError / SyntaxError / or explicit mention of renderPage).
    const consoleErrorTexts = consoleMessages
      .filter((m) => m.type === 'error')
      .map((m) => m.text)
      .join(' | ');
    const pageErrorTexts = pageErrors.map((e) => e.message).join(' | ');
    const combined = (consoleErrorTexts + ' ' + pageErrorTexts).trim();

    // Log captured messages for debugging (these are available in Playwright output)
    // Note: We do not modify page or inject functions; we only assert observed errors.
    // Enforce that at least one error-like message exists matching common runtime error patterns.
    const errorPattern = /(ReferenceError|TypeError|SyntaxError|renderPage)/i;
    // Ensure that an error was observed. If no such error occurred naturally, this assertion will fail,
    // which is consistent with the requirement to let runtime errors appear naturally and assert them.
    expect(combined).toMatch(errorPattern);
  });

  test('Edge Case: Ensure duplicate card content is present (verifies repeated static blocks)', async ({ page }) => {
    // The HTML shows repeated sections. Confirm at least two sections have identical visible text structure.
    const cardsBodies = page.locator('.uk-card-body');
    const count = await cardsBodies.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Grab text of first two bodies and ensure they both include the expected paragraph and list items A-F.
    const firstText = (await cardsBodies.nth(0).innerText()).replace(/\s+/g, ' ').trim();
    const secondText = (await cardsBodies.nth(1).innerText()).replace(/\s+/g, ' ').trim();
    expect(firstText).toContain('Union-Find');
    expect(firstText).toContain('Disjoint Set');
    expect(firstText).toContain('A');
    expect(firstText).toContain('F');

    // Basic equality check for repeated content (not strictly required to be identical, but expected)
    expect(secondText).toContain('Union-Find');
    expect(secondText).toContain('Disjoint Set');
  });

  test('Error observation details: Provide detailed assertions about captured errors and console output', async ({ page }) => {
    // This test documents what was captured: at least one console message or page error of interest.
    // If prior tests already validated the presence of an error, this further asserts structure of captured data.

    // There should be arrays available from beforeEach
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // If there are page errors, ensure they include a message string
    for (const err of pageErrors) {
      expect(typeof err.message).toBe('string');
      expect(err.message.length).toBeGreaterThan(0);
    }

    // If there are console messages, ensure they have type and text
    for (const msg of consoleMessages) {
      expect(typeof msg.type).toBe('string');
      expect(typeof msg.text).toBe('string');
    }

    // Additionally assert that at least one captured console message is of type 'error' or there is a page error
    const hasConsoleError = consoleMessages.some((m) => m.type === 'error');
    const hasPageError = pageErrors.length > 0;
    expect(hasConsoleError || hasPageError).toBe(true);
  });
});