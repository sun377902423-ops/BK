from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    console_errors = []
    page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type in ["error", "warning"] else None)

    page.on("requestfailed", lambda req: console_errors.append(f"[REQUEST_FAILED] {req.url} - {req.failure}"))

    print("Navigating to OHIF viewer...")
    page.goto("http://115.29.203.40/ohif/viewer?StudyInstanceUIDs=1.2.840.638053981590630404.48.0", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=30000)

    page.wait_for_timeout(5000)

    page.screenshot(path="/tmp/ohif_viewer.png", full_page=True)
    print("Screenshot saved to /tmp/ohif_viewer.png")

    print("\n--- Console Errors/Warnings ---")
    for err in console_errors[:30]:
        print(err)

    print("\n--- Page Title ---")
    print(page.title())

    print("\n--- Page URL ---")
    print(page.url)

    body_text = page.locator("body").inner_text()
    print(f"\n--- Body Text (first 500 chars) ---")
    print(body_text[:500] if body_text else "(empty)")

    browser.close()
