import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0441e6e4-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Trie Interactive Application (FSM-driven) - 0441e6e4-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Each test will navigate to the page. The page's script contains runtime errors
  // because DOM elements (#inputField, #searchButton, #startsWithButton, #output)
  // are missing. The tests intentionally do NOT patch or modify the page and assert
  // that those runtime errors occur naturally.

  test('S0 Idle state: static descriptive content is rendered', async ({ page }) => {
    // Capture the first uncaught page error that occurs during load
    const pageErrorPromise = page.waitForEvent('pageerror');
    // Navigate to the application
    await page.goto(APP_URL);

    // The static body content should be present despite script runtime errors.
    const bodyLocator = page.locator('.body');
    await expect(bodyLocator).toContainText('Trie is a data structure that uses a tree-like structure to store a collection of strings.');

    // The page's script will try to access missing DOM elements and should throw.
    // Wait for the pageerror and validate it references addEventListener / null access.
    const err = await pageErrorPromise;
    expect(err).toBeTruthy();
    // The exact error text may vary between engines; assert key substrings that indicate null property access.
    const msg = err.message || '';
    expect(msg.toLowerCase()).toContain('addeventlistener'); // expects failing line when attaching handlers
    expect(msg.toLowerCase()).toContain('null'); // indicates attempt to read properties of null
  });

  test.describe('S1 WordInserted and related transitions (errors due to missing inputs)', () => {
    test('S1 WordInserted: trie object exists and updateUI function is defined, but #inputField is missing causing a runtime error', async ({ page }) => {
      // Listen for the uncaught error during script execution
      const pageErrorPromise = page.waitForEvent('pageerror');
      await page.goto(APP_URL);

      // The runtime error should have occurred while attempting to register event listeners
      const err = await pageErrorPromise;
      expect(err).toBeTruthy();
      const msg = err.message || '';
      expect(msg.toLowerCase()).toContain('addeventlistener');

      // Even though the script error occurs, the Trie constructor and function declarations
      // are parsed/initialized before the runtime failure. Validate that 'trie' exists
      // and 'updateUI' is available on the page global.
      const trieType = await page.evaluate(() => typeof trie);
      const updateUIType = await page.evaluate(() => typeof updateUI);
      expect(trieType).toBe('object');
      expect(updateUIType).toBe('function');

      // The input field required for InputChange event does not exist in the DOM.
      const inputHandle = await page.$('#inputField');
      expect(inputHandle).toBeNull();
    });

    test('InputChange event: attempting to programmatically trigger input on missing element results in an error', async ({ page }) => {
      // Navigate and capture pageerror from initial script execution
      const pageErrorPromise = page.waitForEvent('pageerror');
      await page.goto(APP_URL);
      await pageErrorPromise; // ensure initial runtime error recorded

      // Now attempt to run code in page context that accesses the missing input element,
      // which should throw a TypeError inside the page context.
      let caughtError = null;
      try {
        await page.evaluate(() => {
          // This will throw because inputField is null
          const input = document.getElementById('inputField');
          // Attempt to set value and dispatch should cause an exception
          input.value = 'hello';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      } catch (e) {
        caughtError = e;
      }
      // Ensure the evaluation threw an error due to null access
      expect(caughtError).not.toBeNull();
      const emsg = (caughtError && caughtError.message) ? caughtError.message.toLowerCase() : '';
      expect(emsg).toContain('cannot'); // generic check that it's an error thrown
      // The page-side error message should indicate inability to read properties of null / set properties
      expect(emsg).toMatch(/null|addeventlistener|cannot read/i);
    });

    test('S2 WordSearched and S3 PrefixChecked transitions: search and startsWith buttons are missing', async ({ page }) => {
      // Register pageerror wait to catch runtime error on load
      const pageErrorPromise = page.waitForEvent('pageerror');
      await page.goto(APP_URL);
      await pageErrorPromise;

      // Both buttons referenced in FSM do not exist in the provided HTML.
      const searchButton = await page.$('#searchButton');
      const startsWithButton = await page.$('#startsWithButton');
      expect(searchButton).toBeNull();
      expect(startsWithButton).toBeNull();

      // Because the buttons are missing, clicking them in the UI is impossible.
      // Validate that invoking the search logic directly on the trie still works
      // (the JS runtime constructed the Trie object before the DOM access failure).
      const results = await page.evaluate(() => {
        // Directly interact with trie object to test core logic
        trie.insert('apple');
        trie.insert('app');
        return {
          searchApple: trie.search('apple'),
          searchApp: trie.search('app'),
          searchA: trie.search('a'),
          startsWithAp: trie.startsWith('ap'),
          startsWithApp: trie.startsWith('app'),
          startsWithZ: trie.startsWith('z')
        };
      });

      expect(results.searchApple).toBe(true);
      expect(results.searchApp).toBe(true);
      expect(results.searchA).toBe(false);
      expect(results.startsWithAp).toBe(true);
      expect(results.startsWithApp).toBe(true);
      expect(results.startsWithZ).toBe(false);
    });
  });

  test.describe('UI update and error edge-cases', () => {
    test('updateUI invocation raises an error due to missing #output element', async ({ page }) => {
      // The updateUI function exists but assumes an #output element exists.
      // Calling updateUI should raise a TypeError because output is null.
      const pageErrorPromise = page.waitForEvent('pageerror');
      await page.goto(APP_URL);
      // Wait for the initial error that arises on load (event listener registration failure)
      const initialErr = await pageErrorPromise;
      expect(initialErr).toBeTruthy();

      // Now attempt to call updateUI directly and capture the exception thrown by the page.evaluate call.
      let evalError = null;
      try {
        await page.evaluate(() => {
          // Calling updateUI will try to access output.innerHTML and fail if #output is missing
          updateUI();
        });
      } catch (e) {
        evalError = e;
      }
      expect(evalError).not.toBeNull();
      // Error should indicate trying to set innerHTML of null or similar.
      const evalMsg = (evalError && evalError.message) ? evalError.message.toLowerCase() : '';
      expect(evalMsg).toMatch(/innerhtml|cannot|null|set properties/i);
    });

    test('Edge case: invoking Trie methods with empty strings behaves as expected', async ({ page }) => {
      // Even though DOM elements are missing, the Trie logic should be callable.
      await page.goto(APP_URL);
      // No need to wait for pageerror here; we directly evaluate trie behavior.
      const result = await page.evaluate(() => {
        // Insert empty string and test search / startsWith behaviors
        // Note: behavior for empty string depends on implementation; this Trie marks endOfWord on insertion
        trie.insert('');
        return {
          searchEmpty: trie.search(''),
          startsWithEmpty: trie.startsWith(''),
          // searching for something not inserted
          searchNon: trie.search('nonexistent'),
          startsWithNon: trie.startsWith('nonexistent')
        };
      });

      // According to the implementation, inserting '' would mark the root node as endOfWord.
      // Therefore search('') should return true and startsWith('') should trivially return true.
      expect(result.searchEmpty).toBe(true);
      expect(result.startsWithEmpty).toBe(true);
      expect(result.searchNon).toBe(false);
      expect(result.startsWithNon).toBe(false);
    });
  });

  test.describe('Observability: console and page errors during interactions', () => {
    test('Console logs are not produced for search/startsWith since buttons are missing; page errors were emitted', async ({ page }) => {
      // Collect console messages emitted during navigation
      const messages = [];
      page.on('console', (msg) => {
        messages.push({ type: msg.type(), text: msg.text() });
      });

      // Capture pageerror as well
      const pageErrorPromise = page.waitForEvent('pageerror');

      await page.goto(APP_URL);
      const err = await pageErrorPromise;
      expect(err).toBeTruthy();

      // Because the event listeners for buttons were never registered (script crashed),
      // there should be no console logs coming from search/startsWith flows.
      // We allow that there might be zero console messages.
      const logTexts = messages.map(m => m.text);
      // Ensure that there is not a console message indicating "Word '... found" or similar.
      const anySearchLog = logTexts.some(t => /word .* found|prefix .* found|please enter/i.test(t.toLowerCase()));
      expect(anySearchLog).toBe(false);
    });
  });
});