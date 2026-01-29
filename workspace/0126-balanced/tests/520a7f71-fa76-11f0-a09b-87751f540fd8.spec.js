import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a7f71-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Application 520a7f71-fa76-11f0-a09b-87751f540fd8 - NoSQL (FSM S0_Idle)', () => {
  // Arrays to store console messages and page errors for inspection in tests.
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each navigation so we capture logs produced during page load.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // Normalize by taking the text representation Playwright provides.
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        // In case msg.text() throws for some exotic message type, record basic info.
        consoleMessages.push(String(msg));
      }
    });

    // Capture uncaught exceptions (pageerror)
    page.on('pageerror', (err) => {
      // Save the error message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the page and wait for full load so scripts run and console logs are emitted.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Cleanup listeners automatically by Playwright when page is closed between tests,
    // but ensure we close any leftover state if necessary.
    // No explicit teardown required here.
  });

  test('renders static content for Idle state (S0_Idle) and page metadata', async ({ page }) => {
    // This test validates the static DOM content that corresponds to the Idle state's entry action (renderPage).
    // The FSM lists an entry action renderPage() but the implementation is static HTML.
    // We assert the page title and visible content match the expected informational layout.

    // Verify document title
    await expect(page).toHaveTitle('NoSQL');

    // Header h1
    const header = page.locator('.header h1');
    await expect(header).toHaveText('NoSQL');

    // Intro paragraph presence
    const intro = page.locator('.header p');
    await expect(intro).toHaveText('This is a NoSQL tutorial.');

    // Content headings and paragraphs
    await expect(page.locator('h2', { hasText: 'What is NoSQL?' })).toHaveCount(1);
    await expect(page.locator('h2', { hasText: 'Types of NoSQL Databases' })).toHaveCount(1);

    // Validate list items include expected NoSQL types
    const listItems = page.locator('.content ul li');
    await expect(listItems).toHaveCount(4);
    await expect(listItems.nth(0)).toHaveText('MongoDB');
    await expect(listItems.nth(1)).toHaveText('Cassandra');
    await expect(listItems.nth(2)).toHaveText('Redis');
    await expect(listItems.nth(3)).toHaveText('NoSQL databases for big data');

    // Footer contains link to Example
    const footerLink = page.locator('.footer a');
    await expect(footerLink).toHaveAttribute('href', 'https://www.example.com');
    await expect(footerLink).toHaveText('Example');

    // Assert there are no interactive controls (buttons/inputs) as FSM indicates informational page
    await expect(page.locator('button')).toHaveCount(0);
    await expect(page.locator('input')).toHaveCount(0);
    await expect(page.locator('form')).toHaveCount(0);
  });

  test('captures console output produced by page script', async ({ page }) => {
    // This test verifies the console.log outputs that the in-page script emits.
    // The page logs strings and objects. We ensure those messages were observed.
    // We join all messages into a single string for flexible substring assertions.

    // Wait a short time to ensure console messages have been captured.
    // The logs are emitted synchronously on load, but give a small buffer in case of timing.
    await page.waitForTimeout(100);

    const joined = consoleMessages.join(' | ');

    // Expect the greeting to be logged
    expect(joined).toContain('Hello, World!');

    // The data object contains name, age, occupation. At minimum these substrings should appear in some console message.
    expect(joined).toContain('John');
    expect(joined).toContain('Doe');
    // Age might be printed '30' or part of object; assert presence of '30'
    expect(joined).toContain('30');
    expect(joined).toContain('Software Engineer');

    // The script logs obj and then obj.key and obj.value. obj.key is 'value' and obj.value is undefined.
    // The exact console text can vary between runtimes, so check for relevant substrings.
    expect(joined).toContain('value');

    // 'undefined' should appear for obj.value logs
    expect(joined).toContain('undefined');

    // There should be at least several console messages (greeting + several logs)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(6);
  });

  test('no uncaught runtime errors occurred during page load (pageerror events)', async () => {
    // The application should not produce uncaught exceptions; assert none were captured.
    // This also validates we did not experience ReferenceError/SyntaxError/TypeError during load.
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action "renderPage" is not present on window and did not cause a ReferenceError', async ({ page }) => {
    // The FSM entry_actions lists renderPage(), but the HTML does not define it.
    // We assert that window.renderPage is undefined and that no ReferenceError page errors were observed.

    const hasRenderPage = await page.evaluate(() => {
      return typeof window.renderPage !== 'undefined';
    });

    // renderPage should not be defined in the page's global scope given static HTML
    expect(hasRenderPage).toBe(false);

    // Confirm that absence of renderPage did not throw a ReferenceError during load.
    // We have already captured pageErrors; assert none mention "ReferenceError".
    const foundReferenceErrors = pageErrors.some((m) => /ReferenceError/i.test(m));
    expect(foundReferenceErrors).toBe(false);
  });

  test('edge cases: accessing non-existent DOM elements and verifying safe behavior', async ({ page }) => {
    // Access a non-existent element - should return null; this is an edge case check.
    const nonExist = await page.evaluate(() => document.querySelector('#nonexistent'));
    expect(nonExist).toBeNull();

    // Ensure querying for image elements returns zero (page has no <img>)
    const imgCount = await page.evaluate(() => document.querySelectorAll('img').length);
    expect(imgCount).toBe(0);
  });

  test('no declared transitions or events in FSM - verify page has no interactive event handlers', async ({ page }) => {
    // FSM reports zero events and transitions. Confirm page has no buttons or anchors with onclick attributes.
    const onclickCount = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[onclick]'));
      return els.length;
    });
    expect(onclickCount).toBe(0);

    // Confirm there are anchor tags but they are simple links (no event handlers)
    const anchors = await page.locator('a');
    await expect(anchors).toHaveCount(1);
    // The single anchor should not have an onclick attribute
    const anchorOnclick = await page.locator('a').getAttribute('onclick');
    expect(anchorOnclick).toBeNull();
  });
});