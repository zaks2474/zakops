import { expect, test } from '@playwright/test';

test.describe('ZakOps Chat UI', () => {
  test('Approve executes add_note proposal', async ({ page }) => {
    await page.goto('/chat?deal_id=DEAL-2025-008');

    await page.getByTestId('chat-input').fill('please add a note');
    await page.keyboard.press('Enter');

    const proposal = page.getByTestId('proposal-p-add-note');
    await expect(proposal).toBeVisible();
    await expect(proposal).toContainText('add_note');
    await expect(proposal).toContainText('pending_approval');

    await page.getByTestId('proposal-approve-p-add-note').click();

    await expect(proposal).toContainText('executed');
    await expect(proposal).toContainText('Note saved');
  });

  test('schedule_action is normalized and approves as create_task', async ({ page }) => {
    await page.goto('/chat?deal_id=DEAL-2025-008');

    await page.getByTestId('chat-input').fill('schedule a follow up task');
    await page.keyboard.press('Enter');

    const proposal = page.getByTestId('proposal-p-schedule-action');
    await expect(proposal).toBeVisible();
    await expect(proposal).toContainText('create_task');
    await expect(proposal).not.toContainText('schedule_action');

    await page.getByTestId('proposal-approve-p-schedule-action').click();
    await expect(proposal).toContainText('executed');
    await expect(proposal).toContainText('Task created');
  });

  test('Broker email drafts show Gemini Pro in Debug', async ({ page }) => {
    await page.goto('/chat?deal_id=DEAL-2025-010');

    await page.getByTestId('chat-input').fill('draft email to broker requesting CIM');
    await page.keyboard.press('Enter');

    const proposal = page.getByTestId('proposal-p-draft-email');
    await expect(proposal).toBeVisible();

    await page.getByTestId('proposal-approve-p-draft-email').click();
    await expect(proposal).toContainText('executed');

    await page.getByTestId('chat-debug-toggle').click();
    const debug = page.getByTestId('chat-debug-panel');
    await expect(debug).toBeVisible();
    await expect(debug).toContainText('gemini-pro');
    await expect(debug).toContainText('gemini-1.5-pro');
  });

  test('Scroll does not auto-jump when user scrolled up', async ({ page }) => {
    await page.goto('/chat?deal_id=DEAL-2025-008');

    // Create enough content to enable scrolling.
    await page.getByTestId('chat-input').fill('long response 1');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Line 120: long response 1')).toBeVisible();

    const scroll = page.getByTestId('chat-scroll');
    const metrics = await scroll.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    // Scroll to top and ensure the handler sees we're not near bottom.
    await scroll.evaluate((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event('scroll'));
    });

    const topBefore = await scroll.evaluate((el) => el.scrollTop);
    expect(topBefore).toBeLessThan(50);

    // Trigger streaming updates; scroll should NOT jump to bottom.
    await page.getByTestId('chat-input').fill('long response 2');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    const topDuring = await scroll.evaluate((el) => el.scrollTop);
    expect(topDuring).toBeLessThan(50);
  });
});

