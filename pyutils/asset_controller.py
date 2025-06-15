import os
import shutil
import zipfile
import io
from typing import List, Tuple, Optional

class AssetController:
    def __init__(self, base_path: str):
        self.base_path = base_path
        
    def _get_full_path(self, relative_path: str) -> str:
        """Convert relative path to full path and validate it's within base_path"""
        full_path = os.path.abspath(os.path.join(self.base_path, relative_path))
        if not full_path.startswith(self.base_path):
            raise ValueError("Invalid path: Attempting to access outside base directory")
        return full_path
        
    def list_assets(self, directory: str = "") -> List[str]:
        """List all assets in the given directory"""
        full_path = self._get_full_path(directory)
        if not os.path.exists(full_path):
            return []
            
        assets = []
        for root, _, files in os.walk(full_path):
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), self.base_path)
                assets.append(rel_path.replace("\\", "/"))
        return sorted(assets)
        
    def delete_asset(self, asset_path: str) -> bool:
        """Delete an asset file"""
        try:
            full_path = self._get_full_path(asset_path)
            if os.path.exists(full_path):
                os.remove(full_path)
                return True
            return False
        except Exception:
            return False
            
    def rename_asset(self, old_path: str, new_path: str) -> bool:
        """Rename/move an asset file"""
        try:
            old_full = self._get_full_path(old_path)
            new_full = self._get_full_path(new_path)
            
            if not os.path.exists(old_full):
                return False
                
            os.makedirs(os.path.dirname(new_full), exist_ok=True)
            shutil.move(old_full, new_full)
            return True
        except Exception:
            return False
            
    def create_download_zip(self, asset_paths: List[str]) -> Optional[Tuple[io.BytesIO, int]]:
        """Create a zip file containing the requested assets"""
        try:
            memory_file = io.BytesIO()
            with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
                for asset_path in asset_paths:
                    full_path = self._get_full_path(asset_path)
                    if os.path.exists(full_path):
                        zf.write(full_path, asset_path)
            
            memory_file.seek(0)
            size = memory_file.getbuffer().nbytes
            return memory_file, size
        except Exception:
            return None
            
    def get_asset_type(self, asset_path: str) -> str:
        """Determine the type of asset based on file extension"""
        ext = os.path.splitext(asset_path)[1].lower()
        
        if ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
            return 'image'
        elif ext in ['.wav', '.mp3', '.ogg']:
            return 'audio'
        elif ext in ['.model3.json', '.model.json']:
            return 'model'
        elif ext in ['.motion3.json']:
            return 'motion'
        else:
            return 'other'
            
    def validate_path(self, path: str) -> bool:
        """Validate if a path is safe and within base directory"""
        try:
            self._get_full_path(path)
            return True
        except ValueError:
            return False 