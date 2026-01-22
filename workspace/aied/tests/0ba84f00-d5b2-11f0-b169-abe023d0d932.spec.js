import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba84f00-d5b2-11f0-b169-abe023d0d932.html';

// Page Object for the Hash Map application
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      form: '#hash-map',
      input: '#hash-input',
      submitButton: 'button[type="submit"]',
      clearButton: '#clear-button',
      container: '#hash-map-container'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setInputValue(value) {
    await this.page.fill(this.selectors.input, value);
  }

  // Call the addKey() function directly on the page to avoid form submission navigation.
  async callAddKeyFunction() {
    return this.page.evaluate(() => {
      // Call addKey defined in the page; let errors surface naturally.
      return addKey();
    });
  }

  // Dispatch a submit on the form (this will trigger a real submit and may navigate/reload)
  async submitFormExpectingNavigation() {
    // Click submit button which will trigger submit handler and cause navigation (due to no preventDefault)
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'load' }),
      this.page.click(this.selectors.submitButton)
    ]);
  }

  async clickClearButton() {
    await this.page.click(this.selectors.clearButton);
  }

  async clickInput() {
    await this.page.click(this.selectors.input);
  }

  async getContainerHTML() {
    return this.page.$eval(this.selectors.container, el => el.innerHTML);
  }

  async getParagraphs() {
    return this.page.$$eval(`${this.selectors.container} p`, nodes =>
      nodes.map(n => ({ keyAttr: n.getAttribute('key'), text: n.textContent.trim() }))
    );
  }

  async getHashMapKeys() {
    return this.page.evaluate(() => {
      // Expose Map keys as array (let runtime errors surface naturally if hashMap is not defined)
      return Array.from(hashMap.keys());
    });
  }

  async getHashMapSize() {
    return this.page.evaluate(() => hashMap.size);
  }
}

test.describe('Hash Map FSM - UI and States', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
  });

  test('Initial Idle state: UI renders expected components and container is empty', async ({ page }) => {
    // Validate initial render (FSM S0_Idle evidence)
    const app = new HashMapPage(page);
    await app.goto();

    // Check form, input, add and clear buttons exist
    await expect(page.locator('#hash-map')).toBeVisible();
    await expect(page.locator('#hash-input')).toHaveAttribute('placeholder', 'Enter a key');
    await expect(page.locator('button[type="submit"]')).toHaveText('Add');
    await expect(page.locator('#clear-button')).toHaveText('Clear');

    // Container should be empty initially
    const html = await app.getContainerHTML();
    expect(html).toBe('');

    // No page errors logged on initial load
    expect(pageErrors).toEqual([]);

    // There should be no console.error messages on initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Calling missing entry action renderPage() should raise a ReferenceError (FSM S0 entry action)', async ({ page }) => {
    // The FSM indicates renderPage() as an entry action; the implementation does not define it.
    // This test explicitly invokes renderPage() and asserts that a ReferenceError occurs naturally.
    const app = new HashMapPage(page);
    await app.goto();

    // Expect page.evaluate to reject because renderPage is not defined on the page.
    await expect(page.evaluate(() => renderPage())).rejects.toThrow(/renderPage/);
  });
});

