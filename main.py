import logging
from flask import Flask, send_from_directory, request, jsonify, session, send_file
import os
from transformers import AutoModelForCausalLM, AutoTokenizer
from functools import wraps
from pyutils.user_settings import get_user_settings, save_user_settings
import re
import zipfile
import io

app = Flask(__name__, static_folder='dist')
app.secret_key = 'dev_secret_key'  # For session

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

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
        model = AutoModelForCausalLM.from_pretrained(model_info["name"], cache_dir=model_info["dir"], trust_remote_code=True).cuda()
        loaded_models[model_key] = (tokenizer, model)
    return loaded_models[model_key]

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    prompt = data.get('prompt', '')
    model_key = data.get('model', 'Qwen3-1.7B')
    model_path = data.get('model_path', '')  # Optionally provided by frontend
    tokenizer, model = get_chat_model(model_key)
    # Use agent-specific system prompt
    system_prompt = get_agent_prompt(model_path)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]
    input_ids = tokenizer.apply_chat_template(messages, return_tensors="pt").cuda()
    output = model.generate(input_ids, max_new_tokens=256, do_sample=True, temperature=0.7)
    response = tokenizer.decode(output[0][input_ids.shape[-1]:], skip_special_tokens=True)
    # Remove <think>...</think> tags if present
    response = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL)
    response = re.sub(r'</think>', '', response, flags=re.IGNORECASE)
    return jsonify({"response": response.strip()})

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

STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'storage'))

@app.route('/api/assets/list', methods=['GET'])
@login_required
def list_assets():
    asset_list = []
    for root, dirs, files in os.walk(STORAGE_DIR):
        for file in files:
            rel_path = os.path.relpath(os.path.join(root, file), STORAGE_DIR)
            asset_list.append(rel_path.replace('\\', '/'))
    return asset_list

@app.route('/api/assets/upload', methods=['POST'])
@login_required
def upload_asset():
    if 'file' not in request.files:
        return 'No file part', 400
    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400
    save_path = os.path.join(STORAGE_DIR, file.filename)
    file.save(save_path)
    return 'Uploaded', 200

@app.route('/api/assets/download', methods=['GET'])
@login_required
def download_asset():
    rel_path = request.args.get('path')
    if not rel_path or '..' in rel_path:
        return 'Invalid path', 400
    abs_path = os.path.join(STORAGE_DIR, rel_path)
    if os.path.exists(abs_path):
        return send_from_directory(os.path.dirname(abs_path), os.path.basename(abs_path), as_attachment=True)
    return 'File not found', 404

@app.route('/api/assets/delete', methods=['POST'])
@login_required
def delete_asset():
    data = request.json
    path = data.get('path')
    if not path or '..' in path:
        return 'Invalid path', 400
    abs_path = os.path.join(STORAGE_DIR, path)
    if os.path.exists(abs_path):
        os.remove(abs_path)
        return 'Deleted', 200
    return 'File not found', 404

@app.route('/api/assets/rename', methods=['POST'])
@login_required
def rename_asset():
    data = request.json
    old_path = data.get('old_path')
    new_path = data.get('new_path')
    if not old_path or not new_path or '..' in old_path or '..' in new_path:
        return 'Invalid path', 400
    abs_old = os.path.join(STORAGE_DIR, old_path)
    abs_new = os.path.join(STORAGE_DIR, new_path)
    if os.path.exists(abs_old):
        os.makedirs(os.path.dirname(abs_new), exist_ok=True)
        os.rename(abs_old, abs_new)
        return 'Renamed', 200
    return 'File not found', 404

@app.route('/api/assets/preview', methods=['GET'])
@login_required
def preview_asset():
    rel_path = request.args.get('path')
    if not rel_path or '..' in rel_path:
        return 'Invalid path', 400
    abs_path = os.path.join(STORAGE_DIR, rel_path)
    if not os.path.exists(abs_path):
        return 'File not found', 404
    ext = os.path.splitext(abs_path)[1].lower()
    if ext in ['.png', '.jpg', '.jpeg', '.gif']:
        return send_from_directory(os.path.dirname(abs_path), os.path.basename(abs_path))
    elif ext in ['.mp3', '.wav', '.ogg']:
        return send_from_directory(os.path.dirname(abs_path), os.path.basename(abs_path))
    elif ext in ['.json', '.moc3', '.model3.json', '.model.json']:
        with open(abs_path, 'r', encoding='utf-8') as f:
            content = f.read(2048)  # Only preview first 2KB
        return jsonify({'type': 'text', 'content': content})
    else:
        return jsonify({'type': 'unknown', 'message': 'Preview not supported for this file type.'})

@app.route('/api/assets/download-zip', methods=['POST'])
@login_required
def download_assets_zip():
    data = request.json
    paths = data.get('paths', [])
    if not isinstance(paths, list) or not paths:
        return 'No files specified', 400

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w') as zipf:
        for rel_path in paths:
            if '..' in rel_path:
                continue
            abs_path = os.path.join(STORAGE_DIR, rel_path)
            if os.path.exists(abs_path):
                zipf.write(abs_path, arcname=rel_path)
    zip_buffer.seek(0)
    return send_file(zip_buffer, mimetype='application/zip', as_attachment=True, download_name='assets.zip')

if __name__ == '__main__':
    app.run(port=5000, host="0.0.0.0")