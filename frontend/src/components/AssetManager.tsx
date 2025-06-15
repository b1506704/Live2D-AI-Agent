import React, { useState, useEffect, useRef } from 'react';
import {
  FaFileImage, FaFileAudio, FaFileAlt, FaDownload, FaTrash, FaUpload, FaRobot, FaTimes, FaSearch, FaSortAmountDown, FaSortAmountUp, FaSync, FaEdit, FaCheck, FaCopy
} from 'react-icons/fa';

interface AssetManagerProps {
  onLoadModel: (modelPath: string) => void;
  stagedFiles: File[];
  onStageFiles: (files: FileList | File[]) => void;
  onRemoveStaged: (index: number) => void;
  onCommitUpload: () => void;
  uploading: boolean;
  uploadProgress: { current: number; total: number };
  deleteProgress: { current: number; total: number };
  downloadProgress: { current: number; total: number };
  confirmModal: {
    open: boolean;
    action: null | (() => void);
    message: string;
  };
  showConfirm: (message: string, action: () => void) => void;
  hideConfirm: () => void;
  renaming: string | null;
  setRenaming: React.Dispatch<React.SetStateAction<string | null>>;
  renameValue: string;
  setRenameValue: React.Dispatch<React.SetStateAction<string>>;
  handleDelete: (assetToDelete: string | string[]) => void;
  handleDownload: (assetToDownload: string | string[]) => void;
  fileUploadProgress: number[];
  fileDeleteProgress: number[];
  fileDownloadProgress: number[];
  assets: string[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  refreshing: boolean;
  fetchAssets: () => Promise<void>;
  error: string;
}

type AssetType = 'image' | 'audio' | 'model' | 'other';

function getAssetType(path: string): AssetType {
  if (path.match(/\.(png|jpg|jpeg|gif|webp)$/i)) return 'image';
  if (path.match(/\.(mp3|wav|ogg)$/i)) return 'audio';
  if (path.match(/\.(moc3|model3\.json|model\.json)$/i)) return 'model';
  return 'other';
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/');
}

const PAGE_SIZE = 8;
const assetTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'image', label: 'Images' },
  { value: 'audio', label: 'Audio' },
  { value: 'model', label: 'Models' },
  { value: 'other', label: 'Other' },
];

interface PreviewData {
  type: AssetType | 'text';
  url?: string;
  content?: string;
}