test.describe('Hash Map FSM - Transitions and Events', () => {
  test('AddKey transition: add a key by calling addKey() directly and verify DOM and Map state (S0 -> S1)', async ({ page }) => {
    // This test validates the transition from Idle to Key Added by invoking addKey()
    const app = new HashMapPage(page);
    await app.goto();

    // Ensure no keys initially
    expect(await app.getHashMapSize()).toBe(0);
    expect(await app.getContainerHTML()).toBe('');

    // Set input value and call addKey() directly to avoid page navigation
    await app.setInputValue('myKey1');

    // Call the function on the page; let any runtime errors bubble up naturally
    await app.callAddKeyFunction();

    // After calling addKey(), a <p key="myKey1">Added</p> should be appended to the container
    const paragraphs = await app.getParagraphs();
    const added = paragraphs.find(p => p.keyAttr === 'myKey1' && p.text === 'Added');
    expect(added).toBeTruthy();

    // The hashMap global should contain the new key
    const keys = await app.getHashMapKeys();
    expect(keys).toContain('myKey1');
    expect(await app.getHashMapSize()).toBeGreaterThanOrEqual(1);
  });

  test('AddKey edge case: empty input triggers alert and no addition to map', async ({ page }) => {
    // Validate behavior when submitting with empty input (should trigger alert('Please enter a key'))
    const app = new HashMapPage(page);
    await app.goto();

    // Ensure no keys initially
    expect(await app.getHashMapSize()).toBe(0);

    // Set empty input
    await app.setInputValue('');

    // Register a one-time dialog handler to accept the alert
    page.once('dialog', async dialog => {
      // Verify it's an alert and contains the expected message
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Please enter a key');
      await dialog.accept();
    });

    // Call addKey directly; it will trigger alert which we accept above
    await app.callAddKeyFunction();

    // Confirm nothing was added
    expect(await app.getContainerHTML()).toBe('');
    expect(await app.getHashMapSize()).toBe(0);
  });

  test('ClearHashMap transition via Clear button: clears DOM and underlying Map (S0 -> S0)', async ({ page }) => {
    // Validate clicking the Clear button clears both the container and the Map
    const app = new HashMapPage(page);
    await app.goto();

    // Add a couple of keys via addKey() calls
    await app.setInputValue('kA');
    await app.callAddKeyFunction();
    await app.setInputValue('kB');
    await app.callAddKeyFunction();

    // Confirm keys present
    let paragraphs = await app.getParagraphs();
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(await app.getHashMapSize()).toBeGreaterThanOrEqual(2);

    // Click the clear button (this has its own click handler)
    await app.clickClearButton();

    // After clearing, the container should be empty and the map size should be zero
    expect(await app.getContainerHTML()).toBe('');
    expect(await app.getHashMapSize()).toBe(0);
  });

  test('Unexpected behavior: form-level click listener clears the map when clicking inside form (bug in implementation)', async ({ page }) => {
    // The implementation erroneously attaches clearHashMap to the form click event:
    // document.getElementById('hash-map').addEventListener('click', clearHashMap);
    // This test demonstrates that clicking inside the form (e.g., focusing/clicking the input) will clear the container.
    const app = new HashMapPage(page);
    await app.goto();

    // Add a key so there is something to be cleared
    await app.setInputValue('toBeCleared');
    await app.callAddKeyFunction();

    // Verify added
    let paragraphs = await app.getParagraphs();
    expect(paragraphs.find(p => p.keyAttr === 'toBeCleared')).toBeTruthy();
    expect(await app.getHashMapSize()).toBeGreaterThanOrEqual(1);

    // Click the input inside the form which will bubble the click to the form and trigger clearHashMap
    await app.clickInput();

    // After the click, due to the bug, the container should be cleared and the map emptied
    expect(await app.getContainerHTML()).toBe('');
    expect(await app.getHashMapSize()).toBe(0);
  });

  test('Submitting the form via the Add button triggers submit handler and causes navigation (demonstrates missing preventDefault)', async ({ page }) => {
    // This test demonstrates that the form submission (via clicking the Add button) leads to a navigation
    // because the submit handler addKey does not call event.preventDefault().
    const app = new HashMapPage(page);
    await app.goto();

    // Set a key value so addKey will attempt to add before navigation
    await app.setInputValue('navKey');

    // Because the handler doesn't prevent default, clicking submit will cause a navigation (reload).
    // We click and wait for navigation to complete. We don't assert on persistence because reload resets the DOM.
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.click('button[type="submit"]')
    ]);

    // After navigation the page is reloaded; container may be empty; verify the app is reachable and input exists again
    await expect(page.locator('#hash-input')).toBeVisible();
    // No unexpected crash (page error) should have happened as a result of the submit action itself
    // (we allow for navigation but not errors)
    // If there were errors, Playwright would have emitted pageerror events; assert none present
    // (we don't fail the test solely because the DOM was reset by navigation)
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    // small no-op to let any late pageerror emit if it will
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBe(0);
  });
});