import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b32303-fa74-11f0-bb9a-db7e6ecdeeaa.html';

/**
 * Page object helpers for the OSI Model demo page.
 * Encapsulates common selectors and actions used across tests.
 */
class OsiPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.osiModel = page.locator('#osi-model');
    this.layers = page.locator('#osi-model .layer');
    this.layerDetails = page.locator('#layer-details');
    this.layerTitle = page.locator('#layer-title');
    this.layerFunc = page.locator('#layer-func');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the container to be present and layers to be rendered
    await this.osiModel.waitFor({ state: 'attached' });
    await this.page.waitForSelector('#osi-model .layer');
  }

  locatorForLayerNumber(number) {
    return this.page.locator(`#osi-model .layer[data-number="${number}"]`);
  }

  async clickLayer(number) {
    const loc = this.locatorForLayerNumber(number);
    await loc.scrollIntoViewIfNeeded();
    await loc.click();
  }

  async pressOnLayer(number, key) {
    const loc = this.locatorForLayerNumber(number);
    await loc.focus();
    // Use locator.press to trigger keyboard handlers on the element itself
    await loc.press(key);
  }

  async getCurrentSelectedFromPage() {
    // currentSelected is a global variable in the page script; evaluate it directly.
    return await this.page.evaluate(() => window.currentSelected ?? null);
  }

  async getSelectedLayerElement() {
    return this.page.locator('#osi-model .layer.selected');
  }

  async getLayerCount() {
    return await this.layers.count();
  }

  async getLayerNumbersInDomOrder() {
    const count = await this.getLayerCount();
    const numbers = [];
    for (let i = 0; i < count; i++) {
      const n = await this.layers.nth(i).getAttribute('data-number');
      numbers.push(n);
    }
    return numbers;
  }
}

/**
 * Capture console 'error' messages and page uncaught exceptions for assertions.
 * Each test will have its own arrays to avoid cross-test pollution.
 */
