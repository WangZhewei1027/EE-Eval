import { test, expect } from '@playwright/test';

// Page Object for the Simple Routing Example page
class RouterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f3483-fa73-11f0-a9d0-d7a1991987c6.html';
    this.selectors = {
      navHome: "button[onclick=\"navigate('home')\"]",
      navAbout: "button[onclick=\"navigate('about')\"]",
      navContact: "button[onclick=\"navigate('contact')\"]",
      content: '#content',
      contentHeading: '#content h1',
      contentParagraph: '#content p'
    };
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async clickHome() {
    await this.page.click(this.selectors.navHome);
  }
  async clickAbout() {
    await this.page.click(this.selectors.navAbout);
  }
  async clickContact() {
    await this.page.click(this.selectors.navContact);
  }

  async getHeadingText() {
    const heading = await this.page.locator(this.selectors.contentHeading);
    return heading.textContent();
  }

  async getParagraphText() {
    const para = await this.page.locator(this.selectors.contentParagraph);
    return para.textContent();
  }

  async getContentHTML() {
    return this.page.$eval(this.selectors.content, el => el.innerHTML);
  }

  async getButtonOnclick(selector) {
    return this.page.$eval(selector, el => el.getAttribute('onclick'));
  }

  // Call the global navigate function directly in page context (do not patch or modify)
  async callNavigate(pageName) {
    return this.page.evaluate((p) => {
      // Intentionally call the existing navigate function if present.
      // We must not modify or redefine anything on the page.
      try {
        // Some pages may not expose navigate; let errors surface naturally.
        return typeof navigate === 'function' ? navigate(p) : 'navigate_not_defined';
      } catch (e) {
        // Return the error message so tests can assert on it if needed.
        return { error: e && e.message ? e.message : String(e) };
      }
    }, pageName);
  }
}

