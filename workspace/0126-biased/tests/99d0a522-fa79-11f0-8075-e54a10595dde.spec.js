import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0a522-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the SDLC application
class SDLCPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.planInput = page.locator('#plan-input');
    this.savePlanningBtn = page.locator('button[onclick="savePlanning()"]');
    this.startAnalysisBtn = page.locator('button[onclick="startAnalysis()"]');
    this.planningOutput = page.locator('#planning-output');

    this.designInput = page.locator('#design-input');
    this.saveDesignBtn = page.locator('button[onclick="saveDesign()"]');
    this.designOutput = page.locator('#design-output');

    this.developmentSlider = page.locator('#development-slider');
    this.developmentOutput = page.locator('#development-output');
    this.startTestingBtn = page.locator('button[onclick="startTesting()"]');
    this.testingOutput = page.locator('#testing-output');

    this.deployBtn = page.locator('button[onclick="deployProject()"]');
    this.deploymentOutput = page.locator('#deployment-output');

    this.startingElements = [
      this.planInput,
      this.savePlanningBtn,
      this.startAnalysisBtn,
      this.designInput,
      this.saveDesignBtn,
      this.developmentSlider,
      this.startTestingBtn,
      this.deployBtn
    ];
  }

  // Navigate to the app and wait for basic elements
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // ensure main elements are present
    for (const el of this.startingElements) {
      await expect(el).toBeVisible();
    }
  }

  // Interactions
  async savePlanning(text) {
    await this.planInput.fill(text);
    await this.savePlanningBtn.click();
  }

  async startAnalysis() {
    await this.startAnalysisBtn.click();
  }

  async saveDesign(text) {
    await this.designInput.fill(text);
    await this.saveDesignBtn.click();
  }

  // Set the range slider value and dispatch change event so onchange triggers
  async setDevelopmentProgress(value) {
    // Use page.evaluate to set native value and trigger 'change'
    await this.page.evaluate((v) => {
      const slider = document.getElementById('development-slider');
      slider.value = String(v);
      // trigger both input and change for robustness
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  async startTesting() {
    await this.startTestingBtn.click();
  }

  async deployProject() {
    await this.deployBtn.click();
  }

  // Helpers to read outputs
  async getPlanningOutput() {
    return (await this.planningOutput.textContent()) || '';
  }
  async getAnalysisOutput() {
    return (await this.page.locator('#analysis-output').textContent()) || '';
  }
  async getDesignOutput() {
    return (await this.designOutput.textContent()) || '';
  }
  async getDevelopmentOutput() {
    return (await this.developmentOutput.textContent()) || '';
  }
  async getTestingOutput() {
    return (await this.testingOutput.textContent()) || '';
  }
  async getDeploymentOutput() {
    return (await this.deploymentOutput.textContent()) || '';
  }
}

test.describe('SDLC FSM - Application ID 99d0a522-fa79-11f0-8075-e54a10595dde', () => {
  let consoleMessages = [];
  let pageErrors = [];
  let dialogs = [];

  // Capture console and page errors for each test and reset before each
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    page.on('console', (msg) => {
      // store console messages (text + type)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    page.on('dialog', async (dialog) => {
      // capture and accept alerts so tests can continue
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });
  });

  test.afterEach(async () => {
    // Basic assertions to ensure no unexpected runtime errors occurred
    // Tests that expect alerts will assert dialogs separately.
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.map(e => e.text)).toEqual([]); // no console.error expected
    expect(pageErrors).toEqual([]); // no uncaught page errors expected
  });

  test('Initial state "Idle" renders page and does not define renderPage()', async ({ page }) => {
    // Validate that the page loads and initial UI elements are present.
    const app = new SDLCPage(page);
    await app.goto();

    // FSM S0 had an entry action renderPage(), but implementation does not define it.
    // Verify that renderPage is not present on the page (i.e., not called).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Validate all output containers are empty initially
    await expect(app.planningOutput).toHaveText('');
    await expect(page.locator('#analysis-output')).toHaveText('');
    await expect(app.designOutput).toHaveText('');
    await expect(app.developmentOutput).toHaveText('');
    await expect(app.testingOutput).toHaveText('');
    await expect(app.deploymentOutput).toHaveText('');
  });

  test('Save Planning: Idle -> Planning Saved (S0 -> S1)', async ({ page }) => {
    // This test validates the SavePlanning event and S1 entry evidence (planningOutput propagation)
    const app = new SDLCPage(page);
    await app.goto();

    // Save a planning text and verify planning-output updates
    const planningText = 'Define MVP and timelines';
    await app.savePlanning(planningText);

    const planningOutput = await app.getPlanningOutput();
    expect(planningOutput).toBe('Planning saved: ' + planningText);

    // Ensure analysis-output still empty (analysis not started yet)
    expect(await app.getAnalysisOutput()).toBe('');
  });

  test('Start Analysis without saving planning shows alert and stays Idle (guard failure)', async ({ page }) => {
    // This tests the guard on StartAnalysis: if planningOutput == '' -> alert and no transition
    const app = new SDLCPage(page);
    await app.goto();

    // Click Start Analysis without saving planning first
    await app.startAnalysis();

    // A dialog should have been shown and accepted in beforeEach handler
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    // Last dialog message should be the alert about saving planning first
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.type).toBe('alert');
    expect(lastDialog.message).toBe('Please save planning first.');

    // Ensure analysis-output remains empty (no transition to AnalysisStarted)
    expect(await app.getAnalysisOutput()).toBe('');
  });

  test('Analysis proceeds after Save Planning: S1 -> S2', async ({ page }) => {
    // Validate that saving planning then starting analysis sets analysisDone and output
    const app = new SDLCPage(page);
    await app.goto();

    const planningText = 'Collect requirements';
    await app.savePlanning(planningText);

    // Start analysis now that planningOutput exists
    await app.startAnalysis();

    // analysis-output should reflect planningOutput
    const analysisOutput = await app.getAnalysisOutput();
    expect(analysisOutput).toBe('Analysis started based on: ' + planningText);

    // The global variable analysisDone should be true
    const analysisDone = await page.evaluate(() => window.analysisDone);
    expect(analysisDone).toBe(true);
  });

  test('Save Design: S2 -> S3 and UpdateDesign behavior', async ({ page }) => {
    // Validate saving design sets designOutput and shows expected text
    const app = new SDLCPage(page);
    await app.goto();

    // Precondition: create planning and start analysis so we are in S2
    await app.savePlanning('Plan for design test');
    await app.startAnalysis();

    // Save design
    const designText = 'UI mockups and API contracts';
    await app.saveDesign(designText);

    const designOutput = await app.getDesignOutput();
    expect(designOutput).toBe('Design saved: ' + designText);

    // Also verify global designOutput variable is set
    const globalDesignOutput = await page.evaluate(() => window.designOutput);
    expect(globalDesignOutput).toBe(designText);
  });

  test('Development progress update: S3 -> S4 (edge values)', async ({ page }) => {
    // Validate that updateProgress updates developmentProgress and DOM text
    const app = new SDLCPage(page);
    await app.goto();

    // Move to S3 by saving planning, analysis, and design
    await app.savePlanning('Plan for progress test');
    await app.startAnalysis();
    await app.saveDesign('Design for progress test');

    // Set development progress to 50 and verify
    await app.setDevelopmentProgress(50);
    let devOutput = await app.getDevelopmentOutput();
    expect(devOutput).toBe('Development progress: 50%');

    // Now set to 100 and verify full progress
    await app.setDevelopmentProgress(100);
    devOutput = await app.getDevelopmentOutput();
    expect(devOutput).toBe('Development progress: 100%');

    // Verify global developmentProgress value (note: value may be string '100')
    const devProgressGlobal = await page.evaluate(() => window.developmentProgress);
    // Accept either numeric 100 or string '100'
    expect(devProgressGlobal == 100).toBe(true);
  });

  test('Start Testing guard: fails when progress != 100', async ({ page }) => {
    // Validate that starting testing when developmentProgress != 100 shows alert and no transition
    const app = new SDLCPage(page);
    await app.goto();

    // Precondition: save planning, analysis, design and set progress to 80
    await app.savePlanning('Plan to test testing-guard');
    await app.startAnalysis();
    await app.saveDesign('Design to test testing-guard');
    await app.setDevelopmentProgress(80);

    // Try to start testing
    await app.startTesting();

    // Expect an alert explaining development must be 100%
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const last = dialogs[dialogs.length - 1];
    expect(last.type).toBe('alert');
    expect(last.message).toBe('Development must be 100% complete before testing.');

    // testing-output should remain empty
    expect(await app.getTestingOutput()).toBe('');
  });

  test('Full successful flow from Planning -> Deployment (S0 -> S6)', async ({ page }) => {
    // This test validates the complete happy path covering all transitions and final state evidence
    const app = new SDLCPage(page);
    await app.goto();

    // 1) Save Planning (S0 -> S1)
    const planningText = 'Full project plan';
    await app.savePlanning(planningText);
    expect(await app.getPlanningOutput()).toBe('Planning saved: ' + planningText);

    // 2) Start Analysis (S1 -> S2)
    await app.startAnalysis();
    expect(await app.getAnalysisOutput()).toBe('Analysis started based on: ' + planningText);

    // 3) Save Design (S2 -> S3)
    const designText = 'Complete design specs';
    await app.saveDesign(designText);
    expect(await app.getDesignOutput()).toBe('Design saved: ' + designText);

    // 4) Update Progress to 100 (S3 -> S4)
    await app.setDevelopmentProgress(100);
    expect(await app.getDevelopmentOutput()).toBe('Development progress: 100%');

    // 5) Start Testing (S4 -> S5) - should proceed because progress == 100
    await app.startTesting();
    expect(await app.getTestingOutput()).toBe('Testing started on completed development.');

    // 6) Deploy Project (S5 -> S6) - should succeed because analysisDone, designOutput, progress==100
    await app.deployProject();
    expect(await app.getDeploymentOutput()).toBe('Project deployed successfully!');

    // Additional verification of global variables used in guards
    const globals = await page.evaluate(() => {
      return {
        analysisDone: window.analysisDone,
        designOutput: window.designOutput,
        developmentProgress: window.developmentProgress
      };
    });
    expect(globals.analysisDone).toBe(true);
    expect(globals.designOutput).toBe(designText);
    expect(globals.developmentProgress == 100).toBe(true);
  });

  test('DeployProject guard failure when prerequisites missing shows alert', async ({ page }) => {
    // Validate that deployProject shows an alert when prior phases are incomplete
    const app = new SDLCPage(page);
    await app.goto();

    // Do not run analysis or set progress; attempt to deploy directly
    await app.deployProject();

    // Expect alert about ensuring prior phases are completed
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const last = dialogs[dialogs.length - 1];
    expect(last.type).toBe('alert');
    expect(last.message).toBe('Ensure all prior phases are completed correctly.');

    // deployment-output should remain empty
    expect(await app.getDeploymentOutput()).toBe('');
  });

  test('Edge case: Save empty planning then StartAnalysis triggers guard (empty string truthiness)', async ({ page }) => {
    // Save an empty planning string and verify that analysis guard still blocks (empty string is falsy)
    const app = new SDLCPage(page);
    await app.goto();

    // Save empty planning
    await app.savePlanning('');
    expect(await app.getPlanningOutput()).toBe('Planning saved: ');

    // Try to start analysis -> should alert
    await app.startAnalysis();

    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const last = dialogs[dialogs.length - 1];
    expect(last.message).toBe('Please save planning first.');

    // Ensure analysis-output remains empty
    expect(await app.getAnalysisOutput()).toBe('');
  });
});