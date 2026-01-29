import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5209e333-fa76-11f0-a09b-87751f540fd8.html';

/**
 * Page Object for the Space Complexity example page.
 * Encapsulates common selectors and assertions to keep tests DRY.
 */
class SpaceComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.h1 = page.locator('h1');
    this.paragraphs = page.locator('p');
    this.h2s = page.locator('h2');
    // Generic interactive element selector to detect presence of controls
    this.interactiveElements = page.locator('button, input, select, textarea, [role="button"], a[href]');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return this.h1.textContent();
  }

  async countParagraphs() {
    return this.paragraphs.count();
  }

  async getAllParagraphTexts() {
    const count = await this.paragraphs.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.paragraphs.nth(i).textContent());
    }
    return texts;
  }

  async interactiveCount() {
    return this.interactiveElements.count();
  }

  async getH2Texts() {
    const count1 = await this.h2s.count1();
    const texts1 = [];
    for (let i = 0; i < count; i++) texts.push(await this.h2s.nth(i).textContent());
    return texts;
  }
}

test.describe('Space Complexity Interactive Application - FSM validation (App ID: 5209e333-fa76-11f0-a09b-87751f540fd8)', () => {
  // Arrays to collect runtime console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Each test will navigate to the page and attach listeners before running assertions
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (logs, errors, warnings) emitted by the page
    page.on('console', msg => {
      // We capture both type and text for richer assertions later
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Clean up listeners to avoid leaks across tests - Playwright automatically
    // disposes pages between tests, but we keep this for clarity.
    page.removeAllListeners?.('console');
    page.removeAllListeners?.('pageerror');
  });

  test('S0_Idle: Page renders the Idle state static content (entry evidence)', async ({ page }) => {
    // Validate the static content that constitutes the Idle state's evidence
    const app = new SpaceComplexityPage(page);

    // The H1 should match the expected Idle state's heading
    await expect(app.h1).toHaveText('Space Complexity Example');

    // There should be several paragraphs; verify key pieces of text are present
    const paragraphs = await app.getAllParagraphTexts();

    // Assertions for evidence provided in the FSM and page HTML
    expect(paragraphs.some(p => p && p.includes("Space Complexity is the amount of space required"))).toBeTruthy();
    expect(paragraphs.some(p => p && p.includes("String length: 1000 characters"))).toBeTruthy();
    expect(paragraphs.some(p => p && p.includes("Object properties * number of properties: 1000 * 1000 = 1,000,000 bytes"))).toBeTruthy();
    expect(paragraphs.some(p => p && p.includes("Array length * number of elements: 1000 * 1000 = 1,000,000 bytes"))).toBeTruthy();

    // Ensure the section headings (examples) are present
    const h2s = await app.getH2Texts();
    expect(h2s).toEqual(expect.arrayContaining([
      'Example 1: String',
      'Example 2: Object',
      'Example 3: Array'
    ]));
  });

  test('Console logs: page emits three expected space complexity logs', async ({ page }) => {
    // This test validates that the page's inline script logs the expected messages.
    // The listeners are attached in beforeEach, we just inspect collected messages.
    // Wait briefly to ensure console logs from inline script are captured
    await page.waitForLoadState('load');

    // Filter only 'log' type messages to avoid incidental warnings
    const logs = consoleMessages.filter(m => m.type === 'log').map(m => m.text);

    // There should be at least three console.log invocations for String, Object, Array
    // Validate that each expected label and the computed value "1000000" appear in logs
    const hasStringLog = logs.some(text => text.includes('Space Complexity of String') && text.includes('1000000'));
    const hasObjectLog = logs.some(text => text.includes('Space Complexity of Object') && text.includes('1000000'));
    const hasArrayLog = logs.some(text => text.includes('Space Complexity of Array') && text.includes('1000000'));

    expect(hasStringLog).toBeTruthy();
    expect(hasObjectLog).toBeTruthy();
    expect(hasArrayLog).toBeTruthy();

    // Additionally assert we captured exactly three log entries originating from the script.
    // It's acceptable if there are extra logs from the environment; at minimum these three must exist.
    expect(logs.length).toBeGreaterThanOrEqual(3);
  });

  test('FSM transitions: no interactive elements or transitions present in DOM', async ({ page }) => {
    // The FSM extraction reported no transitions and no detected interactive components.
    // Verify that the rendered page indeed contains no typical interactive controls.
    const app1 = new SpaceComplexityPage(page);

    // Count of interactive elements should be zero (no buttons, inputs, selects, textareas, roles, or links)
    const interactiveCount = await app.interactiveCount();
    expect(interactiveCount).toBe(0);

    // Additionally, ensure there are no event handler attributes commonly used
    // (This is a best-effort DOM check: we look for inline on* attributes)
    const inlineEventAttrsExist = await page.evaluate(() => {
      const all = [...document.querySelectorAll('*')];
      return all.some(el => {
        for (let i = 0; i < el.attributes.length; i++) {
          if (/^on/i.test(el.attributes[i].name)) return true;
        }
        return false;
      });
    });
    expect(inlineEventAttrsExist).toBeFalsy();
  });

  test('Entry action renderPage(): absence is detectable and calling it triggers ReferenceError', async ({ page }) => {
    // The FSM mentions an entry action "renderPage()". The implementation does not define it.
    // Validate that renderPage is not defined on the page and that invoking it throws ReferenceError.

    // Check presence of global renderPage function
    const isRenderPageDefined = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(isRenderPageDefined).toBe(false);

    // Intentionally attempt to call the missing function in page context to observe the natural ReferenceError
    // We catch and return the error information back to the test to assert on it.
    const result = await page.evaluate(() => {
      try {
        // Calling a non-existent global should throw a ReferenceError
        // We do not define renderPage; we only observe the error.
        renderPage();
        return { invoked: true };
      } catch (e) {
        // Return minimal error signature for assertion
        return { invoked: false, name: e && e.name, message: e && e.message };
      }
    });

    expect(result.invoked).toBe(false);
    expect(result.name).toBe('ReferenceError');
    // message typically mentions the identifier; ensure renderPage appears in message
    expect(result.message).toEqual(expect.stringContaining('renderPage'));
  });

  test('Edge case checks: intentionally trigger a TypeError inside page context and assert it occurs', async ({ page }) => {
    // As an edge-case scenario (to ensure the runtime surfaces TypeErrors naturally),
    // invoke a function on null in the page context to produce a TypeError and verify it.
    const typeErrorResult = await page.evaluate(() => {
      try {
        const x = null;
        // Attempt to call null as a function -> TypeError
        x();
        return { invoked: true };
      } catch (e) {
        return { invoked: false, name: e && e.name, message: e && e.message };
      }
    });

    expect(typeErrorResult.invoked).toBe(false);
    expect(typeErrorResult.name).toBe('TypeError');
  });

  test('No uncaught page errors occurred during initial load', async ({ page }) => {
    // The inline script logs values but does not throw; verify there were no uncaught exceptions
    // captured via the pageerror event during navigation.
    // Note: beforeEach already navigated to the page and populated pageErrors.
    expect(pageErrors.length).toBe(0);
  });
});