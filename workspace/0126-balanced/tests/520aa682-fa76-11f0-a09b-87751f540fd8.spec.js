import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520aa682-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Application 520aa682-fa76-11f0-a09b-87751f540fd8 - OSI Model (FSM S0_Idle)', () => {
  // We'll collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  // Setup: navigate to the page and attach listeners before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore any unexpected console handling errors
      }
    });

    // Capture unhandled exceptions from the page
    page.on('pageerror', (err) => {
      // err is an Error in the browser context; record its message and name
      pageErrors.push({ name: err.name, message: err.message });
    });

    // Navigate to the static HTML page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown: no global teardown needed; Playwright will close pages automatically

  test('renders the Idle state page and title (FSM evidence)', async ({ page }) => {
    // This test validates the FSM S0_Idle evidence: that the page title is present and correct.
    await expect(page).toHaveTitle('OSI Model');

    // The main header should be present and readable
    const h1 = await page.locator('h1').innerText();
    expect(h1).toBe('OSI Model');

    // There should be a brief overview paragraph
    const overview = await page.locator('.header p').innerText();
    expect(overview.toLowerCase()).toContain('overview of the osi model');

    // Ensure a main container exists
    const containerExists = await page.locator('.container').count();
    expect(containerExists).toBeGreaterThanOrEqual(1);
  });

  test('contains seven OSI layers with correct headings and examples', async ({ page }) => {
    // This test validates that all seven static layers are rendered as described in the HTML.
    const layers = page.locator('.layer');
    await expect(layers).toHaveCount(7);

    // Verify each layer heading and that examples are present
    const expectedHeadings = [
      'Layer 1: Physical Layer',
      'Layer 2: Data Link Layer',
      'Layer 3: Network Layer',
      'Layer 4: Transport Layer',
      'Layer 5: Session Layer',
      'Layer 6: Presentation Layer',
      'Layer 7: Application Layer',
    ];

    for (let i = 0; i < expectedHeadings.length; i++) {
      const heading = await layers.nth(i).locator('h2').innerText();
      expect(heading.trim()).toBe(expectedHeadings[i]);

      // Each layer should have at least one paragraph explaining and an example paragraph
      const paras = layers.nth(i).locator('p');
      expect(await paras.count()).toBeGreaterThanOrEqual(2);

      // Example paragraph should contain "Example:"
      const lastParaText = await paras.nth(await paras.count() - 1).innerText();
      expect(lastParaText).toMatch(/Example:/i);
    }
  });

  test('footer and copyright are present', async ({ page }) => {
    // This test verifies footer content is present and contains the expected copyright line.
    const footer = page.locator('.footer');
    await expect(footer).toHaveCount(1);

    const footerText = await footer.innerText();
    // The HTML contains "&copy; 2023 OSI Model". The browser will render this as "© 2023 OSI Model"
    expect(footerText).toMatch(/2023\s+OSI Model/);
  });

  test('no interactive elements (buttons, inputs, anchors) - matches FSM extraction notes', async ({ page }) => {
    // FSM extraction noted "No interactive elements". Validate that typical interactive elements are absent.
    const interactiveSelectors = 'button, input, textarea, select, a';
    const interactiveCount = await page.locator(interactiveSelectors).count();
    expect(interactiveCount).toBe(0);
  });

  test('invoking the entry action renderPage() triggers a ReferenceError in the page context', async ({ page }) => {
    // The FSM declared an entry action "renderPage()". The HTML/JS doesn't define this function.
    // Per instructions, we should attempt to invoke it and assert that a ReferenceError (or similar) naturally occurs.
    // We do not patch or define renderPage; we let the runtime throw.

    // Attempt to call renderPage() in the page context and assert that it rejects with an error mentioning renderPage.
    await expect(page.evaluate(() => {
      // Intentionally call the undefined function to let the page throw naturally
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow(/renderPage/i);

    // Allow a short moment for any pageerror events to be emitted
    await page.waitForTimeout(50);

    // At least one page error should have been captured and mention renderPage (error shape may vary)
    const matched = pageErrors.some(e => /renderPage/i.test(e.message || '') || /renderPage/i.test(e.name || ''));
    expect(matched).toBeTruthy();
  });

  test('attempting to call other non-existent transition functions results in ReferenceError (edge case)', async ({ page }) => {
    // FSM defines no transitions. Validate that calling a hypothetical transition function errors naturally.
    await expect(page.evaluate(() => {
      // Attempt to call a made-up transition function; should cause a ReferenceError.
      // eslint-disable-next-line no-undef
      return triggerTransition();
    })).rejects.toThrow(/triggerTransition|is not defined/i);

    // Wait briefly for pageerror to propagate
    await page.waitForTimeout(50);

    const matched1 = pageErrors.some(e => /triggerTransition/i.test(e.message || '') || /triggerTransition/i.test(e.name || ''));
    expect(matched).toBeTruthy();
  });

  test('page console output remains minimal for static content (no unexpected logs)', async ({ page }) => {
    // The static HTML should not emit console logs during normal load.
    // We assert that any console messages are either empty or minimal.
    // Allow a brief time to ensure any logs are captured.
    await page.waitForTimeout(20);

    // No console errors were expected; ensure there's no console message of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // It's acceptable for informational logs to be zero as well
    // But we assert the total messages array exists
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('DOM edge-case checks: querying absent elements returns null without throwing', async ({ page }) => {
    // Ensure querying a non-existent id returns null and does not throw an exception
    const nonExistent = await page.evaluate(() => document.getElementById('this-id-does-not-exist'));
    expect(nonExistent).toBeNull();

    // QuerySelector for a selector that doesn't match should be null in page context
    const nullQuery = await page.evaluate(() => document.querySelector('.no-such-class'));
    expect(nullQuery).toBeNull();
  });

  test('summary assertions: FSM state S0_Idle has been represented and no transitions available', async ({ page }) => {
    // This aggregates earlier checks and documents expectations from the FSM:
    // - S0_Idle evidence (title) present
    // - no transitions present (no interactive elements)
    await expect(page).toHaveTitle('OSI Model');

    // Confirm again that there are no anchors or interactive controls that could represent transitions
    const interactiveCount1 = await page.locator('button, input, textarea, select, a').count();
    expect(interactiveCount).toBe(0);

    // The page should display seven layer sections representing static content
    await expect(page.locator('.layer')).toHaveCount(7);
  });
});