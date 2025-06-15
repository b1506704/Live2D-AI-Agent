import logging
from flask import Flask, send_from_directory, request, jsonify, session, send_file
import os
from transformers import AutoModelForCausalLM, AutoTokenizer
from functools import wraps
from pyutils.user_settings import get_user_settings, save_user_settings
from pyutils.asset_controller import AssetController
import re
import zipfile
import io
import torch
import json

app = Flask(__name__, static_folder='dist')
app.secret_key = 'dev_secret_key'  # For session

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

# Initialize asset controller for storage (user-uploaded assets)
STORAGE_PATH = os.path.join(os.path.dirname(__file__), 'storage')
asset_controller = AssetController(STORAGE_PATH)

# --- Chat Model Management ---
CHAT_MODELS = {
    "Qwen3-1.7B": {
        "name": "Qwen/Qwen3-1.7B",
        "dir": "models/Qwen3-1.7B",
        "default_language": "ja"  # Set default language to Japanese
    }
}

# Agent personalities and prompts
AGENT_PERSONALITIES = {
    'haru_greeter_t05': {
        'name': 'Haru',
        'personality': 'cheerful, friendly, and helpful',
        'system_prompt': '''You are Haru, a cheerful and friendly AI assistant. Your personality traits:
- Always enthusiastic and positive
- Helpful and caring
- Casual but professional
- Uses emoticons occasionally to express feelings
Please respond in a way that matches this personality while helping users.'''
    }
}

def get_agent_prompt(model_path):
    if not model_path:
        return "You are a helpful AI assistant."
    model_name = model_path.split('/')[-1].replace('.model3.json', '').replace('.model.json', '')
    agent = AGENT_PERSONALITIES.get(model_name, {
        'name': model_name.replace('_', ' ').title(),
        'personality': 'helpful and friendly',
        'system_prompt': f"You are {model_name.replace('_', ' ').title()}, a helpful AI assistant."
    })
    return agent['system_prompt']

loaded_models = {}

def get_chat_model(model_key):
    if model_key not in loaded_models:
        model_info = CHAT_MODELS[model_key]
        tokenizer = AutoTokenizer.from_pretrained(model_info["name"], cache_dir=model_info["dir"], trust_remote_code=True)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = AutoModelForCausalLM.from_pretrained(model_info["name"], cache_dir=model_info["dir"], trust_remote_code=True).to(device)
        loaded_models[model_key] = (tokenizer, model, device)
    return loaded_models[model_key]

