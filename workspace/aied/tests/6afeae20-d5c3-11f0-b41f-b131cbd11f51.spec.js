import { test, expect } from '@playwright/test';

// Page Object for the Arrays Demo page
class ArraysDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.basicBtn = page.locator("button[onclick='demoBasicOperations()']");
    this.methodsBtn = page.locator("button[onclick='demoArrayMethods()']");
    this.iterationBtn = page.locator("button[onclick='demoArrayIteration()']");
    this.manipulationBtn = page.locator("button[onclick='demoManipulation()']");

    this.addBtn = page.locator("button[onclick='addToArray()']");
    this.removeBtn = page.locator("button[onclick='removeFromArray()']");
    this.clearBtn = page.locator("button[onclick='clearArray()']");
    this.input = page.locator('#arrayInput');

    this.basicOutput = page.locator('#basicOutput');
    this.methodsOutput = page.locator('#methodsOutput');
    this.iterationOutput = page.locator('#iterationOutput');
    this.manipulationOutput = page.locator('#manipulationOutput');

    this.interactiveOutput = page.locator('#interactiveOutput');
    this.currentArray = page.locator('#currentArray');
  }

  async goto(url) {
    await this.page.goto(url);
  }

  // Demo actions
  async runBasicOperations() {
    await this.basicBtn.click();
  }
  async runArrayMethods() {
    await this.methodsBtn.click();
  }
  async runArrayIteration() {
    await this.iterationBtn.click();
  }
  async runManipulation() {
    await this.manipulationBtn.click();
  }

  // Interactive actions
  async addItem(value) {
    await this.input.fill(value);
    await this.addBtn.click();
  }
  async clickAdd() {
    await this.addBtn.click();
  }
  async clickRemove() {
    await this.removeBtn.click();
  }
  async clickClear() {
    await this.clearBtn.click();
  }

  // Getters for output text
  async getBasicOutputText() {
    return (await this.basicOutput.textContent()) || '';
  }
  async getMethodsOutputText() {
    return (await this.methodsOutput.textContent()) || '';
  }
  async getIterationOutputText() {
    return (await this.iterationOutput.textContent()) || '';
  }
  async getManipulationOutputText() {
    return (await this.manipulationOutput.textContent()) || '';
  }
  async getInteractiveOutputText() {
    return (await this.interactiveOutput.textContent()) || '';
  }
  async getCurrentArrayText() {
    return (await this.currentArray.textContent()) || '';
  }
}

// Base URL where the HTML is served
const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6afeae20-d5c3-11f0-b41f-b131cbd11f51.html';

