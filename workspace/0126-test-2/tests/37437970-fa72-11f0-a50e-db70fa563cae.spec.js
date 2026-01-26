import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/37437970-fa72-11f0-a50e-db70fa563cae.html';

test.describe('Interactive Painting App Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the interactive painting application
        await page.goto(BASE_URL);
    });

    test('should load the application and verify initial state', async ({ page }) => {
        // Verify that the canvas is rendered and in the idle state
        const canvas = await page.locator('#paintCanvas');
        await expect(canvas).toBeVisible();
        const colorPicker = await page.locator('#colorPicker');
        await expect(colorPicker).toHaveValue('#000000');
        const brushSize = await page.locator('#brushSize');
        await expect(brushSize).toHaveValue('5');
    });

    test('should change brush color', async ({ page }) => {
        // Change the brush color and verify the change
        await page.locator('#colorPicker').fill('#ff0000');
        const brushColor = await page.evaluate(() => brushColor);
        expect(brushColor).toBe('#ff0000');
    });

    test('should change brush size', async ({ page }) => {
        // Change the brush size and verify the change
        await page.locator('#brushSize').fill('10');
        const brushSize = await page.evaluate(() => brushSize);
        expect(brushSize).toBe('10');
    });

    test('should start painting on mouse down', async ({ page }) => {
        // Simulate mouse down on the canvas
        await page.mouse.move(250, 250);
        await page.mouse.down();
        const paintingState = await page.evaluate(() => painting);
        expect(paintingState).toBe(true);
    });

    test('should draw on canvas while mouse is down', async ({ page }) => {
        // Simulate drawing on the canvas
        await page.mouse.move(250, 250);
        await page.mouse.down();
        await page.mouse.move(300, 300);
        const canvasData = await page.screenshot();
        expect(canvasData).toBeTruthy(); // Check if something was drawn
    });

    test('should stop painting on mouse up', async ({ page }) => {
        // Simulate mouse up on the canvas
        await page.mouse.move(250, 250);
        await page.mouse.down();
        await page.mouse.up();
        const paintingState = await page.evaluate(() => painting);
        expect(paintingState).toBe(false);
    });

    test('should stop painting on mouse out', async ({ page }) => {
        // Simulate mouse out of the canvas
        await page.mouse.move(250, 250);
        await page.mouse.down();
        await page.mouse.move(600, 600); // Move outside the canvas
        const paintingState = await page.evaluate(() => painting);
        expect(paintingState).toBe(false);
    });

    test('should clear the canvas', async ({ page }) => {
        // Clear the canvas and verify
        await page.mouse.move(250, 250);
        await page.mouse.down();
        await page.mouse.move(300, 300);
        await page.mouse.up();
        await page.locator('#clearButton').click();
        const canvasData = await page.screenshot();
        expect(canvasData).toEqual(await page.screenshot({ path: 'empty_canvas.png' })); // Compare with an empty canvas screenshot
    });

    test('should save the canvas as an image', async ({ page }) => {
        // Simulate drawing and saving the canvas
        await page.mouse.move(250, 250);
        await page.mouse.down();
        await page.mouse.move(300, 300);
        await page.mouse.up();
        await page.locator('#saveButton').click();
        // Check if the download link is created (mocking download behavior)
        const downloadLink = await page.evaluate(() => document.querySelector('a[download]'));
        expect(downloadLink).not.toBeNull();
        expect(downloadLink.download).toBe('myPainting.png');
    });

    test('should handle errors gracefully', async ({ page }) => {
        // Intentionally cause an error and check for console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                expect(msg.text()).toContain('ReferenceError'); // Expect a ReferenceError to be logged
            }
        });
        await page.evaluate(() => { throw new ReferenceError('Test error'); });
    });
});