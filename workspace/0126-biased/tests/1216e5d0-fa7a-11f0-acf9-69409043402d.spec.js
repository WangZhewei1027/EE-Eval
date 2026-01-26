import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1216e5d0-fa7a-11f0-acf9-69409043402d.html';

// Page object model for interacting with the Refactoring Interactive Explorer
class RefactoringExplorerPage {
  constructor(page) {
    this.page = page;
    // Controls
    this.currentStep = page.locator('#currentStep');
    this.totalSteps = page.locator('#totalSteps');
    this.btnPrev = page.locator('#btnPrevStep');
    this.btnNext = page.locator('#btnNextStep');
    this.btnAdd = page.locator('#btnAddStep');
    this.btnDelete = page.locator('#btnDeleteStep');
    this.btnReset = page.locator('#btnResetWorkflow');
    this.inputGoto = page.locator('#inputGotoStep');
    this.btnGoto = page.locator('#btnGotoStep');

    // Step editing
    this.stepTitle = page.locator('#stepTitle');
    this.stepDescription = page.locator('#stepDescription');
    this.stepCategory = page.locator('#stepCategory');
    this.stepHasPre = page.locator('#stepHasPreconditions');
    this.stepHasPost = page.locator('#stepHasPostconditions');
    this.stepDifficulty = page.locator('#stepDifficulty');
    this.difficultyValue = page.locator('#difficultyValue');
    this.stepExpectedTime = page.locator('#stepExpectedTime');

    this.preconditions = page.locator('#preconditionsList');
    this.postconditions = page.locator('#postconditionsList');

    // Patterns
    this.patternSelect = page.locator('#patternSelect');
    this.btnLoadPattern = page.locator('#btnLoadPattern');

    // Summaries & visualization
    this.stepSummary = page.locator('#stepSummary');
    this.workflowVisualization = page.locator('#workflowVisualization');

    // Branching
    this.branchNameInput = page.locator('#branchNameInput');
    this.btnCreateBranch = page.locator('#btnCreateBranch');
    this.branchSelect = page.locator('#branchSelect');
    this.btnSwitchBranch = page.locator('#btnSwitchBranch');
    this.mergeBranchSelect = page.locator('#mergeBranchSelect');
    this.btnMergeBranch = page.locator('#btnMergeBranch');
  }

  async load() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Navigation helpers
  async clickNext() { await this.btnNext.click(); }
  async clickPrev() { await this.btnPrev.click(); }
  async clickAdd() { await this.btnAdd.click(); }
  async clickDelete() { await this.btnDelete.click(); }
  async clickReset() { await this.btnReset.click(); }
  async gotoStep(n) {
    await this.inputGoto.fill(String(n));
    await this.btnGoto.click();
  }

  // Pattern
  async loadPattern(patternValue) {
    await this.patternSelect.selectOption(patternValue);
    await this.btnLoadPattern.click();
  }

  // Branching
  async createBranch(name) {
    await this.branchNameInput.fill(name);
    await this.btnCreateBranch.click();
  }
  async switchBranch(name) {
    await this.branchSelect.selectOption(name);
    await this.btnSwitchBranch.click();
  }
  async mergeBranch(name) {
    await this.mergeBranchSelect.selectOption(name);
    await this.btnMergeBranch.click();
  }

  // Accessors
  async getCurrentStepText() { return (await this.currentStep.textContent()).trim(); }
  async getTotalStepsText() { return (await this.totalSteps.textContent()).trim(); }
  async getStepTitleValue() { return await this.stepTitle.inputValue(); }
  async getStepSummaryText() { return (await this.stepSummary.textContent()).trim(); }
  async getWorkflowVisualizationText() { return (await this.workflowVisualization.inputValue()).trim(); }
  async getDifficultyValue() { return (await this.difficultyValue.textContent()).trim(); }

  async isPrevDisabled() { return await this.btnPrev.isDisabled(); }
  async isNextDisabled() { return await this.btnNext.isDisabled(); }
  async isDeleteDisabled() { return await this.btnDelete.isDisabled(); }
  async isLoadPatternDisabled() { return await this.btnLoadPattern.isDisabled(); }
}

