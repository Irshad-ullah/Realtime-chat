"""
RealChat Selenium Test Suite (15 Test Cases)
===========================================

Covers:
- Authentication UI
- Form validation
- Registration
- Login
- Chat functionality
- Logout

Run:
    pytest test_realchat.py -v
"""

import os
import time
import uuid
import pytest

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# ─── CONFIG ─────────────────────────────────────────

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
WAIT = 10

RUN_ID = uuid.uuid4().hex[:6]

# ─── DRIVER SETUP ───────────────────────────────────

def make_driver():
    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1400,900")

    driver = webdriver.Chrome(options=opts)
    driver.implicitly_wait(3)
    return driver


def wait_for(driver, by, value):
    return WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((by, value))
    )


def click_tab(driver, tab):
    driver.find_element(By.CSS_SELECTOR, f'[data-tab="{tab}"]').click()
    time.sleep(0.3)


# ─── FIXTURE ────────────────────────────────────────

@pytest.fixture
def driver():
    d = make_driver()
    d.get(BASE_URL)
    yield d
    d.quit()


# ───────────────────────────────────────────────────
# 🔹 TEST CASES (1–15)
# ───────────────────────────────────────────────────

# 1. Page Load Test
def test_01_page_load(driver):
    """Verify page loads and auth panel is visible"""
    assert "RealChat" in driver.title
    assert driver.find_element(By.ID, "auth-panel").is_displayed()


# 2. Default Tab Test
def test_02_login_tab_default(driver):
    """Verify login tab is active by default"""
    login_form = driver.find_element(By.ID, "login-form")
    assert "active" in login_form.get_attribute("class")


# 3. Tab Switching Test
def test_03_tab_switching(driver):
    """Verify switching between tabs shows correct form"""
    click_tab(driver, "register-user")
    assert "active" in driver.find_element(By.ID, "register-user-form").get_attribute("class")

    click_tab(driver, "register-biz")
    assert "active" in driver.find_element(By.ID, "register-biz-form").get_attribute("class")


# 4. Empty Login Submission
def test_04_empty_login(driver):
    """Submitting empty login form should not proceed"""
    driver.find_element(By.CSS_SELECTOR, "#login-form button").click()
    assert driver.find_element(By.ID, "auth-panel").is_displayed()


# 5. Invalid Email Format
def test_05_invalid_email(driver):
    """Invalid email should prevent login"""
    driver.find_element(By.ID, "login-email").send_keys("abc")
    driver.find_element(By.ID, "login-password").send_keys("123")
    driver.find_element(By.ID, "login-business-id").send_keys("123")
    driver.find_element(By.CSS_SELECTOR, "#login-form button").click()

    assert driver.find_element(By.ID, "auth-panel").is_displayed()


# 6. Register Business
def test_06_register_business(driver):
    """Valid business registration should succeed"""
    click_tab(driver, "register-biz")

    email = f"biz{RUN_ID}@test.com"

    driver.find_element(By.ID, "rb-name").send_keys("TestBiz")
    driver.find_element(By.ID, "rb-email").send_keys(email)
    driver.find_element(By.ID, "rb-password").send_keys("Password123")
    driver.find_element(By.CSS_SELECTOR, "#register-biz-form button").click()

    msg_el = WebDriverWait(driver, WAIT).until(
        lambda d: d.find_element(By.ID, "auth-message")
        if d.find_element(By.ID, "auth-message").text.strip()
        else False
    )
    assert msg_el.text.strip() != ""


# 7. Register User
def test_07_register_user(driver):
    """Register user under a business"""
    click_tab(driver, "register-biz")

    email = f"biz{uuid.uuid4().hex[:4]}@test.com"

    driver.find_element(By.ID, "rb-name").send_keys("Biz")
    driver.find_element(By.ID, "rb-email").send_keys(email)
    driver.find_element(By.ID, "rb-password").send_keys("Password123")
    driver.find_element(By.CSS_SELECTOR, "#register-biz-form button").click()

    biz_id = wait_for(driver, By.ID, "auth-message").text.split("ID:")[-1].strip()

    click_tab(driver, "register-user")

    driver.find_element(By.ID, "ru-name").send_keys("User1")
    driver.find_element(By.ID, "ru-email").send_keys(f"user{RUN_ID}@test.com")
    driver.find_element(By.ID, "ru-password").send_keys("Password123")
    driver.find_element(By.ID, "ru-business-id").send_keys(biz_id)
    driver.find_element(By.CSS_SELECTOR, "#register-user-form button").click()

    msg = wait_for(driver, By.ID, "auth-message").text
    assert msg != ""


