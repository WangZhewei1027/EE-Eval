import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3da2f80-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the demo router app
class RouterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.app = page.locator('#app');
    this.navLinks = page.locator('a.link');
    this.homeLink = page.locator('a.link[href="#/"]');
    this.aboutLink = page.locator('a.link[href="#/about"]');
    this.usersLink = page.locator('a.link[href="#/users"]');
    this.user1Nav = page.locator('a.link[href="#/users/1"]');
    this.user2PostsNav = page.locator('a.link[href="#/users/2?tab=posts"]');
    this.nopeLink = page.locator('a.link[href="#/nope"]');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for router to render initial content
    await this.page.waitForLoadState('domcontentloaded');
    // router will ensure there is a hash; wait for app content to show something
    await expect(this.app).toBeVisible();
  }

  async clickNavLink(locator) {
    await locator.click();
  }

  async clickHomeLink() {
    await this.homeLink.click();
  }

  async clickAboutLink() {
    await this.aboutLink.click();
  }

  async clickUsersLink() {
    await this.usersLink.click();
  }

  async clickUser1Nav() {
    await this.user1Nav.click();
  }

  async clickUser2PostsNav() {
    await this.user2PostsNav.click();
  }

  async clickNopeLink() {
    await this.nopeLink.click();
  }

  async getAppText() {
    return this.app.innerText();
  }

  async getAppHtml() {
    return this.app.innerHTML();
  }

  async isLoadingVisible() {
    return await this.page.locator('.loading').isVisible().catch(() => false);
  }

  async waitForLoading() {
    const loading = this.page.locator('.loading');
    await expect(loading).toBeVisible({ timeout: 1000 });
    // then wait for it to disappear
    await expect(loading).toHaveCount(0, { timeout: 3000 }).catch(() => {
      // fallback: wait until not visible
      return expect(loading).not.toBeVisible({ timeout: 3000 });
    });
  }

  async waitForHeading(text, timeout = 3000) {
    const h1 = this.page.locator('main #app h1');
    await expect(h1).toHaveText(text, { timeout });
  }

  async getHash() {
    return this.page.evaluate(() => location.hash);
  }

  async clickButtonWithOnclick(onclickValue) {
    const btn = this.page.locator(`button[onclick="${onclickValue}"]`);
    await expect(btn).toBeVisible();
    await btn.click();
  }
}

