import { useState, useEffect } from 'react';
import { FaFileImage, FaFileAudio, FaFileAlt, FaDownload, FaTrash, FaUpload, FaRobot, FaTimes, FaSearch, FaSortAmountDown, FaSortAmountUp, FaSync } from 'react-icons/fa';

function getAssetType(path) {
  if (path.match(/\.(png|jpg|jpeg|gif|webp)$/i)) return 'image';
  if (path.match(/\.(mp3|wav|ogg)$/i)) return 'audio';
  if (path.match(/\.(moc3|model3\.json|model\.json)$/i)) return 'model';
  return 'other';
}

function normalizePath(path) {
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

function AssetManager({ onLoadModel }) {
  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [renameValue, setRenameValue] = useState('');
  const [checked, setChecked] = useState({});
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    const res = await fetch('/api/assets/list', { credentials: 'include' });
    if (res.ok) {
      setAssets(await res.json());
    }
  }

  function handleFileInput(e) {
    setStagedFiles(Array.from(e.target.files));
  }

  function removeStagedFile(idx) {
    setStagedFiles(files => files.filter((_, i) => i !== idx));
  }

  function openConfirm(message, action) {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirm(true);
  }
  function handleConfirm(ok) {
    setShowConfirm(false);
    if (ok && confirmAction) confirmAction();
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!stagedFiles.length) return;
    openConfirm('Upload all staged files?', () => handleUploadConfirmed());
  }

  async function handleUploadConfirmed() {
    setUploading(true);
    setUploadProgress(0);
    for (let i = 0; i < stagedFiles.length; i++) {
      const file = stagedFiles[i];
      const formData = new FormData();
      formData.append('file', file);
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/assets/upload');
        xhr.withCredentials = true;
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round(((i + event.loaded / event.total) / stagedFiles.length) * 100));
          }
        };
        xhr.onload = () => resolve();
        xhr.onerror = () => reject();
        xhr.send(formData);
      });
    }
    setUploadProgress(100);
    setUploading(false);
    setStagedFiles([]);
    fetchAssets();
    setTimeout(() => setUploadProgress(0), 800);
  }

  async function handleDownload(path) {
    window.open(`/api/assets/download?path=${encodeURIComponent(normalizePath(path))}`);
  }

  async function handleDelete(paths) {
    openConfirm('Are you sure you want to delete the selected asset(s)?', async () => {
      for (const path of Array.isArray(paths) ? paths : [paths]) {
        await fetch('/api/assets/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: normalizePath(path) }),
          credentials: 'include',
        });
      }
      fetchAssets();
    });
  }

  async function handleDownloadSelected() {
    openConfirm('Download all selected assets?', () => {
      Object.keys(checked).filter(k=>checked[k]).forEach(handleDownload);
    });
  }

  // Only show user-facing assets (not model internals)
  let filteredAssets = assets.filter(asset => {
    // Exclude files inside model texture/motion/expression folders
    if (/\/haru_greeter_t05\.2048\//.test(asset)) return false;
    if (/\/motion\//.test(asset)) return false;
    if (/\/expressions\//.test(asset)) return false;
    return true;
  });
  // Filter by type
  if (filterType) filteredAssets = filteredAssets.filter(a => getAssetType(a) === filterType);
  // Search
  if (search) filteredAssets = filteredAssets.filter(a => a.toLowerCase().includes(search.toLowerCase()));
  // Sort
  filteredAssets = filteredAssets.sort((a, b) => sortAsc ? a.localeCompare(b) : b.localeCompare(a));
  // Paging
  const totalPages = Math.ceil(filteredAssets.length / PAGE_SIZE) || 1;
  const pagedAssets = filteredAssets.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  // Modern asset grid/list, modal preview, controls
  return (
    <div className="flex flex-col gap-4 h-full max-h-[60vh] md:max-h-[70vh]">
      {/* Filter, search, sort, paging controls */}
      <div className="flex flex-wrap gap-2 items-center justify-between bg-white/80 p-2 rounded-xl shadow">
        <div className="flex gap-2 items-center">
          <input type="text" value={search} onChange={e=>{setSearch(e.target.value); setPage(1);}} placeholder="Search assets..." className="border rounded px-3 py-1 text-sm focus:ring-2 focus:ring-fuchsia-400" />
          <select value={filterType} onChange={e=>{setFilterType(e.target.value); setPage(1);}} className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-fuchsia-400">
            {assetTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <button type="button" className="ml-2 px-2 py-1 rounded bg-fuchsia-100 hover:bg-fuchsia-200 text-fuchsia-700 flex items-center gap-1" onClick={()=>setSortAsc(v=>!v)} title="Sort">
            {sortAsc ? <FaSortAmountDown /> : <FaSortAmountUp />}
            <span className="hidden sm:inline">Sort</span>
          </button>
        </div>
        <div className="flex gap-1 items-center">
          <button onClick={()=>{fetchAssets(); setPage(1);}} className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 flex items-center gap-1" title="Refresh"><FaSync />Refresh</button>
          <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-2 py-1 rounded bg-gray-100 hover:bg-fuchsia-100 text-fuchsia-700 disabled:opacity-50">Prev</button>
          <span className="text-xs text-gray-500">Page {page} / {totalPages}</span>
          <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="px-2 py-1 rounded bg-gray-100 hover:bg-fuchsia-100 text-fuchsia-700 disabled:opacity-50">Next</button>
        </div>
      </div>
      {/* Upload area with staged files */}
      <form onSubmit={handleUpload} className="flex flex-col gap-2 mb-2">
        <div className="flex flex-row gap-2 items-center justify-end">
          <label className="flex items-center gap-2 cursor-pointer bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-full shadow transition">
            <FaUpload />
            <span className="hidden sm:inline">Upload</span>
            <input type="file" multiple onChange={handleFileInput} className="hidden" disabled={uploading} />
          </label>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow transition disabled:opacity-60" disabled={uploading || !stagedFiles.length}>{uploading ? 'Uploading...' : 'Submit'}</button>
        </div>
        {stagedFiles.length > 0 && (
          <div className="bg-white rounded-xl shadow p-3 mt-2 animate-fade-in">
            <div className="font-semibold text-fuchsia-700 mb-2">Staged files:</div>
            <ul className="space-y-2">
              {stagedFiles.map((file, idx) => (
                <li key={file.name + idx} className="flex items-center gap-2 text-sm">
                  <span className="inline-block w-5 text-center">
                    {getAssetType(file.name) === 'image' ? <FaFileImage className="text-fuchsia-500" /> :
                     getAssetType(file.name) === 'audio' ? <FaFileAudio className="text-blue-500" /> :
                     getAssetType(file.name) === 'model' ? <FaRobot className="text-green-500" /> :
                     <FaFileAlt className="text-gray-400" />}
                  </span>
                  <span className="flex-1 truncate" title={file.name}>{file.name}</span>
                  <button type="button" className="text-gray-400 hover:text-red-500 transition" onClick={()=>removeStagedFile(idx)} title="Remove"><FaTimes /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {uploading && (
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-gradient-to-r from-fuchsia-500 to-blue-500 animate-progress-bar" style={{width: uploadProgress + '%', transition: 'width 0.3s cubic-bezier(.4,2,.6,1)'}}></div>
          </div>
        )}
        <style>{`
          @keyframes fade-in { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: none; } }
          .animate-fade-in { animation: fade-in 0.5s; }
          @keyframes progress-bar { 0% {background-position:0%} 100% {background-position:100%} }
          .animate-progress-bar { background-size: 200% 100%; animation: progress-bar 1.2s linear infinite; }
        `}</style>
      </form>
      {/* Asset grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto">
        {pagedAssets.map(asset => {
          const type = getAssetType(asset);
          return (
            <div key={asset} className="relative group bg-white rounded-2xl shadow-md hover:shadow-xl transition flex flex-col items-center p-4 border border-fuchsia-100">
              <input type="checkbox" className="absolute top-2 left-2 accent-fuchsia-600" checked={!!checked[asset]} onChange={e=>setChecked(c=>({...c, [asset]:e.target.checked}))} />
              <div className="w-20 h-20 flex items-center justify-center mb-2 cursor-pointer rounded-lg bg-gray-50 overflow-hidden border border-gray-200" onClick={()=>setPreview(asset)}>
                {type === 'image' ? (
                  <img src={`/api/assets/preview?path=${encodeURIComponent(normalizePath(asset))}`} alt={asset} className="w-full h-full object-contain" />
                ) : type === 'audio' ? (
                  <FaFileAudio className="text-blue-500 text-4xl" />
                ) : type === 'model' ? (
                  <FaRobot className="text-green-500 text-4xl" />
                ) : (
                  <FaFileAlt className="text-gray-400 text-4xl" />
                )}
              </div>
              <div className="truncate w-full text-xs text-center mb-1" title={asset}>{asset.split('/').pop()}</div>
              <div className="flex gap-2 w-full justify-center mt-1">
                {type === 'model' && <button className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-2 py-1 rounded text-xs flex items-center gap-1" onClick={()=>onLoadModel(asset)} title="Load to Live2D"><FaRobot />Load</button>}
                <button className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1" onClick={()=>handleDownload(asset)} title="Download"><FaDownload /></button>
                <button className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1" onClick={()=>handleDelete(asset)} title="Delete"><FaTrash /></button>
              </div>
            </div>
          );
        })}
      </div>
      {/* Batch actions */}
      <div className="flex gap-2 mt-2 flex-wrap justify-end">
        <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full shadow text-xs sm:text-base flex items-center gap-2" onClick={()=>handleDelete(Object.keys(checked).filter(k=>checked[k]))}><FaTrash />Delete Selected</button>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow text-xs sm:text-base flex items-center gap-2" onClick={handleDownloadSelected}><FaDownload />Download Selected</button>
      </div>
      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full relative flex flex-col items-center">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-fuchsia-600 text-2xl" onClick={()=>setPreview(null)} aria-label="Close">&times;</button>
            {getAssetType(preview)==='image' && <img src={`/api/assets/preview?path=${encodeURIComponent(normalizePath(preview))}`} alt={preview} className="w-full h-auto rounded mb-2" />}
            {getAssetType(preview)==='audio' && <audio src={`/api/assets/preview?path=${encodeURIComponent(normalizePath(preview))}`} controls className="w-full mb-2" />}
            {getAssetType(preview)==='model' && <div className="text-center text-fuchsia-700 font-bold">Model file: {preview.split('/').pop()}</div>}
            <div className="text-xs text-gray-400 break-all mt-2">{normalizePath(preview)}</div>
          </div>
        </div>
      )}
      {/* Custom confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full relative flex flex-col items-center animate-fade-in">
            <div className="text-lg font-bold text-fuchsia-700 mb-4">Confirm</div>
            <div className="text-gray-700 text-center mb-6">{confirmMessage}</div>
            <div className="flex gap-4 w-full justify-center">
              <button className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-6 py-2 rounded-full font-bold transition" onClick={()=>handleConfirm(true)}>Yes</button>
              <button className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded-full font-bold transition" onClick={()=>handleConfirm(false)}>No</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: none; } }
        .animate-fade-in { animation: fade-in 0.5s; }
        @keyframes progress-bar { 0% {background-position:0%} 100% {background-position:100%} }
        .animate-progress-bar { background-size: 200% 100%; animation: progress-bar 1.2s linear infinite; }
      `}</style>
    </div>
  );
}

export default AssetManager;
