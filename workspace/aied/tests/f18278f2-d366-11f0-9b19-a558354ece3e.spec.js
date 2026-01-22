import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f18278f2-d366-11f0-9b19-a558354ece3e.html';

// Page Object Model for the KMeans app
class KMeansApp {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.generateBtn = page.locator('#generatePoints');
        this.runBtn = page.locator('#runKMeans');
        this.stepBtn = page.locator('#stepKMeans');
        this.resetBtn = page.locator('#reset');
        this.kValue = page.locator('#kValue');
        this.kDisplay = page.locator('#kDisplay');
        this.pointCount = page.locator('#pointCount');
        this.pointCountDisplay = page.locator('#pointCountDisplay');
        this.status = page.locator('#status');
        this.clusterInfo = page.locator('#clusterInfo');
        this.canvas = page.locator('#canvas');
    }

    async goto() {
        await this.page.goto(APP_URL, { waitUntil: 'load' });
        // Ensure visualizer initialization (attached on window load)
        await this.page.waitForTimeout(100); // give scripts a brief moment to run
    }

    async getStatusText() {
        return (await this.status.innerText()).trim();
    }

    async setKValue(value) {
        // Set via evaluate because range input changes may not reflect without events
        await this.page.evaluate((v) => {
            const el = document.getElementById('kValue');
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, String(value));
    }

    async setPointCount(value) {
        await this.page.evaluate((v) => {
            const el = document.getElementById('pointCount');
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, String(value));
    }

    async clickGenerate() {
        await this.generateBtn.click();
    }

    async clickRun() {
        await this.runBtn.click();
    }

    async clickStep() {
        await this.stepBtn.click();
    }

    async clickReset() {
        await this.resetBtn.click();
    }

    async getKDisplay() {
        return (await this.kDisplay.innerText()).trim();
    }

    async getPointCountDisplay() {
        return (await this.pointCountDisplay.innerText()).trim();
    }

    async getClusterCardCount() {
        return await this.clusterInfo.locator('.cluster-card').count();
    }

    async getClusterInfoInnerHTML() {
        return await this.clusterInfo.innerHTML();
    }

    async canvasDataURL() {
        // returns data URL of canvas for basic content checks
        return await this.page.evaluate(() => {
            const c = document.getElementById('canvas');
            try {
                return c.toDataURL();
            } catch (e) {
                return null;
            }
        });
    }

    async waitForStatusContains(substring, timeout = 3000) {
        await this.page.waitForFunction(
            (sel, sub) => {
                const el = document.getElementById(sel);
                if (!el) return false;
                return el.textContent.includes(sub);
            },
            { timeout },
            'status',
            substring
        );
    }
}

// Test suite
test.describe('K-Means Clustering Visualization - FSM validation', () => {
    let app;
    let consoleMessages;
    let consoleErrors;
    let pageErrors;

    test.beforeEach(async ({ page }) => {
        // Capture console and page errors for each test
        consoleMessages = [];
        consoleErrors = [];
        pageErrors = [];

        page.on('console', (msg) => {
            const entry = { type: msg.type(), text: msg.text() };
            consoleMessages.push(entry);
            if (msg.type() === 'error') consoleErrors.push(entry);
        });

        page.on('pageerror', (err) => {
            pageErrors.push(err);
        });

        app = new KMeansApp(page);
        await app.goto();
    });

    test.afterEach(async () => {
        // Basic expectation: no uncaught page errors occurred during the test
        // If there are page errors, include them in the assertion message to aid debugging.
        expect(pageErrors.length, `Expected no uncaught page errors, got: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
        // Also assert there are no console error messages
        expect(consoleErrors.length, `Expected no console.error messages, got: ${consoleErrors.map(c => c.text).join(' | ')}`).toBe(0);
    });

    test('Initial Idle State: page renders and shows Ready status', async () => {
        // Validate initial idle state (S0_Idle)
        // - Status should indicate ready message from FSM evidence
        const statusText = await app.getStatusText();
        expect(statusText).toContain('Ready - Click "Generate Random Points" to start');

        // Validate presence of controls and default displays
        expect(await app.getKDisplay()).toBe('3'); // default value
        expect(await app.getPointCountDisplay()).toBe('150'); // default value

        // Canvas should exist and be empty or initialized
        const dataUrl = await app.canvasDataURL();
        expect(typeof dataUrl).toBe('string');
        expect(dataUrl.length).toBeGreaterThan(0);
    });

    test('K and Point Count input changes update displays', async () => {
        // Change K value and verify kDisplay updates (KValueChange event)
        await app.setKValue(5);
        expect(await app.getKDisplay()).toBe('5');

        // Change point count and verify display updates (PointCountChange event)
        await app.setPointCount(200);
        expect(await app.getPointCountDisplay()).toBe('200');
    });

    test('Click Step before generating points shows error message (edge case)', async () => {
        // According to implementation, clicking Step before generate shows 'Please generate points first.'
        await app.clickStep();
        await app.waitForStatusContains('Please generate points first.', 2000);
        const status = await app.getStatusText();
        expect(status).toBe('Please generate points first.');
    });

    test('Generate Random Points transitions to PointsGenerated (S1_PointsGenerated)', async () => {
        // Adjust point count to a deterministic value then generate
        await app.setPointCount(120);
        await app.setKValue(3);

        await app.clickGenerate();

        // Wait for status to update according to generateRandomPoints()
        await app.waitForStatusContains('Generated', 2000);
        const status = await app.getStatusText();

        // Expect the status to include the generated point count and readiness prompt
        expect(status).toContain('Generated 120 points. Ready to run K-Means.');

        // Cluster info should be empty because points are generated but clusters not computed
        const clusterHTML = await app.getClusterInfoInnerHTML();
        expect(clusterHTML.trim()).toBe('');
    });

    test('Run K-Means after generating transitions to KMeansRunning (S2_KMeansRunning) and updates cluster info', async () => {
        // Generate first
        await app.setPointCount(100);
        await app.setKValue(4);

        await app.clickGenerate();
        await app.waitForStatusContains('Generated', 2000);

        // Now run KMeans
        await app.clickRun();

        // The implementation sets iterations at the end and displays a "K-Means completed in X iterations..." message
        await app.page.waitForFunction(() => {
            const s = document.getElementById('status');
            if (!s) return false;
            return s.textContent.includes('K-Means completed in');
        }, { timeout: 3000 });

        const statusText = await app.getStatusText();
        expect(statusText).toMatch(/K-Means completed in \d+ iterations\./);

        // Ensure the message contains either 'Converged!' or 'Reached max iterations.'
        expect(
            /Converged!|Reached max iterations\./.test(statusText),
            `Expected outcome to mention convergence or max iterations but got: ${statusText}`
        ).toBeTruthy();

        // Cluster info should now contain cards equal to K (4)
        const cardCount = await app.getClusterCardCount();
        expect(cardCount).toBe(4);

        // Each cluster card should contain "Cluster" label
        const clusterHTML = await app.getClusterInfoInnerHTML();
        expect(clusterHTML).toContain('Cluster 1');
    });

    test('Step through iterations leads to SteppingThrough state and eventually Converged (S3_SteppingThrough -> S4_Converged)', async () => {
        // Generate points with a moderate size to allow stepping
        await app.setPointCount(120);
        await app.setKValue(3);
        await app.clickGenerate();
        await app.waitForStatusContains('Generated', 2000);

        // Step multiple times until convergence or a safe max iterations to avoid infinite loops
        let converged = false;
        let lastStatus = '';
        const maxSteps = 60;
        for (let i = 0; i < maxSteps; i++) {
            await app.clickStep();
            // small pause to allow UI update
            await app.page.waitForTimeout(50);
            lastStatus = await app.getStatusText();

            if (/converged/i.test(lastStatus)) {
                converged = true;
                break;
            }

            // if status indicates iteration, ensure it follows expected pattern
            if (/Iteration \d+\. Click "Step Through" to continue\./.test(lastStatus)) {
                // good, still stepping
            } else {
                // If unexpected message (e.g., Please generate ...), break and fail later
            }
        }

        // The FSM allows for both stepping through and eventual convergence.
        // Assert that either we observed convergence or at least we've observed stepping messages.
        if (converged) {
            expect(lastStatus).toMatch(/K-Means converged after \d+ iterations\./);
            // When converged, cluster cards should reflect clusters (k)
            const k = parseInt(await app.getKDisplay(), 10);
            const cardCount = await app.getClusterCardCount();
            expect(cardCount).toBe(k);
        } else {
            // If not converged within our maxSteps, ensure we at least saw iteration messages
            expect(lastStatus).toMatch(/Iteration \d+\. Click "Step Through" to continue\./);
        }
    });

    test('Reset transitions to Reset state (S5_Reset) from PointsGenerated and from KMeansRunning', async () => {
        // First, from PointsGenerated
        await app.setPointCount(80);
        await app.setKValue(2);
        await app.clickGenerate();
        await app.waitForStatusContains('Generated', 2000);

        // Now reset
        await app.clickReset();

        // Status should reflect reset message
        await app.waitForStatusContains('Reset. Click "Generate Random Points" to start.', 2000);
        expect(await app.getStatusText()).toBe('Reset. Click "Generate Random Points" to start.');

        // clusterInfo should be cleared
        expect(await app.getClusterInfoInnerHTML()).toBe('');

        // Now test reset from running state (generate -> run -> reset)
        await app.clickGenerate();
        await app.waitForStatusContains('Generated', 2000);
        await app.clickRun();

        // Wait for run to complete
        await app.page.waitForFunction(() => {
            const s = document.getElementById('status');
            return s && s.textContent.includes('K-Means completed in');
        }, { timeout: 3000 });

        // Now reset
        await app.clickReset();
        await app.waitForTimeout(100); // brief pause
        expect(await app.getStatusText()).toBe('Reset. Click "Generate Random Points" to start.');
        expect(await app.getClusterInfoInnerHTML()).toBe('');
    });

    test('Observe console messages and page errors during interactions (monitoring)', async () => {
        // This test ensures that console and pageerror listeners are working and that typical interactions produce no uncaught exceptions.

        // Perform a sequence of interactions
        await app.setPointCount(90);
        await app.setKValue(3);
        await app.clickGenerate();
        await app.waitForStatusContains('Generated', 2000);
        await app.clickStep();
        await app.page.waitForTimeout(100);
        await app.clickRun();
        await app.page.waitForTimeout(200);
        await app.clickReset();
        await app.page.waitForTimeout(100);

        // Ensure we captured console messages (there may or may not be any)
        expect(Array.isArray(consoleMessages)).toBe(true);

        // Final assertions about errors are in the afterEach hook; here we additionally assert that general console logging occurred (info/debug)
        // It's acceptable that there are zero console messages - we don't force any to appear.
        // But the structures must be arrays:
        expect(consoleMessages).toBeDefined();
        expect(consoleErrors).toBeDefined();
        expect(pageErrors).toBeDefined();
    });
});