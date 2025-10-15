import requests
from datetime import datetime

WEBHOOK_URL = "https://discord.com/api/webhooks/1427921739979030579/-dLwdkpyzSFdUiU3nEx9BwGqTI_YmU-azBaUCQO1llXJJ90bvhpCtLiJUg6uY2J8AaAk"
API_KEY = "https://api.cricapi.com/v1/countries?apikey=b7272cbc-9fe9-42bb-b8f1-e5fded545c48&offset="


def send_to_discord(message):
    payload = {
        "username": "Cricket Live",
        "avatar_url": "https://i.imgur.com/pEURUtL_d.webp?maxwidth=1520&fidelity=grand",
        "content": message,
    }
    try:
        res = requests.post(WEBHOOK_URL, json=payload)
        res.raise_for_status()
        print("Message sent to Discord successfully.")
    except requests.exceptions.RequestException as e:
        print(f"Failed to send message to Discord: {e}")


def fetch_live_cricket_scores():
    try:
        res = requests.get(API_KEY)
        res.raise_for_status()
        data = res.json().get("data", [])
        if not data:
            return None
        
        for match in data:
            if match.get("status") and "live" in match.get("status").lower():
                team1 = match.get("team-1", [{}][0]).get("name", "Team1")
                team2 = match.get("team-2", [{}][0]).get("name", "Team2")
                match_type = match.get("matchType", "Unknown Type").upper()
                status = match.get("status", "Status not available")
                score_list = match.get("score", [])
                scores = " | ".join(
                    [f"{s['inning']}: {s['r']}/{s['w']} ({s['o']} ov)" for s in score_list]
                ) if score_list else "No score yet"

                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                return f"**{team1} vs {team2}**\nType: {match_type}\nScores: {scores}\nStatus: {status}\nTime: {timestamp}"
            
        return None
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch cricket scores: {e}")
        return None
    

if __name__ == "__main__":
    message = fetch_live_cricket_scores()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if message:
        send_to_discord(message)
    else:
        send_to_discord(f"No live matches at the moment. Checked at {timestamp}.")

        