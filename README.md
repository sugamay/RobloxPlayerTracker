# Roblox Online Tracker

This script tracks the **online time** of a Roblox player using **Rolimons**.

## 📌 Features  
✅ **Tracks online status** from [Rolimons](https://www.rolimons.com/).  
✅ **Updates total online time** every **10 seconds**.  
✅ **User-controlled tracking** (Stop with `"finish"`).  
✅ **Headless browser mode** (Runs in the background).  

## 🛠️ Setup Guide  

### 1️⃣ Install Dependencies  
Ensure **Python 3** is installed, then run:  
```sh
pip install selenium
brew install chromedriver
pip install requests
make sure you have google chrome installed

Running:
python3 tracker.py
enter roblox ID

🏗️ How It Works

1️⃣ The script loads the Rolimons player page.
2️⃣ It checks the "Online" status every 10 seconds.
3️⃣ If the player is online, it adds time to the total.
4️⃣ Stop tracking with "finish", or continue tracking with "k".
5️⃣ When stopped, it prints total online time.

🔧 Troubleshooting

"No such element" Error
❌ Problem: Cannot find the player status.
✅ Solution: Update the XPath in the script:

online_time_element = WebDriverWait(driver, 10).until(
    EC.presence_of_element_located((By.XPATH, '//*[@id="player_online_status"]'))
)
Chromedriver Version Error
❌ Problem: Chrome and Chromedriver versions mismatch.
✅ Solution: Update Chrome & re-download ChromeDriver.

"chromedriver not found" Error
❌ Problem: Chromedriver not installed or not in PATH.
✅ Solution:

Mac/Linux:
sudo mv chromedriver /usr/local/bin/
Windows: Place chromedriver.exe in the script folder.

