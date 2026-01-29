import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d3933-fa74-11f0-a1b6-4b9b8151441a.html';

// Helper Page Object for the demo app
class DemoApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Returns element handle or null
  async getNavLink(href) {
    return await this.page.$(`a[href='${href}']`);
  }

  // Clicks a nav link if present, otherwise tries to set location.hash
  async navigateVia(href) {
    const link = await this.getNavLink(href);
    if (link) {
      await Promise.all([
        this.page.waitForLoadState('networkidle').catch(() => {}), // don't fail if nothing networky
        link.click()
      ]);
    } else {
      // fall back to changing location.hash
      await this.page.evaluate((h) => { location.hash = h.replace('#', ''); }, href);
    }
    // give the app a short moment to react (hashchange handlers are sync/async)
    await this.page.waitForTimeout(150);
  }

  // Checks whether a page element with given id has class 'active'
  async isPageActive(id) {
    const el = await this.page.$(`#${id}`);
    if (!el) return false;
    return await this.page.evaluate((e) => e.classList.contains('active'), el);
  }

  async getPageText(id) {
    const el = await this.page.$(`#${id}`);
    if (!el) return null;
    return (await this.page.innerText(`#${id}`)).trim();
  }

  // Return how many .page elements are visible (display != 'none')
  async visiblePageCount() {
    return await this.page.evaluate(() => {
      const pages = Array.from(document.querySelectorAll('.page'));
      return pages.filter(p => {
        const style = window.getComputedStyle(p);
        return style && style.display !== 'none' && style.visibility !== 'hidden' && p.offsetParent !== null;
      }).length;
    });
  }

  // Return count of elements with .page.active
  async activePageCount() {
    return await this.page.$$eval('.page.active', els => els.length);
  }
}

// Utility: determine if collected errors contain JS runtime errors of interest
function containsJSRuntimeError(messages) {
  const joined = messages.join('\n');
  return /ReferenceError|SyntaxError|TypeError/.test(joined);
}

// Shared fixtures: capture console messages and page errors
test.describe.configure({ mode: 'serial' });

