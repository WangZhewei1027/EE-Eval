import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122ce963-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object encapsulating interactions with the Paging UI
class PagingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Note: there are duplicate IDs ("#next-button") in the HTML.
    // Use .first() to interact with the first instance consistently.
    this.topNext = page.locator('#next-button').first();
    this.clearButton = page.locator('#clear-button');
    this.previousButton = page.locator('#previous-button');
    this.endButton = page.locator('#end-button');
    this.amountInput = page.locator('#amount');
    this.currentButton = page.locator('#current-button');
    this.prevPaginationButton = page.locator('#prev-button');
    // For checking the other occurrence of next-button we can use nth(1)
    this.paginationNext = page.locator('#next-button').nth(1);
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getAmountValue() {
    return await this.amountInput.inputValue();
  }

  async setAmountValue(value) {
    await this.amountInput.fill(String(value));
  }

  async clickClear() {
    await this.clearButton.click();
  }

  async clickTopNext() {
    await this.topNext.click();
  }

  async clickPaginationNext() {
    // may not exist as a second instance in some browsers if DOM normalization differs,
    // guard by checking count
    const count = await this.page.locator('#next-button').count();
    if (count > 1) {
      await this.paginationNext.click();
    } else {
      // fallback to first if only one exists
      await this.topNext.click();
    }
  }

  async clickPrevious() {
    await this.previousButton.click();
  }

  async clickEnd() {
    await this.endButton.click();
  }

  async getCurrentButtonText() {
    return (await this.currentButton.textContent())?.trim() ?? '';
  }

  async getDisplay(selector) {
    return await this.page.locator(selector).evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
  }
}

