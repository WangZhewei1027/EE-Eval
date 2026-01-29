import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca75a2b0-fa75-11f0-9854-e7309e7cf385.html';

test.describe('Queue Example App - FSM tests (ca75a2b0-fa75-11f0-9854-e7309e7cf385)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect unhandled exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page and wait for full load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // close page to ensure a clean slate between tests (Playwright may handle this,
    // but being explicit keeps tests isolated)
    try {
      await page.close();
    } catch (e) {
      // ignore any errors on close
    }
  });

  test('Idle state: static content (H1 and descriptive paragraph) is rendered', async ({ page }) => {
    // Verify the page contains the expected evidence from the FSM for the Idle state.
    // This checks that the main title and explanatory paragraph are present.
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Queue Example');

    const para = page.locator('p');
    await expect(para).toHaveCount(1);
    await expect(para).toContainText('Here is an example of how to create a queue using JavaScript:');

    // The FSM evidence mentions the code sample; verify the page text contains parts of that snippet.
    const bodyText = await page.locator('body').innerText();
    await expect(bodyText).toContain('var queue = []');
    await expect(bodyText).toContain("console.log(queue)");
    await expect(bodyText).toContain("['item', 'item', 'item']");
  });

  test('No interactive elements are present (static example)', async ({ page }) => {
    // This application is a static example per the FSM extraction summary.
    // Ensure there are no common interactive controls: buttons, inputs, selects, textareas, anchors with href.
    const buttons = await page.locator('button').count();
    const inputs = await page.locator('input').count();
    const selects = await page.locator('select').count();
    const textareas = await page.locator('textarea').count();
    const anchorsWithHref = await page.locator('a[href]').count();

    expect(buttons).toBe(0);
    expect(inputs).toBe(0);
    expect(selects).toBe(0);
    expect(textareas).toBe(0);
    expect(anchorsWithHref).toBe(0);
  });

  test('Entry action renderPage: function is not defined; calling it throws ReferenceError', async ({ page }) => {
    // The FSM lists an entry action "renderPage()". The HTML/JS does not define this function.
    // Validate that renderPage is not present on the window, and that attempting to call it
    // in the page context results in an evaluation rejection (ReferenceError).
    const typeofRenderPage = await page.evaluate(() => {
      try {
        // Return the typeof (undefined expected)
        return typeof renderPage;
      } catch (e) {
        // If accessing throws for any reason, return a description
        return `access-threw:${e && e.message}`;
      }
    });
    expect(typeofRenderPage).toBe('undefined');

    // Attempting to call renderPage should reject with a ReferenceError from the page evaluation.
    // We assert that the promise rejects; we do not modify page globals or define renderPage.
    await expect(page.evaluate(() => {
      // This will throw in the page context because renderPage is not defined.
      // Let the exception propagate naturally.
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow();
  });

  test('Global queue is not defined (code snippet displayed but not executed)', async ({ page }) => {
    // The HTML contains a code snippet demonstrating a queue, but it's static text.
    // Verify that no global variable named "queue" was created/executed on page load.
    const queueType = await page.evaluate(() => {
      try {
        // typeof should return 'undefined' if not executed
        return typeof queue;
      } catch (e) {
        return `access-threw:${e && e.message}`;
      }
    });
    expect(queueType).toBe('undefined');
  });

  test('No FSM transitions or events: validate absence of inline event handlers', async ({ page }) => {
    // The FSM defines no events or transitions. We assert there are no inline event handlers like onclick, onsubmit, etc.
    const inlineEventAttrs = await page.evaluate(() => {
      const attrs = ['onclick', 'onsubmit', 'onchange', 'oninput', 'onmouseover', 'onkeydown'];
      const found = [];
      const all = document.querySelectorAll('*');
      all.forEach((el) => {
        for (const a of attrs) {
          if (el.hasAttribute && el.hasAttribute(a)) {
            found.push({ tag: el.tagName.toLowerCase(), attr: a, value: el.getAttribute(a) });
          }
        }
      });
      return found;
    });
    expect(inlineEventAttrs.length).toBe(0);
  });

  test('Console and page errors: none emitted during initial load; ReferenceError observed only when explicitly invoked', async ({ page }) => {
    // At this point (after page load in beforeEach), assert there were no console error messages or pageerrors.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // Now, as an explicit error scenario (edge case), attempt to call a missing function to allow a ReferenceError to occur naturally.
    // This call is done inside page.evaluate and we assert the evaluation rejects.
    await expect(page.evaluate(() => {
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow();

    // Note: the thrown ReferenceError from evaluate is captured by the evaluation promise.
    // It may or may not surface as a 'pageerror' event; ensure that we don't attempt to patch page behavior.
  });

  test('Edge case: accessing a non-existent DOM element returns expected null', async ({ page }) => {
    // Validate that querying an element that should not exist returns null.
    const nonExistent = await page.evaluate(() => {
      return document.querySelector('#this-element-does-not-exist');
    });
    expect(nonExistent).toBeNull();
  });

  test('Documentation text integrity: ensure explanation about pop() behavior is present', async ({ page }) => {
    // The HTML contains explanation text about pop() behavior; verify those sentences exist.
    const bodyText1 = await page.locator('body').innerText();
    await expect(bodyText).toContain('When we call the `pop()` method on the queue, it will return the last element in the queue');
    await expect(bodyText).toContain('which is also \'item\' in this case');
  });
});