test.describe('Routing Demo (Hash-based SPA Router) - end-to-end', () => {
  // Shared capture arrays for console/page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No teardown logic required beyond Playwright's automatic cleanup
    // But ensure arrays are cleared for safety
    consoleErrors = [];
    pageErrors = [];
  });

  test.describe('Initial load and Home state (S0_Home)', () => {
    test('renders Home on initial load and highlights Home link; no uncaught errors', async ({ page }) => {
      // This test validates:
      // - Initial route (hash) is set (#/) if missing
      // - Home content is rendered (<h1>Home</h1>)
      // - Nav "Home" link gets active class
      // - No console.error or uncaught page errors occurred during load
      const rp = new RouterPage(page);
      await rp.goto();

      // Home heading present
      await rp.waitForHeading('Home');

      // Ensure descriptive content and controls exist
      await expect(page.locator('#app button', { hasText: 'Go to About' })).toBeVisible();
      await expect(page.locator('#app button', { hasText: 'See Users' })).toBeVisible();

      // Home nav link should have active class
      await expect(rp.homeLink).toHaveClass(/active/);

      // Assert no runtime console errors or page errors occurred
      expect(consoleErrors.length, `expected no console.error messages, saw: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
      expect(pageErrors.length, `expected no uncaught page errors, saw: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    });
  });

  test.describe('Static routes and navigation (S0 -> S1, S0 -> S2)', () => {
    test('navigates to About page (S1_About) via nav link and renders expected content', async ({ page }) => {
      // Validates NAVIGATE_TO_ABOUT transition and About content
      const rp1 = new RouterPage(page);
      await rp.goto();

      // Click About in sidebar
      await rp.clickAboutLink();

      // Expect About content
      await rp.waitForHeading('About');

      // Active link highlight should be on About
      await expect(rp.aboutLink).toHaveClass(/active/);

      // No console/page errors produced
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('navigates to Users page (S2_Users) via nav link and shows loading then users list', async ({ page }) => {
      // Validates NAVIGATE_TO_USERS transition, loading state, and async rendering
      const rp2 = new RouterPage(page);
      await rp.goto();

      // Click Users
      await rp.clickUsersLink();

      // Immediately a loading indicator should appear
      await expect(page.locator('#app .loading')).toBeVisible();

      // After async load, Users heading should appear
      await rp.waitForHeading('Users', 4000);

      // Ensure sample user names are rendered in the list
      await expect(page.locator('#app ul')).toContainText('Alice');
      await expect(page.locator('#app ul')).toContainText('Bob');

      // Users nav link should be active
      await expect(rp.usersLink).toHaveClass(/active/);

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Parameterized routes and nested views (S2_Users -> S3_UserProfile -> S4_UserPosts)', () => {
    test('navigates to User Profile (S3_UserProfile) and shows nested Profile content', async ({ page }) => {
      // Validates NAVIGATE_TO_USER_PROFILE transition and nested profile rendering
      const rp3 = new RouterPage(page);
      await rp.goto();

      // Ensure we are on Users first so history/back works predictably
      await rp.clickUsersLink();
      await rp.waitForHeading('Users', 4000);

      // Click the nav link for User 1 (can also click in-users list, but nav link is explicit)
      await rp.clickUser1Nav();

      // Loading indicator should show (profile route is async)
      await expect(page.locator('#app .loading')).toBeVisible();

      // Then user name (Alice) should be shown
      await rp.waitForHeading('Alice', 4000);

      // Nested Profile content should contain "Profile" section and ID
      await expect(page.locator('#app section')).toContainText('Profile');
      await expect(page.locator('#app section')).toContainText('ID:');

      // Buttons inside profile should include Profile, Posts, Back (ensures controls rendered)
      await expect(page.locator('button', { hasText: 'Profile' })).toBeVisible();
      await expect(page.locator('button', { hasText: 'Posts' })).toBeVisible();
      await expect(page.locator('button', { hasText: 'Back' })).toBeVisible();

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('from User Profile navigates to Posts tab (S4_UserPosts) and renders posts list', async ({ page }) => {
      // Validates NAVIGATE_TO_USER_POSTS transition and query parsing
      const rp4 = new RouterPage(page);
      await rp.goto();

      // Navigate directly to the user posts nav link
      await rp.clickUser2PostsNav();

      // Loading should show because route is async
      await expect(page.locator('#app .loading')).toBeVisible();

      // Eventually posts heading should appear (name of user is Bob)
      await rp.waitForHeading('Bob', 4000);

      // The nested section should show Posts content
      await expect(page.locator('#app section')).toContainText('Posts');
      await expect(page.locator('#app section ul')).toHaveCount(1);

      // Verify the URL contains the query string we expected
      const hash = await rp.getHash();
      expect(hash).toContain('/users/2');
      expect(hash).toContain('tab=posts');

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Back button inside User Profile uses history.back() to return to Users list', async ({ page }) => {
      // Validates GO_BACK behavior using history.back()
      const rp5 = new RouterPage(page);
      await rp.goto();

      // Navigate: Home -> Users -> User 1
      await rp.clickUsersLink();
      await rp.waitForHeading('Users', 4000);
      await rp.clickUser1Nav();
      await rp.waitForHeading('Alice', 4000);

      // Click "Back" button inside the profile (onclick="history.back()")
      const backBtn = page.locator('#app button', { hasText: 'Back' });
      await expect(backBtn).toBeVisible();
      await backBtn.click();

      // After history.back(), we should be back on Users
      await rp.waitForHeading('Users', 4000);

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('404 fallback and error scenarios (S5_NotFound and user-not-found handling)', () => {
    test('renders 404 Not Found for unknown route (S5_NotFound) and Go Home works', async ({ page }) => {
      // Validates transition to 404 via nav link and GO_HOME action
      const rp6 = new RouterPage(page);
      await rp.goto();

      // Click the 404 example link
      await rp.clickNopeLink();

      // 404 heading should render
      await rp.waitForHeading('404 — Not Found');

      // The 404 UI should present Go Home and Go Back buttons
      const goHomeBtn = page.locator('button[onclick="location.hash=\'#/\'"]');
      const goBackBtn = page.locator('button[onclick="history.back()"]');
      await expect(goHomeBtn).toBeVisible();
      await expect(goBackBtn).toBeVisible();

      // Click Go Home to navigate back to Home
      await goHomeBtn.click();

      // Expect Home again
      await rp.waitForHeading('Home');

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('navigating to a non-existent user shows "User not found" message instead of uncaught error', async ({ page }) => {
      // Validates user-not-found path handling (the route resolves to a "User not found" HTML fragment)
      const rp7 = new RouterPage(page);
      await rp.goto();

      // Programmatic navigation to a user id that does not exist
      await rp.page.evaluate(() => { location.hash = '/users/999'; });

      // Loading should show then the "User not found" content should be present
      await expect(page.locator('#app .loading')).toBeVisible();
      // Wait for the final content to render
      await expect(page.locator('#app')).toContainText('User not found', { timeout: 4000 });

      // Ensure we see a message indicating the missing user id
      await expect(page.locator('#app')).toContainText('No user with id 999');

      // No console/page errors (the app handles this gracefully)
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Go Back on the 404 uses history.back() and returns to prior page when history exists', async ({ page }) => {
      // Validates GO_BACK from 404; ensures history.back() is invoked and returns to previous route
      const rp8 = new RouterPage(page);
      await rp.goto();

      // Navigate Home -> About -> 404
      await rp.clickAboutLink();
      await rp.waitForHeading('About');
      await rp.clickNopeLink();
      await rp.waitForHeading('404 — Not Found');

      // Click the Go Back button in the 404 UI (onclick="history.back()")
      const goBackBtn1 = page.locator('button[onclick="history.back()"]');
      await expect(goBackBtn).toBeVisible();
      await goBackBtn.click();

      // After going back, we should be on About
      await rp.waitForHeading('About', 4000);

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('router does not emit uncaught errors on repeated rapid navigation', async ({ page }) => {
      // Stress test: rapidly click multiple nav links and ensure no uncaught JS errors
      const rp9 = new RouterPage(page);
      await rp.goto();

      // Rapidly navigate: About -> Users -> User 1 -> User 2 posts -> Home
      await Promise.all([
        rp.clickAboutLink(),
        rp.page.waitForTimeout(50),
      ]);
      await Promise.all([
        rp.clickUsersLink(),
        rp.page.waitForTimeout(20),
      ]);
      // Wait a short moment to allow loading indicator to show
      await page.waitForTimeout(50);
      // Click user1 nav quickly
      await rp.clickUser1Nav();
      // Click user2 posts nav quickly
      await rp.clickUser2PostsNav();
      // Finally click Home
      await rp.clickHomeLink();

      // Ensure app eventually stabilizes on Home (heading present)
      await rp.waitForHeading('Home', 5000);

      // Check no uncaught errors or console.error happened during the rapid sequence
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console & page error observation', () => {
    test('there are no unexpected console.error or uncaught exceptions on initial load', async ({ page }) => {
      // This test explicitly verifies that no errors were emitted on page load.
      // It collects console.error and pageerror events in beforeEach and asserts none occurred.
      const rp10 = new RouterPage(page);
      await rp.goto();

      // Additional sanity check: app container should contain at least one heading after load
      await expect(page.locator('#app h1')).toBeVisible();

      // Assert no console.error or pageerror
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});