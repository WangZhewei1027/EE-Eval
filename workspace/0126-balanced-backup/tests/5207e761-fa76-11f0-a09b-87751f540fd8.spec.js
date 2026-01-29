import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5207e761-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Linked List FSM - States, Transitions, Visuals and Errors', () => {
  // Arrays to capture page console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners before each test so we capture logs/errors emitted during page load and interactions
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        // ignore console parsing issues
      }
    });

    page.on('pageerror', err => {
      try {
        pageErrors.push(err.message || String(err));
      } catch (e) {
        pageErrors.push('Unknown page error');
      }
    });
  });

  // Clean up listeners after each test
  test.afterEach(async ({ page }) => {
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('S0 Initialized & S1 ListDisplayed: LinkedList is created and initial display is logged', async ({ page }) => {
    // Navigate to the page which runs the linked list script on load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait briefly to ensure scripts executed and console logs captured
    await page.waitForTimeout(100);

    // The page script logs the list twice: initial display and after removal.
    // Verify that we captured at least two console log entries representing the displays.
    expect(consoleMessages.length).toBeGreaterThanOrEqual(2);

    // Find a console message that corresponds to the initial full list [1, 2, 3, 4, 5]
    const initialLogFound = consoleMessages.some(msg => /1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5/.test(msg));
    expect(initialLogFound).toBeTruthy();

    // Verify the static DOM representation is present (the HTML contains five divs representing nodes)
    const domNodeCount = await page.$$eval('.linked-list > div', nodes => nodes.map(n => n.textContent.trim()));
    expect(domNodeCount).toEqual(['1', '2', '3', '4', '5']);

    // Verify the in-page LinkedList object exists and its current displayed value reflects the script's operations.
    // According to the page script: append 1..5, then remove ll.head.next which removes the node with data=2.
    // Final state (actual behavior) should be [1,3,4,5].
    const displayValue = await page.evaluate(() => {
      // Return the linked list display if available, otherwise undefined
      return typeof ll !== 'undefined' ? ll.display() : undefined;
    });
    expect(displayValue).toEqual([1, 3, 4, 5]);

    // Also assert that the console later logged the updated list [1, 3, 4, 5]
    const updatedLogFound = consoleMessages.some(msg => /1\s*,\s*3\s*,\s*4\s*,\s*5/.test(msg));
    expect(updatedLogFound).toBeTruthy();

    // No unexpected page errors should have occurred during a correct run of the script
    expect(pageErrors.length).toBe(0);
  });

  test('Transition AppendNode: invoking ll.append(6) updates the list structure and display', async ({ page }) => {
    // Load the app fresh for this test
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForTimeout(50);

    // Trigger AppendNode event by calling ll.append in the page context
    const afterAppend = await page.evaluate(() => {
      ll.append(6);
      return ll.display();
    });

    // Expect the list to now include the appended value at the end
    expect(afterAppend).toEqual([1, 3, 4, 5, 6]);

    // Also verify that calling console.log(ll.display()) emits a console entry we can observe
    await page.evaluate(() => console.log('DISPLAY_AFTER_APPEND', ll.display()));
    await page.waitForTimeout(50);

    const appendLogFound = consoleMessages.some(msg => msg.includes('DISPLAY_AFTER_APPEND') && /1\s*,\s*3\s*,\s*4\s*,\s*5\s*,\s*6/.test(msg));
    expect(appendLogFound).toBeTruthy();

    // DOM remains unchanged by the script (script manipulates an in-memory linked list, not DOM), assert this behavior
    const domTexts = await page.$$eval('.linked-list > div', nodes => nodes.map(n => n.textContent.trim()));
    expect(domTexts).toEqual(['1', '2', '3', '4', '5']); // static HTML was not updated by script
  });

  test('Transition RemoveNode and DisplayList: remove a node and log the updated list', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForTimeout(50);

    // At this point the page script already removed ll.head.next once; now append 6 and remove the current head.next
    await page.evaluate(() => {
      // Ensure we have the current structure
      // Append 6 to have more elements to remove afterwards
      ll.append(6);
    });

    await page.waitForTimeout(20);

    // Remove the node immediately after head (this will remove the node with data=3 in the current list)
    const afterRemoval = await page.evaluate(() => {
      ll.remove(ll.head.next);
      return ll.display();
    });

    // The expected list after these operations (starting from initial final state [1,3,4,5], after append -> [1,3,4,5,6], after remove head.next -> [1,4,5,6])
    expect(afterRemoval).toEqual([1, 4, 5, 6]);

    // Trigger a DisplayList event via console.log and verify it appears in consoleMessages
    await page.evaluate(() => console.log('DISPLAY_AFTER_REMOVE', ll.display()));
    await page.waitForTimeout(50);

    const displayAfterRemoveFound = consoleMessages.some(msg => msg.includes('DISPLAY_AFTER_REMOVE') && /1\s*,\s*4\s*,\s*5\s*,\s*6/.test(msg));
    expect(displayAfterRemoveFound).toBeTruthy();
  });

  test('Edge cases & error scenarios: detached method call produces TypeError and referencing undefined variable produces ReferenceError', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // 1) Cause a TypeError by extracting the append method and calling it without binding to ll (this is allowed by the page; do not patch runtime)
    let typeErrorCaught = false;
    try {
      // Calling a method detached from its instance in class methods (strict mode) will typically cause "Cannot read properties of undefined" when accessing this.head
      await page.evaluate(() => {
        const appendFn = ll.append;
        // This call should fail because 'this' is undefined in strict mode for a plain function call
        appendFn(7);
      });
    } catch (e) {
      typeErrorCaught = true;
      // The error message can vary by browser; assert that it mentions reading properties of undefined or similar
      const msg = String(e.message || e);
      expect(/Cannot read|reading 'head'|undefined/.test(msg)).toBeTruthy();
    }

    expect(typeErrorCaught).toBeTruthy();

    // Ensure a corresponding pageerror was fired and captured
    // Wait briefly to allow the pageerror listener to receive the event
    await page.waitForTimeout(50);
    const hasTypeErrorInPageErrors = pageErrors.some(msg => /Cannot read|reading 'head'|TypeError/.test(msg));
    expect(hasTypeErrorInPageErrors).toBeTruthy();

    // 2) Cause a ReferenceError by accessing a non-existent global variable in page context
    let referenceErrorCaught = false;
    try {
      await page.evaluate(() => {
        // This will throw a ReferenceError in the page context
        return nonExistentGlobalVariable;
      });
    } catch (e) {
      referenceErrorCaught = true;
      const msg = String(e.message || e);
      expect(/nonExistentGlobalVariable|ReferenceError|is not defined/.test(msg)).toBeTruthy();
    }

    expect(referenceErrorCaught).toBeTruthy();

    // Ensure that the ReferenceError was captured by pageerror handler
    await page.waitForTimeout(50);
    const hasReferenceError = pageErrors.some(msg => /nonExistentGlobalVariable|ReferenceError|is not defined/.test(msg));
    expect(hasReferenceError).toBeTruthy();
  });

  test('Sanity: verify linked list node traversal via ll.head chain matches display()', async ({ page }) => {
    // Confirm that traversing ll.head yields the same sequence as ll.display()
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForTimeout(50);

    const traversal = await page.evaluate(() => {
      if (typeof ll === 'undefined') return null;
      const values = [];
      let current = ll.head;
      while (current) {
        values.push(current.data);
        current = current.next;
      }
      return values;
    });

    // This should match the final display invoked by the page script (after its remove call)
    const display = await page.evaluate(() => (typeof ll !== 'undefined' ? ll.display() : null));
    expect(traversal).toEqual(display);

    // Ensure traversal yields the expected array [1,3,4,5] as per the page's executed operations
    expect(traversal).toEqual([1, 3, 4, 5]);
  });
});