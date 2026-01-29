import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ad39a1-fa78-11f0-812d-c9788050701f.html';

/**
 * Page object encapsulating common interactions and queries for the app.
 */
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateBtn = page.locator('#animateBtn');
    this.toggleThemeBtn = page.locator('#toggleThemeBtn');
    this.typeFills = page.locator('.type-fill');
    this.typeLabels = page.locator('.type-label');
    this.tooltip = page.locator('#tooltip');
  }

  async goto() {
    // Wait for initial DOM content to load
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait a bit for inline scripts in DOMContentLoaded to run
    await this.page.waitForTimeout(50);
  }

  async clickAnimate() {
    await this.animateBtn.click();
  }

  async clickToggleTheme() {
    await this.toggleThemeBtn.click();
  }

  async getFillInlineWidths() {
    // returns array of element.style.width values (strings, e.g., "60%" or "0px")
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.type-fill')).map(el => el.style.width);
    });
  }

  async waitForFillWidthsToMatch(expectedWidths, timeout = 3000) {
    // expectedWidths: array of strings like ['60%','95%','85%']
    await this.page.waitForFunction(
      (expected) => {
        const fills = Array.from(document.querySelectorAll('.type-fill'));
        if (fills.length !== expected.length) return false;
        for (let i = 0; i < fills.length; i++) {
          const w = fills[i].style.width;
          // Normalize: treat '0' and '0px' equivalent
          if (!w) return false;
          if (w.includes('%')) {
            if (w.trim() !== expected[i].trim()) return false;
          } else {
            // If expected is percent but actual is computed px, we rely on inline style being percent after script sets it.
            if (expected[i].includes('%')) return false;
            if (!w.includes(expected[i])) return false;
          }
        }
        return true;
      },
      expectedWidths,
      { timeout }
    );
  }

  async getTooltipText() {
    return await this.tooltip.textContent();
  }

  async getTooltipOpacity() {
    return await this.page.evaluate(() => {
      const t = document.getElementById('tooltip');
      return t ? t.style.opacity : null;
    });
  }

  async hoverLabel(index = 0) {
    const labelCount = await this.typeLabels.count();
    if (labelCount === 0) throw new Error('No type labels found to hover');
    await this.typeLabels.nth(index).hover();
  }

  async leaveLabel(index = 0) {
    const labelCount = await this.typeLabels.count();
    if (labelCount === 0) throw new Error('No type labels found to mouseleave');
    // Move mouse away from label to body to trigger mouseleave
    await this.page.mouse.move(10, 10);
  }

  async getBodyComputedStyles() {
    return await this.page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      return {
        backgroundColor: cs.backgroundColor,
        color: cs.color
      };
    });
  }
}

