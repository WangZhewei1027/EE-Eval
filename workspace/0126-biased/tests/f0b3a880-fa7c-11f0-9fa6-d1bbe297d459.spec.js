import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3a880-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page Object for the Page Fault Demo section of the application.
 * Encapsulates common actions and queries so tests remain readable.
 */
class PageFaultDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = "button[onclick='showPageFaultDemo()']";
    this.demoSelector = '#pageFaultDemo';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getButton() {
    return this.page.locator(this.buttonSelector);
  }

  async clickToggle() {
    await this.page.click(this.buttonSelector);
  }

  async isDemoVisible() {
    // Playwright's isVisible checks computed visibility; we also check computed style for stricter assertion
    return await this.page.isVisible(this.demoSelector);
  }

  async getDemoDisplayStyle() {
    return await this.page.$eval(this.demoSelector, (el) => window.getComputedStyle(el).display);
  }

  async getButtonOnclickAttr() {
    return await this.page.$eval(this.buttonSelector, el => el.getAttribute('onclick'));
  }

  async demoContainsText(substring) {
    const text = await this.page.$eval(this.demoSelector, el => el.innerText);
    return text.includes(substring);
  }

  async callShowPageFaultDemoDirectly() {
    // Call the function that should be present on window
    return this.page.evaluate(() => {
      // If function is not defined this will throw in the page context and be captured as a pageerror.
      return window.showPageFaultDemo();
    });
  }

  async typeofGlobal(name) {
    return this.page.evaluate((n) => typeof window[n], name);
  }
}