test.describe('Paging FSM - comprehensive end-to-end tests', () => {
  // Arrays to capture console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // capture console messages
    page.on('console', (msg) => {
      // store text and type for diagnostics/assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object; record the message and name
      pageErrors.push({ message: err.message, name: err.name });
    });
  });

  // Test initial Idle state rendering and entry action renderPage() effect (observables)
  test('Initial Idle state renders controls and default values', async ({ page }) => {
    // This test validates S0_Idle entry: renderPage() -> controls present, amount default 10
    const app = new PagingPage(page);
    await app.goto();

    // Expect amount input to exist and have default value "10"
    await expect(app.amountInput).toBeVisible();
    expect(await app.getAmountValue()).toBe('10');

    // Buttons expected by FSM evidence must be present
    await expect(app.clearButton).toBeVisible();
    await expect(app.topNext).toBeVisible();
    await expect(app.previousButton).toBeVisible();

    // The pagination current button should initially show "1"
    await expect(app.currentButton).toBeVisible();
    expect(await app.getCurrentButtonText()).toBe('1');

    // Ensure no uncaught page errors occurred during initial render
    expect(pageErrors).toHaveLength(0);
  });

  test.describe('ClearEvent -> S4_Cleared', () => {
    // Validate that clicking Clear resets fields as specified by the transition
    test('Clicking Clear resets amount to 10 and current page to 1', async ({ page }) => {
      const app = new PagingPage(page);
      await app.goto();

      // Mutate state to non-default values to verify clear resets them.
      await app.setAmountValue('5');
      // set current-button text to something else directly (simulating prior state)
      await page.locator('#current-button').evaluate((el) => (el.textContent = '3'));

      // Sanity check mutated values applied
      expect(await app.getAmountValue()).toBe('5');
      expect(await app.getCurrentButtonText()).toBe('3');

      // Click clear -> expected to reset amount to '10' and current to '1'
      await app.clickClear();

      expect(await app.getAmountValue()).toBe('10');
      expect(await app.getCurrentButtonText()).toBe('1');

      // No unexpected errors should have occurred during Clear handling
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('NextEvent -> S1_NextPressed', () => {
    // Validate next-button behavior and visual changes after click
    test('Clicking Next updates current page display and shows pagination controls', async ({ page }) => {
      const app = new PagingPage(page);
      await app.goto();

      // Precondition: ensure prev-pagination and end-pagination exist
      await expect(app.prevPaginationButton).toBeVisible();
      await expect(app.endButton).toBeVisible();

      // Click the top 'Next' button (first occurrence)
      await app.clickTopNext();

      // The script sets current-button textContent to currentPage (1)
      expect(await app.getCurrentButtonText()).toBe('1');

      // After clicking next, the script attempts to set next/prev/end display = 'block'
      const nextDisplay = await app.getDisplay('#next-button');
      const prevDisplay = await app.getDisplay('#prev-button');
      const endDisplay = await app.getDisplay('#end-button');

      // They should not be 'none' (ideally 'block', but rely on not-none)
      expect(nextDisplay).not.toBe('none');
      expect(prevDisplay).not.toBe('none');
      expect(endDisplay).not.toBe('none');

      // No uncaught page errors expected
      expect(pageErrors).toHaveLength(0);
    });

    test('Clicking Next twice (duplicate listeners) does not throw, state remains consistent', async ({ page }) => {
      // This validates edge case: duplicate event listeners in the HTML (two next-button handlers).
      const app = new PagingPage(page);
      await app.goto();

      // Click next twice rapidly
      await app.clickTopNext();
      await app.clickTopNext();

      // After duplicate handler invocations, current should still be stable (1)
      expect(await app.getCurrentButtonText()).toBe('1');

      // no uncaught exceptions recorded
      expect(pageErrors).toHaveLength(0);

      // Capture console logs presence (should not be empty array type guarantee)
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });
  });

  test.describe('PreviousEvent -> S2_PreviousPressed', () => {
    test('Clicking Previous decrements current page when amount > 1', async ({ page }) => {
      const app = new PagingPage(page);
      await app.goto();

      // Default amount is 10 (>1), clicking previous will set current-button to currentPage - 1 => '0'
      await app.clickPrevious();

      expect(await app.getCurrentButtonText()).toBe('0');

      // pagination buttons should have display set (script sets them to 'block')
      const nextDisplay = await app.getDisplay('#next-button');
      const prevDisplay = await app.getDisplay('#prev-button');
      const endDisplay = await app.getDisplay('#end-button');

      expect(nextDisplay).not.toBe('none');
      expect(prevDisplay).not.toBe('none');
      expect(endDisplay).not.toBe('none');

      expect(pageErrors).toHaveLength(0);
    });

    test('Clicking Previous is a no-op when amount <= 1', async ({ page }) => {
      const app = new PagingPage(page);
      await app.goto();

      // set amount to 1 to trigger the "else" branch in previous-button handler
      await app.setAmountValue('1');

      // current-button should still be the default '1'
      const before = await app.getCurrentButtonText();
      expect(before).toBe('1');

      // Click previous - script's else branch only sets endButtonPressed = false (no DOM change)
      await app.clickPrevious();

      // Ensure no DOM change occurred to current-button
      const after = await app.getCurrentButtonText();
      expect(after).toBe('1');

      // No page errors expected
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('EndEvent -> S3_EndPressed', () => {
    test('Clicking End hides the end button when amount <= 9', async ({ page }) => {
      const app = new PagingPage(page);
      await app.goto();

      // set amount to 5 (<=9) to trigger the code path that hides end-button
      await app.setAmountValue('5');

      // Click end
      await app.clickEnd();

      // current-button should be set to currentPage (1)
      expect(await app.getCurrentButtonText()).toBe('1');

      // end-button should be hidden (display: none)
      const endDisplay = await app.getDisplay('#end-button');
      expect(endDisplay).toBe('none');

      expect(pageErrors).toHaveLength(0);
    });

    test('Clicking End does not hide the end button when amount > 9', async ({ page }) => {
      const app = new PagingPage(page);
      await app.goto();

      // Default amount is 10 (>9), clicking end should not hide end button (else branch)
      await app.clickEnd();

      // end-button should remain visible (not 'none')
      const endDisplay = await app.getDisplay('#end-button');
      expect(endDisplay).not.toBe('none');

      expect(pageErrors).toHaveLength(0);
    });
  });

  test('Edge case and error observation: capture any page errors and console logs', async ({ page }) => {
    // This test's purpose is to validate that we observe console and page errors as they occur
    const app = new PagingPage(page);
    await app.goto();

    // Interact with multiple controls to potentially surface runtime issues
    await app.clickTopNext();
    await app.clickPrevious();
    await app.setAmountValue('2');
    await app.clickEnd();
    await app.clickClear();

    // After interactions, assert that no fatal page errors (ReferenceError/SyntaxError/TypeError) were recorded.
    // The test will fail if any uncaught exceptions occurred in-page.
    const fatalErrors = pageErrors.filter(
      (e) => e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError'
    );

    // We expect no fatal errors in the environment; if any exist, fail the test and print them for debugging.
    expect(fatalErrors).toHaveLength(0);

    // Also assert that console message array exists (we don't require specific messages,
    // just that we successfully observed console traffic)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});