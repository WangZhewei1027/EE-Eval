import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d31cde1-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object encapsulating common operations on the SDLC page
class SDLCPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.methodologySelect = page.locator('#methodology');
    this.initButton = page.locator('button[onclick="initSDLC()"]');
    this.sdlcContainer = page.locator('#sdlcContainer');
    this.currentPhase = page.locator('#currentPhase');
    this.phasesContainer = page.locator('#phases');
    this.phaseElements = page.locator('.phase');
    this.previousButton = page.locator('button[onclick="previousPhase()"]');
    this.nextButton = page.locator('button[onclick="nextPhase()"]');
    this.showAllButton = page.locator('button[onclick="showAllPhases()"]');
    this.customizeButton = page.locator('button[onclick="customizePhase()"]');
    this.simulateButton = page.locator('button[onclick="simulateWork()"]');
    this.introduceBugButton = page.locator('button[onclick="introduceBug()"]');
    this.resolveBugButton = page.locator('button[onclick="resolveBug()"]');
    this.teamSizeInput = page.locator('input[type="range"]#teamSize');
    this.teamSizeValue = page.locator('#teamSizeValue');
    this.workflow = page.locator('#workflow');
    this.artifactType = page.locator('#artifactType');
    this.generateArtifactButton = page.locator('button[onclick="generateArtifact()"]');
    this.artifactsContainer = page.locator('#artifacts');
    this.bugCount = page.locator('#bugCount');
    this.artifactCount = page.locator('#artifactCount');
    this.progress = page.locator('#progress');
    this.progressValue = page.locator('#progressValue');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the document to be ready
    await this.page.waitForLoadState('domcontentloaded');
  }

  async initialize(method = 'waterfall') {
    await this.methodologySelect.selectOption(method);
    await this.initButton.click();
    // Wait for container to be visible and phases to be rendered
    await expect(this.sdlcContainer).toBeVisible();
    await this.page.waitForSelector('.phase', { state: 'attached' });
    // Some updates log workflow entry; wait briefly for DOM updates
    await this.page.waitForTimeout(50);
  }

  async getCurrentPhaseText() {
    return (await this.currentPhase.textContent())?.trim() ?? '';
  }

  async countPhasesRendered() {
    return await this.phaseElements.count();
  }

  async clickNext() {
    await this.nextButton.click();
    await this.page.waitForTimeout(30);
  }

  async clickPrevious() {
    await this.previousButton.click();
    await this.page.waitForTimeout(30);
  }

  async clickShowAll() {
    await this.showAllButton.click();
    await this.page.waitForTimeout(30);
  }

  async clickCustomizeAndAccept(customText) {
    // Prepare to accept the prompt
    this.page.once('dialog', async (dialog) => {
      await dialog.accept(customText);
    });
    await this.customizeButton.click();
    await this.page.waitForTimeout(50);
  }

  async simulateWork() {
    await this.simulateButton.click();
    await this.page.waitForTimeout(50);
  }

  async introduceBug() {
    await this.introduceBugButton.click();
    await this.page.waitForTimeout(30);
  }

  async resolveBug() {
    await this.resolveBugButton.click();
    await this.page.waitForTimeout(30);
  }

  async setTeamSize(value) {
    // set input value via evaluate to ensure the change event fires consistently
    await this.page.evaluate((v) => {
      const el = document.getElementById('teamSize');
      el.value = v;
      // Manually dispatch 'change' event to simulate user interaction
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
    await this.page.waitForTimeout(50);
  }

  async selectArtifactType(typeValue) {
    await this.artifactType.selectOption(typeValue);
    await this.page.waitForTimeout(30);
  }

  async generateArtifact() {
    await this.generateArtifactButton.click();
    await this.page.waitForTimeout(60);
  }

  async getBugCount() {
    const text = (await this.bugCount.textContent()) ?? '0';
    return parseInt(text.trim(), 10);
  }

  async getArtifactCount() {
    const text = (await this.artifactCount.textContent()) ?? '0';
    return parseInt(text.trim(), 10);
  }

  async getProgressValueNumber() {
    // progress element's "value" attribute is numeric
    const value = await this.page.evaluate(() => {
      const p = document.getElementById('progress');
      return p ? Number(p.value) : NaN;
    });
    return value;
  }

  async getWorkflowEntriesText() {
    return await this.page.$$eval('#workflow > div', nodes => nodes.map(n => n.textContent || '').filter(Boolean));
  }

  async getVisiblePhasesCount() {
    return await this.page.$$eval('.phase', nodes => nodes.filter(n => window.getComputedStyle(n).display !== 'none').length);
  }

  async artifactElementsCount() {
    return await this.page.$$eval('#artifacts .artifact', nodes => nodes.length);
  }

  async waitForWorkflowMessageIncludes(substring, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const entries = await this.getWorkflowEntriesText();
      if (entries.some(e => e.includes(substring))) return true;
      await this.page.waitForTimeout(50);
    }
    return false;
  }
}

