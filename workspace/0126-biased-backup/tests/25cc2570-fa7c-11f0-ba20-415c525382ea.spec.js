import { test, expect } from '@playwright/test';

// Test file: 25cc2570-fa7c-11f0-ba20-415c525382ea.spec.js
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/25cc2570-fa7c-11f0-ba20-415c525382ea.html

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cc2570-fa7c-11f0-ba20-415c525382ea.html';
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Attach listeners for console and pageerror to capture runtime diagnostics.
  attachDiagnosticsListeners() {
    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      this.consoleMessages.push({ type, text });
      if (type === 'error') this.consoleErrors.push(text);
    });
    this.page.on('pageerror', (err) => {
      // err is an Error object
      this.pageErrors.push(String(err));
    });
  }

  async goto() {
    await this.page.goto(this.url);
  }

  get translateButton() {
    return this.page.locator('#translateBtn');
  }

  get outputDiv() {
    return this.page.locator('#demoOutput');
  }

  // Click the translate button as a user would (await ensures stable action)
  async clickTranslate() {
    await this.translateButton.click();
  }

  // Helper to collect diagnostics after interactions
  getConsoleErrorCount() {
    return this.consoleErrors.length;
  }

  getPageErrorCount() {
    return this.pageErrors.length;
  }

  // Return captured console messages (for richer assertions in tests)
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }
}

