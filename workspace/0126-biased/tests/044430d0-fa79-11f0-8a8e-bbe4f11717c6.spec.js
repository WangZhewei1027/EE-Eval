import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044430d0-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page object for the DNS static page.
 * Encapsulates common selectors and small helpers.
 */
class DNSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.header = page.locator('h1');
    this.introParagraph = page.locator('.container > p').first();
    this.sectionTitles = page.locator('.section h2');
    this.sectionParagraphs = page.locator('.section p');
    this.links = page.locator('a');
    this.onclickElements = page.locator('[onclick]');
  }

  async titleText() {
    return this.header.textContent();
  }

  async introText() {
    return this.introParagraph.textContent();
  }

  async sectionCount() {
    return this.sectionTitles.count();
  }

  async linkCount() {
    return this.links.count();
  }

  async linkHrefAt(index) {
    return this.links.nth(index).getAttribute('href');
  }

  async hasOnclickAttributes() {
    return (await this.onclickElements.count()) > 0;
  }

  async pageInnerHTML() {
    return this.page.evaluate(() => document.documentElement.innerHTML);
  }
}

test.describe('DNS static page - FSM S0_Idle validation', () => {
  // Arrays to capture console messages and page errors during navigation and interaction.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      } catch (e) {
        // Defensive: ensure collector does not throw
        consoleMessages.push({ type: 'error', text: `(collector error) ${String(e)}` });
      }
    });

    // Collect uncaught page errors (exceptions)
    page.on('pageerror', error => {
      // error is an Error object
      pageErrors.push({
        message: error.message,
        stack: error.stack,
      });
    });

    // Navigate to the application under test and wait for full load.
    await page.goto(APP_URL, { waitUntil: 'load', timeout: 10000 });
    // Allow a short grace period for any scripts to run and for console/page errors to surface.
    await page.waitForTimeout(250);
  });

  test('renders initial state content (S0_Idle) - header and intro paragraph', async ({ page }) => {
    // This test validates that the initial (Idle) state evidence from the FSM exists in DOM.
    const dns = new DNSPage(page);

    // Validate header text
    await expect(dns.header).toHaveCount(1);
    await expect(dns.header).toHaveText('DNS');

    // Validate the introductory paragraph contains the expected explanation.
    const intro = await dns.introText();
    expect(intro).toBeTruthy();
    expect(intro).toContain('DNS stands for Domain Name System'); // key sentence from FSM evidence
    expect(intro).toContain('translates human-readable domain names into IP addresses');
  });

  test('contains explanatory sections and example link(s)', async ({ page }) => {
    // Validate that the page contains the documented sections in the FSM evidence
    const dns = new DNSPage(page);

    // There should be multiple informational sections as per markup.
    const sectionCount = await dns.sectionCount();
    expect(sectionCount).toBeGreaterThanOrEqual(3);

    // Validate at least one example link exists and points to the expected external URL.
    const linkCount = await dns.linkCount();
    expect(linkCount).toBeGreaterThanOrEqual(1);
    // Validate first link href is google.com as in the example
    const href = await dns.linkHrefAt(0);
    expect(href).toBe('https://www.google.com');
  });

  test('no interactive controls (buttons/inputs/forms) and no inline onclick handlers - FSM has no events', async ({ page }) => {
    // Since FSM indicates no events or transitions, the page should not provide interactive controls that alter state.
    const dns = new DNSPage(page);

    // Assert there are no form controls by common selectors.
    const buttonCount = await page.locator('button').count();
    const inputCount = await page.locator('input, textarea, select').count();
    const formCount = await page.locator('form').count();

    expect(buttonCount).toBe(0);
    expect(inputCount).toBe(0);
    expect(formCount).toBe(0);

    // Assert there are no inline onclick attributes (rudimentary check for inline event handlers)
    const hasOnclick = await dns.hasOnclickAttributes();
    expect(hasOnclick).toBe(false);

    // Ensure that no DOM mutations happen shortly after load (no transitions fired)
    const before = await dns.pageInnerHTML();
    await page.waitForTimeout(300);
    const after = await dns.pageInnerHTML();
    expect(after).toBe(before);
  });

  test('observe console and page errors (script loading / runtime errors) - expect at least one error related to script inclusion or missing renderPage', async ({ page }) => {
    // Per instructions: load page as-is, observe console logs and page errors, and assert that errors occur.
    // Many deployments of this static page include a script tag to script.js which may be missing or reference undefined functions (renderPage).
    // This test asserts that either a console-level resource error or a runtime ReferenceError mentioning renderPage (or similar) occurs.

    // Collate textual messages for flexible matching.
    const consoleTexts = consoleMessages.map(m => `${m.type}: ${m.text}`);
    const pageErrorMessages = pageErrors.map(e => `${e.message}`);

    // Debug info (will be shown if assertion fails)
    // We'll assert at least one of the following likely error indicators is present:
    // - a console error mentioning "script.js" or "Failed to load" or "404"
    // - a console or page error that mentions "renderPage" or "ReferenceError" or "is not defined" or "TypeError" or "SyntaxError"
    const errorIndicators = ['script.js', 'Failed to load', '404', 'renderPage', 'ReferenceError', 'is not defined', 'TypeError', 'SyntaxError', 'Uncaught'];

    const foundInConsole = consoleTexts.some(text =>
      errorIndicators.some(ind => text.includes(ind))
    );

    const foundInPageErrors = pageErrorMessages.some(text =>
      errorIndicators.some(ind => text.includes(ind))
    );

    // For better failure visibility, attach the collected messages to assertion messages.
    const collected = {
      consoleMessages,
      pageErrors,
    };

    expect(foundInConsole || foundInPageErrors, `Expected at least one console or page error matching indicators ${JSON.stringify(errorIndicators)}. Collected messages: ${JSON.stringify(collected, null, 2)}`).toBe(true);
  });

  test('attempt to click example link - navigates away (edge case) and does not change app DOM before navigation', async ({ page, context }) => {
    // This test covers an edge case: clicking the link should navigate to an external site.
    // We verify that clicking the example link triggers navigation to the expected href.
    const dns = new DNSPage(page);

    const linkCount = await dns.linkCount();
    expect(linkCount).toBeGreaterThanOrEqual(1);

    // Intercept the navigation or new page that results from clicking the anchor.
    // We will listen for 'framenavigated' on the current page to detect navigation.
    const href = await dns.linkHrefAt(0);
    expect(href).toBeTruthy();

    // Capture current DOM before click
    const beforeInner = await dns.pageInnerHTML();

    // Click the link and wait for navigation; set a timeout because cross-origin may be blocked or redirected.
    const [navigation] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 5000 }).catch(() => null),
      dns.links.nth(0).click().catch(() => null),
    ]);

    // After clicking, either navigation occurred or not (depending on runner environment).
    if (navigation) {
      // If navigation happened, assert the new URL includes the expected hostname (google.com)
      const currentURL = page.url();
      expect(currentURL).toContain('google.com');
    } else {
      // If no navigation (blocked by test runner), ensure original DOM was present until attempted navigation.
      const afterInner = await dns.pageInnerHTML();
      expect(afterInner).toBe(beforeInner);
    }
  });

  test('no FSM transitions defined - ensure nothing triggers onEnter/onExit beyond initial render', async ({ page }) => {
    // FSM lists an entry action "renderPage()". Because we must not patch or define functions,
    // any invocation of a missing function should surface as a page error which we already assert.
    // Here we further assert that no automatic transitions exist by verifying no script-added dynamic content appears.

    // Confirm that the core evidence elements exist
    await expect(page.locator('h1')).toHaveText('DNS');
    await expect(page.locator('p')).toContainText('Domain Name System');

    // Wait a little more for any late-running scripts to attempt DOM modifications
    await page.waitForTimeout(400);

    // Confirm that there are still no interactive controls (buttons/forms)
    expect(await page.locator('button').count()).toBe(0);
    expect(await page.locator('form').count()).toBe(0);

    // Confirm the number of anchors remains consistent (no dynamic creation)
    const anchorsBefore = await page.locator('a').count();
    await page.waitForTimeout(300);
    const anchorsAfter = await page.locator('a').count();
    expect(anchorsAfter).toBe(anchorsBefore);
  });
});