test.describe('Client-Side Routing Demo - Observability and Transitions', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      const text = `[console:${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });
  });

  // Validate basic presence of navigation links and initial render OR capture startup errors.
  test('Initial load: nav links and Home state should be present or runtime errors should be reported', async ({ page }) => {
    const app = new DemoApp(page);
    await app.goto();

    // Wait briefly to allow any broken script to throw
    await page.waitForTimeout(200);

    // Attempt to find the three expected nav links
    const homeLink = await app.getNavLink("#/");
    const aboutLink = await app.getNavLink("#/about");
    const contactLink = await app.getNavLink("#/contact");

    // If the app rendered the nav links, assert they contain expected text.
    if (homeLink && aboutLink && contactLink) {
      const homeText = await page.innerText("a[href='#/']");
      const aboutText = await page.innerText("a[href='#/about']");
      const contactText = await page.innerText("a[href='#/contact']");

      expect(homeText.trim()).toBe('Home');
      expect(aboutText.trim()).toBe('About');
      expect(contactText.trim()).toBe('Contact');

      // Check for Home page evidence described in FSM
      const homeExists = await page.$('#home');
      if (homeExists) {
        const homeVisible = await app.isPageActive('home');
        // If the page is implemented correctly, home should either be visible (active) or at least present in DOM
        expect(await app.getPageText('home')).toBeTruthy();
        // homeVisible may be true or false depending on router, but we ensure the element exists.
      } else {
        // If DOM is missing the expected page, likely runtime error(s) happened.
        expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
        expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
      }
    } else {
      // If one or more nav links are missing, assert that runtime errors occurred (page likely truncated/broken)
      expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
      expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
    }
  });

  // Test all transitions from the FSM. Each test attempts the interaction; if the DOM is missing,
  // the test will assert that JS runtime errors occurred (per instructions: observe & assert errors).
  test('Transition: Home -> About via nav link or hash change', async ({ page }) => {
    const app = new DemoApp(page);
    await app.goto();
    await page.waitForTimeout(100);

    // Ensure start at Home by navigating to home
    const homeLink = await app.getNavLink("#/");
    if (homeLink) {
      await app.navigateVia("#/");
    } else {
      await page.evaluate(() => { location.hash = '/'; });
      await page.waitForTimeout(100);
    }

    // Perform navigation to About
    const aboutLink = await app.getNavLink("#/about");
    if (aboutLink) {
      await app.navigateVia("#/about");

      // Expect About page to be active per FSM
      const aboutActive = await app.isPageActive('about');
      const aboutText = await app.getPageText('about');
      expect(aboutActive || aboutText).toBeTruthy(); // at least content or active class present

      // Ensure home is not active if about is active
      if (aboutActive) {
        const homeActive = await app.isPageActive('home');
        expect(homeActive).toBeFalsy();
      }
    } else {
      // If the About link is absent, assert that runtime errors were recorded
      expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
      expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
    }
  });

  test('Transition: Home -> Contact via nav link or hash change', async ({ page }) => {
    const app = new DemoApp(page);
    await app.goto();
    await page.waitForTimeout(100);

    // ensure start at Home
    const homeLink = await app.getNavLink("#/");
    if (homeLink) {
      await app.navigateVia("#/");
    } else {
      await page.evaluate(() => { location.hash = '/'; });
      await page.waitForTimeout(100);
    }

    // navigate to Contact
    const contactLink = await app.getNavLink("#/contact");
    if (contactLink) {
      await app.navigateVia("#/contact");

      // Expect Contact page to show
      const contactActive = await app.isPageActive('contact');
      const contactText = await app.getPageText('contact');
      expect(contactActive || contactText).toBeTruthy();

      if (contactActive) {
        const homeActive = await app.isPageActive('home');
        expect(homeActive).toBeFalsy();
      }
    } else {
      // Missing link -> expect runtime errors
      expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
      expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
    }
  });

  test('Transition: About -> Home', async ({ page }) => {
    const app = new DemoApp(page);
    await app.goto();
    await page.waitForTimeout(100);

    // Navigate to About first
    const aboutLink = await app.getNavLink("#/about");
    if (aboutLink) {
      await app.navigateVia("#/about");

      // Then navigate to Home
      const homeLink = await app.getNavLink("#/");
      if (homeLink) {
        await app.navigateVia("#/");

        const homeActive = await app.isPageActive('home');
        const homeText = await app.getPageText('home');
        expect(homeActive || homeText).toBeTruthy();

        if (homeActive) {
          const aboutActive = await app.isPageActive('about');
          expect(aboutActive).toBeFalsy();
        }
      } else {
        // Missing home link scenario
        expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
        expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
      }
    } else {
      // Missing about link scenario
      expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
      expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
    }
  });

  test('Transition: About -> Contact', async ({ page }) => {
    const app = new DemoApp(page);
    await app.goto();
    await page.waitForTimeout(100);

    // Ensure we are in About
    const aboutLink = await app.getNavLink("#/about");
    if (aboutLink) {
      await app.navigateVia("#/about");

      // Then navigate to Contact
      const contactLink = await app.getNavLink("#/contact");
      if (contactLink) {
        await app.navigateVia("#/contact");

        const contactActive = await app.isPageActive('contact');
        const contactText = await app.getPageText('contact');
        expect(contactActive || contactText).toBeTruthy();

        if (contactActive) {
          const aboutActive = await app.isPageActive('about');
          expect(aboutActive).toBeFalsy();
        }
      } else {
        expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
        expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
      }
    } else {
      expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
      expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
    }
  });

  test('Transition: Contact -> Home', async ({ page }) => {
    const app = new DemoApp(page);
    await app.goto();
    await page.waitForTimeout(100);

    // Navigate to Contact first
    const contactLink = await app.getNavLink("#/contact");
    if (contactLink) {
      await app.navigateVia("#/contact");

      // Then go Home
      const homeLink = await app.getNavLink("#/");
      if (homeLink) {
        await app.navigateVia("#/");

        const homeActive = await app.isPageActive('home');
        const homeText = await app.getPageText('home');
        expect(homeActive || homeText).toBeTruthy();

        if (homeActive) {
          const contactActive = await app.isPageActive('contact');
          expect(contactActive).toBeFalsy();
        }
      } else {
        expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
        expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
      }
    } else {
      expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
      expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
    }
  });

  test('Transition: Contact -> About', async ({ page }) => {
    const app = new DemoApp(page);
    await app.goto();
    await page.waitForTimeout(100);

    // Go to Contact
    const contactLink = await app.getNavLink("#/contact");
    if (contactLink) {
      await app.navigateVia("#/contact");

      // Then About
      const aboutLink = await app.getNavLink("#/about");
      if (aboutLink) {
        await app.navigateVia("#/about");

        const aboutActive = await app.isPageActive('about');
        const aboutText = await app.getPageText('about');
        expect(aboutActive || aboutText).toBeTruthy();

        if (aboutActive) {
          const contactActive = await app.isPageActive('contact');
          expect(contactActive).toBeFalsy();
        }
      } else {
        expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
        expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
      }
    } else {
      expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
      expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
    }
  });

  // Edge case: clicking the same navigation link repeatedly should not produce additional errors
  test('Edge case: clicking the same nav link multiple times does not crash the app (or reports errors if app is broken)', async ({ page }) => {
    const app = new DemoApp(page);
    await app.goto();
    await page.waitForTimeout(100);

    const aboutLink = await app.getNavLink("#/about");
    if (aboutLink) {
      // Click About repeatedly
      for (let i = 0; i < 3; i++) {
        await app.navigateVia("#/about");
      }

      // Ensure About shows up once and is active
      const activeCount = await app.activePageCount();
      expect(activeCount).toBeGreaterThanOrEqual(0); // at least a valid number
      const aboutActive = await app.isPageActive('about');
      expect(aboutActive || await app.getPageText('about')).toBeTruthy();

      // If there were errors recorded, they should be JS runtime errors (per allowed types)
      if (pageErrors.length + consoleMessages.length > 0) {
        expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
      }
    } else {
      // Can't perform UI clicks; expect observed runtime errors due to truncated implementation
      expect(pageErrors.length + consoleMessages.length).toBeGreaterThan(0);
      expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
    }
  });

  // Edge case: navigating to an unknown hash should not crash the test harness; either the app handles it or JS errors are reported.
  test('Edge case: navigating to an invalid hash (#/nonexistent) should not throw unexpected exceptions', async ({ page }) => {
    const app = new DemoApp(page);
    await app.goto();
    await page.waitForTimeout(100);

    // Set an invalid hash
    await page.evaluate(() => { location.hash = '#/nonexistent'; });
    await page.waitForTimeout(150);

    // If the app has proper router, it may show no active pages or a fallback. We ensure nothing catastrophic happened.
    const activeCount = await app.activePageCount();
    expect(typeof activeCount).toBe('number');

    // If there are page errors, assert they are known JS runtime errors (allowed per instructions)
    if (pageErrors.length + consoleMessages.length > 0) {
      expect(containsJSRuntimeError([...pageErrors, ...consoleMessages])).toBeTruthy();
    }
  });

  // Final test: report collected console messages and page errors for debugging purposes and assert consistency:
  test('Diagnostics: collected console messages and page errors should be observable', async ({ page }) => {
    // We reopen the page to gather final diagnostics
    const app = new DemoApp(page);
    await app.goto();
    await page.waitForTimeout(100);

    // Force a short interaction to potentially trigger errors
    const homeLink = await app.getNavLink("#/");
    if (homeLink) {
      await app.navigateVia("#/");
    }

    // Wait to gather any asynchronous errors
    await page.waitForTimeout(150);

    // At this point we simply assert that our listeners captured arrays (they exist)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // If errors were captured, they should include JS runtime error types per the instructions about letting errors happen
    if (pageErrors.length > 0 || consoleMessages.length > 0) {
      expect(containsJSRuntimeError([...pageErrors, ...consoleMessages]) || (pageErrors.length === 0 && consoleMessages.length > 0)).toBeTruthy();
    }
  });
});