// Collect console errors and page errors per test
test.describe('JavaScript Arrays Demo - Comprehensive E2E', () => {
  // Arrays to collect console error messages and page errors
  let consoleErrors = [];
  let pageErrors = [];

  // Attach listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          // store console error text for assertions
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore any listener exceptions
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(BASE_URL);
  });

  // Ensure no persistent listeners leak (Playwright cleans up between tests,
  // but we keep afterEach for clarity)
  test.afterEach(async ({ page }) => {
    page.removeAllListeners && page.removeAllListeners('console');
    page.removeAllListeners && page.removeAllListeners('pageerror');
  });

  test.describe('Static Demo Sections (FSM states S1-S4)', () => {
    test('Run Basic Operations - S1_BasicOperations state is entered and displays expected info', async ({ page }) => {
      const app = new ArraysDemoPage(page);

      // Click the button that triggers demoBasicOperations()
      await app.runBasicOperations();

      // Validate the basic output contains expected derived values from demoArray = [1,2,3,4,5]
      const text = await app.getBasicOutputText();

      // Assert the HTML contains the heading inserted by the function
      expect(text).toContain('Basic Operations:');

      // Verify core facts about the demoArray are presented correctly
      expect(text).toContain('Original array: [1,2,3,4,5]');
      expect(text).toContain('Length: 5');
      expect(text).toContain('First element: 1');
      expect(text).toContain('Last element: 5');
      expect(text).toContain('Element at index 2: 3');
    });

    test('Run Array Methods Demo - S2_ArrayMethods displays method examples', async ({ page }) => {
      const app = new ArraysDemoPage(page);

      await app.runArrayMethods();

      const text = await app.getMethodsOutputText();
      expect(text).toContain('Array Methods:');
      expect(text).toContain('Original array: [1,2,3,4,5]');
      expect(text).toContain('push(6): [1,2,3,4,5,6]');
      expect(text).toContain('pop(): [1,2,3,4]');
      expect(text).toContain('shift(): [2,3,4,5]');
      expect(text).toContain('unshift(0): [0,1,2,3,4,5]');
      expect(text).toContain('slice(1, 3): [2,3]');
      expect(text).toContain('includes(3): true');
      expect(text).toContain('indexOf(4): 3');
    });

    test('Run Iteration Demo - S3_ArrayIteration displays iteration results', async ({ page }) => {
      const app = new ArraysDemoPage(page);

      await app.runArrayIteration();

      const text = await app.getIterationOutputText();
      expect(text).toContain('Array Iteration Methods:');
      // forEach doubling and map doubling should be reflected
      expect(text).toContain('map (creating new array): [2,4,6,8,10]');
      expect(text).toContain('filter (even numbers): [2,4]');
      expect(text).toContain('reduce (sum): 15');
    });

    test('Run Manipulation Demo - S4_ArrayManipulation displays spread, destructuring, sorting', async ({ page }) => {
      const app = new ArraysDemoPage(page);

      await app.runManipulation();

      const text = await app.getManipulationOutputText();
      expect(text).toContain('Array Manipulation:');
      // Spread operator result
      expect(text).toContain('Spread operator: [1,2,3,4,5,6,7]');
      // Destructuring
      expect(text).toContain('Destructuring: first=1, second=2, rest=[3,4,5]');
      // Sorting demonstration contains both unsorted and sorted representations
      expect(text).toContain('Sorting: [3,1,4,1,5,9,2] → [1,1,2,3,4,5,9]');
    });
  });

  test.describe('Interactive Array Builder (FSM S5_InteractiveArray)', () => {
    test('Initial interactive state is empty and displays correct initial DOM', async ({ page }) => {
      const app = new ArraysDemoPage(page);

      // On load before any interactions, currentArray should show []
      const current = await app.getCurrentArrayText();
      expect(current.trim()).toBe('[]');

      // interactiveOutput should reflect empty array state if updateInteractiveDisplay was called,
      // but even if not called, clicking buttons will confirm behavior — ensure no content indicates misbehavior
      // We'll assert that clicking Remove or Clear on empty array does not produce JS errors and keeps array empty.
      await app.clickRemove();
      expect(await app.getCurrentArrayText()).toBe('[]');

      await app.clickClear();
      expect(await app.getCurrentArrayText()).toBe('[]');

      // And interactive output should not show last item other than 'None' once update happens
      // Trigger an update by clicking clear again (idempotent)
      await app.clickClear();
      const out = await app.getInteractiveOutputText();
      // After updateInteractiveDisplay, it should contain "Array length" and "Is array empty"
      expect(out).toContain('Array length:');
      expect(out).toContain('Is array empty: true');
      expect(out).toContain('Last item: None');
    });

    test('Adding items updates display and currentArray; removing and clearing behave correctly', async ({ page }) => {
      const app = new ArraysDemoPage(page);

      // Edge case: adding empty/whitespace value should not change array
      await app.input.fill('   ');
      await app.clickAdd();
      expect(await app.getCurrentArrayText()).toBe('[]');
      expect((await app.getInteractiveOutputText()).includes('Array length: 0')).toBe(true);

      // Add first item
      await app.addItem('apple');
      expect(await app.getCurrentArrayText()).toBe('["apple"]');
      let out = await app.getInteractiveOutputText();
      expect(out).toContain('Array length: 1');
      expect(out).toContain('Is array empty: false');
      expect(out).toContain('Last item: "apple"');

      // Add second item
      await app.addItem('banana');
      expect(await app.getCurrentArrayText()).toBe('["apple", "banana"]');
      out = await app.getInteractiveOutputText();
      expect(out).toContain('Array length: 2');
      expect(out).toContain('Last item: "banana"');

      // Remove last item (should remove 'banana')
      await app.clickRemove();
      expect(await app.getCurrentArrayText()).toBe('["apple"]');
      out = await app.getInteractiveOutputText();
      expect(out).toContain('Array length: 1');
      expect(out).toContain('Last item: "apple"');

      // Remove again (should remove 'apple' and leave empty)
      await app.clickRemove();
      expect(await app.getCurrentArrayText()).toBe('[]');
      out = await app.getInteractiveOutputText();
      expect(out).toContain('Array length: 0');
      expect(out).toContain('Is array empty: true');
      expect(out).toContain('Last item: None');

      // Removing when empty should be safe (no errors) and remain empty
      await app.clickRemove();
      expect(await app.getCurrentArrayText()).toBe('[]');

      // Add a couple of items then clear
      await app.addItem('x');
      await app.addItem('y');
      expect(await app.getCurrentArrayText()).toBe('["x", "y"]');
      await app.clickClear();
      expect(await app.getCurrentArrayText()).toBe('[]');
      out = await app.getInteractiveOutputText();
      expect(out).toContain('Array length: 0');
      expect(out).toContain('Is array empty: true');
    });
  });

  test.describe('Console and runtime error observations', () => {
    test('No uncaught page errors (pageerror) and no console.error messages of types ReferenceError/SyntaxError/TypeError', async ({ page }) => {
      const app = new ArraysDemoPage(page);

      // Perform a variety of actions that exercise the page and could reveal runtime issues
      await app.runBasicOperations();
      await app.runArrayMethods();
      await app.runArrayIteration();
      await app.runManipulation();

      // Interactive operations that might surface runtime errors
      await app.addItem('alpha');
      await app.addItem('beta');
      await app.clickRemove();
      await app.clickClear();

      // Allow brief time for any asynchronous console/page errors to surface
      await page.waitForTimeout(200);

      // Assert there are no page errors (uncaught exceptions)
      expect(pageErrors.length).toBe(0);

      // Assert there are no console.error messages captured
      expect(consoleErrors.length).toBe(0);

      // Additionally, explicitly assert that none of the captured errors (if any)
      // contain the common JS error names we are monitoring.
      const allMessages = consoleErrors.join('\n') + '\n' + pageErrors.map(e => String(e)).join('\n');
      expect(allMessages).not.toContain('ReferenceError');
      expect(allMessages).not.toContain('SyntaxError');
      expect(allMessages).not.toContain('TypeError');
    });

    test('If any ReferenceError/SyntaxError/TypeError occurs, it will be surfaced as a failure (and captured)', async ({ page }) => {
      // This test documents that we capture runtime errors; it will pass when none occur.
      // We intentionally do not inject or modify the page; we only assert on observed errors.
      const app = new ArraysDemoPage(page);

      // Trigger some interactions
      await app.runBasicOperations();
      await app.addItem('sentry');

      await page.waitForTimeout(100);

      // Build a diagnostic message for test output if something failed
      const messages = consoleErrors.concat(pageErrors.map(e => e.toString()));
      // The test expectation: there should be no runtime errors. If there are,
      // the test will fail and the diagnostic messages will be reported by Playwright.
      expect(messages.length).toBe(0);
    });
  });
});