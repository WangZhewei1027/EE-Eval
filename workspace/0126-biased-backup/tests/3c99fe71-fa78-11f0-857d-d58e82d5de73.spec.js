import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c99fe71-fa78-11f0-857d-d58e82d5de73.html';

// Page object encapsulating selectors and common interactions
class HTTPSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btnMoreInfo = page.locator('#btnMoreInfo');
    this.btnRefresh = page.locator('#btnRefresh');
    this.infoModal = page.locator('#infoModal');
    this.closeBtn = page.locator('#infoModal .close-btn');
    this.globe = page.locator('.globe');
    this.main = page.locator('main[role="main"][aria-label="Explanation and visualization of HTTPS secure connection"]');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Open the info modal as a user would
  async openInfoModal() {
    await this.btnMoreInfo.click();
    // Wait for the modal to have the 'show' class (transition included)
    await this.page.waitForFunction(() => {
      const m = document.getElementById('infoModal');
      return m && m.classList.contains('show');
    });
  }

  // Close info modal by clicking the close button
  async closeInfoModalByButton() {
    await this.closeBtn.click();
    await this.page.waitForFunction(() => {
      const m = document.getElementById('infoModal');
      return m && !m.classList.contains('show');
    });
  }

  // Trigger Escape key while modal is focused (simulate user pressing Escape)
  async closeInfoModalByEscape() {
    // Ensure the modal is focused to get the keydown event handled by the element
    await this.page.evaluate(() => {
      const m = document.getElementById('infoModal');
      if (m) m.focus();
    });
    await this.page.keyboard.press('Escape');
    await this.page.waitForFunction(() => {
      const m = document.getElementById('infoModal');
      return m && !m.classList.contains('show');
    });
  }

  // Click refresh animation
  async refreshGlobe() {
    await this.btnRefresh.click();
  }

  // Return true/false if modal has 'show' class
  async isModalVisible() {
    return await this.page.evaluate(() => {
      const m = document.getElementById('infoModal');
      return m ? m.classList.contains('show') : false;
    });
  }

  // Return aria-expanded value of the More Info button
  async moreInfoAriaExpanded() {
    return await this.btnMoreInfo.getAttribute('aria-expanded');
  }

  // Return the id of active element
  async activeElementId() {
    return await this.page.evaluate(() => document.activeElement && document.activeElement.id ? document.activeElement.id : document.activeElement && document.activeElement.className ? document.activeElement.className : null);
  }

  // Return inline animation style of globe (the inline style property)
  async globeInlineAnimation() {
    return await this.page.evaluate(() => {
      const g = document.querySelector('.globe');
      return g ? g.style.animation : null;
    });
  }

  // Return computed animation-name of globe
  async globeComputedAnimationName() {
    return await this.page.evaluate(() => {
      const g = document.querySelector('.globe');
      if (!g) return null;
      const cs = getComputedStyle(g);
      // animationName may be a comma-separated list; return whole string
      return cs.animationName || cs.webkitAnimationName || '';
    });
  }
}

