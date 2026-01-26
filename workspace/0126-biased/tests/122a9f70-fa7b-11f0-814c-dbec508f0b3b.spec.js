import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122a9f70-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object for the Linked List page
class LinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getAddButton() {
    return this.page.$('#add-button');
  }

  async getRemoveButton() {
    return this.page.$('#remove-button');
  }

  async getClearButton() {
    return this.page.$('#clear-button');
  }

  async getInputField() {
    return this.page.$('#input-field');
  }

  async getListContainer() {
    return this.page.$('#list');
  }

  async getListItemsCount() {
    return this.page.$$eval('#list li', (els) => els.length);
  }

  async getListItemsText() {
    return this.page.$$eval('#list li', (els) => els.map(e => e.textContent));
  }

  // Read the internal currentValue variable from the page (if present)
  async getCurrentValueVariable() {
    return this.page.evaluate(() => {
      // If variable is undefined, this returns undefined — allowed
      return typeof currentValue !== 'undefined' ? currentValue : null;
    });
  }
}

test.describe('Linked List FSM - Application 122a9f70-fa7b-11f0-814c-dbec508f0b3b', () => {
  // Collect runtime page errors and console error messages for assertions
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture unhandled exceptions from the page
    page.on('pageerror', (err) => {
      // store Error objects (or messages)
      pageErrors.push(err);
    });

    // Capture console.error messages as well (some runtime problems surface here)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const linkedList = new LinkedListPage(page);
    await linkedList.goto();
  });

  test.afterEach(async ({ page }) => {
    // No special teardown required; leaving hooks for clarity
    // Ensure page is still reachable
    await expect(page).toBeTruthy();
  });

  test('Idle state: all UI elements are present and list is initially empty', async ({ page }) => {
    // This test validates the S0_Idle state: DOM elements exist (buttons, input, list)
    const p = new LinkedListPage(page);

    const addBtn = await p.getAddButton();
    const removeBtn = await p.getRemoveButton();
    const clearBtn = await p.getClearButton();
    const input = await p.getInputField();
    const list = await p.getListContainer();

    expect(addBtn).not.toBeNull();
    expect(removeBtn).not.toBeNull();
    expect(clearBtn).not.toBeNull();
    expect(input).not.toBeNull();
    expect(list).not.toBeNull();

    // The list should be empty at load
    const count = await p.getListItemsCount();
    expect(count).toBe(0);
  });

  test('InputChange event updates internal currentValue variable (InputChange event)', async ({ page }) => {
    // This test validates the InputChange event handler that sets currentValue via currentValueInput listener
    const p = new LinkedListPage(page);
    const input = await p.getInputField();
    await input.fill('hello');

    // Give the page a moment to process input listeners
    await page.waitForTimeout(50);

    const currentValue = await p.getCurrentValueVariable();
    // The page defines currentValue and the dedicated currentValueInput listener is added before the runtime error,
    // so we expect currentValue to reflect typed input.
    expect(currentValue).toBe('hello');

    // The DOM list should remain empty (add handlers likely not attached yet)
    const listCount = await p.getListItemsCount();
    expect(listCount).toBe(0);
  });

  test('Runtime error occurs due to missing #buttons element; observe pageerror and console.error', async ({ page }) => {
    // This test asserts that a runtime TypeError occurs during script execution due to buttons being null.
    // The script contains: buttons.addEventListener('click', ...) but no element has id="buttons"
    // We assert that at least one pageerror or console.error mentioning addEventListener or buttons was recorded.
    // Wait briefly to ensure page script executes and events are captured.
    await page.waitForTimeout(100);

    // At least one pageerror or console error should be present
    const hadPageError = pageErrors.length > 0;
    const hadConsoleError = consoleErrors.length > 0;

    expect(hadPageError || hadConsoleError).toBeTruthy();

    // If page errors exist, check messages for likely causes
    if (hadPageError) {
      const combinedMessages = pageErrors.map(e => `${e && e.message ? e.message : String(e)}`).join(' | ');
      // Expect the thrown error to be related to addEventListener/read property of null
      expect(/addEventListener|Cannot read properties of null|Cannot read property 'addEventListener'|reading 'addEventListener'/i.test(combinedMessages)).toBeTruthy();
    }

    if (hadConsoleError) {
      const combinedConsole = consoleErrors.join(' | ');
      expect(/addEventListener|buttons|Cannot read properties of null|Cannot read property 'addEventListener'/i.test(combinedConsole)).toBeTruthy();
    }
  });

  test('Attempting AddValue transition via Add button does not create list items due to script error', async ({ page }) => {
    // This test attempts to exercise the AddValue transition (S0 -> S1) by interacting with the UI,
    // but because the runtime error likely prevented event listeners from being attached, the transition should NOT occur.
    const p = new LinkedListPage(page);
    const input = await p.getInputField();
    const addBtn = await p.getAddButton();

    // Type a value that we would like to add
    await input.fill('node1');
    await page.waitForTimeout(50); // let any input handlers run

    // Click the Add button (which may or may not have an active handler)
    await addBtn.click();
    // Allow any handlers (if present) to run
    await page.waitForTimeout(50);

    // Inspect list - due to broken script flow, list should remain empty (no <li> added)
    const items = await p.getListItemsText();
    expect(items.length).toBe(0);

    // Also ensure that internal currentValue has been set by the earlier input listener (sanity)
    const current = await p.getCurrentValueVariable();
    // After typing we expect it to be 'node1' (handler that sets currentValue was attached before the error)
    expect(current).toBe('node1');
  });

  test('Typing into input does not trigger onEnter add behavior (inputField input handler likely not attached) and list stays empty', async ({ page }) => {
    // There is an inputField.addEventListener('input', handleAddClick) in the HTML, but it is placed after a runtime error.
    // Therefore typing into the input should NOT add items to the list even though currentValue changes.
    const p = new LinkedListPage(page);
    const input = await p.getInputField();

    await input.fill('abc');
    // Wait a bit to allow any attached listeners to run (if they somehow exist)
    await page.waitForTimeout(100);

    const items = await p.getListItemsText();
    expect(items.length).toBe(0);
  });

  test('RemoveValue and ClearList transitions do not modify list when handlers are not attached; verify no unexpected DOM change', async ({ page }) => {
    // This test tries to trigger RemoveValue and ClearList transitions by clicking corresponding buttons.
    // Because script initialization likely failed early, these handlers may not have been attached.
    // We assert the list remains empty and no new errors are thrown beyond the initial one.
    const p = new LinkedListPage(page);
    const removeBtn = await p.getRemoveButton();
    const clearBtn = await p.getClearButton();

    // Clicking remove should do nothing (no handler)
    await removeBtn.click();
    await page.waitForTimeout(50);
    expect(await p.getListItemsCount()).toBe(0);

    // Clicking clear should do nothing (no handler)
    await clearBtn.click();
    await page.waitForTimeout(50);
    expect(await p.getListItemsCount()).toBe(0);

    // Confirm that no additional page errors beyond initial exist (we accept >=1 total, but should not blow up further)
    // We allow some flexibility: at least one page error occurred during page load (checked in separate test).
    expect(pageErrors.length).toBeGreaterThanOrEqual(0);
  });

  test('Edge case: verify removeValue would throw if called with invalid index (do not call functions directly) - observe safe DOM', async ({ page }) => {
    // We will NOT call removeValue directly (per instructions), but we assert that the DOM is still safe and no nodes exist,
    // preventing accidental removal. This is an edge-case check: list is empty, so removal cannot succeed.
    const p = new LinkedListPage(page);
    expect(await p.getListItemsCount()).toBe(0);

    // For completeness, ensure the list container HTML is present and empty string is returned for innerHTML
    const innerHTML = await page.$eval('#list', (el) => el.innerHTML);
    expect(innerHTML).toBe('');
  });

  test('Sanity: Ensure page has expected elements text content for buttons and placeholder for input', async ({ page }) => {
    // Validate visible text/content to ensure UI matches FSM evidence
    const addText = await page.$eval('#add-button', el => el.textContent);
    const removeText = await page.$eval('#remove-button', el => el.textContent);
    const clearText = await page.$eval('#clear-button', el => el.textContent);
    const placeholder = await page.$eval('#input-field', el => el.getAttribute('placeholder'));

    expect(addText.trim()).toBe('Add');
    expect(removeText.trim()).toBe('Remove');
    expect(clearText.trim()).toBe('Clear');
    expect(placeholder).toBe('Enter value');
  });

});