test.describe('Static Typing Elegance - FSM based E2E tests', () => {
  // Collect runtime errors and console error messages for assertions
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture unhandled exceptions that bubble to the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture console messages of type 'error'
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown: ensure page is closed in case of failures
    try {
      await page.close();
    } catch (e) {
      // ignore if already closed
    }
  });

  test('Initial state (S0_Idle): page renders expected elements and tooltip hidden', async ({ page }) => {
    // This test validates the Idle state entry action renderPage() by checking the DOM.
    const app = new AppPage(page);
    await app.goto();

    // Buttons should be present and visible
    await expect(app.animateBtn).toBeVisible();
    await expect(app.toggleThemeBtn).toBeVisible();

    // There should be three type-fill bars
    await expect(app.typeFills).toHaveCount(3);

    // Tooltip should be present but hidden (opacity 0 as inline style managed by script on hover)
    const tooltipOpacity = await app.getTooltipOpacity();
    // When not hovered, script sets tooltip.style.opacity = '0' in mouseleave; at load it might be '' or '0'
    expect(['', '0', '0.0', null]).toContain(tooltipOpacity);

    // No uncaught page errors or console 'error' messages at initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('AnimateVisualization (S0 -> S1): clicking animate resets widths to 0 then expands to data-widths', async ({ page }) => {
    // This test validates the animate transition: animateTypeBars() entry action and observable width changes.
    const app = new AppPage(page);
    await app.goto();

    // Confirm initial inline widths reflect the HTML inline styles (should be percentages)
    const initialWidths = await app.getFillInlineWidths();
    expect(initialWidths.length).toBe(3);
    expect(initialWidths[0]).toContain('%');
    expect(initialWidths[1]).toContain('%');
    expect(initialWidths[2]).toContain('%');

    // Click animate: script will set widths to '0' and then after ~100ms to data-widths (60%,95%,85%)
    await app.clickAnimate();

    // Immediately after click, inline style widths should be set to something representing zero (browser may normalize to '0px' or '0')
    // Wait a small tick and check that at least one fill reports a '0' inline style quickly
    await page.waitForTimeout(20);
    const widthsAfterClickImmediate = await app.getFillInlineWidths();
    // At least one should reflect a zero-ish value; we assert that at least one entry contains '0'
    expect(widthsAfterClickImmediate.some(w => w && w.includes('0'))).toBeTruthy();

    // Then wait for script to set data-widths and for the inline styles to equal the expected percentages
    const expected = ['60%', '95%', '85%'];
    await app.waitForFillWidthsToMatch(expected, 3000);

    // Final inline widths should match the set data-widths
    const finalWidths = await app.getFillInlineWidths();
    expect(finalWidths[0]).toBe('60%');
    expect(finalWidths[1]).toBe('95%');
    expect(finalWidths[2]).toBe('85%');

    // No uncaught errors emitted during animation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Animating -> Idle (S1 -> S0): clicking animate again resets and re-expands (idempotent behavior)', async ({ page }) => {
    // Validate clicking animate multiple times toggles through the same animation cycle and does not throw
    const app = new AppPage(page);
    await app.goto();

    // Perform first animation and wait to complete
    await app.clickAnimate();
    await app.waitForFillWidthsToMatch(['60%', '95%', '85%'], 3000);

    // Click animate a second time to trigger reset to 0 and then back to percentages
    await app.clickAnimate();

    // Immediately expect some fills to go to zero (or '0px')
    await page.waitForTimeout(30);
    const immediate = await app.getFillInlineWidths();
    expect(immediate.some(w => w && w.includes('0'))).toBeTruthy();

    // Wait for re-expansion
    await app.waitForFillWidthsToMatch(['60%', '95%', '85%'], 3000);

    // Final widths match again
    const final = await app.getFillInlineWidths();
    expect(final).toEqual(['60%', '95%', '85%']);

    // Ensure no runtime page errors or console error messages happened during repeated animates
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ToggleDarkMode (S0 -> S2 -> S0): toggles body background and text color and toggles back', async ({ page }) => {
    // This test validates the theme toggle transition applyDarkMode() entry action
    const app = new AppPage(page);
    await app.goto();

    const beforeStyles = await app.getBodyComputedStyles();

    // Click to toggle dark mode
    await app.clickToggleTheme();

    // After click the inline background-color should be set to '#0f172a' which computes to 'rgb(15, 23, 42)'
    await page.waitForFunction(() => {
      const cs = getComputedStyle(document.body);
      return cs.backgroundColor === 'rgb(15, 23, 42)' && (cs.color === 'rgb(226, 232, 240)' || cs.color === 'rgb(226,232,240)');
    }, { timeout: 1000 });

    const darkStyles = await app.getBodyComputedStyles();
    expect(darkStyles.backgroundColor).toBe('rgb(15, 23, 42)');
    // Text color expected to be light in dark mode: '#e2e8f0' -> rgb(226,232,240)
    expect(darkStyles.color.replace(/\s+/g, '')).toContain('rgb(226,232,240)');

    // Click again to toggle back to light
    await app.clickToggleTheme();

    // After toggling back, inline background-color should be '#f8fafc' -> rgb(248,250,252)
    await page.waitForFunction(() => {
      const cs = getComputedStyle(document.body);
      return cs.backgroundColor === 'rgb(248, 250, 252)' && (cs.color === 'rgb(30, 41, 59)' || cs.color === 'rgb(30,41,59)');
    }, { timeout: 1000 });

    const lightStyles = await app.getBodyComputedStyles();
    expect(lightStyles.backgroundColor).toBe('rgb(248, 250, 252)');
    expect(lightStyles.color.replace(/\s+/g, '')).toContain('rgb(30,41,59)');

    // No runtime page errors or console 'error' messages during theme toggles
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Tooltip interactions (ShowTooltip / HideTooltip): hover shows tooltip with label text, mouseleave hides it', async ({ page }) => {
    // This test validates showTooltip()/hideTooltip() behavior on mouseenter/mouseleave
    const app = new AppPage(page);
    await app.goto();

    // Pick the first label's text to compare
    const firstLabelText = await page.locator('.type-label').nth(0).textContent();
    expect(firstLabelText).toBeTruthy();

    // Hover to show tooltip
    await app.hoverLabel(0);

    // Tooltip text should match the label text trimmed
    await page.waitForFunction((expected) => {
      const t = document.getElementById('tooltip');
      return t && t.textContent && t.textContent.trim() === expected && t.style.opacity === '1';
    }, firstLabelText.trim(), { timeout: 1000 });

    const tooltipText = (await app.getTooltipText())?.trim();
    expect(tooltipText).toBe(firstLabelText.trim());

    // Leave label to hide tooltip
    await app.leaveLabel(0);

    // Wait for tooltip opacity to go back to '0'
    await page.waitForFunction(() => {
      const t = document.getElementById('tooltip');
      return t && (t.style.opacity === '0' || t.style.opacity === '');
    }, null, { timeout: 1000 });

    const tooltipOpacityAfter = await app.getTooltipOpacity();
    expect(['', '0', '0.0']).toContain(tooltipOpacityAfter);

    // No runtime errors during hover interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases & robustness: rapid/spam interactions do not throw uncaught errors', async ({ page }) => {
    // This test rapidly triggers the major events (animate, toggle, hover) in quick succession
    const app = new AppPage(page);
    await app.goto();

    // Rapidly click animate and toggle in parallel bursts
    for (let i = 0; i < 5; i++) {
      // do not await to simulate rapid user interactions; but add small spacing
      app.clickAnimate().catch(() => {});
      app.clickToggleTheme().catch(() => {});
      // Rapid hover/leave
      await app.hoverLabel(i % 3).catch(() => {});
      await page.waitForTimeout(10);
      await app.leaveLabel(i % 3).catch(() => {});
    }

    // Wait a bit for any async handlers to finish
    await page.waitForTimeout(1000);

    // Ensure animations have settled back to expected widths
    await app.waitForFillWidthsToMatch(['60%', '95%', '85%'], 3000);

    // Verify that no page errors or console errors were thrown during the rapid interactions.
    // This checks that the application's event handlers are robust to quick repeated events.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});