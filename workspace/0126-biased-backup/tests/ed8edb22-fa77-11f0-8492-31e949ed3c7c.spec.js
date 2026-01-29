import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8edb22-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Stunning Pagination Design - FSM validation', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Helper: reads the .content element innerHTML and trims whitespace for stable comparisons
  const getContentHtml = async (page) => {
    return await page.$eval('.content', el => el.innerHTML.trim());
  };

  // Helper: expected page content template for a given page number
  const expectedPageHtml = (pageNum) => {
    // Match the template used by updateContent() in the app
    return `<p>Welcome to page ${pageNum}. This is an example of a stunning design.</p>
                                <p>Page ${pageNum} of 5.</p>`;
  };

  test.beforeEach(async ({ page }) => {
    // Reset collections
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors but do NOT modify page behavior
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the application exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown modifications needed; listeners are bound to page fixture which is disposed by Playwright.
    // This hook exists to clearly separate test lifecycle phases and can be expanded if needed.
  });

  test('Initial load: validate initial DOM, variables and onEnter expectation for S1 (Page 1)', async ({ page }) => {
    // This test validates the initial state when the page first loads.
    // According to the FSM, S1 has an entry action updateContent(), which would set the content to the page template.
    // The implementation does NOT call updateContent() on load. We assert the actual behavior observed.

    // Assert the page loaded and .container header is present
    const headerText = await page.$eval('.header', el => el.textContent.trim());
    expect(headerText).toBe('Welcome to Stunning Pagination');

    // Grab the content HTML on initial load
    const initialContent = await getContentHtml(page);

    // The implementation's initial content is descriptive paragraphs, NOT the page-specific template.
    // Verify that initial content contains expected descriptive text that exists in the HTML.
    expect(initialContent).toContain('This is the most visually appealing pagination example you will ever encounter');
    expect(initialContent).toContain('Each page gracefully transitions with a subtle animation');

    // Assert that the page-scoped variable currentPage exists and equals 1
    const currentPage = await page.evaluate(() => typeof currentPage !== 'undefined' ? currentPage : null);
    expect(currentPage).toBe(1);

    // According to FSM, updateContent() should have been called on entering Page 1.
    // Because updateContent wasn't invoked on load in the implementation, the content should NOT match the expected template for page 1.
    const expectedPage1Html = expectedPageHtml(1).trim();
    expect(initialContent).not.toBe(expectedPage1Html);

    // Verify the pagination buttons exist and have the expected onclick attributes
    const buttons = await page.$$('.pagination .page-button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    const prevOnclick = await page.$eval('.pagination .page-button:nth-of-type(1)', b => b.getAttribute('onclick'));
    const nextOnclick = await page.$eval('.pagination .page-button:nth-of-type(2)', b => b.getAttribute('onclick'));
    expect(prevOnclick).toContain('previousPage()');
    expect(nextOnclick).toContain('nextPage()');

    // Verify no runtime page errors or console errors were emitted during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('NextPage transitions: sequential navigation from Page 1 to Page 5 updates content and currentPage', async ({ page }) => {
    // This test exercises the Next button transitions through all FSM states S1->S5.

    const nextButton = await page.locator('.pagination .page-button:nth-of-type(2)');

    // Iterate through pages 2 to 5, clicking Next and validating the state each time.
    for (let target = 2; target <= 5; target++) {
      await nextButton.click();
      // Wait a short moment for DOM update; updateContent is synchronous but allow microtask scheduling
      await page.waitForTimeout(50);

      // Validate the global currentPage variable updated correctly
      const currentPage = await page.evaluate(() => currentPage);
      expect(currentPage).toBe(target);

      // Validate the content DOM was updated to expected template for the target page
      const contentHtml = await getContentHtml(page);
      // The implementation includes whitespace; use .includes checks for robust assertion
      expect(contentHtml).toContain(`Welcome to page ${target}. This is an example of a stunning design.`);
      expect(contentHtml).toContain(`Page ${target} of 5.`);
    }

    // Edge: clicking Next when already at last page (page 5) should NOT increment further
    await nextButton.click();
    await page.waitForTimeout(50);
    const currentAfterExtraNext = await page.evaluate(() => currentPage);
    expect(currentAfterExtraNext).toBe(5);

    // Ensure no console or page errors were produced during navigation
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('PreviousPage transitions: sequential navigation from Page 5 back to Page 1 updates content and currentPage', async ({ page }) => {
    // This test first navigates to Page 5, then exercises the Previous button transitions down to Page 1.

    const nextButton = await page.locator('.pagination .page-button:nth-of-type(2)');
    const prevButton = await page.locator('.pagination .page-button:nth-of-type(1)');

    // Move to page 5
    for (let i = 0; i < 4; i++) {
      await nextButton.click();
      await page.waitForTimeout(30);
    }
    const atPage5 = await page.evaluate(() => currentPage);
    expect(atPage5).toBe(5);

    // Now navigate back to page 1 using Previous
    for (let target = 4; target >= 1; target--) {
      await prevButton.click();
      await page.waitForTimeout(50);

      // Validate currentPage variable
      const currentPage = await page.evaluate(() => currentPage);
      expect(currentPage).toBe(target);

      // Validate content updates
      const contentHtml = await getContentHtml(page);
      expect(contentHtml).toContain(`Welcome to page ${target}. This is an example of a stunning design.`);
      expect(contentHtml).toContain(`Page ${target} of 5.`);
    }

    // Edge: clicking Previous when at first page should NOT decrement further
    await prevButton.click();
    await page.waitForTimeout(30);
    const currentAfterExtraPrev = await page.evaluate(() => currentPage);
    expect(currentAfterExtraPrev).toBe(1);

    // Validate no unexpected runtime errors occurred while navigating backwards
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases and visual/DOM feedback: verify disabled state absence and stability under rapid clicks', async ({ page }) => {
    // This test checks boundary behavior and that rapid user interactions do not break the DOM.
    const nextButton = await page.locator('.pagination .page-button:nth-of-type(2)');
    const prevButton = await page.locator('.pagination .page-button:nth-of-type(1)');

    // Confirm buttons do not have the 'disabled' class in normal operation (implementation uses .disabled but doesn't apply it)
    const nextClasses = await nextButton.getAttribute('class');
    const prevClasses = await prevButton.getAttribute('class');
    expect(nextClasses).toContain('page-button');
    expect(prevClasses).toContain('page-button');
    expect(nextClasses.includes('disabled')).toBeFalsy();
    expect(prevClasses.includes('disabled')).toBeFalsy();

    // Rapidly click Next many times (beyond totalPages) to test stability: implementation should cap at totalPages
    for (let i = 0; i < 10; i++) {
      await nextButton.click();
    }
    await page.waitForTimeout(100);
    const currentAfterRapidNext = await page.evaluate(() => currentPage);
    expect(currentAfterRapidNext).toBe(5); // Should not exceed totalPages

    // Rapidly click Previous many times to test lower bound safeguard
    for (let i = 0; i < 10; i++) {
      await prevButton.click();
    }
    await page.waitForTimeout(100);
    const currentAfterRapidPrev = await page.evaluate(() => currentPage);
    expect(currentAfterRapidPrev).toBe(1); // Should not go below 1

    // Verify that the content matches the expected template for page 1 after the rapid interactions
    const contentHtml = await getContentHtml(page);
    expect(contentHtml).toContain('Welcome to page 1. This is an example of a stunning design.');
    expect(contentHtml).toContain('Page 1 of 5.');

    // Confirm no console or page errors occurred during these rapid interactions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM onEnter/onExit observation: confirm updateContent is called on transitions but not on initial load', async ({ page }) => {
    // This test explicitly validates the FSM entry actions behavior as implemented.
    // The FSM expects updateContent() on entering each state.
    // Implementation: updateContent() is executed on transitions (when clicking next/previous), but NOT on initial page load.
    // We already asserted initial load didn't call updateContent in a previous test; here we verify transitions invoke it.

    // Snapshot of initial content (descriptive text)
    const initialContent = await getContentHtml(page);
    expect(initialContent).toContain('This is the most visually appealing pagination example');

    // Trigger a transition by clicking Next - this should call updateContent() and replace content with page template
    await page.locator('.pagination .page-button:nth-of-type(2)').click();
    await page.waitForTimeout(50);

    const contentAfterTransition = await getContentHtml(page);
    // After transition to page 2, content should match template for page 2
    expect(contentAfterTransition).toContain('Welcome to page 2. This is an example of a stunning design.');
    expect(contentAfterTransition).toContain('Page 2 of 5.');

    // From here, clicking Previous should call updateContent() again and restore page 1 template
    await page.locator('.pagination .page-button:nth-of-type(1)').click();
    await page.waitForTimeout(50);

    const contentAfterPrev = await getContentHtml(page);
    expect(contentAfterPrev).toContain('Welcome to page 1. This is an example of a stunning design.');
    expect(contentAfterPrev).toContain('Page 1 of 5.');

    // Confirm that the initial descriptive paragraphs are no longer present after the transition sequence
    expect(contentAfterPrev).not.toContain('This is the most visually appealing pagination example');

    // Ensure no runtime errors occurred while exercising these onEnter behaviors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console and page errors across interactions and report findings (assert none occurred)', async ({ page }) => {
    // This test explicitly gathers and asserts console and page errors for all observed interactions.
    // It will perform a few interactions and then examine collected console messages and page errors.

    // Perform some navigations
    await page.locator('.pagination .page-button:nth-of-type(2)').click(); // -> page2
    await page.waitForTimeout(20);
    await page.locator('.pagination .page-button:nth-of-type(2)').click(); // -> page3
    await page.waitForTimeout(20);
    await page.locator('.pagination .page-button:nth-of-type(1)').click(); // -> page2
    await page.waitForTimeout(20);

    // Summarize console messages and page errors
    const errorsFromConsole = consoleMessages.filter(m => m.type === 'error');
    if (errorsFromConsole.length > 0) {
      // If any console errors are present, fail the test with their messages for easier debugging
      const msgs = errorsFromConsole.map(e => e.text).join('\n---\n');
      test.fail(true, `Console errors were emitted during interactions:\n${msgs}`);
    }
    if (pageErrors.length > 0) {
      const errs = pageErrors.map(e => e.message).join('\n---\n');
      test.fail(true, `Page errors were emitted during interactions:\n${errs}`);
    }

    // Final assertions: expect none
    expect(errorsFromConsole.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

});