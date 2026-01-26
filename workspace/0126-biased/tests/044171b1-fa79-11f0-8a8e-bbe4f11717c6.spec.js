import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/044171b1-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Deque Interactive Application - FSM tests (Application ID: 044171b1-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors without modifying the page
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // pageerror will capture runtime errors like ReferenceError, TypeError, etc.
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown modification of the page; listeners are bound to page fixture and cleared by Playwright
  });

  test('Idle state (S0_Idle) initial render: page shows deque and 5 initial items and Add Item button', async ({ page }) => {
    // This test validates the initial "Idle" state described in the FSM:
    // - The deque container is present
    // - There are exactly five initial items: Item 1..Item 5
    // - The "Add Item" button is present and visible

    // Ensure the container and deque exist
    const deque = page.locator('.deque');
    await expect(deque).toBeVisible();

    // Verify the button exists and contains expected text
    const addButton = page.locator('.deque-button');
    await expect(addButton).toBeVisible();
    await expect(addButton).toHaveText('Add Item');

    // Count the child div elements inside .deque
    const items = page.locator('.deque > div');
    const count = await items.count();
    // FSM evidence lists 5 initial items
    expect(count).toBe(5);

    // Verify each initial item text matches Item 1..Item 5, in order
    for (let i = 0; i < 5; i++) {
      const text = await items.nth(i).textContent();
      expect(text.trim()).toBe(`Item ${i + 1}`);
    }

    // Ensure no runtime page errors occurred during initial rendering
    // (We observe and assert that zero page errors were produced)
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console.error messages during initial render
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Add Item event (AddItem_Click) transitions to Item Added (S1_ItemAdded): appends "Item 6"', async ({ page }) => {
    // This test validates the transition triggered by clicking the Add Item button:
    // - After click, a new div node with text 'Item 6' is appended to .deque
    // - The total child count increases by 1
    // - The appended node is a DIV and appended at the end (last child)

    const addButton = page.locator('.deque-button');
    const itemsLocator = page.locator('.deque > div');

    // Precondition: ensure there is no 'Item 6' yet
    let preCount = await itemsLocator.count();
    expect(preCount).toBe(5);
    for (let i = 0; i < preCount; i++) {
      const t = (await itemsLocator.nth(i).textContent()).trim();
      expect(t).not.toBe('Item 6');
    }

    // Trigger the Add Item click event
    await addButton.click();

    // After clicking, expect the number of children to increase by 1
    const postCount = await itemsLocator.count();
    expect(postCount).toBe(preCount + 1);

    // The last child should contain the text 'Item 6'
    const lastIndex = postCount - 1;
    const lastText = (await itemsLocator.nth(lastIndex).textContent()).trim();
    expect(lastText).toBe('Item 6');

    // The appended node should be a DIV element (created with document.createElement('div'))
    const lastTagName = await itemsLocator
      .nth(lastIndex)
      .evaluate((node) => node.tagName);
    expect(lastTagName).toBe('DIV');

    // The implementation does not explicitly add the 'deque-item' class to the new element,
    // so assert that it does not necessarily have that class (class may be null or not include deque-item).
    const lastClass = await itemsLocator.nth(lastIndex).getAttribute('class');
    // Accept either null/empty or anything that does not break expectation; explicitly ensure it is not "deque-item"
    if (lastClass !== null) {
      expect(lastClass.split(/\s+/).includes('deque-item')).toBe(false);
    }

    // Ensure no runtime page errors occurred as a result of clicking
    expect(pageErrors.length).toBe(0);

    // Ensure console did not emit error-level messages due to this interaction
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Repeated Add Item clicks append multiple Item 6 entries (edge case)', async ({ page }) => {
    // This test validates an edge case: clicking the Add Item button multiple times
    // should append multiple elements containing 'Item 6' (since the implementation hardcodes 'Item 6').

    const addButton = page.locator('.deque-button');
    const itemsLocator = page.locator('.deque > div');

    // Click twice
    await addButton.click();
    await addButton.click();

    // Expect 2 new elements appended (initially 5 -> now 7)
    const count = await itemsLocator.count();
    expect(count).toBe(7);

    // Verify the last two items both have text 'Item 6'
    const lastText1 = (await itemsLocator.nth(5).textContent()).trim();
    const lastText2 = (await itemsLocator.nth(6).textContent()).trim();
    expect(lastText1).toBe('Item 6');
    expect(lastText2).toBe('Item 6');

    // Verify that original items remain unchanged (Item 1..Item 5)
    for (let i = 0; i < 5; i++) {
      const t = (await itemsLocator.nth(i).textContent()).trim();
      expect(t).toBe(`Item ${i + 1}`);
    }

    // Ensure no runtime page errors were raised during repeated interactions
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console.error messages recorded
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM structure assertions for deque and items after interaction', async ({ page }) => {
    // This test validates DOM structure expectations mentioned in FSM evidence:
    // - .deque element exists and children are div elements
    // - appended nodes are child nodes of .deque (deque.appendChild(item) behavior)

    const dequeLocator = page.locator('.deque');
    await expect(dequeLocator).toBeVisible();

    // Confirm initial child node types are DIV
    const children = dequeLocator.locator('div');
    const initialCount = await children.count();
    expect(initialCount).toBe(5);

    for (let i = 0; i < initialCount; i++) {
      const tagName = await children.nth(i).evaluate((n) => n.tagName);
      expect(tagName).toBe('DIV');
    }

    // Click to append one item and re-assert that the newly appended child is a direct child of .deque
    await page.locator('.deque-button').click();

    const newCount = await children.count();
    expect(newCount).toBe(6);

    // Check last child is the appended item (child of deque)
    const lastIsChild = await dequeLocator.evaluate((dequeEl) => {
      const last = dequeEl.lastElementChild;
      return last && last.textContent && last.textContent.trim() === 'Item 6';
    });
    expect(lastIsChild).toBe(true);

    // Ensure no page errors were triggered in the process
    expect(pageErrors.length).toBe(0);
  });

  test('Console and runtime errors observation: assert absence of ReferenceError/SyntaxError/TypeError', async ({ page }) => {
    // This test explicitly inspects collected console messages and page errors
    // to assert whether JavaScript runtime errors occurred naturally without any patching.
    // Per testing rules we must only observe and assert the results.

    // Gather textual forms of page errors and console errors
    const pageErrorMessages = pageErrors.map((e) => {
      if (e && e.message) return e.message;
      return String(e);
    });

    const errorConsoleMessages = consoleMessages
      .filter((m) => m.type === 'error')
      .map((m) => m.text);

    // Combine for easier assertions
    const allErrors = [...pageErrorMessages, ...errorConsoleMessages];

    // Assert that no ReferenceError, SyntaxError, or TypeError messages are present
    // This asserts that the runtime did not naturally produce those errors for this page.
    const hasReferenceError = allErrors.some((msg) =>
      /ReferenceError/.test(msg)
    );
    const hasSyntaxError = allErrors.some((msg) => /SyntaxError/.test(msg));
    const hasTypeError = allErrors.some((msg) => /TypeError/.test(msg));

    expect(hasReferenceError).toBe(false);
    expect(hasSyntaxError).toBe(false);
    expect(hasTypeError).toBe(false);

    // If any page errors exist, fail the test with details (helps debugging if environment differs)
    expect(allErrors.length).toBe(
      0,
      `Unexpected runtime errors were observed: ${JSON.stringify(allErrors, null, 2)}`
    );
  });
});