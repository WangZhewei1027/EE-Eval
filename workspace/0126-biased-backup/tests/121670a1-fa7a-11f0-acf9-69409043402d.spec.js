import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121670a1-fa7a-11f0-acf9-69409043402d.html';

// Page Object to encapsulate interactions with the Routing Demo UI
class RouterPage {
  constructor(page) {
    this.page = page;
    // selectors used across tests
    this.selectors = {
      currentPath: '#current-path',
      currentParams: '#current-params',
      currentQuery: '#current-query',
      inputRoute: '#input-route',
      inputParams: '#input-params',
      inputQuery: '#input-query',
      btnNavigate: '#btn-navigate',
      btnApplyParams: '#btn-apply-params',
      btnApplyQuery: '#btn-apply-query',
      tokenSelect: '#token-select',
      tokenValue: '#token-value',
      btnUpdateToken: '#btn-update-token',
      btnRemoveToken: '#btn-remove-token',
      queryKey: '#query-key',
      queryValue: '#query-value',
      btnAddQuery: '#btn-add-query',
      btnRemoveQuery: '#btn-remove-query',
      btnBack: '#btn-back',
      btnForward: '#btn-forward',
      btnReset: '#btn-reset',
      historyLog: '#history-log',
      historyIndex: '#history-index',
      btnJumpHistory: '#btn-jump-history',
      workflowSelectStep: '#workflow-select-step',
      btnGoStep: '#btn-go-step',
      btnNextStep: '#btn-next-step',
      btnPrevStep: '#btn-prev-step',
      branchName: '#branch-name',
      btnNewBranch: '#btn-new-branch',
      btnSwitchBranch: '#btn-switch-branch',
      btnShowBranches: '#btn-show-branches',
      branchesList: '#branches-list',
    };
  }

  async navigate(route, paramsJson = '', query = '') {
    const p = this.page;
    if (route !== undefined) {
      await p.fill(this.selectors.inputRoute, route);
    }
    if (paramsJson !== undefined) {
      await p.fill(this.selectors.inputParams, paramsJson);
    }
    if (query !== undefined) {
      await p.fill(this.selectors.inputQuery, query);
    }
    await p.click(this.selectors.btnNavigate);
  }

  async applyParams(paramsJson) {
    await this.page.fill(this.selectors.inputParams, paramsJson);
    await this.page.click(this.selectors.btnApplyParams);
  }

  async applyQuery(queryString) {
    await this.page.fill(this.selectors.inputQuery, queryString);
    await this.page.click(this.selectors.btnApplyQuery);
  }

  async updateToken(tokenValue, newVal) {
    // set select and token value, then click update
    await this.page.selectOption(this.selectors.tokenSelect, tokenValue);
    await this.page.fill(this.selectors.tokenValue, newVal);
    await this.page.click(this.selectors.btnUpdateToken);
  }

  async removeToken(tokenValue) {
    await this.page.selectOption(this.selectors.tokenSelect, tokenValue);
    await this.page.click(this.selectors.btnRemoveToken);
  }

  async addQueryParam(key, value) {
    await this.page.fill(this.selectors.queryKey, key);
    await this.page.fill(this.selectors.queryValue, value);
    await this.page.click(this.selectors.btnAddQuery);
  }

  async removeQueryParam(key) {
    await this.page.fill(this.selectors.queryKey, key);
    await this.page.click(this.selectors.btnRemoveQuery);
  }

  async back() {
    await this.page.click(this.selectors.btnBack);
  }

  async forward() {
    await this.page.click(this.selectors.btnForward);
  }

  async reset() {
    await this.page.click(this.selectors.btnReset);
  }

  async jumpHistory(index) {
    await this.page.fill(this.selectors.historyIndex, String(index));
    await this.page.click(this.selectors.btnJumpHistory);
  }

  async goToStep(index) {
    await this.page.selectOption(this.selectors.workflowSelectStep, String(index));
    await this.page.click(this.selectors.btnGoStep);
  }