def classify_intent(prompt, model_name):
    system_prompt = (
        "You are an intent classifier for an AI agent. "
        "Given a user message, reply ONLY with a JSON object: "
        '{"intent": "list-assets"|"delete-asset"|"rename-asset"|"download-asset"|"normal-chat", "args": {...}}. '
        "If the user wants to list, delete, rename, or download assets, set the intent accordingly. "
        "Otherwise, set intent to 'normal-chat'. "
        "For delete, rename, or download, extract the asset path(s) as args. "
        "For rename, provide both old and new path in args. "
        "If you are unsure, default to 'normal-chat'.\n"
        "Examples:\n"
        "User: 'Can you show me my files?'\n"
        'Reply: {"intent": "list-assets", "args": {}}\n'
        "User: 'List all uploaded files.'\n"
        'Reply: {"intent": "list-assets", "args": {}}\n'
        "User: 'What files do I have?'\n"
        'Reply: {"intent": "list-assets", "args": {}}\n'
        "User: 'Show me everything I uploaded.'\n"
        'Reply: {"intent": "list-assets", "args": {}}\n'
        "User: 'Remove the file called test.txt'\n"
        'Reply: {"intent": "delete-asset", "args": {"path": "test.txt"}}\n'
        "User: 'Delete foo.png'\n"
        'Reply: {"intent": "delete-asset", "args": {"path": "foo.png"}}\n'
        "User: 'Erase the document report.pdf'\n"
        'Reply: {"intent": "delete-asset", "args": {"path": "report.pdf"}}\n'
        "User: 'I want to rename foo.txt to bar.txt'\n"
        'Reply: {"intent": "rename-asset", "args": {"old_path": "foo.txt", "new_path": "bar.txt"}}\n'
        "User: 'Change the name of old.doc to new.doc'\n"
        'Reply: {"intent": "rename-asset", "args": {"old_path": "old.doc", "new_path": "new.doc"}}\n'
        "User: 'Can you download the report.pdf?'\n"
        'Reply: {"intent": "download-asset", "args": {"path": "report.pdf"}}\n'
        "User: 'Get me the file data.csv'\n"
        'Reply: {"intent": "download-asset", "args": {"path": "data.csv"}}\n'
        "User: 'How are you today?'\n"
        'Reply: {"intent": "normal-chat", "args": {}}\n'
        "User: 'Tell me a joke.'\n"
        'Reply: {"intent": "normal-chat", "args": {}}\n'
        "User: 'Can you help me?'\n"
        'Reply: {"intent": "normal-chat", "args": {}}\n'
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]
    tokenizer, model, device = get_chat_model(model_name)
    input_ids = tokenizer.apply_chat_template(messages, return_tensors="pt").to(device)
    output = model.generate(input_ids, max_new_tokens=128, do_sample=False)
    response = tokenizer.decode(output[0][input_ids.shape[-1]:], skip_special_tokens=True)
    response = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL | re.IGNORECASE)
    response = re.sub(r'</?think>', '', response, flags=re.IGNORECASE)
    return response.strip()

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        prompt = data.get('prompt', '')
        model_name = data.get('model', 'Qwen3-1.7B')

        # Step 1: Classify intent
        intent_json = classify_intent(prompt, model_name)
        try:
            intent_data = json.loads(intent_json)
        except Exception:
            intent_data = {"intent": "normal-chat", "args": {}}

        intent = intent_data.get("intent", "normal-chat")
        args = intent_data.get("args", {})

        # Step 2: Route based on intent
        if intent == "list-assets":
            assets = asset_controller.list_assets()
            response = "Here are the available assets:\n" + "\n".join(assets)
            return jsonify({'response': response})
        elif intent == "delete-asset":
            path = args.get('path')
            if path and asset_controller.delete_asset(path):
                return jsonify({'response': f"Successfully deleted asset: {path}"})
            return jsonify({'response': f"Failed to delete asset: {path or '[no path provided]'}"})
        elif intent == "rename-asset":
            old_path = args.get('old_path')
            new_path = args.get('new_path')
            if old_path and new_path and asset_controller.rename_asset(old_path, new_path):
                return jsonify({'response': f"Successfully renamed asset from {old_path} to {new_path}"})
            return jsonify({'response': f"Failed to rename asset from {old_path or '[no old path]'} to {new_path or '[no new path]'}"})
        elif intent == "download-asset":
            path = args.get('path')
            if path:
                # Return a message with a download link (frontend can handle it)
                url = f"/api/assets/download?path={path}"
                return jsonify({'response': f"Click [here]({url}) to download asset: {path}"})
            return jsonify({'response': 'No asset path provided for download.'})
        else:
            # Normal chat
            model_info = CHAT_MODELS.get(model_name)
            if not model_info:
                return jsonify({'error': 'Invalid model name'}), 400
            system_prompt = get_agent_prompt(model_info['name'])
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
            tokenizer, model, device = get_chat_model(model_name)
            input_ids = tokenizer.apply_chat_template(messages, return_tensors="pt").to(device)
            output = model.generate(input_ids, max_new_tokens=256, do_sample=True, temperature=0.7)
            response = tokenizer.decode(output[0][input_ids.shape[-1]:], skip_special_tokens=True)
            response = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL | re.IGNORECASE)
            response = re.sub(r'</?think>', '', response, flags=re.IGNORECASE)
            return jsonify({"response": response.strip()})
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    # Serve the React app's index.html from dist
    return send_from_directory('dist', 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    # Serve static files from dist (React build output)
    return send_from_directory('dist', path)

@app.route('/assets/<path:path>')
def serve_static(path):
    return send_from_directory('./dist/assets', path)

@app.route('/api/tts', methods=['POST'])
def tts_api():
    data = request.json
    text = data.get('text', '')
    # Remove special characters for TTS
    text = re.sub(r'[^\w\s.,!?\-]', '', text)
    pitch = float(data.get('pitch', 1.0))
    speed = float(data.get('speed', 1.0))
    voice = data.get('voice', '')
    gender = data.get('gender', '')
    mood = data.get('mood', '')
    try:
        from pyutils.text_to_speech import generate_voice
        audio_fp = generate_voice(text, pitch=pitch, speed=speed, voice=voice, gender=gender, mood=mood)
        return send_file(audio_fp, mimetype='audio/mpeg', as_attachment=False, download_name='tts.mp3')
    except Exception as e:
        print(f"TTS error: {e}")
        return jsonify({'error': 'TTS failed', 'details': str(e)}), 500

# --- Simple Auth Decorator ---
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if username == 'demo' and password == 'demo':
        session['logged_in'] = True
        session['username'] = username
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('logged_in', None)
    return jsonify({'success': True})

@app.route('/api/settings/tts', methods=['GET', 'POST'])
@login_required
def tts_settings():
    username = session.get('username', 'default')
    if request.method == 'GET':
        return jsonify(get_user_settings(username))
    elif request.method == 'POST':
        data = request.json
        save_user_settings(username, data)
        return jsonify({'success': True})

@app.route('/api/assets/list')
def list_assets():
    try:
        directory = request.args.get('directory', '')
        assets = asset_controller.list_assets(directory)
        return jsonify(assets)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assets/delete', methods=['POST'])
def delete_asset():
    try:
        data = request.json
        path = data.get('path')
        if not path:
            return jsonify({'error': 'No path provided'}), 400
            
        if asset_controller.delete_asset(path):
            return jsonify({'success': True})
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assets/rename', methods=['POST'])
def rename_asset():
    try:
        data = request.json
        old_path = data.get('old_path')
        new_path = data.get('new_path')
        
        if not old_path or not new_path:
            return jsonify({'error': 'Missing path parameters'}), 400
            
        if asset_controller.rename_asset(old_path, new_path):
            return jsonify({'success': True})
        return jsonify({'error': 'File not found or rename failed'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assets/download')
def download_asset():
    try:
        paths = request.args.getlist('path')
        if not paths:
            return jsonify({'error': 'No paths provided'}), 400
            
        if len(paths) == 1:
            # Single file download
            path = paths[0]
            if not asset_controller.validate_path(path):
                return jsonify({'error': 'Invalid path'}), 400
                
            full_path = os.path.join(STORAGE_PATH, path)
            if not os.path.exists(full_path):
                return jsonify({'error': 'File not found'}), 404
                
            return send_file(full_path, as_attachment=True)
        else:
            # Multiple files - create zip
            result = asset_controller.create_download_zip(paths)
            if not result:
                return jsonify({'error': 'Failed to create zip'}), 500
                
            memory_file, size = result
            return send_file(
                memory_file,
                mimetype='application/zip',
                as_attachment=True,
                download_name='assets.zip'
            )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assets/upload', methods=['POST'])
@login_required
def upload_asset():
    if 'file' not in request.files:
        return 'No file part', 400
    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400
    save_path = os.path.join(STORAGE_PATH, file.filename)
    file.save(save_path)
    return 'Uploaded', 200

@app.route('/api/assets/preview')
def preview_asset():
    try:
        path = request.args.get('path')
        if not path:
            return jsonify({'error': 'No path provided'}), 400
            
        if not asset_controller.validate_path(path):
            return jsonify({'error': 'Invalid path'}), 400
            
        full_path = os.path.join(STORAGE_PATH, path)
        if not os.path.exists(full_path):
            return jsonify({'error': 'File not found'}), 404
            
        asset_type = asset_controller.get_asset_type(path)
        
        if asset_type in ['image', 'audio']:
            return send_file(full_path)
        else:
            # For text-based files, return content
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return jsonify({'content': content})
            except Exception:
                return jsonify({'error': 'Cannot preview file'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)