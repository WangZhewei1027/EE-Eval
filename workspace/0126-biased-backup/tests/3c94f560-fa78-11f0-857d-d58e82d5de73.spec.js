import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c94f560-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object encapsulating selectors and common actions for the Array visualization page.
 */
class ArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#highlight-btn');
    this.arrayContainer = page.locator('.array-container');
    this.arrayItems = page.locator('.array-item');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for main interactive controls to be present
    await this.button.waitFor({ state: 'visible' });
    await this.arrayContainer.waitFor({ state: 'visible' });
  }

  async clickToggle() {
    await this.button.click();
  }

  async getButtonText() {
    return this.button.textContent();
  }

  async getButtonAriaPressed() {
    return this.button.getAttribute('aria-pressed');
  }

  async getArrayItemCount() {
    return this.arrayItems.count();
  }

  // Returns the element handle (JSHandle) for the mid item
  async getMidItemLocator() {
    const count = await this.getArrayItemCount();
    const mid = Math.floor(count / 2);
    return this.arrayItems.nth(mid);
  }

  // Return inline style properties from the mid item as an object
  async getMidItemInlineStyles() {
    const midLocator = await this.getMidItemLocator();
    return midLocator.evaluate((el) => {
      // return the inline styles we are interested in
      return {
        background: el.style.background || '',
        boxShadow: el.style.boxShadow || '',
        color: el.style.color || '',
        textContent: el.textContent,
        dataIndex: el.getAttribute('data-index'),
        ariaLabel: el.getAttribute('aria-label'),
      };
    });
  }

  // Return inline style for a given item index (string or number)
  async getItemInlineStylesByIndex(index) {
    return this.page.locator(`.array-item[data-index="${index}"]`).evaluate((el) => {
      return {
        background: el.style.background || '',
        boxShadow: el.style.boxShadow || '',
        color: el.style.color || '',
        textContent: el.textContent,
        ariaLabel: el.getAttribute('aria-label'),
      };
    });
  }
}

