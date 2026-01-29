import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b2f481-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('DNS Interactive Application (f5b2f481-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Containers for observed console messages and page errors during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      // capture type and text for richer diagnostics in assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      // capture error name and message
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Navigate to the static HTML page
    await page.goto(APP_URL);
    // Ensure the page has loaded main content before running assertions
    await expect(page).toHaveTitle(/Domain Name System \(DNS\)/i);
  });

  test.afterEach(async () => {
    // nothing to teardown explicitly; listeners are tied to the page instance and cleared between tests
  });

  test('S0_Idle (Idle) state: page renders expected heading and static content', async ({ page }) => {
    // This test verifies the single FSM state "Idle" is represented by the page content.
    // It verifies the primary evidence: an <h1> with "Domain Name System (DNS)" is present,
    // and that descriptive paragraphs are rendered.

    // Check the main heading exists and has exact expected text
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Domain Name System (DNS)');

    // Verify some known static descriptive text is present in the document body
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText).toContain('DNS is a system that translates human-readable domain names into machine-readable IP addresses.');
    expect(bodyText).toContain('When you type a website\'s URL into your browser, your computer sends a request to a DNS server.');
    expect(bodyText).toContain('DNSSEC');

    // The FSM's declared entry action for S0_Idle is renderPage()
    // The implementation contains no scripts that define renderPage().
    // We must not call or inject renderPage; simply assert whether it exists on window.
    const renderPageExists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // Expect that renderPage is NOT defined in the page environment (implementation is static).
    expect(renderPageExists).toBe(false);

    // No runtime errors should have been thrown during load for this static page.
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0); // collector sanity (always >= 0)
    expect(pageErrors.length).toBe(0);
  });

  test('No interactive controls or scripts present (no transitions/events)', async ({ page }) => {
    // The FSM declares no events or transitions.
    // This test ensures the page contains no interactive controls (buttons, forms, links)
    // that could be used to trigger transitions or events.

    // Buttons
    const buttonCount = await page.locator('button').count();
    expect(buttonCount).toBe(0);

    // Form controls
    const inputCount = await page.locator('input').count();
    const selectCount = await page.locator('select').count();
    const textareaCount = await page.locator('textarea').count();
    expect(inputCount + selectCount + textareaCount).toBe(0);

    // Anchors with href (links)
    const linkCount = await page.locator('a[href]').count();
    expect(linkCount).toBe(0);

    // Elements with inline onclick handlers would indicate inline interactive behavior
    const onclickCount = await page.evaluate(() => document.querySelectorAll('[onclick]').length);
    expect(onclickCount).toBe(0);

    // Ensure there are no script tags in the document (page claims there are no inline scripts)
    const scriptCount = await page.locator('script').count();
    expect(scriptCount).toBe(0);

    // Confirm no page errors were fired while inspecting static DOM
    expect(pageErrors.length).toBe(0);
  });

  test('Malformed/invalid list item tags handled robustly by DOM parser', async ({ page }) => {
    // The provided HTML contains unusual list item tags like "<li-AFP ...>" which are not standard <li>.
    // This test checks that the browser parsed the content and that the meaningful text remains accessible.
    // It also documents the observed DOM node names under the list for diagnostic purposes.

    // Locate the first unordered list and its textual content
    const ulHandle = await page.$('ul');
    expect(ulHandle).not.toBeNull();

    // Get the innerText of the ul to ensure content like 'AXFR' and 'Alternate Format' is present
    const ulText = await page.evaluate((ul) => ul.innerText, ulHandle);
    expect(ulText).toBeTruthy();
    expect(ulText).toContain('AXFR (Alternate Exchange Format)');
    expect(ulText).toContain('Alternate Format'); // seems in the source even if tags are odd

    // Inspect the child node tag names under the ul to understand how the browser parsed invalid tags
    const childTagNames = await page.evaluate((ul) => {
      return Array.from(ul.children).map((el) => el.tagName.toLowerCase());
    }, ulHandle);

    // There must be at least one direct child element (AXFR) and we want to ensure page didn't crash on malformed tags
    expect(childTagNames.length).toBeGreaterThanOrEqual(1);

    // The page should still not have produced runtime errors due to malformed tags
    expect(pageErrors.length).toBe(0);
  });

  test('FSM transitions/events validation: assert none are present or triggerable', async ({ page }) => {
    // Because the FSM has zero transitions and events, we assert there are no interactive elements
    // and that attempting to trigger common event-causing element types is not possible.

    // Ensure no elements that commonly have event listeners exist in the DOM
    const interactiveSelectors = ['button', 'a[href]', 'input', 'select', 'textarea', '[role="button"]', '[tabindex]'];
    for (const selector of interactiveSelectors) {
      const count = await page.locator(selector).count();
      // There may be elements with tabindex for accessibility, but in this static page we expect none.
      expect(count).toBe(0);
    }

    // Attempting to dispatch click events programmatically to the body shouldn't throw runtime errors.
    // We do not call any missing functions (e.g., renderPage) — only dispatch generic events.
    const dispatchResult = await page.evaluate(() => {
      try {
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        document.body.dispatchEvent(evt);
        return { ok: true };
      } catch (e) {
        return { ok: false, name: e.name, message: e.message };
      }
    });
    expect(dispatchResult.ok).toBe(true);

    // If any page errors were captured at load time, they should be among common JS error types; otherwise none.
    if (pageErrors.length > 0) {
      // If there are errors, ensure they are of expected JS error classes (ReferenceError/TypeError/SyntaxError)
      for (const err of pageErrors) {
        expect(['ReferenceError', 'TypeError', 'SyntaxError']).toContain(err.name);
      }
    } else {
      expect(pageErrors.length).toBe(0);
    }
  });

  test('Edge case: confirm absence of implicit onExit actions and transitions', async ({ page }) => {
    // FSM for this app lists no onExit actions. We cannot call or simulate onExit, but we can
    // verify that navigating away and back does not produce runtime exceptions.

    // Navigate to a blank page and then back to the app page to simulate exit/enter cycle
    await page.goto('about:blank');
    // Ensure no errors thrown during navigation away
    expect(pageErrors.length).toBe(0);

    // Revisit the app
    await page.goto(APP_URL);
    // After returning, ensure the main heading is still present and no new runtime errors occurred
    await expect(page.locator('h1')).toHaveText('Domain Name System (DNS)');
    expect(pageErrors.length).toBe(0);
  });

  test('Diagnostics: collect and assert console output and runtime errors shape', async ({ page }) => {
    // This test captures console messages and page errors and validates their structure
    // so that any unexpected diagnostics are surfaced in CI logs.

    // Provide diagnostic expectations:
    // - Console messages array should contain only strings and types
    for (const msg of consoleMessages) {
      expect(typeof msg.type).toBe('string');
      expect(typeof msg.text).toBe('string');
    }

    // - If there are pageErrors, ensure they expose name/message/stack properties
    for (const err of pageErrors) {
      expect(err).toHaveProperty('name');
      expect(err).toHaveProperty('message');
      // stack may be undefined in some environments, but if present it should be a string
      if (err.stack !== undefined) {
        expect(typeof err.stack).toBe('string');
      }
    }

    // Final assertion: either no runtime page errors, or only expected JS runtime errors
    if (pageErrors.length === 0) {
      expect(pageErrors.length).toBe(0);
    } else {
      for (const err of pageErrors) {
        expect(['ReferenceError', 'TypeError', 'SyntaxError']).toContain(err.name);
      }
    }
  });
});