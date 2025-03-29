import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def format_time(seconds):
    """Converts time in seconds to hours, minutes, and seconds format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds = int(seconds % 60)
    return f"{hours}h {minutes}m {seconds}s"

def track_player_game_time(player_id):
    # Set up ChromeDriver
    service = Service("/opt/homebrew/bin/chromedriver")  # Adjust path if necessary
    options = Options()
    options.add_argument("--headless")  # Runs in background (remove if you want to see the browser)
    driver = webdriver.Chrome(service=service, options=options)

    # Visit the player's profile page on Rolimons
    url = f"https://www.rolimons.com/player/{player_id}"
    driver.get(url)

    total_game_time = 0  # Total time player has been in-game
    last_check_time = time.time()  # Last check time
    player_was_in_game = False  # Tracks if player was in-game last check
    counter = 0  # Number of updates

    print(f"Tracking Player {player_id}... Press CTRL+C to stop.")

    try:
        while True:
            try:
                driver.refresh()
                # Wait for the game status element to appear
                game_status_element = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, '//*[@id="location_pane_last_location_non_link"]'))
                )
                game_status_text = game_status_element.text.strip()

                current_time = time.time()

                if game_status_text == "In-Game":
                    if not player_was_in_game:
                        last_check_time = current_time  # Reset check time when they enter game
                    total_game_time += current_time - last_check_time
                    player_was_in_game = True
                    counter += 1
                    print(f"Player {player_id} is In-Game. Total game time: {format_time(total_game_time)}. Update count: {counter}")
                else:
                    player_was_in_game = False  # Reset flag if they leave the game
                    print(f"Player {player_id} is not in-game. (Status: {game_status_text})")

                last_check_time = current_time  # Always update check time

            except Exception as e:
                print(f"Error retrieving status: {e}")

            # Wait 10 seconds before checking again
            time.sleep(10)

    except KeyboardInterrupt:
        print("\nTracking stopped by user.")
    finally:
        driver.quit()
        print(f"Final total game time for player {player_id}: {format_time(total_game_time)}")

def main():
    player_id = input("Enter the Roblox player ID: ")
    track_player_game_time(player_id)

if __name__ == "__main__":
    main()
