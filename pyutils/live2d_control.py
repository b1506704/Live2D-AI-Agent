from gtts import gTTS
import librosa
import time
import pygame
import numpy as np
import os



def my_tts(text, save_path, pitch=1.0, speed=1.0):
    # Ensure the directory exists for the save_path
    dir_name = os.path.dirname(save_path)
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)
    # Remove the file if it already exists to avoid permission issues
    if os.path.exists(save_path):
        try:
            os.remove(save_path)
        except Exception as e:
            print(f"Warning: Could not remove existing file {save_path}: {e}")
    tts = gTTS(text, lang="zh-CN")
    tts.save(save_path)
    # Post-process pitch and speed using librosa if needed
    if pitch != 1.0 or speed != 1.0:
        y, sr = librosa.load(save_path, sr=None)
        if pitch != 1.0:
            # Calculate the number of semitones to shift
            n_steps = 12 * (pitch - 1.0)
            # Use the correct pitch_shift parameters
            y = librosa.effects.pitch_shift(y=y, sr=sr, n_steps=n_steps)
        if speed != 1.0:
            y = librosa.effects.time_stretch(y=y, rate=speed)
        import soundfile as sf
        sf.write(save_path, y, sr)
