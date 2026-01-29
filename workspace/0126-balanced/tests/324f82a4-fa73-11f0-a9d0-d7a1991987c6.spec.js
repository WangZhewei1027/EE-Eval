import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f82a4-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object to encapsulate selectors and common operations
class DesignPatternsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.singletonButton = page.locator('#singletonButton');
    this.factoryButton = page.locator('#factoryButton');
    this.singletonResult = page.locator('#singletonResult');
    this.factoryResult = page.locator('#factoryResult');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async clickSingleton() {
    await this.singletonButton.click();
  }

  async clickFactory() {
    await this.factoryButton.click();
  }

  async getSingletonText() {
    return await this.singletonResult.textContent();
  }

  async getFactoryText() {
    return await this.factoryResult.textContent();
  }

  // Helper to call into page context to inspect internals (without modifying code)
  async evaluate(fn) {
    return await this.page.evaluate(fn);
  }
}

test.describe('Design Patterns Example (FSM tests)', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let pageObj;

  test.beforeEach(async ({ page }) => {
    // reset collectors before each test
    pageErrors = [];
    consoleMessages = [];

    // collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // collect uncaught page errors
    page.on('pageerror', (error) => {
      // store the Error object for assertions
      pageErrors.push(error);
    });

    pageObj = new DesignPatternsPage(page);
    await pageObj.goto();
  });

  test.afterEach(async ({ page }) => {
    // detach listeners implicitly by navigating away (cleanup)
    // Nothing to explicitly tear down; listeners are per-page and will be cleaned up by Playwright
    // But assert no leftover outstanding errors in the page at teardown (some tests intentionally trigger errors)
  });

  test('Initial state (S0_Idle): buttons present and result areas empty', async ({ page }) => {
    // Validate initial UI elements exist and are visible
    await expect(page.locator('#singletonButton')).toBeVisible();
    await expect(page.locator('#factoryButton')).toBeVisible();

    // Validate result areas start empty
    const singletonText = (await pageObj.getSingletonText()) || '';
    const factoryText = (await pageObj.getFactoryText()) || '';
    expect(singletonText.trim()).toBe('', 'Expected singletonResult to be empty at initial state');
    expect(factoryText.trim()).toBe('', 'Expected factoryResult to be empty at initial state');

    // Ensure no console errors or page errors on initial load
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0 -> S1 (Get Singleton Instance): clicking updates singletonResult and shows same instance', async ({ page }) => {
    // Click the singleton button to trigger the FSM transition and entry action
    await pageObj.clickSingleton();

    // Expected text produced by entry action
    const expectedSingletonText = 'Instance 1: I am the instance\nInstance 2: I am the instance\nSame instance: true';

    // Wait and assert the pre text content is updated exactly as expected
    await expect(page.locator('#singletonResult')).toHaveText(expectedSingletonText);

    // Double-check via evaluating in page context that Singleton.getInstance() returns identical references
    const sameInstance = await pageObj.evaluate(() => {
      // Use the page's existing Singleton implementation
      try {
        const a = Singleton.getInstance();
        const b = Singleton.getInstance();
        return a === b;
      } catch (e) {
        // If something unexpected happens, forward the error message
        return { error: String(e) };
      }
    });

    // If the page evaluation returned an object with error, fail with that message
    if (sameInstance && typeof sameInstance === 'object' && sameInstance.error) {
      throw new Error('Error while checking Singleton in page: ' + sameInstance.error);
    }

    expect(sameInstance).toBe(true);

    // Ensure no console errors or page errors during this normal interaction
    const errorConsoleMessages1 = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Singleton preserves single instance across multiple clicks (idempotence)', async ({ page }) => {
    // Click singleton button multiple times to ensure idempotent behavior
    await pageObj.clickSingleton();
    await pageObj.clickSingleton();
    await pageObj.clickSingleton();

    // The result should still indicate the same instance
    const expectedTextPart = 'Same instance: true';
    const singletonText1 = (await pageObj.getSingletonText()) || '';
    expect(singletonText).toContain(expectedTextPart);

    // Verify programmatically that repeated getInstance returns the same object
    const sameAcross = await pageObj.evaluate(() => {
      const a1 = Singleton.getInstance();
      const b1 = Singleton.getInstance();
      const c = Singleton.getInstance();
      return a === b && b === c;
    });
    expect(sameAcross).toBe(true);

    // No page-level uncaught errors expected
    const errorConsoleMessages2 = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0 -> S2 (Create Animal): clicking updates factoryResult with Dog and Cat speaks', async ({ page }) => {
    // Click the factory button to trigger the FSM transition and entry action
    await pageObj.clickFactory();

    // Expected text produced by entry action
    const expectedFactoryText = 'Dog says: Woof!\nCat says: Meow!';

    // Assert the result area contains the expected text
    await expect(page.locator('#factoryResult')).toHaveText(expectedFactoryText);

    // Inspect the created objects via page context to ensure classes behave as expected
    const speaks = await pageObj.evaluate(() => {
      try {
        const factory = new AnimalFactory();
        const dog = factory.createAnimal('dog');
        const cat = factory.createAnimal('cat');
        return { dogSpeak: dog.speak(), catSpeak: cat.speak() };
      } catch (e) {
        return { error: String(e) };
      }
    });

    if (speaks && speaks.error) {
      throw new Error('Error while checking animals in page: ' + speaks.error);
    }

    expect(speaks.dogSpeak).toBe('Woof!');
    expect(speaks.catSpeak).toBe('Meow!');

    // No console errors or page errors during this normal interaction
    const errorConsoleMessages3 = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Factory edge case: creating unknown animal type returns null (graceful handling)', async ({ page }) => {
    // Call createAnimal with an unknown type via page.evaluate and assert null is returned
    const result = await pageObj.evaluate(() => {
      try {
        const factory1 = new AnimalFactory();
        return factory.createAnimal('bird'); // not implemented in factory
      } catch (e) {
        return { error: String(e) };
      }
    });

    // If an error object was returned from the page evaluate, fail
    if (result && result.error) {
      throw new Error('Error while invoking factory.createAnimal in page: ' + result.error);
    }

    // Expect null for unknown type
    expect(result).toBeNull();

    // No console errors or page errors expected from this graceful null-returning call
    const errorConsoleMessages4 = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console and page errors: intentionally trigger a ReferenceError and assert it is captured', async ({ page }) => {
    // Ensure we start with no page errors
    expect(pageErrors.length).toBe(0);

    // Intentionally invoke a non-existent function in the page context to generate a ReferenceError.
    // We catch the evaluate rejection to allow the test to continue and then assert the pageerror was emitted.
    let evalError = null;
    try {
      // This will throw in the page context and also emit a 'pageerror' event
      await page.evaluate(() => {
        // Intentionally call something not defined to trigger ReferenceError
        // This does not modify page globals or patch code; it simply exercises error handling
        // eslint-disable-next-line no-undef
        nonExistentFunctionThatDoesNotExistForTest();
      });
    } catch (e) {
      // page.evaluate is expected to reject; capture the thrown error for inspection
      evalError = e;
    }

    // We expect an error to have been thrown by evaluate
    expect(evalError).not.toBeNull();

    // Wait briefly to ensure the pageerror event has been received
    // (listeners are synchronous but allow a tick to collect)
    await page.waitForTimeout(50);

    // There should be at least one page error captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The captured page error should be a ReferenceError mentioning the missing function
    const matching = pageErrors.some(err => {
      if (!err || !err.message) return false;
      const msg = err.message.toLowerCase();
      return msg.includes('nonexistentfunctionthatdoesnotexistfortest'.toLowerCase()) || msg.includes('not defined') || msg.includes('is not defined') || msg.includes('not found');
    });
    expect(matching).toBe(true);
  });
});