test.describe('Virtual Memory Explained - Page Fault Demo (FSM verification)', () => {
  // Collect runtime errors and console.error messages observed during each test.
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Listen for uncaught exceptions in the page
    page.on('pageerror', (err) => {
      // stringify to preserve detail
      pageErrors.push(String(err));
    });

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // At teardown we assert that no unexpected runtime errors occurred.
    // The application code as provided is expected to be well-formed; if there are runtime
    // errors (ReferenceError, TypeError, etc.) they will be surfaced here and cause tests to fail.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('Initial state (S0_Idle): button present, demo hidden, entry-action renderPage not implemented', async ({ page }) => {
    // This test validates the Idle state:
    // - The toggle button exists and has the expected onclick attribute
    // - The #pageFaultDemo element exists and is initially hidden (CSS sets display: none)
    // - The FSM's listed entry_action 'renderPage' is not present on window (we assert undefined)
    const p = new PageFaultDemoPage(page);
    await p.goto();

    // Button exists and has expected label and onclick attribute
    const btn = p.getButton();
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveText('Show Page Fault Process');

    const onclickAttr = await p.getButtonOnclickAttr();
    expect(onclickAttr).toBe('showPageFaultDemo()');

    // Demo exists
    const demoHandle = await page.$('#pageFaultDemo');
    expect(demoHandle, 'Expected #pageFaultDemo to be present in the DOM').not.toBeNull();

    // Initially hidden via CSS: display should be 'none'
    const initialDisplay = await p.getDemoDisplayStyle();
    expect(initialDisplay).toBe('none');

    // The page defines showPageFaultDemo; verify it exists and is a function
    const typeofShow = await p.typeofGlobal('showPageFaultDemo');
    expect(typeofShow).toBe('function');

    // FSM's S0 entry_action mentions renderPage(); this implementation does not define renderPage.
    // We assert that renderPage is not defined (i.e., typeof is 'undefined') to surface mismatch between FSM and implementation.
    const typeofRenderPage = await p.typeofGlobal('renderPage');
    expect(typeofRenderPage).toBe('undefined');
  });

  test('Transition S0 -> S1: clicking the button shows the demo (demo.style.display -> block)', async ({ page }) => {
    // This tests the transition from Idle to PageFaultDemoVisible by clicking the button once.
    const p = new PageFaultDemoPage(page);
    await p.goto();

    // Sanity: ensure initially hidden
    expect(await p.getDemoDisplayStyle()).toBe('none');

    // Click the button to trigger showPageFaultDemo()
    await p.clickToggle();

    // After click, demo should be visible (display: block)
    const displayAfter = await p.getDemoDisplayStyle();
    expect(displayAfter).toBe('block');

    // Playwright's isVisible should agree
    expect(await p.isDemoVisible()).toBe(true);

    // Verify the demo contains expected content indicating 'Page Fault Handling Sequence'
    const containsHeading = await p.demoContainsText('Page Fault Handling Sequence');
    expect(containsHeading).toBe(true);

    // Check a couple of expected sequence lines are present
    expect(await p.demoContainsText('CPU accesses virtual address in page 5')).toBe(true);
    expect(await p.demoContainsText('OS updates page tables')).toBe(true);
  });

  test('Transition S1 -> S2: clicking the button when visible hides the demo (demo.style.display -> none)', async ({ page }) => {
    // This test validates toggling off the demo when currently visible.
    const p = new PageFaultDemoPage(page);
    await p.goto();

    // Make demo visible first
    await p.clickToggle();
    expect(await p.getDemoDisplayStyle()).toBe('block');

    // Click again to hide
    await p.clickToggle();

    // After second click, demo should be hidden
    const displayAfterHide = await p.getDemoDisplayStyle();
    expect(displayAfterHide).toBe('none');
    expect(await p.isDemoVisible()).toBe(false);
  });

  test('Transition S2 -> S1: clicking button again when hidden shows the demo (toggle back)', async ({ page }) => {
    // Start from fresh page (hidden), click twice to get to hidden (simulate S1->S2), then click to show (S2->S1)
    const p = new PageFaultDemoPage(page);
    await p.goto();

    // 1st click -> visible
    await p.clickToggle();
    expect(await p.getDemoDisplayStyle()).toBe('block');

    // 2nd click -> hidden
    await p.clickToggle();
    expect(await p.getDemoDisplayStyle()).toBe('none');

    // 3rd click -> visible again
    await p.clickToggle();
    expect(await p.getDemoDisplayStyle()).toBe('block');
    expect(await p.isDemoVisible()).toBe(true);
  });

  test('Edge case: rapid toggling remains consistent (odd -> visible, even -> hidden)', async ({ page }) => {
    // This test rapidly clicks the toggle button multiple times and checks the final state matches parity of clicks.
    const p = new PageFaultDemoPage(page);
    await p.goto();

    const clicks = 5; // odd number should leave demo visible
    for (let i = 0; i < clicks; i++) {
      await p.clickToggle();
    }

    const finalDisplay = await p.getDemoDisplayStyle();
    if (clicks % 2 === 1) {
      expect(finalDisplay).toBe('block');
      expect(await p.isDemoVisible()).toBe(true);
    } else {
      expect(finalDisplay).toBe('none');
      expect(await p.isDemoVisible()).toBe(false);
    }

    // Now do one more click to flip state and verify
    await p.clickToggle();
    const flippedDisplay = await p.getDemoDisplayStyle();
    if (clicks % 2 === 1) {
      // previously visible -> now hidden
      expect(flippedDisplay).toBe('none');
      expect(await p.isDemoVisible()).toBe(false);
    } else {
      expect(flippedDisplay).toBe('block');
      expect(await p.isDemoVisible()).toBe(true);
    }
  });

  test('Direct invocation of showPageFaultDemo() toggles visibility (function exists and callable)', async ({ page }) => {
    // This test invokes the global function directly (no user click), which should be equivalent to clicking.
    const p = new PageFaultDemoPage(page);
    await p.goto();

    // Ensure initial state hidden
    expect(await p.getDemoDisplayStyle()).toBe('none');

    // Call the function directly in page context
    await p.callShowPageFaultDemoDirectly();

    // Now visible
    expect(await p.getDemoDisplayStyle()).toBe('block');

    // Call again directly to hide
    await p.callShowPageFaultDemoDirectly();
    expect(await p.getDemoDisplayStyle()).toBe('none');
  });

  test('Implementation vs FSM: validate documented evidence elements exist', async ({ page }) => {
    // This test ensures that the components the FSM expects are present in the DOM:
    // - The button with onclick handler
    // - The #pageFaultDemo div with class 'demo'
    const p = new PageFaultDemoPage(page);
    await p.goto();

    // Button exists
    const btn = page.locator(p.buttonSelector);
    await expect(btn).toHaveCount(1);

    // #pageFaultDemo exists and has class 'demo'
    const demo = page.locator(p.demoSelector);
    await expect(demo).toHaveCount(1);
    const className = await demo.getAttribute('class');
    expect(className).toContain('demo');

    // Confirm that the textual evidence (heading text) is present
    const headingText = await demo.locator('h3').innerText();
    expect(headingText).toContain('Page Fault Handling Sequence');
  });

  test('No unexpected global mutations: ensure only expected globals (showPageFaultDemo) exist and renderPage is absent', async ({ page }) => {
    // As part of testing onEnter actions listed in FSM, we assert which global functions exist.
    // We DO NOT inject or modify globals; we only read their types.
    const p = new PageFaultDemoPage(page);
    await p.goto();

    const showType = await p.typeofGlobal('showPageFaultDemo');
    expect(showType).toBe('function');

    const renderType = await p.typeofGlobal('renderPage');
    // FSM mentions renderPage as entry action for S0, but the implementation does not define it.
    // We assert that it is indeed undefined so that the mismatch is explicitly documented by the test.
    expect(renderType).toBe('undefined');

    // Ensure no other obvious FSM functions are present (we check a couple of plausible names to ensure implementation hasn't added unexpected functions)
    const suspiciousNames = ['enterS1', 'enterS2', 'hideDemo', 'toggleDemo'];
    for (const name of suspiciousNames) {
      const t = await p.typeofGlobal(name);
      expect(t).toBe('undefined');
    }
  });
});