test.describe('Array visualization — FSM states and transitions', () => {
  // Collect runtime page errors and console messages for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages and page errors. We will assert on these in tests.
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    const arrayPage = new ArrayPage(page);
    await arrayPage.goto();
  });

  // Basic Idle state validation
  test('Initial Idle state: button and array items are present and not highlighted', async ({ page }) => {
    const arrayPage = new ArrayPage(page);

    // Validate the button exists and has correct initial text and aria-pressed
    await expect(arrayPage.button).toBeVisible();
    const btnText = await arrayPage.getButtonText();
    expect(btnText?.trim()).toBe('Highlight middle element');

    const ariaPressed = await arrayPage.getButtonAriaPressed();
    expect(ariaPressed).toBe('false');

    // Validate accessibility attributes on button
    const ariaLabel = await arrayPage.button.getAttribute('aria-label');
    expect(ariaLabel).toBe('Highlight middle element in array');

    // Validate array container and items
    await expect(arrayPage.arrayContainer).toHaveAttribute('role', 'list');
    const count = await arrayPage.getArrayItemCount();
    expect(count).toBe(7); // FSM and HTML define 7 items (indices 0..6)

    // The mid index should be floor(7/2) = 3; check the mid item is the expected value and has no inline highlight styles
    const midStyles = await arrayPage.getMidItemInlineStyles();
    expect(midStyles.dataIndex).toBe('3');
    expect(midStyles.textContent?.trim()).toBe('23');

    // Inline styles should be empty prior to clicking (styles come from stylesheet, not inline)
    expect(midStyles.background).toBe('');
    expect(midStyles.boxShadow).toBe('');
    expect(midStyles.color).toBe('');

    // Ensure other items are not modified inline either (spot-check index 0 and index 6)
    const firstStyles = await arrayPage.getItemInlineStylesByIndex(0);
    expect(firstStyles.background).toBe('');
    const lastStyles = await arrayPage.getItemInlineStylesByIndex(6);
    expect(lastStyles.background).toBe('');
  });

  // Transition S0_Idle -> S1_Highlighted
  test('Clicking highlight toggles to Highlighted state with expected DOM changes', async ({ page }) => {
    const arrayPage = new ArrayPage(page);

    // Click the toggle button once to highlight the middle element
    await arrayPage.clickToggle();

    // After click: button text should change and aria-pressed true
    const btnTextAfter = await arrayPage.getButtonText();
    expect(btnTextAfter?.trim()).toBe('Remove highlight');

    const ariaPressedAfter = await arrayPage.getButtonAriaPressed();
    expect(ariaPressedAfter).toBe('true');

    // Mid item inline styles should reflect the highlighted styles as set by the script
    const midStyles = await arrayPage.getMidItemInlineStyles();

    // The script sets inline background to a red gradient and explicit boxShadow and color
    expect(midStyles.background).toBe('linear-gradient(145deg, #ff6f61 0%, #ff3d3d 100%)');
    expect(midStyles.boxShadow).toBe('0 8px 25px #ff3d3dcc, 0 0 25px #ff6f6188');
    expect(midStyles.color).toBe('#fff0f0');

    // Other items should remain without inline highlight styles (spot-check index 2)
    const item2 = await arrayPage.getItemInlineStylesByIndex(2);
    expect(item2.background).toBe('');
  });

  // Transition S1_Highlighted -> S0_Idle
  test('Clicking highlight again toggles back to Idle state and restores styles', async ({ page }) => {
    const arrayPage = new ArrayPage(page);

    // Click twice: highlight then remove highlight
    await arrayPage.clickToggle();
    // Wait a tick for DOM updates
    await page.waitForTimeout(50);
    await arrayPage.clickToggle();

    // After second click: button text should revert and aria-pressed false
    const btnText = await arrayPage.getButtonText();
    expect(btnText?.trim()).toBe('Highlight middle element');

    const ariaPressed = await arrayPage.getButtonAriaPressed();
    expect(ariaPressed).toBe('false');

    // Mid item inline styles should be restored to the script's blue gradient and original boxShadow/color
    const midStyles = await arrayPage.getMidItemInlineStyles();
    expect(midStyles.background).toBe('linear-gradient(145deg, #2f99ff 0%, #0077ff 100%)');
    expect(midStyles.boxShadow).toBe('0 4px 12px rgba(0,120,255,0.6), 0 0 8px #0077ff');
    expect(midStyles.color).toBe('#e3f2fd');
  });

  // Edge case: repeated rapid toggles should alternate states predictably
  test('Rapid repeated toggles alternate between Idle and Highlighted states predictably', async ({ page }) => {
    const arrayPage = new ArrayPage(page);

    const expectedRedBackground = 'linear-gradient(145deg, #ff6f61 0%, #ff3d3d 100%)';
    const expectedBlueBackground = 'linear-gradient(145deg, #2f99ff 0%, #0077ff 100%)';

    // Perform 5 rapid clicks and after each click assert parity-based expectation
    for (let i = 1; i <= 5; i++) {
      await arrayPage.clickToggle();
      // short wait to let the click handler update the DOM
      await page.waitForTimeout(20);
      const midStyles = await arrayPage.getMidItemInlineStyles();
      const ariaPressed = await arrayPage.getButtonAriaPressed();
      const currentBtnText = (await arrayPage.getButtonText())?.trim();

      if (i % 2 === 1) {
        // odd clicks -> highlighted
        expect(ariaPressed).toBe('true');
        expect(currentBtnText).toBe('Remove highlight');
        expect(midStyles.background).toBe(expectedRedBackground);
      } else {
        // even clicks -> idle
        expect(ariaPressed).toBe('false');
        expect(currentBtnText).toBe('Highlight middle element');
        expect(midStyles.background).toBe(expectedBlueBackground);
      }
    }
  });

  // Observability: ensure there are no unexpected runtime errors or console.error messages during normal operation
  test('No unexpected runtime errors or console.error messages should be emitted during load and interactions', async ({ page }) => {
    const arrayPage = new ArrayPage(page);

    // Perform a few interactions to exercise the script
    await arrayPage.clickToggle();
    await page.waitForTimeout(10);
    await arrayPage.clickToggle();
    await page.waitForTimeout(10);

    // Gather the console and page error snapshots captured in beforeEach listeners
    // Note: consoleMessages and pageErrors are populated by the listeners registered earlier.
    // Assert there are no page errors (uncaught exceptions)
    expect(pageErrors.length).toBe(0);

    // Assert there are no console messages with type 'error'
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Additionally assert there are no JS engine exceptions of common types in the pageErrors array
    const hasCriticalError = pageErrors.some((err) => {
      const msg = String(err && err.message ? err.message : err);
      return msg.includes('ReferenceError') || msg.includes('SyntaxError') || msg.includes('TypeError');
    });
    expect(hasCriticalError).toBe(false);
  });

  // Accessibility and attributes: roles and aria-labels should match FSM components
  test('Accessibility attributes and item labels match the FSM component definitions', async ({ page }) => {
    const arrayPage = new ArrayPage(page);

    // Verify the container role and label
    await expect(arrayPage.arrayContainer).toHaveAttribute('role', 'list');
    await expect(arrayPage.arrayContainer).toHaveAttribute('aria-label', 'Array of numbers');

    // Verify each array item has role listitem and correct aria-label contents
    const count = await arrayPage.getArrayItemCount();
    for (let i = 0; i < count; i++) {
      const locator = page.locator(`.array-item[data-index="${i}"]`);
      await expect(locator).toHaveAttribute('role', 'listitem');
      const ariaLabel = await locator.getAttribute('aria-label');
      expect(ariaLabel).toBe(`Index ${i}, value ${await locator.textContent()}`);
    }
  });
});