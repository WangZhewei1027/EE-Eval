import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf93b3-fa79-11f0-8075-e54a10595dde.html';

// Page object encapsulating interactions with the demo
class SpaceDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sizeInput = page.locator('#sizeInput');
    this.capacityInput = page.locator('#capacityInput');
    this.increaseBtn = page.locator('button[onclick="increaseSpace()"]');
    this.decreaseBtn = page.locator('button[onclick="decreaseSpace()"]');
    this.resetBtn = page.locator('button[onclick="resetSpace()"]');
    this.toggleDetailsBtn = page.locator('button[onclick="toggleDetails()"]');
    this.calculateBtn = page.locator('button[onclick="calculateCapacity()"]');
    this.output = page.locator('#output');
    this.details = page.locator('#details');
    this.capacityOutput = page.locator('#capacityOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure content is loaded
    await expect(this.page.locator('h1')).toHaveText(/Space Complexity Interactive Demo/);
  }

  async setSize(value) {
    // Use fill to write numbers or empty string
    await this.sizeInput.fill(String(value));
  }

  async setCapacity(value) {
    await this.capacityInput.fill(String(value));
  }

  async clickIncrease() {
    await this.increaseBtn.click();
  }

  async clickDecrease() {
    await this.decreaseBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async clickToggleDetails() {
    await this.toggleDetailsBtn.click();
  }

  async clickCalculate() {
    await this.calculateBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()).trim();
  }

  async getCapacityOutputText() {
    const txt = await this.capacityOutput.textContent();
    return txt ? txt.trim() : '';
  }

  async isDetailsDisplayed() {
    // Evaluate style.display directly so we match implementation detail
    return this.page.evaluate(() => {
      const d = document.getElementById('details');
      return d ? d.style.display : null;
    });
  }

  async getSizeInputValue() {
    return this.sizeInput.inputValue();
  }

  async getCapacityInputValue() {
    return this.capacityInput.inputValue();
  }
}

