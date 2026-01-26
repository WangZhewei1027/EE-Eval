import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d317fc0-fa7a-11f0-ba5b-57721b046e74.html';

/**
 * Page Object for the Advanced Routing Demo application.
 * Encapsulates common interactions and queries used across tests.
 */
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      homeBtn: page.locator('#home-btn'),
      productsBtn: page.locator('#products-btn'),
      profileBtn: page.locator('#profile-btn'),
      settingsBtn: page.locator('#settings-btn'),
      customBtn: page.locator('#custom-btn'),
      goCustomBtn: page.locator('#go-custom-btn'),
      customRouteInput: page.locator('#custom-route-input'),

      applyUserIdBtn: page.locator('#apply-user-id'),
      userIdInput: page.locator('#user-id-input'),

      categorySelect: page.locator('#category-select'),
      sortSelect: page.locator('#sort-select'),
      searchInput: page.locator('#search-input'),
      applySearchBtn: page.locator('#apply-search'),
      pageSizeSlider: page.locator('#page-size-slider'),
      pageSizeValue: page.locator('#page-size-value'),
      prevPageBtn: page.locator('#prev-page'),
      nextPageBtn: page.locator('#next-page'),
      pageNumber: page.locator('#page-number'),

      homeAction1: page.locator('#home-action-1'),
      homeAction2: page.locator('#home-action-2'),
      homeContent: page.locator('#home-content'),

      productsView: page.locator('#products-view'),
      productsList: page.locator('#products-list'),
      homeView: page.locator('#home-view'),
      profileView: page.locator('#profile-view'),
      profileContent: page.locator('#profile-content'),
      editProfileBtn: page.locator('#edit-profile'),
      viewOrdersBtn: page.locator('#view-orders'),
      viewSettingsBtn: page.locator('#view-settings'),

      settingsView: page.locator('#settings-view'),
      darkModeCheckbox: page.locator('#dark-mode'),
      notifFrequency: page.locator('#notif-frequency'),
      saveSettingsBtn: page.locator('#save-settings'),
      resetSettingsBtn: page.locator('#reset-settings'),

      customView: page.locator('#custom-view'),
      customContent: page.locator('#custom-content'),

      historyList: page.locator('#history-list'),
      clearHistoryBtn: page.locator('#clear-history'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Navigation helpers
  async navigateToHome() { await this.locators.homeBtn.click(); }
  async navigateToProducts() { await this.locators.productsBtn.click(); }
  async navigateToProfile() { await this.locators.profileBtn.click(); }
  async navigateToSettings() { await this.locators.settingsBtn.click(); }
  async navigateToCustom() { await this.locators.customBtn.click(); }

  // Product param interactions
  async setCategory(value) {
    await this.locators.categorySelect.selectOption(value);
  }

  async setSort(value) {
    await this.locators.sortSelect.selectOption(value);
  }

  async setSearch(query) {
    await this.locators.searchInput.fill(query);
    await this.locators.applySearchBtn.click();
  }

  async setPageSize(value) {
    // set range slider value and dispatch 'input' event to trigger handlers
    await this.page.$eval('#page-size-slider', (el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async clickNextPage() { await this.locators.nextPageBtn.click(); }
  async clickPrevPage() { await this.locators.prevPageBtn.click(); }

  // Home actions
  async loadRecommendations() { await this.locators.homeAction1.click(); }
  async showTutorial() { await this.locators.homeAction2.click(); }

  // Profile interactions
  async applyUserId(id) {
    await this.locators.userIdInput.fill(id);
    await this.locators.applyUserIdBtn.click();
  }

  async clickEditProfile() { await this.locators.editProfileBtn.click(); }
  async clickViewOrders() { await this.locators.viewOrdersBtn.click(); }
  async clickViewSettings() { await this.locators.viewSettingsBtn.click(); }

  // Settings interactions
  async toggleDarkMode(checked) {
    const isChecked = await this.locators.darkModeCheckbox.isChecked();
    if (isChecked !== checked) await this.locators.darkModeCheckbox.click();
  }
  async setNotifFrequency(value) {
    await this.locators.notifFrequency.selectOption(value);
  }
  async saveSettings() { await this.locators.saveSettingsBtn.click(); }
  async resetSettings() { await this.locators.resetSettingsBtn.click(); }

  // Custom route
  async enterCustomRoute(route) {
    await this.locators.customRouteInput.fill(route);
  }
  async goCustom() { await this.locators.goCustomBtn.click(); }

  // History
  async clearHistory() { await this.locators.clearHistoryBtn.click(); }
  async clickHistoryItemAt(index) {
    // Click nth history-item (index based on DOM order)
    const items = await this.page.$$('.history-item');
    if (items.length > index) {
      await items[index].click();
    } else {
      throw new Error('History item index out of bounds');
    }
  }

  // Utility queries
  async activeViewId() {
    // returns id of .view element that has class 'active'
    return await this.page.$eval('.view.active', el => el.id);
  }

  async getHomeContentText() { return this.locators.homeContent.innerText(); }
  async getProductsListText() { return this.locators.productsList.innerText(); }
  async getProfileContentText() { return this.locators.profileContent.innerText(); }
  async getPageNumberText() { return this.locators.pageNumber.innerText(); }
  async getPageSizeValue() { return this.locators.pageSizeValue.innerText(); }
  async getCustomContentText() { return this.locators.customContent.innerText(); }
  async getHistoryItemsCount() { return (await this.page.$$('.history-item')).length; }
  async getHistoryText() {
    const nodes = await this.page.$$('.history-item');
    return Promise.all(nodes.map(n => n.innerText()));
  }
  async isPrevDisabled() { return this.locators.prevPageBtn.isDisabled(); }
}

/**
 * Test suite for the Advanced Routing Demo.
 * Covers all FSM states, transitions, parameters, and edge cases.
 */
test.describe('Advanced Routing Demo - Comprehensive E2E', () => {
  // Collect console messages and page errors to assert runtime health
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including errors)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Auto-accept alerts (the app triggers alert on save settings)
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
  });

  test.describe('Initialization and Console / Error Observability', () => {
    test('loads without fatal console errors and home view is active', async ({ page }) => {
      // Validate initial load, DOM ready, and home view is active
      const app = new AppPage(page);
      await app.goto();

      // Ensure home view is active per FSM S0_Home entry action updateView()
      const activeView = await app.activeViewId();
      expect(activeView).toBe('home-view');

      // No page runtime errors should have occurred during load
      expect(pageErrors).toEqual([]);
      // No console errors (type 'error') expected during normal load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Navigation between views (FSM state transitions)', () => {
    test('navigates Home -> Products and back to Home', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Home -> Products
      await app.navigateToProducts();
      await expect(app.productsView).toHaveClass(/active/);
      expect(await app.activeViewId()).toBe('products-view');

      // Products -> Home
      await app.navigateToHome();
      expect(await app.activeViewId()).toBe('home-view');

      // No runtime page errors occurred during navigation
      expect(pageErrors).toEqual([]);
    });

    test('navigates Home -> Profile -> Settings via profile view', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Home -> Profile
      await app.navigateToProfile();
      expect(await app.activeViewId()).toBe('profile-view');

      // Within profile, click "Account Settings" to navigate to settings
      await app.clickViewSettings();
      expect(await app.activeViewId()).toBe('settings-view');

      // Settings -> Home
      await app.navigateToHome();
      expect(await app.activeViewId()).toBe('home-view');

      expect(pageErrors).toEqual([]);
    });

    test('navigates to Custom Route via button and via Go (with and without input)', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Click custom route button
      await app.navigateToCustom();
      expect(await app.activeViewId()).toBe('custom-view');

      // Enter empty input and click Go -> should not navigate away or crash
      await app.enterCustomRoute('');
      await app.goCustom();
      // Remains on custom view
      expect(await app.activeViewId()).toBe('custom-view');

      // Enter a custom route string and click Go -> triggers navigateTo(route)
      await app.enterCustomRoute('special-route');
      await app.goCustom();

      // Due to implementation, unknown route leads to custom view; ensure custom view remains active
      expect(await app.activeViewId()).toBe('custom-view');

      // Custom content should show 'Custom Route' parameters block
      const customText = await app.getCustomContentText();
      expect(customText.toLowerCase()).toContain('custom route');
      expect(customText.toLowerCase()).toContain('parameters');

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Products view interactions and parameters', () => {
    test('applies category, sort, search, paging and page size changes', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Navigate to products
      await app.navigateToProducts();
      expect(await app.activeViewId()).toBe('products-view');

      // Initially page number should be Page 1 and prev disabled
      expect(await app.getPageNumberText()).toContain('Page 1');
      expect(await app.isPrevDisabled()).toBeTruthy();

      // Change category to electronics and ensure product list contains electronics items
      await app.setCategory('electronics');
      const productsTextAfterCategory = await app.getProductsListText();
      expect(productsTextAfterCategory.length).toBeGreaterThan(0);
      expect(productsTextAfterCategory.toLowerCase()).toContain('laptop');

      // Change sort to price-desc and ensure highest price product appears first
      await app.setSort('price-desc');
      const firstProductHtml = await page.$eval('#products-list > div:first-child h4', el => el.innerText);
      // Highest price product in the mock is 'Laptop' at 999 so it should be first after desc sort
      expect(firstProductHtml.toLowerCase()).toContain('laptop');

      // Set page size smaller via slider and verify displayed page size text updates
      await app.setPageSize(5);
      expect(await app.getPageSizeValue()).toBe('5');

      // Use search to filter to 'smart' (should match 'Smartphone' and 'Smart Watch')
      await app.setSearch('smart');
      const productsTextAfterSearch = await app.getProductsListText();
      expect(productsTextAfterSearch.toLowerCase()).toContain('smartphone');

      // Click next page to change page and ensure page number increments
      const beforePageNumber = await app.getPageNumberText();
      await app.clickNextPage();
      const afterPageNumber = await app.getPageNumberText();
      expect(afterPageNumber).not.toBe(beforePageNumber);

      // Click previous page to go back (if possible)
      await app.clickPrevPage();
      // Page number returns (if prev was enabled) or remains at page 1
      const finalPageNumber = await app.getPageNumberText();
      expect(finalPageNumber).toMatch(/Page \d+/);

      expect(pageErrors).toEqual([]);
    });

    test('prev page does not decrement when on first page (edge case)', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      await app.navigateToProducts();
      // Ensure we are on page 1
      expect(await app.getPageNumberText()).toContain('Page 1');

      // prev button should be disabled; clicking should have no effect
      expect(await app.isPrevDisabled()).toBeTruthy();
      await app.clickPrevPage(); // should be harmless
      expect(await app.getPageNumberText()).toContain('Page 1');

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Home view actions', () => {
    test('loads recommendations and shows tutorial content', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Ensure in home
      expect(await app.activeViewId()).toBe('home-view');

      // Load recommendations
      await app.loadRecommendations();
      const recs = await app.getHomeContentText();
      expect(recs.toLowerCase()).toContain('recommended products loaded');

      // Show tutorial
      await app.showTutorial();
      const tutorial = await app.getHomeContentText();
      expect(tutorial.toLowerCase()).toContain('tutorial: use the navigation buttons');

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Profile view interactions', () => {
    test('apply user id, edit profile, view orders and content updates accordingly', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Go to profile view
      await app.navigateToProfile();
      expect(await app.activeViewId()).toBe('profile-view');

      // Initially overview should show
      let profileText = await app.getProfileContentText();
      expect(profileText.toLowerCase()).toContain('profile overview');

      // Apply a user id and ensure profile content reflects it (updateView is run when on profile)
      await app.applyUserId('42');
      profileText = await app.getProfileContentText();
      expect(profileText).toContain('(42)');

      // Click edit profile and ensure edit form appears
      await app.clickEditProfile();
      profileText = await app.getProfileContentText();
      expect(profileText.toLowerCase()).toContain('edit profile');

      // Click view orders and ensure orders listed
      await app.clickViewOrders();
      profileText = await app.getProfileContentText();
      expect(profileText.toLowerCase()).toContain('order history');

      expect(pageErrors).toEqual([]);
    });

    test('applying empty user id does not override existing user id (edge case)', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Go to profile and set user id to 99
      await app.navigateToProfile();
      await app.applyUserId('99');
      expect((await app.getProfileContentText())).toContain('(99)');

      // Clear input and click apply -> should not change since handler checks if (userId)
      await app.locators.userIdInput.fill('');
      await app.locators.applyUserIdBtn.click();

      // Profile should still display (99)
      expect((await app.getProfileContentText())).toContain('(99)');

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Settings interactions and edge cases', () => {
    test('toggle, change and reset settings; save triggers alert handled by test', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Navigate to settings
      await app.navigateToSettings();
      expect(await app.activeViewId()).toBe('settings-view');

      // Toggle dark mode on and set notification to weekly
      await app.toggleDarkMode(true);
      await app.setNotifFrequency('weekly');

      // Save settings -> triggers alert which we auto-accept in beforeEach
      await app.saveSettings();

      // Reset settings should clear dark mode and set notif to instant
      await app.resetSettings();
      expect(await app.locators.darkModeCheckbox.isChecked()).toBeFalsy();
      expect((await app.locators.notifFrequency.inputValue())).toBe('instant');

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('History and routing history interactions', () => {
    test('history is populated after navigations, clicking history item navigates, and clear history empties', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Perform a series of navigations to populate history
      await app.navigateToProducts();
      await app.navigateToProfile();
      await app.navigateToSettings();
      await app.navigateToHome();
      // Small wait to ensure history rendered
      await page.waitForTimeout(100);

      const countBefore = await app.getHistoryItemsCount();
      expect(countBefore).toBeGreaterThanOrEqual(4);

      // Click the most recent history item (index 0 in DOM is the latest due to reverse)
      const beforeActive = await app.activeViewId();
      await app.clickHistoryItemAt(0);
      // After clicking history item, we expect the app navigated to that route (no crash)
      const afterActive = await app.activeViewId();
      expect(afterActive).toMatch(/(home-view|products-view|profile-view|settings-view|custom-view)/);

      // Clear history and verify list empties
      await app.clearHistory();
      await page.waitForTimeout(50);
      const countAfterClear = await app.getHistoryItemsCount();
      expect(countAfterClear).toBe(0);

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Runtime health - console and page errors during interactions', () => {
    test('no unhandled page errors or console.error messages occur across typical flows', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // perform a representative set of interactions touching all major flows
      await app.navigateToProducts();
      await app.setCategory('books');
      await app.setSort('name-asc');
      await app.setPageSize(10);
      await app.setSearch('history');
      await app.clickNextPage();
      await app.navigateToProfile();
      await app.applyUserId('7');
      await app.clickEditProfile();
      await app.navigateToSettings();
      await app.toggleDarkMode(true);
      await app.resetSettings();
      await app.navigateToHome();
      await app.loadRecommendations();

      // Wait a moment to ensure any async errors surface
      await page.waitForTimeout(100);

      // Assert there are no unhandled page errors
      expect(pageErrors).toEqual([]);

      // Assert there are no console messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors).toEqual([]);
    });
  });

  // Final cleanup: ensure no unexpected runtime errors left
  test.afterEach(async ({ page }) => {
    // Provide additional assertion: ensure global variable `state` exists (sanity check)
    // We don't modify or patch anything; we're just reading as part of validation.
    const hasState = await page.evaluate(() => typeof window.state !== 'undefined');
    expect(hasState).toBeTruthy();
  });
});