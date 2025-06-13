import json
import logging
from flask import Flask, send_from_directory, request, jsonify, session, redirect
import os
import glob
from transformers import AutoModelForCausalLM, AutoTokenizer
from functools import wraps

app = Flask(__name__, static_folder='dist')
app.secret_key = 'dev_secret_key'  # For session

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

# --- Chat Model Management ---
CHAT_MODELS = {
    "Qwen3-1.7B": {
        "name": "Qwen/Qwen3-1.7B",
        "dir": "models/Qwen3-1.7B"
    }
}

# Agent personalities and prompts
AGENT_PERSONALITIES = {
    'haru_greeter_t03': {
        'name': 'Haru',
        'personality': 'cheerful, friendly, and helpful',
        'system_prompt': '''You are Haru, a cheerful and friendly AI assistant. Your personality traits:
- Always enthusiastic and positive
- Helpful and caring
- Casual but professional
- Uses emoticons occasionally to express feelings
Please respond in a way that matches this personality while helping users.'''
    },
    'shizuku': {
        'name': 'Shizuku',
        'personality': 'calm, knowledgeable, and professional',
        'system_prompt': '''You are Shizuku, a calm and knowledgeable AI guide. Your personality traits:
- Professional and composed
- Detailed and thorough
- Gentle but direct
- Formal yet approachable
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

@app.route('/api/list_models')
def list_models():
    return jsonify(list(CHAT_MODELS.keys()))

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    prompt = data.get('prompt', '')
    model_key = data.get('model', 'Qwen3-1.7B')
    tokenizer, model = get_chat_model(model_key)
    system_prompt = "你是一个乐于助人的中文AI助手，请用简体中文回答用户的问题。"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]
    input_ids = tokenizer.apply_chat_template(messages, return_tensors="pt").cuda()
    output = model.generate(input_ids, max_new_tokens=256, do_sample=True, temperature=0.7)
    response = tokenizer.decode(output[0][input_ids.shape[-1]:], skip_special_tokens=True)
    # Remove <think>...</think> tags if present
    import re
    response = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL)
    return jsonify({"response": response.strip()})

# --- Live2D Model Management ---
@app.route('/api/list_live2d_models')
def list_live2d_models():
    # Search for model3.json and model.json files in assets
    haru_models = glob.glob('public/assets/haru/*.model3.json')
    shizuku_models = glob.glob('public/assets/shizuku/*.model.json')
    models = haru_models + shizuku_models
    # Return relative paths for frontend
    models = [os.path.relpath(m, 'public') for m in models]
    return jsonify(models)

@app.route('/api/upload_live2d_model', methods=['POST'])
def upload_live2d_model():
    if 'file' not in request.files:
        return 'No file part', 400
    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400
    save_path = os.path.join('public/assets/uploaded', file.filename)
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    file.save(save_path)
    return 'File uploaded', 200

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/assets/<path:path>')
def serve_static(path):
    return send_from_directory('./dist/assets', path)

@app.route('/api/tts', methods=['POST'])
def tts_api():
    data = request.json
    text = data.get('text', '')
    pitch = float(data.get('pitch', 1.0))
    speed = float(data.get('speed', 1.0))
    # Use a temp file for output
    tmp_audio_path = 'tmp/tmp_webui.mp3'
    from pyutils.live2d_control import my_tts
    my_tts(text, tmp_audio_path, pitch=pitch, speed=speed)
    # Return the audio file as a response
    from flask import send_file
    return send_file(tmp_audio_path, mimetype='audio/mpeg')

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
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('logged_in', None)
    return jsonify({'success': True})

# --- Live2D Asset Management ---
@app.route('/api/assets/list', methods=['GET'])
@login_required
def list_assets():
    base = 'public/assets'
    asset_list = []
    for root, dirs, files in os.walk(base):
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), 'public')
            asset_list.append(rel)
    return jsonify(asset_list)

@app.route('/api/assets/upload', methods=['POST'])
@login_required
def upload_asset():
    if 'file' not in request.files:
        return 'No file part', 400
    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400
    save_path = os.path.join('public/assets/uploaded', file.filename)
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    file.save(save_path)
    return 'File uploaded', 200

@app.route('/api/assets/delete', methods=['POST'])
@login_required
def delete_asset():
    data = request.json
    rel_path = data.get('path')
    if not rel_path or '..' in rel_path:
        return 'Invalid path', 400
    abs_path = os.path.join('public', rel_path)
    if os.path.exists(abs_path):
        os.remove(abs_path)
        return 'Deleted', 200
    return 'File not found', 404

if __name__ == '__main__':
    app.run(port=4800, host="0.0.0.0")