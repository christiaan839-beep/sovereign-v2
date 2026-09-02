from playwright.sync_api import sync_playwright
import os

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(f"file://{os.path.abspath('test_focus.html')}")

    print("Initial opacity of actions:", page.locator(".flex-col").evaluate("el => window.getComputedStyle(el).opacity"))

    # Focus the first button
    page.locator("button[aria-label='Mark as read']").focus()

    print("Opacity of actions after focus:", page.locator(".flex-col").evaluate("el => window.getComputedStyle(el).opacity"))

    # Take screenshot of focus state
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    page.screenshot(path="/home/jules/verification/screenshots/focus-test.png")

    browser.close()