test.describe('Virtual Memory Demo - FSM states and transitions', () => {
  let demo;

  // Use a fresh page per test to isolate state and clickCount
  test.beforeEach(async ({ page }) => {
    demo = new DemoPage(page);
    demo.attachDiagnosticsListeners();
    // Navigate to the page under test
    await demo.goto();
    // Ensure initial load has completed DOM
    await expect(demo.translateButton).toBeVisible();
    await expect(demo.outputDiv).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // close page - Playwright will handle cleanup, but keep for clarity
    await page.close();
  });

  test('Initial Idle state: button and demo output rendered (S0_Idle)', async () => {
    // This test validates the Idle state (S0_Idle):
    // - The "Translate Virtual Address" button exists and is enabled.
    // - The demo output area contains the initial instructional text.
    const btn = demo.translateButton;
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveText('Translate Virtual Address');

    const outputText = await demo.outputDiv.textContent();
    // The initial content in the HTML includes a leading ">" character and sentence.
    expect(outputText).toContain('Click the button above to see the address translation process in action.');

    // Verify ARIA attributes and class presence as evidence of rendered demo area
    await expect(demo.outputDiv).toHaveAttribute('aria-live', 'polite');
    await expect(demo.outputDiv).toHaveAttribute('aria-label', 'Virtual memory address translation demonstration');

    // Assert that no runtime errors were emitted during initial render.
    // Per instructions we must observe console/page errors and let them occur naturally.
    // In this implementation we expect none. If any appear, they'll be surfaced below.
    expect(demo.getConsoleErrorCount()).toBe(0);
    expect(demo.getPageErrorCount()).toBe(0);
  });

  test('Translating state: successive clicks produce translations and page-fault messages (S1_Translating)', async () => {
    // This test validates transitions from Idle -> Translating (S0 -> S1)
    // and repeated S1 -> S1 transitions while the guard allows.
    // It asserts the output content after each click matches the demo's translateAddress() output.

    // Expected outcomes computed from the page's JS logic (do not modify page code).
    const expectedOutputsSubstrings = [
      // 1) VA 0x0123 -> vpn 0 -> pfn 5 -> physical address 0x1523
      [
        'Virtual Address (hex): 0x0123',
        '- Virtual Page Number (VPN): 0 (decimal)', // contains vpn info
        '- Page Offset: 0x123', // offset formatting
        '- Physical Frame Number (PFN): 5 (decimal)',
        '- Physical Address: 0x1523 (decimal 5411)'
      ],
      // 2) VA 0x0fab -> vpn 3 -> page not present (pfn === -1) -> Page Fault message
      [
        'Virtual Address (hex): 0x0fab',
        '- Virtual Page Number (VPN): 3 (decimal)',
        'Page Fault!'
      ],
      // 3) VA 0x15c0 -> vpn 5 -> pfn 4 -> physical address 0x11c0
      [
        'Virtual Address (hex): 0x15c0',
        '- Virtual Page Number (VPN): 5 (decimal)',
        '- Page Offset: 0x1c0', // offset padded to 3 chars
        '- Physical Frame Number (PFN): 4 (decimal)',
        '- Physical Address: 0x11c0'
      ],
      // 4) VA 0x0420 -> vpn 1 -> pfn 1 -> physical address 0x0420
      [
        'Virtual Address (hex): 0x0420',
        '- Virtual Page Number (VPN): 1 (decimal)',
        '- Page Offset: 0x020',
        '- Physical Frame Number (PFN): 1 (decimal)',
        '- Physical Address: 0x0420'
      ],
      // 5) VA 0x1010 -> vpn 4 -> pfn 7 -> physical address 0x1c10
      [
        'Virtual Address (hex): 0x1010',
        '- Virtual Page Number (VPN): 4 (decimal)',
        '- Page Offset: 0x010',
        '- Physical Frame Number (PFN): 7 (decimal)',
        '- Physical Address: 0x1c10'
      ]
    ];

    // Click for each expected translation and assert that demoOutput contains expected fragments.
    for (let i = 0; i < expectedOutputsSubstrings.length; i++) {
      await demo.clickTranslate();
      // After clicking, wait for the demo output to update with non-empty content.
      await expect(demo.outputDiv).not.toHaveText('', { timeout: 2000 });

      const content = await demo.outputDiv.textContent();
      // Validate that all expected substrings for this translation are present.
      for (const substr of expectedOutputsSubstrings[i]) {
        expect(content.toLowerCase()).toContain(substr.toLowerCase());
      }

      // Ensure the translate button remains enabled until we exhaust the list (final state reached later)
      await expect(demo.translateButton).toBeEnabled();
    }

    // After 5 valid translations, no page errors should have occurred.
    expect(demo.getConsoleErrorCount()).toBe(0);
    expect(demo.getPageErrorCount()).toBe(0);
  });

  test('Completed state: when translations exhausted the demo shows completion and disables button (S2_Completed)', async () => {
    // This test validates the guard transition from Translating -> Completed:
    // When clickCount >= virtualAddresses.length, the click handler sets final message and disables button.
    // According to code logic, after 5 translations (clickCount becomes 5), an additional click triggers completion.
    // So perform 5 translation clicks, then one more to hit completion.

    // Perform 5 clicks to consume all translations.
    for (let i = 0; i < 5; i++) {
      await demo.clickTranslate();
      // small wait to ensure state propagation and DOM update
      await expect(demo.outputDiv).not.toHaveText('', { timeout: 2000 });
    }

    // Now assert the button is still enabled (the code disables only when clickCount >= length and that happens next click)
    await expect(demo.translateButton).toBeEnabled();

    // Sixth click should trigger completion branch: outputDiv.textContent = 'Demo complete. Reload the page to run again.'; btn.disabled = true;
    await demo.clickTranslate();

    await expect(demo.outputDiv).toHaveText('Demo complete. Reload the page to run again.');
    await expect(demo.translateButton).toBeDisabled();

    // Attempting another user click should not change the output or re-enable the button.
    // Using Playwright's click will throw if element is disabled for normal user click, but we still attempt to confirm state is stable.
    const outputAfterComplete = await demo.outputDiv.textContent();

    // Try programmatic click (should not be possible as disabled prevents user action; using page.locator.click will throw,
    // so we avoid another click and assert stability).
    expect(outputAfterComplete).toBe('Demo complete. Reload the page to run again.');

    // Verify no runtime errors occurred through the whole flow
    expect(demo.getConsoleErrorCount()).toBe(0);
    expect(demo.getPageErrorCount()).toBe(0);
  });

  test('Edge cases and robustness: repeated rapid clicks and diagnostic observation', async () => {
    // This test exercises edge conditions:
    // - Rapid clicking to ensure guard logic prevents out-of-range access
    // - Observes console and page errors (they should remain zero)
    // - Verifies that the demoOutput remains sensibly formatted (no uncaught exceptions)

    // Rapidly click the button more times than there are virtual addresses.
    // Use a try/catch to allow the test to continue even if Playwright disallows clicking a disabled element later.
    for (let i = 0; i < 10; i++) {
      try {
        await demo.clickTranslate();
      } catch (err) {
        // If clicking fails because the button became disabled, that's acceptable; break out.
        break;
      }
    }

    // After aggressive clicking, the button should be disabled (completion reached) and the final message present.
    await expect(demo.translateButton).toBeDisabled();
    await expect(demo.outputDiv).toHaveText('Demo complete. Reload the page to run again.');

    // Ensure no console.error or pageerror events were emitted during the aggressive interaction.
    // According to instructions we observe errors and let them occur naturally; here we assert none occurred.
    const consoleErrors = demo.getConsoleErrorCount();
    const pageErrors = demo.getPageErrorCount();

    // Include debug info in expectation messages in case of failure for quicker diagnosis.
    expect(consoleErrors).toBe(0);
    expect(pageErrors).toBe(0);

    // Additionally ensure that console messages (info/debug) did not include stack traces or uncaught exception markers.
    const msgs = demo.getConsoleMessages().map(m => `${m.type}: ${m.text}`);
    // This assertion is conservative: just ensure none of the messages contain typical uncaught error prefixes
    const joined = msgs.join('\n').toLowerCase();
    expect(joined).not.toContain('uncaught');
    expect(joined).not.toContain('referenceerror');
    expect(joined).not.toContain('typeerror');
    expect(joined).not.toContain('syntaxerror');
  });

  test('Assertions on FSM evidence: verifies S0 entry action result and UI attributes', async () => {
    // This test ties the FSM "evidence" and "entry_actions" to actual DOM effects:
    // - S0_Idle entry action renderPage() was expected; we verify visible UI elements that correspond to renderPage output.
    // - Evidence: presence of #translateBtn and #demoOutput initial text.
    await expect(demo.translateButton).toBeVisible();
    await expect(demo.outputDiv).toBeVisible();

    const initialText = await demo.outputDiv.textContent();
    expect(initialText).toContain('Click the button above to see the address translation process in action.');

    // No runtime errors expected from initial entry action.
    expect(demo.getConsoleErrorCount()).toBe(0);
    expect(demo.getPageErrorCount()).toBe(0);
  });
});