test.describe('OSI Model Interactive Demo - FSM and Accessibility Tests', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages emitted by the page
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore instrumentation errors
      }
    });

    // Capture uncaught exceptions (pageerror)
    page.on('pageerror', err => {
      pageErrors.push(err.message ?? String(err));
    });
  });

  test.afterEach(async ({ page }) => {
    // For observability we assert that there were no uncaught runtime errors
    // This verifies the app loaded without ReferenceError/SyntaxError/TypeError at runtime.
    // If the application intentionally throws, these assertions should be updated.
    expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `Unexpected console.error messages: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    // make sure page closed cleanly (best-effort)
    await page.close();
  });

  test('Initial Idle state: page renders layers and details placeholder (S0_Idle)', async ({ page }) => {
    // This test validates the S0 Idle state and the "renderPage()" entry action equivalent:
    // - The #osi-model container exists and has seven .layer items
    // - The initial #layer-details shows the placeholder heading/text
    const osi = new OsiPage(page);
    await osi.goto();

    // Verify container exists and has role=list and proper aria-label
    const container = page.locator('#osi-model');
    await expect(container).toHaveAttribute('role', 'list');
    await expect(container).toHaveAttribute('aria-label', 'OSI Model Layers');

    // There should be 7 layers rendered
    expect(await osi.getLayerCount()).toBe(7);

    // Verify each layer has role=listitem and tabindex="0"
    const firstLayer = page.locator('#osi-model .layer').first();
    await expect(firstLayer).toHaveAttribute('role', 'listitem');
    await expect(firstLayer).toHaveAttribute('tabindex', '0');

    // Verify DOM order is descending 7..1 (sorted in script)
    const numbers = await osi.getLayerNumbersInDomOrder();
    expect(numbers[0]).toBe('7');
    expect(numbers[numbers.length - 1]).toBe('1');

    // Verify the details section initial content (S0 evidence)
    await expect(page.locator('#layer-details h2#layer-title')).toHaveText('Select a layer to see details');
    await expect(page.locator('#layer-details #layer-func')).toHaveText(
      'Click one of the OSI layers above to view its function, key protocols, and examples.'
    );
  });

  test('Click transition: clicking a layer selects it and updates details (S0 -> S1 via LayerClick)', async ({ page }) => {
    // This test validates the LayerClick event leading to S1_LayerSelected:
    // - Clicking a layer applies .selected class
    // - layerDetails content (title and function) updates to the chosen layer
    // - currentSelected global variable reflects selection
    const osi = new OsiPage(page);
    await osi.goto();

    // Select Transport Layer (number 4)
    await osi.clickLayer(4);

    // The element with .selected should be the one with data-number="4"
    const selected = osi.getSelectedLayerElement();
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAttribute('data-number', '4');

    // Verify global state currentSelected is updated to 4
    const currentSelected = await osi.getCurrentSelectedFromPage();
    expect(currentSelected).toBe(4);

    // Verify the #layer-details updated its innerHTML with Layer 4 content
    await expect(page.locator('#layer-details h2#layer-title')).toHaveText('Layer 4: Transport Layer');
    await expect(page.locator('#layer-details #layer-func')).toContainText('Provides reliable data transmission');

    // Verify that the details region receives focus after selection (layerDetails.focus())
    await expect(osi.layerDetails).toBeFocused();
  });

  test('Clicking different layers updates details and moves selection (S1 -> S1 via LayerClick with guard)', async ({ page }) => {
    // Validate transitions when changing selection:
    // - Selecting layer 5 then layer 3 moves the selected class and updates details
    const osi = new OsiPage(page);
    await osi.goto();

    // Click layer 5
    await osi.clickLayer(5);
    await expect(osi.getSelectedLayerElement()).toHaveAttribute('data-number', '5');
    await expect(page.locator('#layer-details h2#layer-title')).toHaveText('Layer 5: Session Layer');

    // Click layer 3
    await osi.clickLayer(3);
    await expect(osi.getSelectedLayerElement()).toHaveAttribute('data-number', '3');
    await expect(page.locator('#layer-details h2#layer-title')).toHaveText('Layer 3: Network Layer');

    // Ensure the previous one (5) no longer has selected class
    const prev = page.locator('#osi-model .layer[data-number="5"]');
    await expect(prev).not.toHaveClass(/selected/);
  });

  test('Guard behavior: clicking already-selected layer does not change state (S1 on same LayerClick guarded)', async ({ page }) => {
    // Validate the guard "currentSelected === number" prevents re-running selection logic:
    // - Clicking same layer twice should not change currentSelected or re-render content
    const osi = new OsiPage(page);
    await osi.goto();

    // Choose layer 2
    await osi.clickLayer(2);
    const initialHtml = await page.locator('#layer-details').innerHTML();
    const initialSelected = await osi.getCurrentSelectedFromPage();
    expect(initialSelected).toBe(2);

    // Click layer 2 again
    await osi.clickLayer(2);

    // After clicking the already-selected layer, the currentSelected should remain 2, and the details should be unchanged
    const afterHtml = await page.locator('#layer-details').innerHTML();
    const afterSelected = await osi.getCurrentSelectedFromPage();
    expect(afterSelected).toBe(2);
    expect(afterHtml).toBe(initialHtml);
  });

  test('Keyboard activation: Enter and Space trigger selection (LayerKeyDown event)', async ({ page }) => {
    // Validate keyboard accessibility:
    // - Pressing Enter or Space on a focused layer triggers selection and updates details
    const osi = new OsiPage(page);
    await osi.goto();

    // Focus layer 1 and press Enter
    await osi.locatorForLayerNumber(1).focus();
    await osi.pressOnLayer(1, 'Enter');
    await expect(osi.getSelectedLayerElement()).toHaveAttribute('data-number', '1');
    await expect(page.locator('#layer-details h2#layer-title')).toHaveText('Layer 1: Physical Layer');

    // Now focus layer 6 and press Space (represented as ' ' key)
    await osi.locatorForLayerNumber(6).focus();
    // Press Space using locator.press(' ');
    await osi.pressOnLayer(6, ' ');
    await expect(osi.getSelectedLayerElement()).toHaveAttribute('data-number', '6');
    await expect(page.locator('#layer-details h2#layer-title')).toHaveText('Layer 6: Presentation Layer');
  });

  test('Keyboard non-activation: pressing other keys does not trigger select', async ({ page }) => {
    // Ensure that pressing unrelated keys (e.g., 'a') on a layer does not select it.
    const osi = new OsiPage(page);
    await osi.goto();

    // Ensure starting state has no selection
    expect(await osi.getCurrentSelectedFromPage()).toBeNull();

    // Focus layer 7 and press 'a'
    await osi.locatorForLayerNumber(7).focus();
    await osi.pressOnLayer(7, 'a');

    // No selection should be made
    expect(await osi.getCurrentSelectedFromPage()).toBeNull();
    await expect(osi.getSelectedLayerElement()).toHaveCount(0);
  });

  test('Edge case: verify ARIA and accessibility attributes on details and layers', async ({ page }) => {
    // Validate that layer-details has aria-live and is accessible; layers have proper aria-labels
    const osi = new OsiPage(page);
    await osi.goto();

    await expect(page.locator('#layer-details')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#layer-details')).toHaveAttribute('aria-atomic', 'true');

    // Each layer should have an aria-label like "Layer N: Name"
    const count = await osi.getLayerCount();
    for (let i = 0; i < count; i++) {
      const layer = page.locator('#osi-model .layer').nth(i);
      const aria = await layer.getAttribute('aria-label');
      expect(aria).toMatch(/^Layer \d+: /);
    }
  });

  test('Observability: page should load without uncaught ReferenceError/SyntaxError/TypeError', async ({ page }) => {
    // This test explicitly loads the page and collects runtime exceptions.
    // The afterEach hook will assert there were no pageerrors/console.errors.
    // We still perform additional sanity checks for the FSM observable states.
    const osi = new OsiPage(page);
    await osi.goto();

    // Sanity: select a layer to ensure interactive handlers run without throwing.
    await osi.clickLayer(4);
    const cs = await osi.getCurrentSelectedFromPage();
    expect(cs).toBe(4);

    // Confirm details region reflects selection without throwing
    await expect(page.locator('#layer-details h2#layer-title')).toHaveText('Layer 4: Transport Layer');
  });
});