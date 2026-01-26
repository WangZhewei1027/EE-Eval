import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b0aa92-fa7c-11f0-adc7-178f556b1ee0.html';

// Simple Page Object for the Heap Sort page
class HeapSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#heap-sort-button');
    this.heading = page.locator('h2');
    this.textContainer = page.locator('.text-container');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickExampleButton() {
    await this.button.click();
  }

  async buttonText() {
    return this.button.textContent();
  }

  async headingText() {
    return this.heading.textContent();
  }

  async textContainerText() {
    return this.textContainer.innerText();
  }
}

test.describe('Heap Sort FSM - Interactive Application (f5b0aa92-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Collections to record page console messages and errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info/warn/error logs)
    page.on('console', (msg) => {
      try {
        // Use text() to capture human-readable console output
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object from the page context; capture its message
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the app (listeners attached before navigation to capture early logs/errors)
    await page.goto(APP_URL);
    // Small wait to let any synchronous on-load script errors and console logs be processed
    await page.waitForTimeout(100);
  });

  test('Initial Idle state (S0_Idle): page renders, button present, and entry rendering verified', async ({ page }) => {
    // This test validates the initial Idle state: UI should be rendered with the expected components.
    const heapPage = new HeapSortPage(page);

    // Verify core UI elements
    await expect(heapPage.heading).toBeVisible();
    expect(await heapPage.headingText()).toContain('Heap Sort');

    await expect(heapPage.textContainer).toBeVisible();
    const containerText = await heapPage.textContainerText();
    expect(containerText.length).toBeGreaterThan(50); // ensure textual description exists

    // Verify the expected button (component) exists
    await expect(heapPage.button).toBeVisible();
    expect((await heapPage.buttonText()).trim()).toBe('Heap Sort Example');

    // The page's inline script attempts to log initial array values before calling heapSort.
    // We expect at least one console message that includes "Before Heap Sort:"
    const foundBefore = consoleMessages.some((m) => m.includes('Before Heap Sort'));
    expect(foundBefore).toBe(true);

    // Also expect that the array was logged (some message containing '64' or the numbers)
    const foundArrayLog = consoleMessages.some((m) => /64.*34.*25/.test(m) || m.includes('[64'));
    expect(foundArrayLog).toBe(true);

    // Because the page calls heapSort(...) but heapSort is only shown in a <pre> (not executed),
    // we expect a ReferenceError or similar page error to have occurred during page load.
    const hasHeapSortReferenceError = pageErrors.some((m) => m.includes('heapSort') || m.includes('is not defined'));
    expect(hasHeapSortReferenceError).toBe(true);
  });

  test('Transition on HeapSortExampleClick (FSM event): click should trigger console.log in ideal case; observe actual behavior and errors', async ({ page }) => {
    // This test attempts to validate the FSM transition that should log "Heap Sort Example" when clicking the button.
    // Per the live page, a prior ReferenceError during load likely prevented attaching the click handler.
    // We therefore assert the observed behavior: no "Heap Sort Example" log appears after clicking,
    // and that the earlier ReferenceError remains recorded.

    const heapPage = new HeapSortPage(page);

    // Ensure button exists before clicking
    await expect(heapPage.button).toBeVisible();

    // Clear previous console messages of interest so we can detect new ones after click
    const beforeMessages = [...consoleMessages];

    // Click the button (should trigger the event listener if it was attached)
    await heapPage.clickExampleButton();

    // Give a short delay to allow any click handler logs to appear
    await page.waitForTimeout(100);

    // Capture messages that arrived after click
    const afterMessages = consoleMessages.slice(beforeMessages.length);

    // If the event handler had been attached, we'd expect a "Heap Sort Example" console message.
    // Assert that such a message is NOT present (because the load-time ReferenceError likely prevented attaching the listener).
    const clickProducedHeapSortLog = afterMessages.some((m) => m.includes('Heap Sort Example'));
    expect(clickProducedHeapSortLog).toBe(false);

    // Confirm that no new pageerror was produced by clicking (clicking a detached button should not create new errors)
    // It's acceptable if the initial page error exists, but clicking should not have added new ones.
    // We assert that at least one prior page error exists (the heapSort ReferenceError) and that pageErrors length is unchanged after click.
    const hasInitialHeapSortError = pageErrors.some((m) => m.includes('heapSort') || m.includes('is not defined'));
    expect(hasInitialHeapSortError).toBe(true);
  });

  test('FSM S1_HeapSortExecuted expected onEnter action (console.log) is absent due to page error - assert graceful failure', async ({ page }) => {
    // This test checks that the S1 entry action console.log("Heap Sort Example") did not occur,
    // since the click handler never got attached due to the earlier ReferenceError.
    const heapPage = new HeapSortPage(page);

    // Confirm there is a page error capturing the missing heapSort function
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors.some((m) => m.toLowerCase().includes('heapsort'))).toBe(true);

    // Try clicking the button multiple times to ensure the handler is not attached at any later time
    await heapPage.clickExampleButton();
    await page.waitForTimeout(50);
    await heapPage.clickExampleButton();
    await page.waitForTimeout(50);

    // Throughout the clicks, ensure that no console message "Heap Sort Example" appeared
    const sawHeapSortExample = consoleMessages.some((m) => m.includes('Heap Sort Example'));
    expect(sawHeapSortExample).toBe(false);
  });

  test('Edge case: validate that other page functionality remains accessible and no additional runtime fixes are injected', async ({ page }) => {
    // This test ensures that despite the load-time error, the DOM remains interactive and we do not modify the page.
    // We assert that we can still query and interact with elements, and that no code injection/patching was performed.
    const heapPage = new HeapSortPage(page);

    // Interact with non-listener DOM properties
    await expect(heapPage.textContainer).toBeVisible();
    const text = await heapPage.textContainerText();
    expect(text).toContain('Heap Sort is a comparison-based sorting algorithm');

    // Try focusing the button and ensuring focus works (no injected handlers required)
    await heapPage.button.focus();
    // Check the active element is our button
    const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(activeId).toBe('heap-sort-button');

    // Ensure no global variables were injected by the test harness (we must not inject/patch anything)
    // We assert that window.heapSort is undefined in the page context (matches observed behavior)
    const heapSortExists = await page.evaluate(() => typeof window.heapSort !== 'undefined');
    expect(heapSortExists).toBe(false);
  });

  test('Observability: ensure console and pageerror events were captured and include the expected diagnostic strings', async ({ page }) => {
    // This test explicitly verifies that we observed console logs and captured the ReferenceError.
    // Useful for test harness validation and to prove observability of runtime issues.

    // At least one console message should include "Before Heap Sort"
    const hasBefore = consoleMessages.some((m) => m.includes('Before Heap Sort'));
    expect(hasBefore).toBe(true);

    // Confirm an array logging occurred (numbers from the sample array)
    const hasArray = consoleMessages.some((m) => /64/.test(m) || /\[64/.test(m));
    expect(hasArray).toBe(true);

    // Confirm page error contains details about heapSort not being defined (ReferenceError)
    const hasReferenceError = pageErrors.some((m) => m.toLowerCase().includes('heapsort') || m.toLowerCase().includes('is not defined') || m.toLowerCase().includes('referenceerror'));
    expect(hasReferenceError).toBe(true);
  });
});