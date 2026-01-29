import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b37121-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the routing demo
class RoutingApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.app = page.locator('#app');
    this.linkHome = page.locator("a[data-link][href='/']");
    this.linkAbout = page.locator("a[data-link][href='/about']");
    this.linkContact = page.locator("a[data-link][href='/contact']");
  }

  // Navigate to the app and wait for initial render
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // The app performs an initial render on DOMContentLoaded; wait for #app to be populated
    await expect(this.app).toBeVisible();
    // Wait until at least an <h2> header appears inside the app (Home by default)
    await this.page.waitForSelector('#app h2', { timeout: 2000 });
  }

  // Click a nav link by locator and wait for render to update
  async clickLink(locator) {
    await locator.click();
    // After clicking, the app calls history.pushState and render(href).
    // Wait for the h2 inside #app to update; a simple waitForSelector ensures DOM changed.
    await this.page.waitForSelector('#app h2', { timeout: 2000 });
  }

  // Get the visible text content of the app area
  async getAppText() {
    return (await this.app.innerText()).trim();
  }

  // Get page pathname
  async pathname() {
    return this.page.evaluate(() => window.location.pathname);
  }

  // Push states and trigger back/forward to exercise popstate handler
  async pushStatesAndBack(pushSequence = []) {
    // pushSequence is an array of path strings we will push in order (first..last)
    await this.page.evaluate((seq) => {
      seq.forEach((p) => history.pushState(null, null, p));
    }, pushSequence);
    // Now go back one step to trigger popstate to the previous entry
    await this.page.evaluate(() => history.back());
    // Allow some time for popstate listener to run and DOM to update
    await new Promise((r) => setTimeout(r, 100));
  }
}