// Tests
test.describe('Refactoring Interactive Explorer - FSM & UI behavior', () => {
  let page;
  let explorer;
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ browser }) => {
    // create a fresh context/page for each test
    const context = await browser.newContext();
    page = await context.newPage();

    // Capture console messages for inspection
    consoleMessages = [];
    page.on('console', msg => {
      // record console text and type
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (uncaught exceptions)
    pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture dialog messages (alerts/confirms triggered by the app)
    dialogMessages = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      // accept all dialogs (confirm/alert) to allow flows to continue
      try {
        await dialog.accept();
      } catch (e) {
        // ignore
      }
    });

    explorer = new RefactoringExplorerPage(page);
    await explorer.load();
  });

  test.afterEach(async () => {
    // Basic assertion: no uncaught page errors occurred during the test
    // This verifies the app executed without throwing unexpected exceptions
    expect(pageErrors, 'No unexpected page errors (uncaught exceptions)').toHaveLength(0);
  });

  test('Initial state after resetWorkflow (S0_Idle -> S1_StepSelected on init): UI initialized correctly', async () => {
    // The app runs resetWorkflow() on initialization. Verify entry actions and UI reflect S1_StepSelected.
    // Current step should be 1 and total steps should be 5 (as defined in resetWorkflow).
    const current = await explorer.getCurrentStepText();
    const total = await explorer.getTotalStepsText();
    expect(current).toBe('1'); // currentStepIndex === 0 -> displayed as 1
    expect(total).toBe('5'); // initial number of steps

    // Prev should be disabled, Next enabled (since more than one step)
    expect(await explorer.isPrevDisabled()).toBe(true);
    expect(await explorer.isNextDisabled()).toBe(false);

    // Delete should be enabled because a current step exists
    expect(await explorer.isDeleteDisabled()).toBe(false);

    // Step title should match first step defined in resetWorkflow
    expect(await explorer.getStepTitleValue()).toContain('Identify Refactoring Opportunity');

    // Step summary should include ID, Title and Category
    const summary = await explorer.getStepSummaryText();
    expect(summary).toContain('Title: Identify Refactoring Opportunity');
    expect(summary).toContain('Category: Analysis');

    // Workflow visualization should include branch name and list first step
    const viz = await explorer.getWorkflowVisualizationText();
    expect(viz).toContain('Workflow Branch: "main"');
    expect(viz).toMatch(/1\.\s+Identify Refactoring Opportunity/);
  });

  test('Navigate steps using Next and Prev (NextStep and PrevStep events)', async () => {
    // Click Next -> should move to step 2
    await explorer.clickNext();

    let current = await explorer.getCurrentStepText();
    expect(current).toBe('2');

    // Step title should be 'Write Tests'
    expect(await explorer.getStepTitleValue()).toContain('Write Tests');

    // Click Prev -> should go back to step 1
    await explorer.clickPrev();
    current = await explorer.getCurrentStepText();
    expect(current).toBe('1');

    // Clicking Prev again should do nothing (already at first), remain disabled
    expect(await explorer.isPrevDisabled()).toBe(true);
  });

  test('AddStep and DeleteStep transitions update workflow and UI correctly', async () => {
    const totalBefore = Number(await explorer.getTotalStepsText());

    // Add step after current (should insert and currentStepIndex increments to newly added)
    await explorer.clickAdd();

    // After adding, total should increase by 1 and current step should point to new 'New Step'
    const totalAfterAdd = Number(await explorer.getTotalStepsText());
    expect(totalAfterAdd).toBe(totalBefore + 1);

    const currentAfterAdd = await explorer.getCurrentStepText();
    // Current step moved to the newly inserted step (index changed from 1 to 2)
    expect(Number(currentAfterAdd)).toBeGreaterThanOrEqual(2);
    expect(await explorer.getStepTitleValue()).toBe('New Step');

    // Delete the current step
    await explorer.clickDelete();
    const totalAfterDelete = Number(await explorer.getTotalStepsText());
    expect(totalAfterDelete).toBe(totalBefore); // back to original count

    // Ensure UI summary updates and workflow visualization does not include 'New Step' now
    const viz = await explorer.getWorkflowVisualizationText();
    expect(viz).not.toMatch(/New Step/);
  });

  test('GotoStep event: valid and invalid inputs', async () => {
    // Valid goto: go to step 4
    await explorer.gotoStep(4);
    expect(await explorer.getCurrentStepText()).toBe('4');
    expect(await explorer.getStepTitleValue()).toContain('Run Tests');

    // Invalid goto: step 999 (out of range) should do nothing
    const beforeCurrent = await explorer.getCurrentStepText();
    await explorer.gotoStep(999);
    const afterCurrent = await explorer.getCurrentStepText();
    expect(afterCurrent).toBe(beforeCurrent);

    // Invalid input (non-number) should be ignored
    await explorer.inputGoto.fill('not-a-number');
    await explorer.btnGoto.click();
    expect(await explorer.getCurrentStepText()).toBe(afterCurrent);
  });

  test('LoadPattern into current step updates step data (LoadPattern event)', async () => {
    // Ensure we're at step 1
    await explorer.gotoStep(1);
    expect(await explorer.getCurrentStepText()).toBe('1');

    // Load 'extractMethod' pattern
    await explorer.loadPattern('extractMethod');

    // Step title should update to pattern's title
    expect(await explorer.getStepTitleValue()).toBe('Extract Method');

    // Step summary should reference the new title and expectedTime from pattern
    const summary = await explorer.getStepSummaryText();
    expect(summary).toContain('Title: Extract Method');
    expect(summary).toContain('Expected time (minutes): 40');
  });

  test('Creating a branch, switching branches, and merging with edge cases', async () => {
    // Setup: ensure at first step
    await explorer.gotoStep(1);
    expect(await explorer.getCurrentStepText()).toBe('1');

    // Attempt to create branch without a name -> should produce an alert message
    await explorer.createBranch(''); // will trigger alert 'Please enter a branch name.'
    // The dialog handler in beforeEach records dialog messages
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(dialogMessages[dialogMessages.length - 1]).toMatch(/Please enter a branch name/);

    // Create a branch properly named 'featureX'
    await explorer.createBranch('featureX');
    // The app alerts about branch creation; it was accepted
    expect(dialogMessages[dialogMessages.length - 1]).toMatch(/Branch "featureX" created starting from step/);

    // Confirm branchSelect contains 'featureX'
    const branchOptions = await explorer.branchSelect.locator('option').allTextContents();
    expect(branchOptions).toContain('featureX');

    // mergeBranchSelect should contain the new branch (when current branch != new branch)
    // At creation time current branch stays as 'main'. So mergeBranchSelect should NOT include 'main' and should include 'featureX' only after switching.
    const mergeOptionsAfterCreate = await explorer.mergeBranchSelect.locator('option').allTextContents();
    // After creation, mergeBranchSelect contains branches that are not current; since current is 'main', merge options should include nothing (because only other branch is featureX but mergeBranchSelect built excluding current)
    // However, rebuildBranchSelects was called, and mergeBranchSelect should contain other branches (the code appends optMerge for b !== workflow.currentBranch).
    // So ensure that 'featureX' appears in mergeBranchSelect when current is 'main'
    expect(mergeOptionsAfterCreate).toContain('featureX');

    // Switch to newly created branch 'featureX' (SwitchBranch event)
    await explorer.switchBranch('featureX');
    // After switching, current branch is featureX and currentStepIndex set to 0 -> displayed as 1
    expect(await explorer.getCurrentStepText()).toBe('1');
    const vizFeature = await explorer.getWorkflowVisualizationText();
    expect(vizFeature).toContain('Workflow Branch: "featureX"');

    // Attempt to merge without selecting a branch (mergeBranchSelect value empty) -> triggers alert
    // Clear selection by selecting the empty value if present, else just click Merge to trigger alert.
    await explorer.btnMergeBranch.click();
    expect(dialogMessages[dialogMessages.length - 1]).toMatch(/Select a branch to merge/);

    // Switch back to 'main' and merge 'featureX' into 'main'
    await explorer.switchBranch('main');
    // Ensure mergeBranchSelect includes 'featureX' as a candidate
    const mergeOptions = await explorer.mergeBranchSelect.locator('option').allTextContents();
    expect(mergeOptions).toContain('featureX');

    // Perform merge: select 'featureX' and click Merge
    await explorer.mergeBranch('featureX');
    // Merge action shows an alert about merge completion; the handler recorded that message
    const lastDialog = dialogMessages[dialogMessages.length - 1];
    expect(lastDialog).toMatch(/Merge complete: \d+ new steps added, some conditions merged./);

    // After merge, workflowVisualization should include steps potentially appended from merged branch
    const vizAfterMerge = await explorer.getWorkflowVisualizationText();
    expect(vizAfterMerge).toContain('Workflow Branch: "main"');
    // At minimum it should still list steps (no crash)
    expect(vizAfterMerge.length).toBeGreaterThan(10);
  });

  test('Edge cases: deleting until no steps, then adding; Reset workflow confirmation', async () => {
    // Delete steps repeatedly until none remain, verifying UI handles empty branch
    // First, determine total steps
    let total = Number(await explorer.getTotalStepsText());
    // Delete current step as many times as needed
    for (let i = 0; i < total; i++) {
      // Ensure delete enabled
      if (!(await explorer.isDeleteDisabled())) {
        await explorer.clickDelete();
      } else {
        break;
      }
    }

    // After deletions, totalSteps should be 0 and currentStep should show 0
    const totalAfterDeletes = Number(await explorer.getTotalStepsText());
    expect(totalAfterDeletes).toBe(0);
    expect(await explorer.getCurrentStepText()).toBe('0');

    // UI should show 'No current step selected.' in step summary area
    const summary = await explorer.getStepSummaryText();
    expect(summary).toContain('No current step selected');

    // Add a new step (AddStep when no current should append and set current index to last)
    await explorer.clickAdd();
    expect(Number(await explorer.getTotalStepsText())).toBe(1);
    expect(await explorer.getCurrentStepText()).toBe('1');

    // Reset workflow will prompt a confirmation; our dialog handler accepts it
    await explorer.clickReset();
    // Expect a confirm dialog to have been shown (the last dialog before reset was confirmation)
    // Since multiple dialogs may have been recorded, just assert that some dialog included 'Are you sure you want to reset' or that reset happened (total steps back to original 5)
    const totalsPostReset = Number(await explorer.getTotalStepsText());
    expect(totalsPostReset).toBeGreaterThanOrEqual(5); // reset should repopulate the branch with initial 5 steps
  });

  test('Validation: editing fields updates summary and saveCurrentStep behavior', async () => {
    // Go to step 1 and modify title/description and pre/post lines then navigate away to trigger saveCurrentStep
    await explorer.gotoStep(1);

    await explorer.stepTitle.fill('Custom Title For Test');
    await explorer.stepDescription.fill('A test description.');
    await explorer.preconditions.fill('pre1\npre2');
    await explorer.postconditions.fill('post1');

    // Change difficulty slider
    await explorer.stepDifficulty.fill('8'); // using .fill to set range value; triggers input event
    // Move to next step which triggers saveCurrentStep in the event handler
    await explorer.clickNext();

    // Return to step 1 to verify saved changes persisted
    await explorer.gotoStep(1);
    expect(await explorer.getStepTitleValue()).toBe('Custom Title For Test');
    const summary = await explorer.getStepSummaryText();
    expect(summary).toContain('Preconditions:');
    expect(summary).toContain(' - pre1');
    expect(summary).toContain('Postconditions:');
    expect(summary).toContain(' - post1');
    expect(summary).toContain('Estimated difficulty (1-10): 8');
  });

  test('Console should not contain error-level messages (sanity check of logs)', async () => {
    // Ensure no console messages of type 'error' were emitted during the page interaction
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(errorConsole, 'No console.error messages').toHaveLength(0);
  });
});