test.describe('Interactive SDLC Explorer - FSM tests', () => {
  // Collect console messages and page errors for assertions and debugging
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    page.on('console', msg => {
      // Capture console messages (info/debug logs)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // Capture runtime errors thrown in the page
      pageErrors.push(err);
    });
  });

  // Test S0 -> S1 initialization and entry actions
  test('S0 -> S1 Initialize SDLC: renders phases, shows container, updates current phase', async ({ page }) => {
    const sd = new SDLCPage(page);
    await sd.goto();

    // Before initialization, sdlcContainer should be hidden
    await expect(sd.sdlcContainer).toHaveClass(/hidden/);

    // Initialize the SDLC (should trigger renderPhases and updateCurrentPhase)
    await sd.initialize('waterfall');

    // After initialization, container visible
    await expect(sd.sdlcContainer).toBeVisible();

    // Current phase should equal the first waterfall phase
    const current = await sd.getCurrentPhaseText();
    expect(current).toBe('Requirements');

    // Number of rendered phase elements should match methodology length
    const count = await sd.countPhasesRendered();
    expect(count).toBe(5); // waterfall has 5 phases

    // The workflow should have an initialization entry
    const hasInitLog = await sd.waitForWorkflowMessageIncludes('Initialized waterfall SDLC');
    expect(hasInitLog).toBe(true);

    // No runtime page errors during initialization
    expect(pageErrors.length).toBe(0);
  });

  // Test phase navigation transitions S2: NextPhase, PreviousPhase, ShowAllPhases
  test('S2 Phase Navigation: next, previous, and show all phases work and update DOM & workflow', async ({ page }) => {
    const sd = new SDLCPage(page);
    await sd.goto();
    await sd.initialize('agile');

    // Save initial phase
    const initial = await sd.getCurrentPhaseText();
    expect(initial).toBe('Sprint Planning');

    // Click NextPhase -> should move to 'Development'
    await sd.clickNext();
    const afterNext = await sd.getCurrentPhaseText();
    expect(afterNext).toBe('Development');

    // Workflow log should reflect the movement
    expect(await sd.waitForWorkflowMessageIncludes('Moved to Development phase')).toBe(true);

    // Click PreviousPhase -> should return to 'Sprint Planning'
    await sd.clickPrevious();
    const afterPrev = await sd.getCurrentPhaseText();
    expect(afterPrev).toBe('Sprint Planning');
    expect(await sd.waitForWorkflowMessageIncludes('Returned to Sprint Planning phase')).toBe(true);

    // Show all phases -> all .phase elements should be visible
    await sd.clickShowAll();
    const visibleCount = await sd.getVisiblePhasesCount();
    expect(visibleCount).toBe(5); // agile has 5 phases
    expect(await sd.waitForWorkflowMessageIncludes('Showing all phases simultaneously')).toBe(true);

    // No runtime page errors during navigation
    expect(pageErrors.length).toBe(0);
  });

  // Test workflow simulation and bug handling S3
  test('S3 Workflow Simulation: simulate work increases progress, introduce/resolve bug updates metrics', async ({ page }) => {
    const sd = new SDLCPage(page);
    await sd.goto();
    await sd.initialize('spiral');

    // Ensure starting bug count is zero
    expect(await sd.getBugCount()).toBe(0);

    // Edge case: resolving when bugs = 0 should not decrement below 0
    await sd.resolveBug();
    expect(await sd.getBugCount()).toBe(0);
    // There should be no "Bug resolved!" log when there were no bugs introduced
    const entries1 = await sd.getWorkflowEntriesText();
    const hasResolveWhenZero = entries1.some(e => e.includes('Bug resolved!'));
    expect(hasResolveWhenZero).toBe(false);

    // Change team size to 4 and validate UI update and workflow log
    await sd.setTeamSize(4);
    await expect(sd.teamSizeValue).toHaveText('4');
    expect(await sd.waitForWorkflowMessageIncludes('Team size changed to 4')).toBe(true);

    // Record progress before simulation
    const beforeProgress = await sd.getProgressValueNumber();

    // Simulate work: progress should increase by 5 * teamSize (4 -> +20), but capped at 100
    await sd.simulateWork();
    const afterProgress = await sd.getProgressValueNumber();
    expect(afterProgress).toBeGreaterThanOrEqual(beforeProgress);
    // At least some progress should have been added
    expect(afterProgress - beforeProgress).toBeGreaterThanOrEqual(5);

    // Introduce a bug and verify bug count and workflow log
    await sd.introduceBug();
    expect(await sd.getBugCount()).toBe(1);
    expect(await sd.waitForWorkflowMessageIncludes('Bug introduced!')).toBe(true);

    // Resolve the bug and verify bug count returns to zero and log exists
    await sd.resolveBug();
    expect(await sd.getBugCount()).toBe(0);
    expect(await sd.waitForWorkflowMessageIncludes('Bug resolved!')).toBe(true);

    // No runtime page errors during simulation (aside from later intentional cases)
    expect(pageErrors.length).toBe(0);
  });

  // Test artifact generation S4 including a runtime ReferenceError when selecting 'diagram' (intentional bug in app)
  test('S4 Artifact Generation: successful artifact creation and intentional ReferenceError for diagram type', async ({ page }) => {
    const sd = new SDLCPage(page);
    await sd.goto();
    await sd.initialize('vmodel');

    // Select 'document' and generate artifact - should succeed
    await sd.selectArtifactType('document');
    const artifactsBefore = await sd.getArtifactCount();
    await sd.generateArtifact();
    const artifactsAfter = await sd.getArtifactCount();
    expect(artifactsAfter).toBe(artifactsBefore + 1);

    // There should be a new artifact element in the DOM
    const artifactElements = await sd.artifactElementsCount();
    expect(artifactElements).toBeGreaterThanOrEqual(1);
    expect(await sd.waitForWorkflowMessageIncludes('Created artifact:')).toBe(true);

    // Now select 'diagram' which triggers a ReferenceError in the implementation (currentPhaseTasks is undefined)
    // Prepare to capture the page error emitted by the runtime
    let capturedError = null;
    const pageErrorPromise = new Promise(resolve => {
      page.once('pageerror', err => {
        capturedError = err;
        resolve(err);
      });
    });

    await sd.selectArtifactType('diagram');
    await sd.generateArtifact();

    // Wait for the pageerror to occur (the app is expected to throw a ReferenceError for 'diagram')
    await pageErrorPromise;

    // Assert that a ReferenceError occurred and contains relevant text
    expect(capturedError).toBeTruthy();
    const errorMessage = String(capturedError.message || capturedError);
    expect(errorMessage).toMatch(/ReferenceError|currentPhaseTasks|is not defined/);

    // Ensure artifacts count did NOT increment for the failing case
    const artifactsFinal = await sd.getArtifactCount();
    expect(artifactsFinal).toBe(artifactsAfter); // unchanged from the successful generation

    // At least one page error should have been recorded globally
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  // Test phase customization S5 using dialog handling
  test('S5 Phase Customization: customize current phase via prompt dialog and reflect customization in DOM', async ({ page }) => {
    const sd = new SDLCPage(page);
    await sd.goto();
    await sd.initialize('waterfall');

    // Customize current phase using a dialog prompt; accept with a custom note
    const customText = 'Add security review';
    await sd.clickCustomizeAndAccept(customText);

    // After customization, phases are re-rendered and current phase should include the custom note
    // Find the current phase's element and check for the custom note text
    const currentPhaseName = await sd.getCurrentPhaseText();

    // Wait for phases to be re-rendered and have the custom note somewhere
    const hasCustom = await sd.page.$$eval('.phase', (nodes, cp, ct) => {
      return nodes.some(n => n.textContent && n.textContent