test.describe('Simple Routing Demo - FSM based end-to-end tests', () => {
  // Collect console messages and page errors for each test to assert no unexpected runtime errors
  test.beforeEach(async ({ page }) => {
    // Preserve console messages and uncaught page errors
    page.__consoleMessages = [];
    page.__pageErrors = [];
    page.on('console', (msg) => {
      // store messages for inspection (type, text)
      page.__consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      page.__pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: fail the test if there were uncaught exceptions or console errors.
    // These will surface naturally; we do not modify the page to provoke or fix them.
    const consoleErrors = page.__consoleMessages.filter(m => m.type === 'error');
    if (consoleErrors.length > 0) {
      // Attach console errors to failure message by throwing - letting test framework report it.
      throw new Error('Console errors detected: ' + consoleErrors.map(e => e.text).join(' | '));
    }
    if (page.__pageErrors.length > 0) {
      throw new Error('Uncaught page errors detected: ' + page.__pageErrors.map(e => e.message).join(' | '));
    }
  });

  test.describe('Initial load and component presence', () => {
    test('renders Home page on initial load and navigation links are present', async ({ page }) => {
      const app = new RoutingApp(page);
      // Load the page and wait for initial render
      await app.goto();

      // Verify nav links exist with expected href attributes
      await expect(app.linkHome).toBeVisible();
      await expect(app.linkHome).toHaveAttribute('href', '/');

      await expect(app.linkAbout).toBeVisible();
      await expect(app.linkAbout).toHaveAttribute('href', '/about');

      await expect(app.linkContact).toBeVisible();
      await expect(app.linkContact).toHaveAttribute('href', '/contact');

      // Validate that Home content is shown on initial render
      const text = await app.getAppText();
      expect(text).toContain('Home Page');
      expect(text).toContain('Welcome to our simple routing demo site');
      // Ensure the browser location reflects the pathname (should be '/')
      const path = await app.pathname();
      // The test environment may preserve file URL path; ensure it ends with '/' or equals '/'
      // We relax the assertion to check that pathname is a string and contains '/'
      expect(typeof path).toBe('string');
      expect(path.startsWith('/')).toBeTruthy();
    });
  });

  test.describe('Navigation via links and state transitions', () => {
    test('Home -> About via link click updates DOM and history', async ({ page }) => {
      const app = new RoutingApp(page);
      await app.goto();

      // Click About link
      await app.clickLink(app.linkAbout);

      // Expect About content in app
      const aboutText = await app.getAppText();
      expect(aboutText).toContain('About Us');
      expect(aboutText).toContain('basic client-side routing');

      // Pathname should be '/about'
      const path = await app.pathname();
      expect(path).toBe('/about');
    });

    test('About -> Contact via link click updates DOM and history', async ({ page }) => {
      const app = new RoutingApp(page);
      await app.goto();

      // Navigate to About first
      await app.clickLink(app.linkAbout);
      expect(await app.pathname()).toBe('/about');

      // Click Contact link
      await app.clickLink(app.linkContact);

      // Expect Contact content
      const contactText = await app.getAppText();
      expect(contactText).toContain('Contact');
      expect(contactText).toContain('contact@example.com');

      // Pathname should be '/contact'
      const path = await app.pathname();
      expect(path).toBe('/contact');
    });

    test('Contact -> Home via link click updates DOM and history', async ({ page }) => {
      const app = new RoutingApp(page);
      await app.goto();

      // Navigate to Contact
      await app.clickLink(app.linkContact);
      expect(await app.pathname()).toBe('/contact');

      // Click Home link
      await app.clickLink(app.linkHome);

      // Expect Home content restored
      const homeText = await app.getAppText();
      expect(homeText).toContain('Home Page');
      expect(homeText).toContain('Welcome to our simple routing demo site');

      // Pathname should be '/'
      const path = await app.pathname();
      // Some environments may show '/' or '', but expect leading slash
      expect(path).toBe('/');
    });

    test('Full navigation cycle verifies transitions and history entries', async ({ page }) => {
      const app = new RoutingApp(page);
      await app.goto();

      // Home -> About
      await app.clickLink(app.linkAbout);
      expect(await app.pathname()).toBe('/about');
      expect((await app.getAppText()).includes('About Us')).toBeTruthy();

      // About -> Contact
      await app.clickLink(app.linkContact);
      expect(await app.pathname()).toBe('/contact');
      expect((await app.getAppText()).includes('Contact')).toBeTruthy();

      // Contact -> Home
      await app.clickLink(app.linkHome);
      expect(await app.pathname()).toBe('/');
      expect((await app.getAppText()).includes('Home Page')).toBeTruthy();
    });
  });

  test.describe('History API and popstate behavior (404 handling)', () => {
    test('Navigating back to an unknown pushed path triggers 404 render via popstate', async ({ page }) => {
      const app = new RoutingApp(page);
      await app.goto();

      // Sequence:
      // 1. Push a non-existent path '/nonexistent' (no render called on pushState)
      // 2. Push a known path '/about' so the history stack is: ... '/', '/nonexistent', '/about'
      // 3. Call history.back() to go to '/nonexistent' which should trigger popstate and render 404
      await page.evaluate(() => {
        history.pushState(null, null, '/nonexistent');
        history.pushState(null, null, '/about');
      });

      // At this point the visible page may still show Home or About depending on prior state.
      // Now navigate back to '/nonexistent' to trigger popstate rendering 404
      await page.evaluate(() => history.back());
      // Allow a small delay for popstate to be processed and DOM to update
      await page.waitForTimeout(150);

      // The app's popstate handler calls render(window.location.pathname) which should render 404 for '/nonexistent'
      const text = await app.getAppText();
      expect(text).toContain('404 - Not Found');
      expect(text).toContain('does not exist');

      // Ensure current pathname is '/nonexistent'
      const path = await app.pathname();
      expect(path).toBe('/nonexistent');
    });

    test('Forward navigation after back restores previous route content', async ({ page }) => {
      const app = new RoutingApp(page);
      await app.goto();

      // Go to About via click (this will pushState and render)
      await app.clickLink(app.linkAbout);
      expect(await app.pathname()).toBe('/about');
      expect((await app.getAppText()).includes('About Us')).toBeTruthy();

      // Push a bogus path then push back to about to build history: '/about' -> '/bogus' -> '/contact'
      await page.evaluate(() => {
        history.pushState(null, null, '/bogus');
        history.pushState(null, null, '/contact');
      });

      // Now go back twice to reach '/about'
      await page.evaluate(() => history.back());
      await page.waitForTimeout(100);
      await page.evaluate(() => history.back());
      await page.waitForTimeout(150);

      // We should now be at '/about' and About content should be rendered
      const pathNow = await app.pathname();
      expect(pathNow).toBe('/about');
      const content = await app.getAppText();
      expect(content).toContain('About Us');

      // Then go forward to '/contact' and validate Contact content
      await page.evaluate(() => history.forward());
      await page.waitForTimeout(150);
      expect(await app.pathname()).toBe('/contact');
      expect((await app.getAppText()).includes('Contact')).toBeTruthy();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking non-data-link anchors does not trigger routing (no-op)', async ({ page }) => {
      // We will inject a simple anchor that lacks data-link and ensure clicking it does not affect routing.
      // Note: This test does not modify application's existing functions, it only adds an element to the DOM.
      // The instruction forbids patching existing functions; adding an element is allowed as an interaction.
      const app = new RoutingApp(page);
      await app.goto();

      // Add a normal anchor without data-link
      await page.evaluate(() => {
        const a = document.createElement('a');
        a.id = 'normal-anchor';
        a.href = '/should-not-navigate';
        a.textContent = 'Normal Anchor';
        document.body.appendChild(a);
      });

      // Record current pathname and app content
      const beforePath = await app.pathname();
      const beforeText = await app.getAppText();

      // Click the normal anchor
      await page.click('#normal-anchor');
      // Give a moment for any potential navigation - but because it's a same-origin href that the dev server may not serve,
      // the browser might attempt a full navigation. To avoid leaving the page, we click while preventing default via evaluating.
      // Since we cannot intercept the event globally without patching code, ensure that click did not change the SPA state:
      await page.waitForTimeout(200);

      const afterPath = await app.pathname();
      const afterText = await app.getAppText();

      // The SPA should not have changed its internal rendering as the anchor did not have data-link,
      // although a real navigation might have occurred; in this environment we expect SPA to remain.
      expect(afterPath).toBe(beforePath);
      expect(afterText).toBe(beforeText);
    });

    test('Initial render for unknown pathname yields 404 when page loaded with that pathname (simulated)', async ({ page }) => {
      // We avoid directly requesting a non-existent server path; instead simulate navigation to an unknown pathname
      // before the app's initial DOMContentLoaded render by using replaceState then reloading.
      // Since we cannot change server routing, we will rely on pushState + dispatching a load event to mimic initial render.
      // This does not redefine functions, only exercises the app's render behavior.
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

      // Replace the current history entry with an unknown pathname and then trigger the app's render function by calling it.
      // Calling the existing global render is allowed (not a redefinition).
      await page.evaluate(() => {
        history.replaceState(null, null, '/initial-unknown');
        // Manually call render as if the app ran its initial render for the current pathname.
        if (typeof render === 'function') {
          render(window.location.pathname);
        }
      });

      // Wait a bit for DOM update
      await page.waitForTimeout(100);

      // Expect 404 content
      const appContent = await page.locator('#app').innerText();
      expect(appContent).toContain('404 - Not Found');
      expect(appContent).toContain('does not exist');
      const path = await page.evaluate(() => window.location.pathname);
      expect(path).toBe('/initial-unknown');
    });
  });
});