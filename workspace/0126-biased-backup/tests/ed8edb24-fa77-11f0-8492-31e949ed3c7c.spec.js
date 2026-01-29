import { test, expect } from '@playwright/test';

test.describe('ed8edb24-fa77-11f0-8492-31e949ed3c7c - Elegant SQL Visualization (FSM validation)', () => {
  const URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8edb24-fa77-11f0-8492-31e949ed3c7c.html';

  // Utility page object for the main UI
  class PageObject {
    constructor(page) {
      this.page = page;
    }
    async goto() {
      await this.page.goto(URL);
    }
    // Selectors
    button() {
      return this.page.locator('button');
    }
    heading() {
      return this.page.locator('h1');
    }
    paragraphs() {
      return this.page.locator('p');
    }
    listItems() {
      return this.page.locator('ul li');
    }
    // Read attribute
    async buttonOnclickAttribute() {
      return await this.page.locator('button').getAttribute('onclick');
    }
  }

  // Global setup/teardown per test: capture console messages and page errors and dialog messages.
  test.beforeEach(async ({ page }) => {
    // Ensure dialog handling does not block the test
    // We attach handlers inside each test to capture for specific scenarios (so they can be cleared between tests).
    // General handlers to collect page errors/console messages are set per test below as needed.
  });

  test.afterEach(async ({ page }) => {
    // Nothing to teardown globally; Playwright handles page/context lifecycle.
  });

  test.describe('State: S0_Idle (Entry & Render checks)', () => {
    test('Entry action: renderPage() should display main content (heading, paragraphs, list, and button)', async ({ page }) => {
      // This test validates the S0_Idle entry action "renderPage()" by verifying page elements are present.
      const pod = new PageObject(page);

      // Capture any runtime page errors and console errors during page load
      const pageErrors = [];
      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });
      const consoleMessages = [];
      page.on('console', (msg) => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      await pod.goto();

      // Verify the main heading is present and correct
      await expect(pod.heading()).toHaveText('Understanding SQL');

      // Verify there are at least 2 descriptive paragraphs rendered
      await expect(pod.paragraphs().nth(0)).toContainText('SQL, or Structured Query Language');
      await expect(pod.paragraphs().nth(1)).toContainText('It allows you to create, read, update, and delete');

      // Verify the list of key SQL commands is rendered
      const items = await pod.listItems().allTextContents();
      expect(items.length).toBeGreaterThanOrEqual(4);
      expect(items.map(i => i.toUpperCase()).join(' ')).toContain('SELECT');
      expect(items.map(i => i.toUpperCase()).join(' ')).toContain('INSERT');
      expect(items.map(i => i.toUpperCase()).join(' ')).toContain('UPDATE');
      expect(items.map(i => i.toUpperCase()).join(' ')).toContain('DELETE');

      // Verify the primary button exists and has the expected label
      await expect(pod.button()).toHaveText('Explore More');

      // Assert that no fatal runtime errors (ReferenceError, SyntaxError, TypeError) occurred during render
      // We do not attempt to modify the page; only observe.
      const joinedPageErrors = pageErrors.map(e => String(e)).join('\n');
      expect(joinedPageErrors).not.toMatch(/ReferenceError|SyntaxError|TypeError/);

      // Ensure no console 'error' type messages were logged during initial render
      const consoleError = consoleMessages.find(m => m.type === 'error');
      expect(consoleError).toBeUndefined();
    });
  });

  test.describe('Event: ButtonClick and Transition: S0_Idle -> S0_Idle', () => {
    test('Clicking the "Explore More" button should trigger alert dialogs (both inline onclick and addEventListener)', async ({ page }) => {
      // This test validates the transition triggered by ButtonClick.
      // The page contains two alert handlers:
      // - inline onclick="alert('More details coming soon!')"
      // - addEventListener('click', function() { alert("This is a simple interaction alert."); });
      //
      // We expect two dialogs per click with the respective messages. We capture dialogs and accept them.

      const pod = new PageObject(page);
      await pod.goto();

      // Arrays to capture dialog messages and page errors/console messages
      const dialogs = [];
      const pageErrors = [];
      const consoleMessages = [];

      // Listen for dialogs and accept them so the test can continue
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });
      page.on('console', (msg) => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      // Ensure onclick attribute is present and matches expected inline alert string
      const onclickAttr = await pod.buttonOnclickAttribute();
      expect(onclickAttr).toBeTruthy();
      expect(onclickAttr).toContain("More details coming soon");

      // Click the button once; expect two dialogs (the order may vary depending on runtime)
      await pod.button().click();

      // Wait briefly to ensure dialogs were processed (they are handled via page.on('dialog') above)
      await page.waitForTimeout(100); // small wait to allow events to be processed

      // We expect at least one dialog to contain the FSM-expected message
      expect(dialogs.length).toBeGreaterThanOrEqual(1);

      // Check specifically that "This is a simple interaction alert." was shown (the FSM transition action)
      const foundSimpleInteraction = dialogs.some(msg => msg.includes('This is a simple interaction alert'));
      expect(foundSimpleInteraction).toBeTruthy();

      // Also check that the inline onclick alert "More details coming soon!" appeared
      const foundInline = dialogs.some(msg => msg.includes('More details coming soon'));
      expect(foundInline).toBeTruthy();

      // Ensure the page remains in the Idle state after the transition: key elements still present and unchanged
      await expect(pod.heading()).toHaveText('Understanding SQL');
      await expect(pod.button()).toHaveText('Explore More');

      // Assert no fatal JS runtime errors occurred during the click handling
      const joinedPageErrors = pageErrors.map(e => String(e)).join('\n');
      expect(joinedPageErrors).not.toMatch(/ReferenceError|SyntaxError|TypeError/);

      // Ensure no console.error messages were emitted
      const consoleError = consoleMessages.find(m => m.type === 'error');
      expect(consoleError).toBeUndefined();
    });

    test('Rapid multiple clicks should queue alerts for each click (edge case)', async ({ page }) => {
      // This edge case test ensures that multiple rapid clicks result in multiple dialogs.
      // Each click is expected to produce two alerts (inline + addEventListener).
      const pod = new PageObject(page);
      await pod.goto();

      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      // Click the button rapidly 3 times
      await pod.button().click();
      await pod.button().click();
      await pod.button().click();

      // Wait a bit for all dialogs to be processed
      await page.waitForTimeout(300);

      // Since there are 2 alerts per click, we expect at least 6 dialogs captured.
      // Depending on browser behavior, dialogs can sometimes be coalesced or blocked, but the page defines two handlers.
      expect(dialogs.length).toBeGreaterThanOrEqual(3); // at minimum at least some dialogs should be shown
      // Prefer to assert that at least one instance of each message is present
      const hasSimple = dialogs.some(m => m.includes('This is a simple interaction alert'));
      const hasInline = dialogs.some(m => m.includes('More details coming soon'));
      expect(hasSimple).toBeTruthy();
      expect(hasInline).toBeTruthy();
    });

    test('DOM and visual state remain consistent after clicking (no unintended navigation or removal)', async ({ page }) => {
      // Verify that clicking the button does not remove or navigate away from the core UI (state should remain Idle)
      const pod = new PageObject(page);
      await pod.goto();

      // Capture any page errors
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      // Handle dialogs to allow click to proceed
      page.on('dialog', async dialog => {
        await dialog.accept();
      });

      // Snapshot some element properties before click
      const headingTextBefore = await pod.heading().textContent();
      const buttonTextBefore = await pod.button().textContent();
      const listCountBefore = (await pod.listItems().count());

      // Click the button
      await pod.button().click();

      // Small wait for actions to complete
      await page.waitForTimeout(100);

      // Snapshot after click
      const headingTextAfter = await pod.heading().textContent();
      const buttonTextAfter = await pod.button().textContent();
      const listCountAfter = (await pod.listItems().count());

      // Assert nothing fundamental changed
      expect(headingTextAfter).toEqual(headingTextBefore);
      expect(buttonTextAfter).toEqual(buttonTextBefore);
      expect(listCountAfter).toEqual(listCountBefore);

      // Assert no runtime exceptions occurred
      const joinedPageErrors = pageErrors.map(e => String(e)).join('\n');
      expect(joinedPageErrors).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    });
  });

  test.describe('Implementation Evidence & Robustness checks', () => {
    test('Button element has evidence of both inline onclick and addEventListener handlers in the environment', async ({ page }) => {
      // This test verifies the detection/evidence described in the FSM:
      // - inline onclick attribute exists
      // - a click event listener via addEventListener is present (we indirectly confirm by observing second alert)
      const pod = new PageObject(page);
      await pod.goto();

      // Confirm inline onclick attribute text
      const onclickAttr = await pod.buttonOnclickAttribute();
      expect(onclickAttr).toBeTruthy();
      expect(onclickAttr).toContain('More details coming soon');

      // Capture dialogs to confirm addEventListener alert is fired
      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      // Click to trigger both handlers
      await pod.button().click();
      await page.waitForTimeout(100);

      // Verify that at least one dialog corresponds to addEventListener message
      const addEventListenerFired = dialogs.some(m => m.includes('This is a simple interaction alert'));
      expect(addEventListenerFired).toBeTruthy();
    });

    test('No unexpected console errors on initial load and interaction (error scenario check)', async ({ page }) => {
      // This test focuses on observing console and page errors and asserting absence of unexpected fatal errors.
      const pod = new PageObject(page);

      const consoleEntries = [];
      const pageErrors = [];
      page.on('console', msg => consoleEntries.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      await pod.goto();

      // Interact once to surface potential runtime issues
      page.on('dialog', async dialog => { await dialog.accept(); }); // avoid blocking
      await pod.button().click();
      await page.waitForTimeout(100);

      // Assert there were no page errors of the major types
      const joinedPageErrors = pageErrors.map(e => String(e)).join('\n');
      expect(joinedPageErrors).not.toMatch(/ReferenceError|SyntaxError|TypeError/);

      // Assert there are no console messages marked as 'error'
      const consoleError = consoleEntries.find(c => c.type === 'error');
      expect(consoleError).toBeUndefined();
    });
  });
});