  async nextStep() {
    await this.page.click(this.selectors.btnNextStep);
  }

  async prevStep() {
    await this.page.click(this.selectors.btnPrevStep);
  }

  async createBranch(branchName) {
    await this.page.fill(this.selectors.branchName, branchName);
    await this.page.click(this.selectors.btnNewBranch);
  }

  async switchBranch(branchName) {
    await this.page.fill(this.selectors.branchName, branchName);
    await this.page.click(this.selectors.btnSwitchBranch);
  }

  async showBranches() {
    // This triggers an alert dialog
    await this.page.click(this.selectors.btnShowBranches);
  }

  // Read UI state helpers
  async getCurrentPath() {
    return (await this.page.$eval(this.selectors.currentPath, el => el.value)).trim();
  }
  async getCurrentParams() {
    return (await this.page.$eval(this.selectors.currentParams, el => el.value)).trim();
  }
  async getCurrentQuery() {
    return (await this.page.$eval(this.selectors.currentQuery, el => el.value)).trim();
  }
  async getHistoryLog() {
    return (await this.page.$eval(this.selectors.historyLog, el => el.value)).trim();
  }
  async getBranchesList() {
    return (await this.page.$eval(this.selectors.branchesList, el => el.textContent)).trim();
  }
  async getTokenOptions() {
    return this.page.$$eval(`${this.selectors.tokenSelect} option`, opts => opts.map(o => ({ value: o.value, text: o.textContent })));
  }
  async getWorkflowOptions() {
    return this.page.$$eval(`${this.selectors.workflowSelectStep} option`, opts => opts.map(o => ({ value: o.value, text: o.textContent })));
  }
}