test.describe('Simple Routing Example - FSM State & Transition Tests', () => {
  // Arrays to collect console and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect unhandled exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });
  });

  test.afterEach(async ({ page }) => {
    // Assert no console errors or page errors occurred during the test interactions
    // This validates that the UI interactions did not cause runtime exceptions.
    expect(consoleErrors, `Console errors were detected: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `Page errors were detected: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Initial load shows Home state (S0_Home) and navigation buttons exist', async ({ page }) => {
    // Validate the initial state on page load: Home content is present
    const router = new RouterPage(page);
    await router.goto();

    // Check page title and that the content contains the Home heading and paragraph
    await expect(page).toHaveTitle(/Simple Routing Example/);

    const heading1 = await router.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading).toContain('Welcome to the Home Page');

    const paragraph = await router.getParagraphText();
    expect(paragraph).toContain('This is the home section of our simple routing demo');

    // Ensure navigation buttons exist and contain the expected onclick attributes
    const homeOnclick = await router.getButtonOnclick(router.selectors.navHome);
    const aboutOnclick = await router.getButtonOnclick(router.selectors.navAbout);
    const contactOnclick = await router.getButtonOnclick(router.selectors.navContact);

    expect(homeOnclick).toContain("navigate('home')");
    expect(aboutOnclick).toContain("navigate('about')");
    expect(contactOnclick).toContain("navigate('contact')");
  });

  test('Transition: Home -> About (S0_Home to S1_About) via NavigateAbout', async ({ page }) => {
    // Validate clicking the About button moves to About state and updates DOM accordingly
    const router1 = new RouterPage(page);
    await router.goto();

    // Click About and verify content updates to About Us
    await router.clickAbout();

    const heading2 = await router.getHeadingText();
    expect(heading).toContain('About Us');

    const paragraph1 = await router.getParagraphText();
    expect(paragraph).toContain('This page contains information about our application');
  });

  test('Transition: Home -> Contact (S0_Home to S2_Contact) via NavigateContact', async ({ page }) => {
    // Validate clicking the Contact button from Home updates to Contact state
    const router2 = new RouterPage(page);
    await router.goto();

    await router.clickContact();

    const heading3 = await router.getHeadingText();
    expect(heading).toContain('Contact Us');

    const paragraph2 = await router.getParagraphText();
    expect(paragraph).toContain('contact@example.com');
  });

  test('Full transition cycle: Home -> About -> Home -> Contact -> Home', async ({ page }) => {
    // Validate multiple sequential transitions as specified in the FSM transitions
    const router3 = new RouterPage(page);
    await router.goto();

    // Home -> About
    await router.clickAbout();
    expect(await router.getHeadingText()).toContain('About Us');

    // About -> Home
    await router.clickHome();
    expect(await router.getHeadingText()).toContain('Welcome to the Home Page');

    // Home -> Contact
    await router.clickContact();
    expect(await router.getHeadingText()).toContain('Contact Us');

    // Contact -> Home
    await router.clickHome();
    expect(await router.getHeadingText()).toContain('Welcome to the Home Page');
  });

  test('Transitions between all pairs: About <-> Contact and About <-> Home and Contact <-> Home', async ({ page }) => {
    // This test exercises all pairs of transitions enumerated in the FSM transitions list.
    const router4 = new RouterPage(page);
    await router.goto();

    // S0(Home) -> S1(About)
    await router.clickAbout();
    expect(await router.getHeadingText()).toContain('About Us');

    // S1(About) -> S2(Contact)
    await router.clickContact();
    expect(await router.getHeadingText()).toContain('Contact Us');

    // S2(Contact) -> S1(About)
    await router.clickAbout();
    expect(await router.getHeadingText()).toContain('About Us');

    // S1(About) -> S0(Home)
    await router.clickHome();
    expect(await router.getHeadingText()).toContain('Welcome to the Home Page');

    // S0(Home) -> S2(Contact)
    await router.clickContact();
    expect(await router.getHeadingText()).toContain('Contact Us');

    // S2(Contact) -> S0(Home)
    await router.clickHome();
    expect(await router.getHeadingText()).toContain('Welcome to the Home Page');
  });

  test('Edge case: clicking the same navigation button repeatedly does not break the app', async ({ page }) => {
    // Repeated clicks on the same state should be idempotent and result in the same DOM state
    const router5 = new RouterPage(page);
    await router.goto();

    // Start at Home -> click Home multiple times
    await router.clickHome();
    await router.clickHome();
    await router.clickHome();
    expect(await router.getHeadingText()).toContain('Welcome to the Home Page');

    // Go to About -> click About multiple times
    await router.clickAbout();
    await router.clickAbout();
    const aboutHeading = await router.getHeadingText();
    expect(aboutHeading).toContain('About Us');

    // Go to Contact -> click Contact multiple times
    await router.clickContact();
    await router.clickContact();
    expect(await router.getHeadingText()).toContain('Contact Us');
  });

  test('Edge case / Error scenario: calling navigate with an unknown page parameter leaves content unchanged', async ({ page }) => {
    // Validate that passing an unexpected parameter to navigate() does not throw and content remains stable
    const router6 = new RouterPage(page);
    await router.goto();

    // Capture current content HTML
    const beforeHTML = await router.getContentHTML();

    // Call navigate with an unknown page string; this should not change the content as per implementation
    const result = await router.callNavigate('unknown_page_123');
    // If navigate is undefined it will return 'navigate_not_defined'; otherwise the function completes.
    // We do not assert result value specifically; we only assert content stability and lack of runtime errors.
    const afterHTML = await router.getContentHTML();

    expect(beforeHTML.trim()).toBe(afterHTML.trim());
  });

  test('Edge case / Error scenario: calling navigate without parameters should not throw and content remains unchanged', async ({ page }) => {
    // Some consumers may call navigate() with no argument; this should be handled gracefully by the page.
    const router7 = new RouterPage(page);
    await router.goto();

    const beforeHTML1 = await router.getContentHTML();

    // Call navigate without parameter
    const result1 = await router.callNavigate();
    const afterHTML1 = await router.getContentHTML();

    expect(beforeHTML.trim()).toBe(afterHTML.trim());
  });

  test('DOM integrity: verify content structure for each state (headings & paragraphs exist)', async ({ page }) => {
    // Ensure that for each logical state the expected DOM elements (h1 and p) are present
    const router8 = new RouterPage(page);
    await router.goto();

    // Home
    expect(await router.page.locator(router.selectors.contentHeading).count()).toBeGreaterThan(0);
    expect(await router.page.locator(router.selectors.contentParagraph).count()).toBeGreaterThan(0);

    // About
    await router.clickAbout();
    expect(await router.page.locator(router.selectors.contentHeading).count()).toBeGreaterThan(0);
    expect(await router.page.locator(router.selectors.contentParagraph).count()).toBeGreaterThan(0);

    // Contact
    await router.clickContact();
    expect(await router.page.locator(router.selectors.contentHeading).count()).toBeGreaterThan(0);
    expect(await router.page.locator(router.selectors.contentParagraph).count()).toBeGreaterThan(0);
  });

  test('Accessibility and interaction: navigation via keyboard (Enter) works for focused buttons', async ({ page }) => {
    // Verify keyboard activation: focus a nav button and press Enter
    const router9 = new RouterPage(page);
    await router.goto();

    // Focus About button and press Enter
    const aboutLocator = page.locator(router.selectors.navAbout);
    await aboutLocator.focus();
    await aboutLocator.press('Enter');
    expect(await router.getHeadingText()).toContain('About Us');

    // Focus Contact button and press Space (another common activation)
    const contactLocator = page.locator(router.selectors.navContact);
    await contactLocator.focus();
    await contactLocator.press(' ');
    // Some browsers treat Space as click; ensure content went to Contact
    expect(await router.getHeadingText()).toContain('Contact Us');
  });
});