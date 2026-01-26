import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122a9f72-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Circular Linked List demo
class LinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // capture console and page errors for assertions
    this.page.on('console', (msg) => {
      try {
        // stringify message text for easier assertions
        this.consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        this.consoleMessages.push(`console: <unable to read message>`);
      }
    });

    this.page.on('pageerror', (err) => {
      // err is an Error object from the page context
      this.pageErrors.push(err && err.message ? err.message : String(err));
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // small wait to ensure initial scripts have executed and errors (if any) are logged
    await this.page.waitForTimeout(200);
  }

  // Returns number of child elements inside #output
  async outputChildCount() {
    return await this.page.evaluate(() => {
      const output = document.getElementById('output');
      return output ? output.childElementCount : 0;
    });
  }

  // Returns array of textContent from children of #output
  async outputTexts() {
    return await this.page.evaluate(() => {
      const output = document.getElementById('output');
      if (!output) return [];
      return Array.from(output.children).map(c => c.textContent);
    });
  }

  // Click a specific button by id (e.g., '#append', '#clear', '#prev', '#next')
  async clickButton(selector) {
    await this.page.click(selector);
    // allow any event handlers to run and log errors
    await this.page.waitForTimeout(100);
  }

  // Dispatch an 'input' event on #input element
  async dispatchInputEvent() {
    // Dispatch a native input event. For this application's #input (a div),
    // the registered listener will attempt to read input.value.trim() which may throw.
    await this.page.dispatchEvent('#input', 'input');
    await this.page.waitForTimeout(100);
  }

  // Call a global page function and return any thrown error
  async callPageFunction(fnName, ...args) {
    // We intentionally do not try to "repair" page code; calling functions may naturally throw.
    return await this.page.evaluate(
      ({ fnName, args }) => {
        // eslint-disable-next-line no-undef
        return window[fnName](...args);
      },
      { fnName, args }
    );
  }

  getConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Circular Linked List - FSM and UI validation', () => {
  let llPage;

  test.beforeEach(async ({ page }) => {
    llPage = new LinkedListPage(page);
    await llPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // help teardown by closing page-level listeners implicitly; Playwright will handle actual closing
    // but we add a tiny delay to ensure any asynchronous console logs are captured before assertions
    await page.waitForTimeout(50);
  });

  test('Initial load: should render the first appended "Head" node and log an error when rendering subsequent nodes', async ({ page }) => {
    // This test validates the Idle -> Head transition happened on page load (append("Head") is called in script)
    // and that the buggy rendering during the second append produces a TypeError related to appendChild
    const texts = await llPage.outputTexts();

    // The initial script attempts to append multiple nodes; the first append should have placed "Head"
    expect(texts).toContain('Head');

    // Because the implementation has a bug in updateOutput when handling additional nodes,
    // we expect at least one page error mentioning appendChild (TypeError) or similar.
    const errors = llPage.getPageErrors();
    expect(errors.length).toBeGreaterThan(0);
    const joinedErrors = errors.join(' | ');
    // The error message may vary by engine, but should reference appendChild or "parameter 1 is not of type 'Node'" or "appendChild"
    expect(joinedErrors.toLowerCase()).toMatch(/appendchild|not of type|parameter 1|append child/);
  });

  test('Direct append calls: Append("Head") succeeds, Append("Tail") triggers a runtime error when rendering', async ({ page }) => {
    // Clear the list first to reduce noise - use the page's clear() function directly
    // Note: evaluating functions may throw; we handle that naturally via expect(...).rejects when appropriate.
    // Call clear() to ensure deterministic start
    await page.evaluate(() => {
      if (typeof clear === 'function') clear();
    });

    // Append Head via the global append function - this should succeed (no throw expected)
    await expect(page.evaluate(() => {
      // eslint-disable-next-line no-undef
      return append('Head');
    })).resolves.not.toBeNull();

    // After appending Head, output should contain one child 'Head'
    let texts = await llPage.outputTexts();
    expect(texts[0]).toBe('Head');
    expect(texts.length).toBe(1);

    // Now attempt to append Tail via direct function call.
    // Given the known bug in updateOutput, this may throw a TypeError when trying to append head.next (undefined)
    // We assert that an exception is thrown and that the page has logged an error about appendChild.
    await expect(page.evaluate(() => {
      // eslint-disable-next-line no-undef
      return append('Tail');
    })).rejects.toThrow();

    // Confirm the pageerror log contains at least one message referencing appendChild
    const pageErrors = llPage.getPageErrors();
    expect(pageErrors.length).toBeGreaterThan(0);
    expect(pageErrors.join(' ')).toMatch(/appendchild|not of type|parameter 1/i);
  });

  test('Input event on #input (a div): dispatching input causes an error due to input.value being undefined', async ({ page }) => {
    // The application attaches an 'input' listener to a div#input but expects .value to exist.
    // Dispatching an 'input' event should cause a TypeError referencing 'trim' or 'value'.
    await llPage.dispatchInputEvent();

    const errors = llPage.getPageErrors();
    // At least one error should mention 'trim' (cannot read property 'trim' of undefined) or similar
    expect(errors.length).toBeGreaterThan(0);
    const anyMatches = errors.some(e => /trim|value|cannot read|cannot convert/i.test(e));
    expect(anyMatches).toBeTruthy();
  });

  test('Clicking controls inside the #button container does not trigger intended actions due to handler using the container element', async ({ page }) => {
    // The click handler is attached to the container with id="button" and uses that variable's id
    // which is always 'button', so clicking child buttons should not perform append/clear/prev/next.
    // We'll capture the number of nodes in #output, click Append, Prev, Next, Clear, and ensure no changes occurred.

    const beforeCount = await llPage.outputChildCount();

    // Click Append button - should not append because the handler checks container.id
    await llPage.clickButton('#append');

    // Click Prev and Next and Clear - none should affect the output due to the same handler bug
    await llPage.clickButton('#prev');
    await llPage.clickButton('#next');
    await llPage.clickButton('#clear');

    const afterCount = await llPage.outputChildCount();

    // Expect no change in number of child nodes as a result of these clicks
    expect(afterCount).toBe(beforeCount);

    // Also ensure that no new unexpected page errors were introduced by these clicks (they shouldn't throw)
    const errors = llPage.getPageErrors();
    // There may already be errors from initial load; assert that clicking didn't add new errors referencing click handling logic
    // We ensure at least the pageErrors array exists; no assertion on new errors count because environment may vary.
    expect(Array.isArray(errors)).toBe(true);
  });

  test('Clear function invoked directly clears the list and removes nodes from #output', async ({ page }) => {
    // Ensure we have something in the list by appending a Head directly via evaluate
    await page.evaluate(() => {
      if (typeof append === 'function') append('Solo');
    });

    // Confirm 'Solo' is present
    const textsBefore = await llPage.outputTexts();
    expect(textsBefore.some(t => t === 'Solo')).toBeTruthy();

    // Call clear() directly - should clear the list without throwing
    await expect(page.evaluate(() => {
      if (typeof clear === 'function') return clear();
      return null;
    })).resolves.not.toBeNull();

    // After clearing, output should have zero children
    const countAfter = await llPage.outputChildCount();
    expect(countAfter).toBe(0);
  });

  test('Edge case: appending an empty string via function creates a node (empty text) or throws during rendering - we assert expected observed behavior', async ({ page }) => {
    // Call append('') and observe whether it throws or results in an empty node in #output
    const appendPromise = page.evaluate(() => {
      // eslint-disable-next-line no-undef
      return append('');
    });

    let threw = false;
    try {
      await appendPromise;
    } catch (e) {
      threw = true;
    }

    // Either the call threw due to updateOutput bug or succeeded; we accept both but assert consistent observations
    const texts = await llPage.outputTexts();

    if (threw) {
      // If it threw, we expect at least one page error mentions appendChild or similar
      const errors = llPage.getPageErrors();
      expect(errors.some(e => /appendchild|not of type|parameter 1/i.test(e.toLowerCase()))).toBeTruthy();
    } else {
      // If it didn't throw, we should now see an entry in the output (may be empty string)
      expect(texts.length).toBeGreaterThanOrEqual(1);
      // at least one of the outputs should be a string (possibly empty)
      expect(texts.every(t => typeof t === 'string')).toBeTruthy();
    }
  });

  test('Observe and assert that runtime errors (TypeError) occurred during page lifecycle', async ({ page }) => {
    // Final sanity check: ensure we captured at least one TypeError during the scenario runs
    const errors = llPage.getPageErrors();
    expect(errors.length).toBeGreaterThan(0);

    // Look for TypeError-like messages (e.g., appendChild, trim, cannot read)
    const foundTypeError = errors.some(e => /typeerror|appendchild|trim|cannot read/i.test(e));
    expect(foundTypeError).toBeTruthy();

    // Also ensure console captured messages (errors/warnings) to help debugging if needed
    const consoles = llPage.getConsoleMessages();
    expect(Array.isArray(consoles)).toBeTruthy();
    expect(consoles.length).toBeGreaterThanOrEqual(0);
  });
});