test.describe('Space Complexity Interactive Demo (FSM-driven tests)', () => {
  // Collect console messages and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // nothing required here, individual tests will set up listeners
  });

  // Validate initial idle state (S0_Idle) and rendering
  test('Initial render - S0_Idle: page shows default controls and output', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new SpaceDemoPage(page);
    await demo.goto();

    // Validate components exist and initial texts match FSM evidence
    await expect(page.locator('button[onclick="increaseSpace()"]')).toHaveCount(1);
    await expect(page.locator('button[onclick="decreaseSpace()"]')).toHaveCount(1);
    await expect(page.locator('button[onclick="resetSpace()"]')).toHaveCount(1);
    await expect(page.locator('button[onclick="toggleDetails()"]')).toHaveCount(1);
    // Output initial text
    await expect(demo.output).toHaveText('Current Space Usage: 0');
    // size input default value per HTML is "0"
    expect(await demo.getSizeInputValue()).toBe('0');
    // details should be hidden initially (style display none)
    const detailsDisplay = await demo.isDetailsDisplayed();
    expect(detailsDisplay === 'none' || detailsDisplay === '').toBeTruthy();
    // capacityOutput should be empty
    expect(await demo.getCapacityOutputText()).toBe('');

    // Ensure there were no uncaught page errors during load
    expect(pageErrors.length).toBe(0);
    // No severe console errors
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test.describe('Space usage transitions (Increase, Decrease, Reset)', () => {
    test('Increase Space -> S1_SpaceIncreased: increasing changes Current Space Usage', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const demo = new SpaceDemoPage(page);
      await demo.goto();

      // Increase by 5
      await demo.setSize(5);
      await demo.clickIncrease();
      await expect(demo.output).toHaveText('Current Space Usage: 5');

      // Increase by 3 -> should be 8
      await demo.setSize(3);
      await demo.clickIncrease();
      await expect(demo.output).toHaveText('Current Space Usage: 8');

      // Confirm no page errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Decrease Space -> S2_SpaceDecreased: decreasing reduces usage and floor at zero', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const demo = new SpaceDemoPage(page);
      await demo.goto();

      // Set to 10 via increasing
      await demo.setSize(10);
      await demo.clickIncrease();
      await expect(demo.output).toHaveText('Current Space Usage: 10');

      // Decrease by 4 -> 6
      await demo.setSize(4);
      await demo.clickDecrease();
      await expect(demo.output).toHaveText('Current Space Usage: 6');

      // Decrease by 10 -> should floor at 0
      await demo.setSize(10);
      await demo.clickDecrease();
      await expect(demo.output).toHaveText('Current Space Usage: 0');

      expect(pageErrors.length).toBe(0);
    });

    test('Reset Space -> S3_SpaceReset: reset sets usage to 0 and clears size input', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const demo = new SpaceDemoPage(page);
      await demo.goto();

      // Increase to non-zero
      await demo.setSize(7);
      await demo.clickIncrease();
      await expect(demo.output).toHaveText('Current Space Usage: 7');

      // Reset should set usage to 0 and clear size input (per implementation)
      await demo.clickReset();
      await expect(demo.output).toHaveText('Current Space Usage: 0');
      // After reset implementation sets sizeInput.value = "", ensure that happened
      expect(await demo.getSizeInputValue()).toBe('');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Details toggle and capacity calculation (S4 <-> S5)', () => {
    test('ToggleDetails shows and hides details (S4_DetailsVisible -> S0_Idle)', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const demo = new SpaceDemoPage(page);
      await demo.goto();

      // Initially hidden
      let display = await demo.isDetailsDisplayed();
      expect(display === 'none' || display === '').toBeTruthy();

      // Toggle -> should show (implementation sets to block)
      await demo.clickToggleDetails();
      display = await demo.isDetailsDisplayed();
      expect(display).toBe('block');

      // Toggle again -> should hide (implementation toggles to none)
      await demo.clickToggleDetails();
      display = await demo.isDetailsDisplayed();
      // Could be '' or 'none' depending on initial style; expect none after toggling back
      expect(display === 'none' || display === '').toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });

    test('CalculateCapacity -> S5_CapacityCalculated: computes percentage used and displays with two decimals', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const demo = new SpaceDemoPage(page);
      await demo.goto();

      // Ensure some spaceUsage value exists by increasing
      await demo.setSize(10);
      await demo.clickIncrease();
      await expect(demo.output).toHaveText('Current Space Usage: 10');

      // Show details
      await demo.clickToggleDetails();
      let display = await demo.isDetailsDisplayed();
      expect(display).toBe('block');

      // Enter capacity 40 -> used percent = 25.00%
      await demo.setCapacity(40);
      await demo.clickCalculate();
      await expect(demo.capacityOutput).toHaveText('Used capacity: 25.00%');

      // Change space usage to 7 -> percent = 17.50%
      await demo.setSize(7);
      await demo.clickIncrease(); // now 17
      await demo.setCapacity(100);
      await demo.clickCalculate();
      await expect(demo.capacityOutput).toHaveText('Used capacity: 17.00%');

      // Hide details at end to return to idle-like state
      await demo.clickToggleDetails();
      display = await demo.isDetailsDisplayed();
      expect(display === 'none' || display === '').toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Invalid size input triggers alert on increase and decrease', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const demo = new SpaceDemoPage(page);
      await demo.goto();

      // Provide invalid size (0) which should cause alert: "Please enter a valid size."
      await demo.setSize(0);

      // Capture dialog for increase
      const [increaseDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        demo.clickIncrease()
      ]);
      expect(increaseDialog.message()).toBe('Please enter a valid size.');
      await increaseDialog.dismiss();

      // Capture dialog for decrease
      const [decreaseDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        demo.clickDecrease()
      ]);
      expect(decreaseDialog.message()).toBe('Please enter a valid size.');
      await decreaseDialog.dismiss();

      expect(pageErrors.length).toBe(0);
    });

    test('Invalid capacity input triggers alert on calculateCapacity', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const demo = new SpaceDemoPage(page);
      await demo.goto();

      // Ensure details visible
      await demo.clickToggleDetails();
      const display = await demo.isDetailsDisplayed();
      expect(display).toBe('block');

      // Set invalid capacity value (0) -> should alert
      await demo.setCapacity(0);

      const [dlg] = await Promise.all([
        page.waitForEvent('dialog'),
        demo.clickCalculate()
      ]);
      expect(dlg.message()).toBe('Please enter a valid capacity.');
      await dlg.dismiss();

      expect(pageErrors.length).toBe(0);
    });
  });

  test('No uncaught ReferenceError, SyntaxError, or TypeError during user interactions', async ({ page }) => {
    // This test will perform a series of interactions and assert that no page errors of the given types were emitted.
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new SpaceDemoPage(page);
    await demo.goto();

    // Perform typical interactions
    await demo.setSize(2);
    await demo.clickIncrease();
    await demo.setSize(1);
    await demo.clickDecrease();
    await demo.clickToggleDetails();
    await demo.setCapacity(10);
    await demo.clickCalculate();
    await demo.clickToggleDetails();
    await demo.clickReset();

    // Ensure none of the collected page errors are the specified types
    const offending = pageErrors.filter(err => {
      const name = err && err.name;
      return name === 'ReferenceError' || name === 'TypeError' || name === 'SyntaxError';
    });

    // Assert that no critical JS errors occurred during the interactions
    expect(offending.length).toBe(0);
  });
});