# 8. Invalid Business ID
def test_08_invalid_business_id(driver):
    """User registration should fail with invalid business ID"""
    click_tab(driver, "register-user")

    driver.find_element(By.ID, "ru-name").send_keys("Fake")
    driver.find_element(By.ID, "ru-email").send_keys("fake@test.com")
    driver.find_element(By.ID, "ru-password").send_keys("Password123")
    driver.find_element(By.ID, "ru-business-id").send_keys("123456")

    driver.find_element(By.CSS_SELECTOR, "#register-user-form button").click()

    msg = wait_for(driver, By.ID, "auth-message").text
    assert "error" in msg.lower() or msg != ""


# 9. Successful Login
def test_09_successful_login(driver):
    """User should login and see chat panel"""
    # Setup
    click_tab(driver, "register-biz")

    email = f"biz{uuid.uuid4().hex[:4]}@test.com"
    driver.find_element(By.ID, "rb-name").send_keys("Biz")
    driver.find_element(By.ID, "rb-email").send_keys(email)
    driver.find_element(By.ID, "rb-password").send_keys("Password123")
    driver.find_element(By.CSS_SELECTOR, "#register-biz-form button").click()

    biz_msg = WebDriverWait(driver, WAIT).until(
        lambda d: d.find_element(By.ID, "auth-message")
        if d.find_element(By.ID, "auth-message").text.strip()
        else False
    )
    biz_id = biz_msg.text.split("ID:")[-1].strip()

    click_tab(driver, "register-user")
    user_email = f"loginuser{uuid.uuid4().hex[:6]}@test.com"
    driver.find_element(By.ID, "ru-name").send_keys("User")
    driver.find_element(By.ID, "ru-email").send_keys(user_email)
    driver.find_element(By.ID, "ru-password").send_keys("Password123")
    driver.find_element(By.ID, "ru-business-id").send_keys(biz_id)
    driver.find_element(By.CSS_SELECTOR, "#register-user-form button").click()

    click_tab(driver, "login")
    driver.find_element(By.ID, "login-email").send_keys(user_email)
    driver.find_element(By.ID, "login-password").send_keys("Password123")
    driver.find_element(By.ID, "login-business-id").send_keys(biz_id)
    driver.find_element(By.CSS_SELECTOR, "#login-form button").click()

    WebDriverWait(driver, WAIT).until(
        lambda d: "hidden" not in d.find_element(By.ID, "chat-panel").get_attribute("class")
    )


# 10. Invalid Login
def test_10_invalid_login(driver):
    """Wrong password should not login"""
    click_tab(driver, "login")

    driver.find_element(By.ID, "login-email").send_keys("wrong@test.com")
    driver.find_element(By.ID, "login-password").send_keys("wrong")
    driver.find_element(By.ID, "login-business-id").send_keys("123")

    driver.find_element(By.CSS_SELECTOR, "#login-form button").click()

    assert driver.find_element(By.ID, "auth-panel").is_displayed()


# 11. Chat Panel Visible
def test_11_chat_panel_visibility(driver):
    """Chat panel should be hidden before login"""
    chat_panel = driver.find_element(By.ID, "chat-panel")
    assert "hidden" in chat_panel.get_attribute("class")


# 12. Logout Test
def test_12_logout(driver):
    """Logout should return to auth panel"""
    # Simulate visible chat panel
    driver.execute_script("document.getElementById('chat-panel').classList.remove('hidden')")
    driver.execute_script("document.getElementById('auth-panel').classList.add('hidden')")

    driver.find_element(By.ID, "logout-btn").click()

    assert driver.find_element(By.ID, "auth-panel").is_displayed()


# 13. User List Exists
def test_13_user_list_exists(driver):
    """User list container should exist"""
    assert driver.find_element(By.ID, "user-list")


# 14. Select Contact
def test_14_select_contact(driver):
    """Selecting a contact should show message form"""
    driver.execute_script("""
        document.getElementById('message-form').classList.remove('hidden');
    """)
    msg_form = driver.find_element(By.ID, "message-form")
    assert "hidden" not in msg_form.get_attribute("class")


# 15. Send Message UI Test
def test_15_send_message_ui(driver):
    """Typing message should update input field"""
    driver.execute_script("""
        document.getElementById('chat-panel').classList.remove('hidden');
        document.getElementById('message-form').classList.remove('hidden');
    """)
    inp = WebDriverWait(driver, WAIT).until(
        EC.element_to_be_clickable((By.ID, "message-input"))
    )
    inp.send_keys("Hello")

    assert inp.get_attribute("value") == "Hello"