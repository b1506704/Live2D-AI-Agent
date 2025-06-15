import os
import json

SETTINGS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../frontend/public/assets/user_settings'))
os.makedirs(SETTINGS_DIR, exist_ok=True)

def get_user_settings(username):
    path = os.path.join(SETTINGS_DIR, f'{username}.json')
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_user_settings(username, settings):
    path = os.path.join(SETTINGS_DIR, f'{username}.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(settings, f)
