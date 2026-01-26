import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1216bec1-fa7a-11f0-acf9-69409043402d.html';

test.describe('Agile Methodology Interactive Explorer - FSM validation', () => {
  // Collect console and page errors for each test and assert none occurred at the end.
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    await expect(page).toHaveTitle(/Agile Methodology Interactive Explorer/);
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors or console error-level messages.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console errors should be emitted').toEqual([]);
  });

  test.describe('Project Setup (S0_ProjectSetup) validations and transitions', () => {

    test('shows validation when initializing project without a name and validates team size and role assignments', async ({ page }) => {
      // Attempt to initialize project without name: expect validation message
      await page.click('#setupProjectBtn');
      const setupMsg = page.locator('#projectSetupResult');
      await expect(setupMsg).toContainText('Project name is required.');

      // Set invalid team size (0) and attempt to trigger change to create role inputs
      await page.fill('#teamSize', '0');
      // Dispatch change to trigger role inputs recreation
      await page.locator('#teamSize').evaluate(el => el.dispatchEvent(new Event('change')));
      // teamSize should be corrected to 1 by code, ensure a role input exists
      await expect(page.locator('#roleInput1')).toBeVisible();

      // Now set team size to 3 and provide roles but omit required roles to trigger validation.
      await page.fill('#teamSize', '3');
      await page.locator('#teamSize').evaluate(el => el.dispatchEvent(new Event('change')));
      // Wait for role inputs for member #1..3
      await expect(page.locator('#roleInput1')).toBeVisible();
      await expect(page.locator('#roleInput2')).toBeVisible();
      await expect(page.locator('#roleInput3')).toBeVisible();

      // Fill project name but assign roles without Product Owner and Scrum Master
      await page.fill('#projectName', 'Test Project A');
      // Set all to Developer to trigger missing PO/SM validation
      await page.selectOption('#roleInput1', 'Developer');
      await page.selectOption('#roleInput2', 'Developer');
      await page.selectOption('#roleInput3', 'Developer');

      await page.click('#setupProjectBtn');
      await expect(setupMsg).toContainText('At least one Product Owner is required.');

      // Fix to include a Product Owner but still missing Scrum Master
      await page.selectOption('#roleInput1', 'Product Owner');
      await page.click('#setupProjectBtn');
      await expect(setupMsg).toContainText('At least one Scrum Master is required.');

      // Fix roles to include PO, SM, and Developer, then initialize successfully
      await page.selectOption('#roleInput2', 'Scrum Master');
      await page.selectOption('#roleInput3', 'Developer');

      await page.click('#setupProjectBtn');
      await expect(setupMsg).toContainText('Project "Test Project A" initialized with team of 3 members.');

      // After successful initialization, Product Backlog Management and other sections should be visible
      const productBacklogSection = page.locator("section[aria-label='Product Backlog Management']");
      const sprintSection = page.locator("section[aria-label='Sprint Planning and Execution']");
      const ceremoniesSection = page.locator("section[aria-label='Agile Ceremonies']");
      const explorationSection = page.locator("section[aria-label='Explore Agile Concepts']");
      const projectSummarySection = page.locator("section[aria-label='Project Summary']");

      await expect(productBacklogSection).toBeVisible();
      await expect(sprintSection).toBeVisible();
      await expect(ceremoniesSection).toBeVisible();
      await expect(explorationSection).toBeVisible();
      await expect(projectSummarySection).toBeVisible();
    });
  });

  test.describe('Product Backlog Management (S1_ProductBacklogManagement) - events and edge cases', () => {

    test('adding backlog items validates inputs and displays list when toggled', async ({ page }) => {
      // Initialize project with a minimal valid team: 2 members (PO and Developer + SM requirement -> use 3)
      await page.fill('#teamSize', '3');
      await page.locator('#teamSize').evaluate(el => el.dispatchEvent(new Event('change')));
      await page.fill('#projectName', 'Backlog Test Project');
      await page.selectOption('#roleInput1', 'Product Owner');
      await page.selectOption('#roleInput2', 'Scrum Master');
      await page.selectOption('#roleInput3', 'Developer');
      await page.click('#setupProjectBtn');
      await expect(page.locator('#projectSetupResult')).toContainText('initialized');

      // Try adding a backlog item without title -> expect error
      await page.fill('#backlogTitle', '');
      await page.fill('#backlogDescription', 'A description');
      await page.fill('#backlogPriority', '2');
      await page.fill('#backlogEstimation', '5');
      await page.click('#addBacklogItemBtn');
      await expect(page.locator('#backlogMessage')).toContainText('Backlog item title is required.');

      // Now add a valid backlog item
      await page.fill('#backlogTitle', 'User login feature');
      await page.click('#addBacklogItemBtn');
      await expect(page.locator('#backlogMessage')).toContainText('Backlog item #1 added.');

      // Show backlog and ensure content contains our item title
      await page.click('#showBacklogBtn');
      await expect(page.locator('#backlogList')).toContainText('User login feature');

      // Add another valid backlog item
      await page.fill('#backlogTitle', 'Payment integration');
      await page.fill('#backlogEstimation', '8');
      await page.click('#addBacklogItemBtn');
      await expect(page.locator('#backlogMessage')).toContainText('Backlog item #2 added.');

      // Attempt to add an item with non-existent dependency -> expect dependency error
      await page.fill('#backlogTitle', 'Dependent task');
      await page.fill('#backlogDependency', '99'); // no such id
      await page.click('#addBacklogItemBtn');
      await expect(page.locator('#backlogMessage')).toContainText('Dependency ID does not exist');

      // Reset dependency field and successfully add an item that depends on #1
      await page.fill('#backlogDependency', '1');
      await page.fill('#backlogTitle', 'Follow-up task');
      await page.click('#addBacklogItemBtn');
      await expect(page.locator('#backlogMessage')).toContainText('Backlog item #3 added.');

      // Open backlog list again and verify dependencies are displayed for the dependent item
      // Ensure backlog details are open
      const details = page.locator('#backlogListDetails');
      // If closed, toggle open
      const isOpen = await details.evaluate(el => el.open);
      if (!isOpen) await page.click('#showBacklogBtn');
      await expect(page.locator('#backlogList')).toContainText('Depends on: 1');

      // Circular dependency scenario is guarded by the app; we at least confirm that adding valid dependencies works
      await expect(page.locator('#backlogList')).toContainText('#1');
      await expect(page.locator('#backlogList')).toContainText('#2');
      await expect(page.locator('#backlogList')).toContainText('#3');
    });

    test('start sprint edge cases: cannot start with empty backlog or without developers', async ({ page }) => {
      // Initialize a fresh project with roles that have no Developers
      await page.fill('#teamSize', '2');
      await page.locator('#teamSize').evaluate(el => el.dispatchEvent(new Event('change')));
      await page.fill('#projectName', 'NoDev Project');
      // Role inputs created for 2 members
      await page.selectOption('#roleInput1', 'Product Owner');
      await page.selectOption('#roleInput2', 'Scrum Master');
      await page.click('#setupProjectBtn');
      await expect(page.locator('#projectSetupResult')).toContainText('initialized');

      // Ensure backlog empty and attempt to start sprint -> expect "backlog is empty."
      await page.click('#startSprintBtn');
      await expect(page.locator('#sprintStatus')).toContainText('backlog is empty');

      // Add a backlog item and attempt to start sprint again -> expect "No Developers on team"
      await page.fill('#backlogTitle', 'Admin UI');
      await page.click('#addBacklogItemBtn');
      await expect(page.locator('#backlogMessage')).toContainText('#1 added');

      await page.click('#startSprintBtn');
      await expect(page.locator('#sprintStatus')).toContainText('No Developers on team to assign sprint work.');
    });

  });

  test.describe('Sprint Planning and Execution (S2_SprintPlanningExecution) and task updates', () => {

    test('full sprint lifecycle: start sprint, update task state, hold daily standup, end sprint', async ({ page }) => {
      // Initialize project with Developer present and add backlog items
      await page.fill('#teamSize', '3');
      await page.locator('#teamSize').evaluate(el => el.dispatchEvent(new Event('change')));
      await page.fill('#projectName', 'Sprint Lifecycle Project');
      await page.selectOption('#roleInput1', 'Product Owner');
      await page.selectOption('#roleInput2', 'Scrum Master');
      await page.selectOption('#roleInput3', 'Developer');
      await page.click('#setupProjectBtn');
      await expect(page.locator('#projectSetupResult')).toContainText('initialized');

      // Add two backlog items
      await page.fill('#backlogTitle', 'Implement search');
      await page.fill('#backlogEstimation', '5');
      await page.click('#addBacklogItemBtn');
      await expect(page.locator('#backlogMessage')).toContainText('#1 added');

      await page.fill('#backlogTitle', 'Refactor auth');
      await page.fill('#backlogEstimation', '3');
      await page.click('#addBacklogItemBtn');
      await expect(page.locator('#backlogMessage')).toContainText('#2 added');

      // Start sprint - should select items and mark sprint active
      await page.click('#startSprintBtn');
      await expect(page.locator('#sprintStatus')).toContainText('started');
      // End sprint button becomes enabled
      await expect(page.locator('#endSprintBtn')).toBeEnabled();

      // Verify sprint backlog select has items
      const selectSprintItem = page.locator('#selectSprintItem');
      await expect(selectSprintItem.locator('option')).toHaveCount(2);

      // Update first task to "In Progress"
      const firstOptionValue = await selectSprintItem.locator('option').first().getAttribute('value');
      await page.selectOption('#selectSprintItem', firstOptionValue);
      await page.selectOption('#taskStateSelect', 'In Progress');
      await page.click('#updateTaskStateBtn');
      await expect(page.locator('#sprintStatus')).toContainText('Task #' + firstOptionValue + ' state updated');

      // Validate task board output shows "In Progress" under that section
      await expect(page.locator('#taskBoardOutput')).toContainText('In Progress:');
      await expect(page.locator('#taskBoardOutput')).toContainText(`#${firstOptionValue}`);

      // Hold daily stand-up - with active sprint this should populate ceremonyOutput accordingly
      await page.click('#dailyStandupBtn');
      await expect(page.locator('#ceremonyOutput')).toContainText('Daily Stand-up');

      // To end sprint, tasks must be Done. Update both tasks to Done.
      const options = await selectSprintItem.locator('option').allTextContents();
      for (const optText of options) {
        // extract id from optText like "#1: Title" - but option value attribute contains id too
      }
      // Get option values and set each to Done via select and update button
      const optionElements = selectSprintItem.locator('option');
      const optionCount = await optionElements.count();
      for (let i = 0; i < optionCount; i++) {
        const val = await optionElements.nth(i).getAttribute('value');
        await page.selectOption('#selectSprintItem', val);
        await page.selectOption('#taskStateSelect', 'Done');
        await page.click('#updateTaskStateBtn');
        await expect(page.locator('#sprintStatus')).toContainText(`Task #${val} state updated to "Done".`);
      }

      // Now end the sprint
      await page.click('#endSprintBtn');
      await expect(page.locator('#sprintStatus')).toContainText('completed');
      // After completion, review & retrospective buttons should be enabled
      await expect(page.locator('#sprintReviewBtn')).toBeEnabled();
      await expect(page.locator('#sprintRetrospectiveBtn')).toBeEnabled();
    });

  });

  test.describe('Agile Ceremonies (S3_AgileCeremonies) and Project Summary (S5_ProjectSummary)', () => {

    test('sprint review, retrospective, impediments management and report generation', async ({ page }) => {
      // Initialize project, add backlog, start sprint, mark Done and finish sprint so ceremonies can run
      await page.fill('#teamSize', '3');
      await page.locator('#teamSize').evaluate(el => el.dispatchEvent(new Event('change')));
      await page.fill('#projectName', 'Ceremonies Project');
      await page.selectOption('#roleInput1', 'Product Owner');
      await page.selectOption('#roleInput2', 'Scrum Master');
      await page.selectOption('#roleInput3', 'Developer');
      await page.click('#setupProjectBtn');
      await expect(page.locator('#projectSetupResult')).toContainText('initialized');

      // Add a backlog item and start sprint
      await page.fill('#backlogTitle', 'Feature X');
      await page.click('#addBacklogItemBtn');
      await expect(page.locator('#backlogMessage')).toContainText('#1 added');
      await page.click('#startSprintBtn');
      await expect(page.locator('#sprintStatus')).toContainText('started');

      // Mark the sole task as Done to allow ending sprint
      const optVal = await page.locator('#selectSprintItem option').first().getAttribute('value');
      await page.selectOption('#selectSprintItem', optVal);
      await page.selectOption('#taskStateSelect', 'Done');
      await page.click('#updateTaskStateBtn');
      await expect(page.locator('#sprintStatus')).toContainText('state updated');

      // End sprint to enable review and retrospective
      await page.click('#endSprintBtn');
      await expect(page.locator('#sprintStatus')).toContainText('completed');

      // Hold Sprint Review
      await page.click('#sprintReviewBtn');
      await expect(page.locator('#ceremonyOutput')).toContainText('Sprint Review');
      // Holding again should indicate it was already held
      await page.click('#sprintReviewBtn');
      await expect(page.locator('#ceremonyOutput')).toContainText('review was already held');

      // Hold Sprint Retrospective
      await page.click('#sprintRetrospectiveBtn');
      await expect(page.locator('#ceremonyOutput')).toContainText('Sprint Retrospective');
      // Holding again should indicate it was already held
      await page.click('#sprintRetrospectiveBtn');
      await expect(page.locator('#ceremonyOutput')).toContainText('retrospective was already held');

      // Explore impediments: add and resolve
      await page.fill('#impedimentText', 'Blocked by API outage');
      await page.click('#addImpedimentBtn');
      // Ensure impediment list shows the new impediment and details opened
      await expect(page.locator('#impedimentsList')).toContainText('Blocked by API outage');
      await expect(page.locator('#impedimentsDetails')).toBeVisible();

      // Resolve the impediment and ensure it now shows Resolved
      await page.click('#resolveImpedimentBtn');
      await expect(page.locator('#impedimentsList')).toContainText('[Resolved]');

      // Generate project report and verify contents contain project name and backlog/sprint info
      await page.click('#generateReportBtn');
      await expect(page.locator('#projectReport')).toContainText('Project Report: "Ceremonies Project"');
      await expect(page.locator('#projectReport')).toContainText('Backlog:');
      await expect(page.locator('#reportDetails')).toBeVisible();
    });
  });

  test.describe('Edge cases and negative flows', () => {
    test('invalid backlog priority and estimation produce errors', async ({ page }) => {
      await page.fill('#teamSize', '3');
      await page.locator('#teamSize').evaluate(el => el.dispatchEvent(new Event('change')));
      await page.fill('#projectName', 'Validation Project');
      await page.selectOption('#roleInput1', 'Product Owner');
      await page.selectOption('#roleInput2', 'Scrum Master');
      await page.selectOption('#roleInput3', 'Developer');
      await page.click('#setupProjectBtn');
      await expect(page.locator('#projectSetupResult')).toContainText('initialized');

      // Invalid priority (0)
      await page.fill('#backlogTitle', 'Invalid priority item');
      await page.fill('#backlogPriority', '0');
      await page.fill('#backlogEstimation', '3');
      await page.click('#addBacklogItemBtn');
      await expect(page.locator('#backlogMessage')).toContainText('Priority must be a number between 1 and 10');

      // Invalid estimation (20)
      await page.fill('#backlogPriority', '3');
      await page.fill('#backlogEstimation', '20');
      await page.click('#addBacklogItemBtn');
      await expect(page.locator('#backlogMessage')).toContainText('Estimation must be between 1 and 13');
    });

    test('cannot update task state when no active sprint exists', async ({ page }) => {
      // Fresh project with no sprint started
      await page.fill('#teamSize', '3');
      await page.locator('#teamSize').evaluate(el => el.dispatchEvent(new Event('change')));
      await page.fill('#projectName', 'No Sprint Update');
      await page.selectOption('#roleInput1', 'Product Owner');
      await page.selectOption('#roleInput2', 'Scrum Master');
      await page.selectOption('#roleInput3', 'Developer');
      await page.click('#setupProjectBtn');

      // Attempt to update task state with no sprint active
      await page.click('#updateTaskStateBtn');
      await expect(page.locator('#sprintStatus')).toContainText('No active sprint for updating task state.');
    });

  });

});