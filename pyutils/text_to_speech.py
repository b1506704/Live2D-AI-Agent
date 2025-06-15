from gtts import gTTS
import librosa
from pydub import AudioSegment
from io import BytesIO
import soundfile as sf
import tempfile
import os

def generate_voice(text, pitch=1.0, speed=1.0, voice='', gender='', mood=''):
    # Map common extended codes to gTTS-compatible codes
    lang_map = {
        'ja-JP': 'ja',
        'en-US': 'en',
        'en-GB': 'en',
        'zh-CN': 'zh-CN',
        'zh': 'zh-CN',
    }
    lang = lang_map.get(voice, voice) if voice else "ja"
    tts_fp = BytesIO()
    tts = gTTS(text, lang=lang)
    tts.write_to_fp(tts_fp)
    tts_fp.seek(0)
    # If pitch/speed unchanged, return mp3 BytesIO
    if pitch == 1.0 and speed == 1.0:
        tts_fp.seek(0)
        return tts_fp
    # Else, process with librosa and pydub
    audio = AudioSegment.from_file(tts_fp, format='mp3')
    wav_fp = BytesIO()
    audio.export(wav_fp, format='wav')
    wav_fp.seek(0)
    # Write to temp file, close it, then load with librosa
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_wav:
        tmp_wav.write(wav_fp.read())
        tmp_wav_path = tmp_wav.name
    try:
        y, sr = librosa.load(tmp_wav_path, sr=None)
        if pitch != 1.0:
            n_steps = 12 * (pitch - 1.0)
            y = librosa.effects.pitch_shift(y=y, sr=sr, n_steps=n_steps)
        if speed != 1.0:
            y = librosa.effects.time_stretch(y=y, rate=speed)
        out_wav_fp = BytesIO()
        sf.write(out_wav_fp, y, sr, format='WAV')
        out_wav_fp.seek(0)
        processed_audio = AudioSegment.from_file(out_wav_fp, format='wav')
        out_mp3_fp = BytesIO()
        processed_audio.export(out_mp3_fp, format='mp3')
        out_mp3_fp.seek(0)
        return out_mp3_fp
    finally:
        if os.path.exists(tmp_wav_path):
            os.remove(tmp_wav_path)