test.describe('HTTPS — Secure by Design (FSM validation)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleMessages = [];

    // Collect console messages and page errors for each test run
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // Collect the Error object/message from page
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test assert there were no uncaught runtime errors on the page
    // This validates that event handlers and interactions did not throw.
    // If there were expected runtime errors in the application they would be surfaced here.
    expect(pageErrors.length).toBe(0);
    // Ensure there are no console error-level messages emitted during interaction
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Initial Idle state (S0_Idle)', () => {
    test('renders the main page and default elements are present', async ({ page }) => {
      // Validate initial render (entry action renderPage() expected by FSM)
      const app = new HTTPSPage(page);

      // Main element exists and is accessible
      await expect(app.main).toBeVisible();

      // More Info button exists with correct attributes
      await expect(app.btnMoreInfo).toBeVisible();
      const ariaControls = await app.btnMoreInfo.getAttribute('aria-controls');
      expect(ariaControls).toBe('infoModal');
      const ariaExpanded = await app.btnMoreInfo.getAttribute('aria-expanded');
      expect(ariaExpanded).toBe('false');

      // Modal should exist in DOM but not visible (no 'show' class)
      const modalVisible = await app.isModalVisible();
      expect(modalVisible).toBe(false);

      // Globe should have the animation applied via CSS (computed style)
      const computedName = await app.globeComputedAnimationName();
      // We expect the CSS keyframes 'slowRotate' to be applied; animationName may be vendor-prefixed or a list.
      expect(typeof computedName).toBe('string');
      // It should not be 'none' initially - accept either 'slowRotate' or not 'none'
      expect(computedName.toLowerCase()).not.toBe('none');
    });
  });

  test.describe('Information modal interactions (S0_Idle <-> S1_InfoModalVisible)', () => {
    test('ShowInfoModal: clicking #btnMoreInfo displays modal, sets aria-expanded, and focuses modal', async ({ page }) => {
      const app = new HTTPSPage(page);

      // Click the "Why HTTPS Matters" button to show modal
      // This triggers: infoModal.classList.add('show'); btnMoreInfo.setAttribute('aria-expanded','true'); infoModal.focus();
      await app.openInfoModal();

      // Assert the modal has the 'show' class (onEnter action)
      expect(await app.isModalVisible()).toBe(true);

      // aria-expanded must reflect true
      expect(await app.moreInfoAriaExpanded()).toBe('true');

      // The modal should have focus (entry action calls infoModal.focus())
      const activeId = await app.activeElementId();
      // activeId may be 'infoModal' or className if active element is a child; assert that active element is the modal or inside it
      const activeIsModalOrChild = await page.evaluate(() => {
        const active = document.activeElement;
        const modal = document.getElementById('infoModal');
        return modal && (active === modal || modal.contains(active));
      });
      expect(activeIsModalOrChild).toBe(true);

      // Also check the visible CSS state (opacity/transform -> class toggles these)
      const opacity = await page.evaluate(() => getComputedStyle(document.getElementById('infoModal')).opacity);
      expect(Number(opacity)).toBeGreaterThan(0);
    });

    test('CloseInfoModal: clicking .close-btn hides modal, updates aria-expanded, and returns focus', async ({ page }) => {
      const app = new HTTPSPage(page);

      // Ensure modal is open first
      await app.openInfoModal();

      // Click close button to trigger closeInfoModal() which should remove 'show' and set aria-expanded false and focus the original button
      await app.closeInfoModalByButton();

      // Modal must be hidden (exit action removes 'show')
      expect(await app.isModalVisible()).toBe(false);

      // aria-expanded should be false again
      const ariaExpandedAfter = await app.moreInfoAriaExpanded();
      expect(ariaExpandedAfter).toBe('false');

      // Focus should be returned to the More Info button
      const activeElement = await app.activeElementId();
      // activeElement for the button should be 'btnMoreInfo'
      expect(activeElement).toContain('btnMoreInfo');
    });

    test('EscapeCloseInfoModal: pressing Escape while modal focused hides modal', async ({ page }) => {
      const app = new HTTPSPage(page);

      // Open modal, then press Escape
      await app.openInfoModal();
      await app.closeInfoModalByEscape();

      // Modal should be hidden and aria-expanded false
      expect(await app.isModalVisible()).toBe(false);
      expect(await app.moreInfoAriaExpanded()).toBe('false');

      // Focus should be returned to the More Info button
      const active = await app.activeElementId();
      expect(active).toContain('btnMoreInfo');
    });

    test('Edge case: pressing Escape when modal is not visible should do nothing and not throw', async ({ page }) => {
      const app = new HTTPSPage(page);

      // Ensure modal hidden
      expect(await app.isModalVisible()).toBe(false);

      // Press Escape while something else (body) is focused
      await page.keyboard.press('Escape');

      // Modal still hidden and no page errors should have been thrown (checked in afterEach)
      expect(await app.isModalVisible()).toBe(false);
    });

    test('Edge case: attempt to invoke close button programmatically when modal hidden (simulated non-UI click) should not throw', async ({ page }) => {
      // We intentionally simulate a programmatic click on the hidden close button to see if the handler is resilient.
      // We call element.click() via evaluate to bypass Playwright's visibility requirement (this simulates a non-user call).
      await page.evaluate(() => {
        const closeBtn = document.querySelector('#infoModal .close-btn');
        if (closeBtn && typeof closeBtn.click === 'function') {
          try { closeBtn.click(); } catch (e) { /* let pageerror capture any uncaught errors */ }
        }
      });

      // After this operation the modal should remain hidden (no 'show' class)
      const modalHasShow = await page.evaluate(() => {
        const m = document.getElementById('infoModal');
        return m ? m.classList.contains('show') : false;
      });
      expect(modalHasShow).toBe(false);
    });
  });

  test.describe('Refresh animation (S0_Idle -> S0_Idle)', () => {
    test('RefreshAnimation: clicking #btnRefresh retriggers globe animation without throwing', async ({ page }) => {
      const app = new HTTPSPage(page);

      // Capture inline animation value before click
      const beforeInline = await app.globeInlineAnimation();

      // Computed animation name before click
      const beforeComputed = await app.globeComputedAnimationName();

      // Click to refresh animation - expected actions:
      // globe.style.animation = 'none'; void globe.offsetWidth; globe.style.animation = '';
      await app.refreshGlobe();

      // The final inline style is expected to be '' based on the implementation (it resets the inline style).
      const afterInline = await app.globeInlineAnimation();
      expect(afterInline === '' || afterInline === null).toBe(true);

      // Computed animation name after click should still indicate the CSS animation is applied (retriggered)
      const afterComputed = await app.globeComputedAnimationName();
      expect(typeof afterComputed).toBe('string');
      // It should not be 'none' (the animation should be active via CSS rule)
      expect(afterComputed.toLowerCase()).not.toBe('none');

      // Perform multiple rapid clicks to surface potential race conditions or errors
      await Promise.all([
        app.refreshGlobe(),
        app.refreshGlobe(),
        app.refreshGlobe()
      ]);

      // Final inline style should remain empty (reset to CSS)
      const finalInline = await app.globeInlineAnimation();
      expect(finalInline === '' || finalInline === null).toBe(true);
    });
  });

  test.describe('Accessibility & DOM contract checks (additional validations)', () => {
    test('Modal element has the expected ARIA attributes and tabindex as described in FSM', async ({ page }) => {
      const app = new HTTPSPage(page);

      // Validate modal ARIA attributes match the FSM description
      const attrs = await page.evaluate(() => {
        const m = document.getElementById('infoModal');
        if (!m) return null;
        return {
          role: m.getAttribute('role'),
          ariaModal: m.getAttribute('aria-modal'),
          labelledby: m.getAttribute('aria-labelledby'),
          describedby: m.getAttribute('aria-describedby'),
          tabindex: m.getAttribute('tabindex')
        };
      });

      expect(attrs).not.toBeNull();
      expect(attrs.role).toBe('dialog');
      expect(attrs.ariaModal).toBe('true');
      expect(attrs.labelledby).toBe('modalTitle');
      expect(attrs.describedby).toBe('modalDesc');
      expect(attrs.tabindex).toBe('-1');
    });

    test('Close button exists with accessible label and is inside the modal', async ({ page }) => {
      const app = new HTTPSPage(page);
      await expect(app.closeBtn).toHaveAttribute('aria-label', 'Close information modal');

      // Ensure it's a child of the modal element
      const isChild = await page.evaluate(() => {
        const closeBtn = document.querySelector('#infoModal .close-btn');
        const modal = document.getElementById('infoModal');
        return closeBtn && modal ? modal.contains(closeBtn) : false;
      });
      expect(isChild).toBe(true);
    });
  });
});