test.describe('Interactive Routing Demo - FSM validation', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture page errors and console errors for assertions later
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    // Ensure app had a chance to initialize
    await page.waitForSelector('#current-path');
  });

  test.afterEach(async () => {
    // Assert there were no unexpected runtime errors (ReferenceError, SyntaxError, TypeError) emitted to the page
    // The application should run without throwing page-level exceptions.
    expect(pageErrors.length, `Expected no page runtime errors, got: ${pageErrors.map(e => e.message || String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, got: ${consoleErrors.join('; ')}`).toBe(0);
  });

  // Basic navigation and S0 -> S1 transition
  test('S0 Home -> S1 Navigated: Navigate to a new route updates current path, params, query and history', async ({ page }) => {
    const app = new RouterPage(page);

    // Verify initial state S0 (Home) after app init
    const initialPath = await app.getCurrentPath();
    expect(initialPath).toBe('/home', 'Initial path should be /home after Router.init()');
    const historyLogInitial = await app.getHistoryLog();
    expect(historyLogInitial).toContain('[0] /home', 'History should contain initial /home entry');

    // Perform navigation with template + params + query -> S1_Navigated
    await app.navigate('/users/:userId/posts/:postId', '{"userId":"123","postId":"456"}', '?tab=summary&page=2');

    // Validate current path includes param replacements and query string
    const pathAfterNav = await app.getCurrentPath();
    expect(pathAfterNav.startsWith('/users/123/posts/456')).toBeTruthy();
    expect(pathAfterNav).toContain('tab=summary');
    expect(pathAfterNav).toContain('page=2');

    // Validate params and query UI areas show expected JSON
    const paramsText = await app.getCurrentParams();
    expect(paramsText).toContain('"userId": "123"');
    expect(paramsText).toContain('"postId": "456"');

    const queryText = await app.getCurrentQuery();
    expect(queryText).toContain('"tab": "summary"');
    expect(queryText).toContain('"page": "2"');

    // Validate history advanced and most recent entry marked (the UI uses '>' marker)
    const historyLog = await app.getHistoryLog();
    expect(historyLog).toMatch(/\> \[\d+\] \/users\/123\/posts\/456\?/);
  });

  test.describe('Parameters and Query operations', () => {
    test('S1 -> S2 Apply Params: Applying route parameters updates route and history', async ({ page }) => {
      const app = new RouterPage(page);

      // Start by navigating to a template route
      await app.navigate('/items/:itemId', '{"itemId":"10"}', '');
      const path1 = await app.getCurrentPath();
      expect(path1).toContain('/items/10');

      // Apply new params (S2_ParamsApplied)
      await app.applyParams('{"itemId":"99"}');
      const path2 = await app.getCurrentPath();
      expect(path2).toContain('/items/99');

      const params = await app.getCurrentParams();
      expect(params).toContain('"itemId": "99"');

      // History should have additional entry
      const historyLog = await app.getHistoryLog();
      const lines = historyLog.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });

    test('S1 -> S3 Apply Query: Applying query parameters updates query and path', async ({ page }) => {
      const app = new RouterPage(page);

      // Navigate to simple route
      await app.navigate('/search', '{}', '');
      let path = await app.getCurrentPath();
      expect(path).toBe('/search');

      // Apply query '?q=test&sort=asc' (S3_QueryApplied)
      await app.applyQuery('?q=test&sort=asc');
      path = await app.getCurrentPath();
      expect(path.startsWith('/search')).toBeTruthy();
      expect(path).toContain('q=test');
      expect(path).toContain('sort=asc');

      const query = await app.getCurrentQuery();
      expect(query).toContain('"q": "test"');
      expect(query).toContain('"sort": "asc"');
    });
  });

  test.describe('Token manipulation (S4, S5)', () => {
    test('S1 -> S4 Update Token: token-select is populated and updating token modifies params and path', async ({ page }) => {
      const app = new RouterPage(page);

      // Navigate with tokens in template
      await app.navigate('/users/:userId/posts/:postId', '{"userId":"1","postId":"2"}', '');
      // token-select should list tokens
      const tokenOptions = await app.getTokenOptions();
      const optionValues = tokenOptions.map(o => o.value);
      expect(optionValues).toEqual(expect.arrayContaining(['userId', 'postId']));

      // Update userId token to new value
      await app.updateToken('userId', '321');
      const params = await app.getCurrentParams();
      expect(params).toContain('"userId": "321"');

      const path = await app.getCurrentPath();
      expect(path).toContain('/users/321/');
    });

    test('S1 -> S5 Remove Token: removing a token removes it from params and updates path', async ({ page }) => {
      const app = new RouterPage(page);

      // Navigate to route with tokens
      await app.navigate('/orders/:orderId/items/:itemId', '{"orderId":"500","itemId":"7"}', '');
      let params = await app.getCurrentParams();
      expect(params).toContain('"orderId": "500"');
      expect(params).toContain('"itemId": "7"');

      // Remove itemId token (S5_TokenRemoved)
      await app.removeToken('itemId');

      // After removal, current params should not include itemId
      params = await app.getCurrentParams();
      expect(params).not.toContain('"itemId":');

      // Path should include ':itemId' placeholder or omit last segment depending on implementation
      const path = await app.getCurrentPath();
      // ensure order and correctness: itemId removed so path should not contain '/7'
      expect(path).not.toContain('/7');
    });
  });

  test.describe('Query param operations (S6, S7)', () => {
    test('S1 -> S6 Add Query Param: add/update query parameter via controls updates path and query JSON', async ({ page }) => {
      const app = new RouterPage(page);

      await app.navigate('/products', '{}', '?category=tools');
      let query = await app.getCurrentQuery();
      expect(query).toContain('"category": "tools"');

      // Add a new query param newKey=newVal
      await app.addQueryParam('newKey', 'newVal');
      const path = await app.getCurrentPath();
      expect(path).toContain('newKey=newVal');

      query = await app.getCurrentQuery();
      expect(query).toContain('"newKey": "newVal"');
    });

    test('S1 -> S7 Remove Query Param: removing an existing query parameter updates query and path', async ({ page }) => {
      const app = new RouterPage(page);

      await app.navigate('/products', '{}', '?a=1&b=2');
      let query = await app.getCurrentQuery();
      expect(query).toContain('"a": "1"');
      expect(query).toContain('"b": "2"');

      // Remove 'a'
      await app.removeQueryParam('a');

      query = await app.getCurrentQuery();
      expect(query).not.toContain('"a": "1"');

      const path = await app.getCurrentPath();
      expect(path).not.toContain('a=1');
    });
  });

  test.describe('History management (S8, S9, S10, S11)', () => {
    test('S1 -> S8 Back and S9 Forward: back and forward navigate history correctly', async ({ page }) => {
      const app = new RouterPage(page);

      // Build history with a few navigations
      await app.reset(); // start clean
      await app.navigate('/page1', '{}', '');
      await app.navigate('/page2', '{}', '');
      await app.navigate('/page3', '{}', '');

      const pathBefore = await app.getCurrentPath();
      expect(pathBefore).toContain('/page3');

      // Go back (S8_HistoryBack)
      await app.back();
      const pathAfterBack = await app.getCurrentPath();
      expect(pathAfterBack).toContain('/page2');

      // Go forward (S9_HistoryForward)
      await app.forward();
      const pathAfterForward = await app.getCurrentPath();
      expect(pathAfterForward).toContain('/page3');
    });

    test('S1 -> S10 Reset Router: reset restores initial state and clears workflow/history', async ({ page }) => {
      const app = new RouterPage(page);

      await app.navigate('/somewhere', '{"x":"1"}', '?z=9');
      const pathBeforeReset = await app.getCurrentPath();
      expect(pathBeforeReset).toContain('/somewhere');

      // Reset
      await app.reset();

      const pathAfterReset = await app.getCurrentPath();
      expect(pathAfterReset).toBe('/home');

      const historyLog = await app.getHistoryLog();
      // After reset the implementation pushes a new history with only /home
      expect(historyLog).toContain('[0] /home');
    });

    test('S1 -> S11 Jump History: jumping to a specific history index navigates to that entry', async ({ page }) => {
      const app = new RouterPage(page);

      await app.reset();
      await app.navigate('/alpha', '{}', '');
      await app.navigate('/beta', '{}', '');
      await app.navigate('/gamma', '{}', '');

      // Jump to index 1 (should be /alpha, with index starting at 0 = /home)
      // Determine mapping by reading history log for available indices
      const historyLog = await app.getHistoryLog();
      const lines = historyLog.split('\n');
      // find an index that is not the last one - choose 1 if exists
      const targetIndex = Math.min(1, Math.max(0, lines.length - 1));
      await app.jumpHistory(targetIndex);

      // After jump, ensure history marker points to the chosen index
      const updatedHistory = await app.getHistoryLog();
      // Ensure the chosen index line is marked with '>'
      const expectedPattern = new RegExp(`\\> \\[${targetIndex}\\]`);
      expect(updatedHistory).toMatch(expectedPattern);
    });
  });

  test.describe('Workflow steps and branching (S12..S16)', () => {
    test('S12 Workflow step change and S13/S14 Next/Prev step behavior', async ({ page }) => {
      const app = new RouterPage(page);

      await app.reset();
      // Create a sequence of route states that will become workflow steps
      await app.navigate('/wf/step1', '{"a":"1"}', '');
      await app.navigate('/wf/step2', '{"a":"2"}', '');
      await app.navigate('/wf/step3', '{"a":"3"}', '');

      // The workflow select should now have entries for each step
      const workflowOptions = await app.getWorkflowOptions();
      // First option is placeholder; subsequent should correspond to steps
      expect(workflowOptions.length).toBeGreaterThanOrEqual(2);

      // Go to step 0 (S12_WorkflowStepChanged)
      await app.goToStep(0);
      let currentPath = await app.getCurrentPath();
      expect(currentPath).toContain('/wf/step1');

      // Next step (S13_WorkflowNextStep)
      await app.nextStep();
      currentPath = await app.getCurrentPath();
      expect(currentPath).toContain('/wf/step2');

      // Prev step (S14_WorkflowPrevStep)
      await app.prevStep();
      currentPath = await app.getCurrentPath();
      expect(currentPath).toContain('/wf/step1');
    });

    test('S15 Branch created and S16 Branch switched: branch operations update workflow and branches list', async ({ page }) => {
      const app = new RouterPage(page);

      await app.reset();
      // Create a couple of steps
      await app.navigate('/branch/one', '{"n":"1"}', '');
      await app.navigate('/branch/two', '{"n":"2"}', '');

      // Create a new branch from current step
      const branchName = 'featureX';
      await app.createBranch(branchName);

      // After creation, the branches list should indicate current branch
      const branchesText = await app.getBranchesList();
      expect(branchesText).toContain(branchName);
      // The implementation marks current branch with '*' next to its name
      expect(branchesText).toMatch(/\*/);

      // Now create another branch and then switch to the original 'main' branch
      const branchName2 = 'experiment';
      await app.createBranch(branchName2);

      // Switch back to 'main' branch (S16_WorkflowSwitchBranch)
      await app.switchBranch('main');
      const branchesAfterSwitch = await app.getBranchesList();
      // Ensure main exists and may or may not be current depending on prior ops; ensure function call does not throw
      expect(branchesAfterSwitch).toContain('main');
    });

    test('Show Branches triggers an alert dialog listing branches (ShowBranches event)', async ({ page }) => {
      const app = new RouterPage(page);

      // Ensure at least one branch exists
      await app.reset();
      // Setup dialog listener to assert content
      page.on('dialog', async dialog => {
        try {
          const msg = dialog.message();
          expect(msg).toMatch(/Branches:/);
        } finally {
          await dialog.dismiss();
        }
      });

      // Trigger show branches - should open an alert
      await app.showBranches();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Malformed params JSON does not update params (safeJsonParse) and does not throw', async ({ page }) => {
      const app = new RouterPage(page);

      await app.reset();
      await app.navigate('/edge', '{}', '');
      const paramsBefore = await app.getCurrentParams();

      // Provide malformed JSON to Apply Params (e.g. missing closing brace)
      await app.applyParams('{"badJson": 1'); // intentionally malformed

      // The Router.safeJsonParse should return null and updateParams should not be called
      // So params should remain unchanged
      const paramsAfter = await app.getCurrentParams();
      expect(paramsAfter).toBe(paramsBefore);
    });

    test('Jumping to invalid history index does nothing and does not throw', async ({ page }) => {
      const app = new RouterPage(page);

      await app.reset();
      await app.navigate('/one', '{}', '');
      await app.navigate('/two', '{}', '');

      // Capture current path
      const before = await app.getCurrentPath();

      // Try to jump to an out-of-range index (e.g., 999)
      await app.jumpHistory(999);

      // Path should remain unchanged
      const after = await app.getCurrentPath();
      expect(after).toBe(before);
    });

    test('Updating/removing non-existent token when no tokens available is handled gracefully', async ({ page }) => {
      const app = new RouterPage(page);

      // Reset to /home which has no tokens
      await app.reset();

      // Token select should be disabled and show '--No tokens--'
      const tokenOptions = await app.getTokenOptions();
      expect(tokenOptions.length).toBeGreaterThanOrEqual(1);
      expect(tokenOptions[0].text).toContain('--No tokens--');

      // Attempt to update a token (empty value). Buttons are guarded and should not cause errors.
      await page.click('#btn-update-token');
      await page.click('#btn-remove-token');

      // No runtime errors should have been thrown (checked in afterEach)
      // Ensure path still points to /home
      const path = await app.getCurrentPath();
      expect(path).toBe('/home');
    });
  });
});