const AssetManager: React.FC<AssetManagerProps> = ({
  onLoadModel,
  stagedFiles,
  onStageFiles,
  onRemoveStaged,
  onCommitUpload,
  uploading,
  uploadProgress,
  fileUploadProgress,
  deleteProgress,
  fileDeleteProgress,
  downloadProgress,
  fileDownloadProgress,
  confirmModal,
  showConfirm,
  hideConfirm,
  renaming,
  setRenaming,
  renameValue,
  setRenameValue,
  handleDelete,
  handleDownload,
  assets,
  selected,
  setSelected,
  refreshing,
  fetchAssets,
  error
}) => {
  const [filteredAssets, setFilteredAssets] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAssetType, setSelectedAssetType] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewName, setPreviewName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [zipDownloadProgress, setZipDownloadProgress] = useState(0);
  const [zipDownloading, setZipDownloading] = useState(false);
  const [zipDownloadError, setZipDownloadError] = useState('');
  const [deleteProgressModal, setDeleteProgressModal] = useState(0);
  const [deleteTotalModal, setDeleteTotalModal] = useState(0);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  useEffect(() => {
    console.log('AssetManager mounted');
  }, []);

  useEffect(() => {
    let filtered = assets;
    if (searchTerm) {
      filtered = filtered.filter(asset => asset.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (selectedAssetType) {
      filtered = filtered.filter(asset => getAssetType(asset) === selectedAssetType);
    }
    filtered = [...filtered];
    if (sortOrder === 'asc') filtered.sort();
    else filtered.sort().reverse();
    setFilteredAssets(filtered);
  }, [assets, searchTerm, selectedAssetType, sortOrder]);

  // Reset currentPage to 1 only when assets list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [assets]);

  const handleDeleteAssets = (assetToDelete: string | string[]) => {
    const toDelete = Array.isArray(assetToDelete) ? assetToDelete : [assetToDelete];
    showConfirm(
      `Are you sure you want to delete ${toDelete.length > 1 ? 'these files' : 'this file'}? This action cannot be undone!`,
      async () => {
        setDeleteProgressModal(0);
        setDeleteTotalModal(toDelete.length);
        setDeleteInProgress(true);
        setDeleteError('');
        try {
          for (let i = 0; i < toDelete.length; i++) {
            const asset = toDelete[i];
            const res = await fetch('/api/assets/delete', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: asset })
            });
            if (!res.ok) {
              throw new Error(`Failed to delete ${asset}`);
            }
            setDeleteProgressModal(i + 1);
          }
          setSelected(new Set());
          await fetchAssets();
          setTimeout(() => setDeleteInProgress(false), 1200);
        } catch (e: any) {
          setDeleteError(e.message || 'Delete error');
          setTimeout(() => setDeleteInProgress(false), 2000);
        } finally {
          hideConfirm();
        }
      }
    );
  };

  const handleDownloadAssets = async (assetToDownload: string | string[]) => {
    const toDownload = Array.isArray(assetToDownload) ? assetToDownload : [assetToDownload];
    if (toDownload.length === 1) {
      setZipDownloadProgress(0);
      setZipDownloading(true);
      setZipDownloadError('');
      try {
        const response = await fetch(`/api/assets/download?path=${encodeURIComponent(toDownload[0])}`, {
          method: 'GET',
          credentials: 'include',
        });
        if (!response.ok || !response.body) {
          throw new Error('Failed to download file');
        }
        const contentLength = response.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        const reader = response.body.getReader();
        let received = 0;
        let chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (total) {
              setZipDownloadProgress(Math.round((received / total) * 100));
            }
          }
        }
        const blob = new Blob(chunks);
        setZipDownloadProgress(100);
        // Download the file
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Try to get filename from Content-Disposition header
        const disposition = response.headers.get('Content-Disposition');
        let filename = toDownload[0].split('/').pop() || 'downloaded_file';
        if (disposition && disposition.includes('filename=')) {
          const match = disposition.match(/filename="?([^";]+)"?/);
          if (match && match[1]) filename = match[1];
        }
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setTimeout(() => setZipDownloading(false), 1200);
      } catch (err: any) {
        setZipDownloadError(err.message || 'Download failed');
        setTimeout(() => setZipDownloading(false), 2000);
      }
    } else if (toDownload.length > 1) {
      setZipDownloadProgress(0);
      setZipDownloading(true);
      setZipDownloadError('');
      try {
        const response = await fetch('/api/assets/download-zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: toDownload }),
          credentials: 'include',
        });
        if (!response.ok || !response.body) {
          throw new Error('Failed to download zip');
        }
        const contentLength = response.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        const reader = response.body.getReader();
        let received = 0;
        let chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (total) {
              setZipDownloadProgress(Math.round((received / total) * 100));
            }
          }
        }
        const blob = new Blob(chunks, { type: 'application/zip' });
        setZipDownloadProgress(100);
        // Download the file
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Generate filename with current datetime
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const datetime = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        a.download = `assets-${datetime}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setTimeout(() => setZipDownloading(false), 1200);
      } catch (err: any) {
        setZipDownloadError(err.message || 'Download failed');
        setTimeout(() => setZipDownloading(false), 2000);
      }
    }
  };

  const handlePreview = async (asset: string) => {
    setPreview(null);
    setPreviewName(asset);
    try {
      const type = getAssetType(asset);
      if (type === 'image' || type === 'audio') {
        setPreview({ type, url: `/api/assets/preview?path=${encodeURIComponent(asset)}` });
      } else if (type === 'model' || type === 'other') {
        const res = await fetch(`/api/assets/preview?path=${encodeURIComponent(asset)}`);
        if (res.ok) {
          const data = await res.json();
          setPreview({ type: 'text', content: data.content });
        } else {
          setPreview({ type: 'text', content: 'Unable to preview file.' });
        }
      }
    } catch (e: any) {
      setPreview({ type: 'text', content: 'Preview error.' });
    }
  };

  const handleRename = async (oldPath: string, newPath: string) => {
    if (!newPath || oldPath === newPath) return setRenaming(null);
    try {
      const res = await fetch('/api/assets/rename', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_path: oldPath, new_path: newPath })
      });
      if (!res.ok) throw new Error('Rename failed');
      setRenaming(null);
      setRenameValue('');
      await fetchAssets();
    } catch (e: any) {
      console.error(e.message || 'Rename error');
    }
  };

  const toggleSelect = (asset: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(asset)) next.delete(asset);
      else next.add(asset);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(assets));
  const clearSelection = () => setSelected(new Set());

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files.length) return;
    onStageFiles(e.dataTransfer.files);
  };

  const indexOfLastAsset = currentPage * PAGE_SIZE;
  const indexOfFirstAsset = indexOfLastAsset - PAGE_SIZE;
  const currentAssets = filteredAssets.slice(indexOfFirstAsset, indexOfLastAsset);
  const totalPages = Math.ceil(filteredAssets.length / PAGE_SIZE);

  return (
    <div className="w-full" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
      <div className="flex flex-wrap gap-2 mb-2 items-center">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="p-2 rounded border border-gray-300 flex-1 min-w-[120px]"
        />
        <select value={selectedAssetType} onChange={e => setSelectedAssetType(e.target.value)} className="rounded border p-2">
          {assetTypeOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')} className={`p-2 rounded border bg-white hover:bg-gray-100 flex items-center gap-1 ${sortOrder === 'asc' ? 'ring-2 ring-fuchsia-400' : ''}`}
          title={`Sort ${sortOrder === 'asc' ? 'A→Z' : 'Z→A'}`}
        >
          <span className="font-semibold">Sort</span>
          {sortOrder === 'asc' ? <FaSortAmountUp /> : <FaSortAmountDown />}
        </button>
        <button onClick={fetchAssets} className="p-2 rounded border bg-white hover:bg-gray-100" title="Refresh" disabled={refreshing}>
          <FaSync className={refreshing ? 'animate-spin' : ''} />
        </button>
        <label className="cursor-pointer bg-gradient-to-r from-green-400 to-blue-500 text-white px-4 py-2 rounded shadow hover:from-green-500 hover:to-blue-600 transition text-center flex items-center gap-2">
          <FaUpload /> Upload
          <input ref={fileInputRef} type="file" className="hidden" onChange={e => {
            const files = e.target.files;
            if (!files || !files.length) return;
            onStageFiles(files);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }} multiple disabled={uploading} />
        </label>
        {stagedFiles.length > 0 && (
          <div className="w-full bg-blue-50 border border-blue-200 rounded p-2 mt-2">
            <div className="font-semibold mb-1">Staged Files:</div>
            <ul className="mb-2">
              {stagedFiles.map((file, idx) => (
                <li key={file.name + idx} className="flex items-center gap-2 mb-1">
                  <span className="truncate flex-1">{file.name}</span>
                  <button onClick={() => onRemoveStaged(idx)} className="text-red-500 hover:text-red-700"><FaTimes /></button>
                </li>
              ))}
            </ul>
            {uploading && uploadProgress.total > 0 && (
              <div className="w-full bg-gray-200 rounded h-4 mb-2 overflow-hidden">
                <div
                  className="bg-fuchsia-500 h-4 transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                ></div>
                <div className="absolute left-1/2 top-0 text-xs text-white font-bold" style={{transform: 'translateX(-50%)'}}>
                  {uploadProgress.current} / {uploadProgress.total} uploading...
                </div>
              </div>
            )}
            {deleteProgress.total > 0 && (
              <div className="w-full bg-gray-200 rounded h-4 mb-2 overflow-hidden relative">
                <div
                  className="bg-red-500 h-4 transition-all duration-300"
                  style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }}
                ></div>
                <div className="absolute left-1/2 top-0 text-xs text-white font-bold" style={{transform: 'translateX(-50%)'}}>
                  {deleteProgress.current} / {deleteProgress.total} deleting...
                </div>
              </div>
            )}
            {downloadProgress.total > 0 && (
              <div className="w-full bg-gray-200 rounded h-4 mb-2 overflow-hidden relative">
                <div
                  className="bg-blue-500 h-4 transition-all duration-300"
                  style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                ></div>
                <div className="absolute left-1/2 top-0 text-xs text-white font-bold" style={{transform: 'translateX(-50%)'}}>
                  {downloadProgress.current} / {downloadProgress.total} downloading...
                </div>
              </div>
            )}
            {uploading && fileUploadProgress.length > 0 && (
              <div className="w-full mb-2">
                <div className="font-semibold text-xs mb-1">Per-file Upload Progress:</div>
                <ul>
                  {stagedFiles.map((file, idx) => (
                    <li key={file.name + idx} className="mb-1 flex items-center gap-2">
                      <span className="truncate flex-1 text-xs">{file.name}</span>
                      <div className="flex-1 bg-gray-200 rounded h-3 overflow-hidden relative">
                        <div
                          className="bg-fuchsia-500 h-3 transition-all duration-300"
                          style={{ width: `${fileUploadProgress[idx] || 0}%` }}
                        ></div>
                        <span className="absolute left-1/2 top-0 text-[10px] text-white font-bold" style={{transform: 'translateX(-50%)'}}>
                          {fileUploadProgress[idx] || 0}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {deleteProgress.total > 0 && fileDeleteProgress.length > 0 && (
              <div className="w-full mb-2">
                <div className="font-semibold text-xs mb-1">Per-file Delete Progress:</div>
                <ul>
                  {Array.from({ length: deleteProgress.total }).map((_, idx) => (
                    <li key={idx} className="mb-1 flex items-center gap-2">
                      <span className="truncate flex-1 text-xs">Deleting file {idx + 1}</span>
                      <div className="flex-1 bg-gray-200 rounded h-3 overflow-hidden relative">
                        <div
                          className="bg-red-500 h-3 transition-all duration-300"
                          style={{ width: `${fileDeleteProgress[idx] || 0}%` }}
                        ></div>
                        <span className="absolute left-1/2 top-0 text-[10px] text-white font-bold" style={{transform: 'translateX(-50%)'}}>
                          {fileDeleteProgress[idx] || 0}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {downloadProgress.total > 0 && fileDownloadProgress.length > 0 && (
              <div className="w-full mb-2">
                <div className="font-semibold text-xs mb-1">Per-file Download Progress:</div>
                <ul>
                  {Array.from({ length: downloadProgress.total }).map((_, idx) => (
                    <li key={idx} className="mb-1 flex items-center gap-2">
                      <span className="truncate flex-1 text-xs">Downloading file {idx + 1}</span>
                      <div className="flex-1 bg-gray-200 rounded h-3 overflow-hidden relative">
                        <div
                          className="bg-blue-500 h-3 transition-all duration-300"
                          style={{ width: `${fileDownloadProgress[idx] || 0}%` }}
                        ></div>
                        <span className="absolute left-1/2 top-0 text-[10px] text-white font-bold" style={{transform: 'translateX(-50%)'}}>
                          {fileDownloadProgress[idx] || 0}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button onClick={onCommitUpload} className="bg-fuchsia-600 text-white px-4 py-1 rounded hover:bg-fuchsia-700 font-semibold" disabled={uploading}>Commit ({stagedFiles.length})</button>
          </div>
        )}
        {selected.size > 0 && (
          <>
            <button onClick={() => handleDeleteAssets(Array.from(selected))} className="p-2 rounded bg-red-500 text-white hover:bg-red-700 ml-2"><FaTrash /> Delete Selected</button>
            <button onClick={() => handleDownloadAssets(Array.from(selected))} className="p-2 rounded bg-blue-500 text-white hover:bg-blue-700 ml-2"><FaDownload /> Download Selected</button>
            <button onClick={clearSelection} className="p-2 rounded bg-gray-300 text-gray-700 hover:bg-gray-400 ml-2"><FaTimes /> Clear</button>
          </>
        )}
      </div>
      <div className="overflow-x-auto">
        {filteredAssets.length === 0 && !refreshing ? (
          <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-fuchsia-50 to-blue-50 rounded shadow mb-4">
            <FaUpload className="text-6xl text-fuchsia-300 mb-4 animate-bounce" />
            <div className="text-xl font-bold text-fuchsia-700 mb-2">No assets found</div>
            <div className="text-gray-500 mb-2">Your storage is empty. Upload files to get started!</div>
            <div className="text-gray-400 text-xs">(Supported: images, audio, models, and more)</div>
          </div>
        ) : (
          <table className="min-w-full bg-white rounded shadow text-xs sm:text-base">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2"><input type="checkbox" checked={selected.size === currentAssets.length && currentAssets.length > 0} onChange={e => e.target.checked ? selectAll() : clearSelection()} /></th>
                <th className="p-2">Name</th>
                <th className="p-2">Type</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentAssets.map(asset => {
                const type = getAssetType(asset);
                return (
                  <tr key={asset} className="border-b hover:bg-fuchsia-50">
                    <td className="p-2 text-center"><input type="checkbox" checked={selected.has(asset)} onChange={() => toggleSelect(asset)} /></td>
                    <td className="p-2 truncate max-w-[200px]">
                      {renaming === asset ? (
                        <span className="flex items-center gap-1">
                          <input value={renameValue} onChange={e => setRenameValue(e.target.value)} className="border rounded p-1 text-xs" />
                          <button onClick={() => handleRename(asset, renameValue)} className="text-green-600"><FaCheck /></button>
                          <button onClick={() => setRenaming(null)} className="text-gray-400"><FaTimes /></button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span className="truncate cursor-pointer hover:underline" title={asset} onClick={() => handlePreview(asset)}>{asset}</span>
                          <button onClick={() => { setRenaming(asset); setRenameValue(asset); }} className="text-blue-400" title="Rename"><FaEdit /></button>
                          <button onClick={() => { navigator.clipboard.writeText(asset); }} className="text-gray-400" title="Copy path"><FaCopy /></button>
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {type === 'image' && <FaFileImage className="text-fuchsia-500" />}
                      {type === 'audio' && <FaFileAudio className="text-blue-500" />}
                      {type === 'model' && <FaRobot className="text-green-500" />}
                      {type === 'other' && <FaFileAlt className="text-gray-400" />}
                    </td>
                    <td className="p-2 flex gap-1 flex-wrap">
                      <button onClick={() => handlePreview(asset)} className="p-1 rounded bg-gray-200 hover:bg-fuchsia-100" title="Preview"><FaSearch /></button>
                      {type === 'model' && <button onClick={() => onLoadModel(normalizePath(asset))} className="p-1 rounded bg-fuchsia-500 text-white hover:bg-fuchsia-700" title="Load Model"><FaRobot /></button>}
                      <button onClick={() => handleDownload(asset)} className="p-1 rounded bg-blue-500 text-white hover:bg-blue-700" title="Download"><FaDownload /></button>
                      <button onClick={() => handleDelete(asset)} className="p-1 rounded bg-red-500 text-white hover:bg-red-700" title="Delete"><FaTrash /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex gap-1 mt-2 flex-wrap">
        {Array(totalPages).fill(null).map((_, index) => (
          <button key={index} onClick={() => setCurrentPage(index + 1)} className={`px-2 py-1 rounded ${currentPage === index + 1 ? 'bg-fuchsia-600 text-white' : 'bg-gray-200 hover:bg-fuchsia-100'}`}>{index + 1}</button>
        ))}
      </div>
      {preview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-lg w-full relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-2 right-2 text-gray-400 hover:text-fuchsia-600" onClick={() => setPreview(null)}><FaTimes /></button>
            <div className="mb-2 font-bold">Preview: <span className="text-xs text-gray-500">{previewName}</span></div>
            {preview.type === 'image' && <img src={preview.url} alt="preview" className="max-w-full max-h-80 rounded shadow" />}
            {preview.type === 'audio' && <audio src={preview.url} controls className="w-full" />}
            {preview.type === 'text' && <pre className="bg-gray-100 rounded p-2 max-h-80 overflow-auto text-xs whitespace-pre-wrap">{preview.content}</pre>}
          </div>
        </div>
      )}
      {error && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => console.error(error)}>
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-2 right-2 text-gray-400 hover:text-fuchsia-600" onClick={() => console.error(error)}><FaTimes /></button>
            <div className="font-bold text-red-600 mb-2">Error</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
      )}
      {uploading && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center">
            <FaUpload className="text-4xl animate-bounce mb-2 text-fuchsia-600" />
            <div>Uploading... {uploadProgress.current} / {uploadProgress.total}</div>
          </div>
        </div>
      )}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-xs w-full relative animate-fade-in">
            <div className="font-bold text-lg mb-2 text-fuchsia-700">Confirm Action</div>
            <div className="mb-4 text-gray-700">{confirmModal.message}</div>
            <div className="flex gap-2 justify-end">
              <button onClick={hideConfirm} className="px-4 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold">Cancel</button>
              <button onClick={() => { confirmModal.action && confirmModal.action(); }} className="px-4 py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold">Yes</button>
            </div>
          </div>
        </div>
      )}
      {zipDownloading && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-8 flex flex-col items-center min-w-[320px] animate-fade-in">
            <div className="mb-4 flex flex-col items-center">
              {zipDownloadError ? (
                <FaTimes className="text-5xl text-red-500 animate-bounce mb-2" />
              ) : zipDownloadProgress === 100 ? (
                <FaCheck className="text-5xl text-green-500 animate-bounce mb-2" />
              ) : (
                <FaDownload className="text-5xl text-fuchsia-500 animate-bounce mb-2" />
              )}
              <div className="font-bold text-lg mb-2">
                {zipDownloadError
                  ? 'Download Failed'
                  : zipDownloadProgress === 100
                  ? 'Download Complete!'
                  : 'Downloading Zip...'}
              </div>
              <div className="w-full bg-gray-200 rounded h-4 overflow-hidden mb-2">
                <div
                  className={`h-4 transition-all duration-300 ${zipDownloadError ? 'bg-red-400' : 'bg-fuchsia-500'}`}
                  style={{ width: `${zipDownloadProgress}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-600 mb-2">
                {zipDownloadError
                  ? zipDownloadError
                  : `${zipDownloadProgress}%`}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Progress Modal */}
      {deleteInProgress && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-8 flex flex-col items-center min-w-[320px] animate-fade-in">
            <div className="mb-4 flex flex-col items-center">
              {deleteError ? (
                <FaTimes className="text-5xl text-red-500 animate-bounce mb-2" />
              ) : deleteProgressModal === deleteTotalModal && deleteTotalModal > 0 ? (
                <FaCheck className="text-5xl text-green-500 animate-bounce mb-2" />
              ) : (
                <FaTrash className="text-5xl text-red-400 animate-bounce mb-2" />
              )}
              <div className="font-bold text-lg mb-2">
                {deleteError
                  ? 'Delete Failed'
                  : deleteProgressModal === deleteTotalModal && deleteTotalModal > 0
                  ? 'Delete Complete!'
                  : 'Deleting Files...'}
              </div>
              <div className="w-full bg-gray-200 rounded h-4 overflow-hidden mb-2">
                <div
                  className={`h-4 transition-all duration-300 ${deleteError ? 'bg-red-400' : 'bg-red-500'}`}
                  style={{ width: `${deleteTotalModal ? (deleteProgressModal / deleteTotalModal) * 100 : 0}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-600 mb-2">
                {deleteError
                  ? deleteError
                  : `${deleteProgressModal} / ${deleteTotalModal} deleted`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManager;
