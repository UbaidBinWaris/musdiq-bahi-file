"use client";
import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';

const DEFAULT_PASSWORDS = { admin: 'admin123', agent: 'agent123' };

const storage = {
  get: async (key: string) => {
    if (typeof window !== 'undefined') {
      return { value: localStorage.getItem(key) };
    }
    return null;
  },
  set: async (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }
};

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [view, setView] = useState('login');
  const [role, setRole] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [columns, setColumns] = useState<any[]>([]);
  const [passwords, setPasswords] = useState(DEFAULT_PASSWORDS);
  const [searchZip, setSearchZip] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newAgentPass, setNewAgentPass] = useState('');
  const [newZipInputs, setNewZipInputs] = useState<any>({});
  const [editingCell, setEditingCell] = useState<any>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<any>(null);

  useEffect(() => {
    setIsMounted(true);
    const loadData = async () => {
      try {
        const colData = await storage.get('zip_portal_columns');
        if (colData?.value) setColumns(JSON.parse(colData.value));
      } catch (e) {}
      try {
        const passData = await storage.get('zip_portal_passwords');
        if (passData?.value) setPasswords(JSON.parse(passData.value));
      } catch (e) {}
    };
    loadData();
  }, []);

  const saveColumns = async (newCols: any[]) => {
    setColumns(newCols);
    await storage.set('zip_portal_columns', JSON.stringify(newCols));
  };

  const savePasswords = async (newPass: any) => {
    setPasswords(newPass);
    await storage.set('zip_portal_passwords', JSON.stringify(newPass));
  };

  const handleLogin = (targetRole: any) => {
    if (password === (passwords as any)[targetRole]) {
      setRole(targetRole);
      setView(targetRole);
      setPassword('');
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  const handleSearch = () => {
    if (!searchZip.trim()) return;
    const results = columns.map(col => ({
      name: col.name,
      hasZip: col.zips.includes(searchZip.trim())
    }));
    setSearchResult({ zip: searchZip.trim(), columns: results });
    setShowPopup(true);
  };

  const addColumn = () => {
    if (!newColumnName.trim()) return;
    saveColumns([...columns, { id: Date.now(), name: newColumnName.trim(), zips: [] }]);
    setNewColumnName('');
  };

  const deleteColumn = (id: any) => {
    if (confirm('Delete this column and all its zip codes?')) {
      saveColumns(columns.filter(c => c.id !== id));
    }
  };

  const renameColumn = (id: any, newName: any) => {
    if (!newName.trim()) return;
    saveColumns(columns.map(c => c.id === id ? { ...c, name: newName.trim() } : c));
    setEditingCell(null);
  };

  const addZipToColumn = (colId: any) => {
    const zip = newZipInputs[colId]?.trim();
    if (!zip) return;
    saveColumns(columns.map(c => {
      if (c.id === colId && !c.zips.includes(zip)) {
        return { ...c, zips: [...c.zips, zip] };
      }
      return c;
    }));
    setNewZipInputs({ ...newZipInputs, [colId]: '' });
  };

  const removeZip = (colId: any, zip: any) => {
    saveColumns(columns.map(c => c.id === colId ? { ...c, zips: c.zips.filter((z: any) => z !== zip) } : c));
  };

  const updatePasswords = () => {
    const updated = { ...passwords };
    if (newAdminPass.trim()) updated.admin = newAdminPass.trim();
    if (newAgentPass.trim()) updated.agent = newAgentPass.trim();
    savePasswords(updated);
    setShowPasswordModal(false);
    setNewAdminPass('');
    setNewAgentPass('');
    alert('Passwords updated!');
  };

  const getMaxZips = () => Math.max(...columns.map(c => c.zips.length), 0);

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadStatus('Processing...');

    const reader = new FileReader();
    reader.onload = (event: any) => {
      try {
        const text = event.target.result;
        const result = Papa.parse(text, { 
          header: false,
          skipEmptyLines: true,
          dynamicTyping: false
        });

        if (!result.data || result.data.length === 0) {
          setUploadStatus('Error: File is empty');
          return;
        }

        const headers = (result.data as any)[0].map((h: any) => String(h || '').trim()).filter((h: any) => h);
        
        if (headers.length === 0) {
          setUploadStatus('Error: No headers found in first row');
          return;
        }

        const newColumns = headers.map((header: any, idx: any) => {
          const zips = [];
          for (let row = 1; row < result.data.length; row++) {
            const cellValue = (result.data as any)[row]?.[idx];
            if (cellValue !== undefined && cellValue !== null && String(cellValue).trim()) {
              zips.push(String(cellValue).trim());
            }
          }
          const existingCol = columns.find(c => c.name.toLowerCase() === header.toLowerCase());
          if (existingCol) {
            const mergedZips = [...new Set([...existingCol.zips, ...zips])];
            return { ...existingCol, zips: mergedZips };
          }
          return { id: Date.now() + idx, name: header, zips };
        });

        const uploadedNames = headers.map((h: any) => h.toLowerCase());
        const remainingCols = columns.filter(c => !uploadedNames.includes(c.name.toLowerCase()));
        
        saveColumns([...remainingCols, ...newColumns]);
        
        const totalZips = newColumns.reduce((sum: number, c: any) => sum + c.zips.length, 0);
        setUploadStatus(`✓ Imported ${headers.length} columns with ${totalZips} zip codes`);
        
        setTimeout(() => setUploadStatus(''), 5000);
      } catch (err) {
        console.error(err);
        setUploadStatus('Error: Could not read file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = () => {
    if (columns.length === 0) {
      alert('No data to export');
      return;
    }

    const maxRows = getMaxZips();
    const headers = columns.map(c => c.name);
    
    let csv = headers.join(',') + '\n';
    for (let i = 0; i < maxRows; i++) {
      const row = columns.map(c => c.zips[i] || '');
      csv += row.join(',') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zip_codes_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAllData = () => {
    if (confirm('Are you sure you want to delete ALL columns and zip codes?')) {
      saveColumns([]);
      setUploadStatus('All data cleared');
      setTimeout(() => setUploadStatus(''), 3000);
    }
  };

  if (!isMounted) return null;

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Zip Code Portal</h1>
            <p className="text-gray-500 mt-2">Enter password to continue</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Enter password"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none text-black"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin('agent')}
          />
          {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => handleLogin('agent')} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">Agent Login</button>
            <button onClick={() => handleLogin('admin')} className="flex-1 bg-slate-700 text-white py-3 rounded-lg font-semibold hover:bg-slate-800">Admin Login</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'agent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">🔍 Zip Code Lookup</h1>
            <button onClick={() => { setView('login'); setRole(null); }} className="text-gray-500 hover:text-gray-700">Logout</button>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={searchZip}
                onChange={(e) => setSearchZip(e.target.value)}
                placeholder="Enter zip code (e.g., 90210)"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg text-black"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700">Search</button>
            </div>
          </div>

          {columns.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-700 text-white">
                      {columns.map(col => (
                        <th key={col.id} className="border border-slate-600 px-4 py-3 font-semibold text-left min-w-[150px]">{col.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: getMaxZips() }).map((_, rowIdx) => (
                      <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {columns.map(col => (
                          <td key={col.id} className="border border-gray-200 px-4 py-2 text-gray-700">{col.zips[rowIdx] || ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {getMaxZips() === 0 && <p className="text-gray-500 text-center py-8">No zip codes added yet.</p>}
            </div>
          )}
        </div>

        {showPopup && searchResult && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-black">Results for: <span className="text-blue-600">{searchResult.zip}</span></h2>
                <button onClick={() => setShowPopup(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>
              <div className="space-y-3">
                {searchResult.columns.map((col: any, idx: any) => (
                  <div key={idx} className={`flex items-center justify-between p-4 rounded-lg ${col.hasZip ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                    <span className={`font-medium ${col.hasZip ? 'text-green-800' : 'text-gray-500'}`}>{col.name}</span>
                    <span className={col.hasZip ? 'text-green-600 text-2xl' : 'text-gray-400 text-2xl'}>{col.hasZip ? '✓' : '✗'}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowPopup(false)} className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">Close</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">⚙️ Admin Panel</h1>
            <div className="flex gap-3">
              <button onClick={() => setShowPasswordModal(true)} className="text-slate-600 hover:text-slate-800 text-sm">Change Passwords</button>
              <button onClick={() => { setView('login'); setRole(null); }} className="text-gray-500 hover:text-gray-700">Logout</button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <h3 className="font-semibold text-gray-700 mb-1">📤 Bulk Upload</h3>
                <p className="text-sm text-gray-500">Upload CSV file. Row 1 = headers, below = zips</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700">📁 Upload CSV</button>
              <button onClick={handleExport} className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-green-700">📥 Export CSV</button>
              <button onClick={clearAllData} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-200">Clear All</button>
            </div>
            {uploadStatus && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${uploadStatus.startsWith('✓') ? 'bg-green-100 text-green-700' : uploadStatus.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                {uploadStatus}
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-amber-800 mb-2">📋 CSV Format Example:</h4>
            <code className="text-sm text-amber-900 block bg-amber-100 p-2 rounded">
              Flooring,Roofing,HVAC<br/>
              90210,10001,60601<br/>
              90211,10002,60602
            </code>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 mb-4 flex gap-3 items-center flex-wrap">
            <span className="font-semibold text-gray-700">Add Column:</span>
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="Service type (e.g., Flooring)"
              className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
              onKeyDown={(e) => e.key === 'Enter' && addColumn()}
            />
            <button onClick={addColumn} className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700">+ Add</button>
          </div>

          {columns.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-12 text-center text-gray-500">
              <p className="text-lg">No columns yet. Add manually or upload a CSV file!</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-green-700 text-white">
                      {columns.map(col => (
                        <th key={col.id} className="border border-green-600 px-2 py-2 min-w-[160px]">
                          <div className="flex items-center justify-between gap-2">
                            {editingCell === `header-${col.id}` ? (
                              <input
                                type="text"
                                defaultValue={col.name}
                                autoFocus
                                className="flex-1 px-2 py-1 text-black rounded text-sm"
                                onBlur={(e) => renameColumn(col.id, e.currentTarget.value)}
                                onKeyDown={(e) => e.key === 'Enter' && renameColumn(col.id, e.currentTarget.value)}
                              />
                            ) : (
                              <span 
                                className="font-semibold cursor-pointer hover:underline flex-1 text-left"
                                onDoubleClick={() => setEditingCell(`header-${col.id}`)}
                                title="Double-click to rename"
                              >
                                {col.name}
                              </span>
                            )}
                            <button onClick={() => deleteColumn(col.id)} className="text-red-200 hover:text-white text-xs">✕</button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: getMaxZips() }).map((_, rowIdx) => (
                      <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-green-50'}>
                        {columns.map(col => (
                          <td key={col.id} className="border border-gray-200 px-3 py-2">
                            {col.zips[rowIdx] ? (
                              <div className="flex items-center justify-between group">
                                <span className="text-gray-700">{col.zips[rowIdx]}</span>
                                <button 
                                  onClick={() => removeZip(col.id, col.zips[rowIdx])}
                                  className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 text-sm"
                                >✕</button>
                              </div>
                            ) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-blue-50">
                      {columns.map(col => (
                        <td key={col.id} className="border border-gray-200 px-2 py-2">
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={newZipInputs[col.id] || ''}
                              onChange={(e) => setNewZipInputs({ ...newZipInputs, [col.id]: e.currentTarget.value })}
                              placeholder="+ Add zip"
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none text-black"
                              onKeyDown={(e) => e.key === 'Enter' && addZipToColumn(col.id)}
                            />
                            <button 
                              onClick={() => addZipToColumn(col.id)}
                              className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                            >+</button>
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="bg-gray-100 px-4 py-2 text-sm text-gray-500 border-t">
                💡 Double-click headers to rename • Hover over zips to delete • Total: {columns.reduce((sum: number, c: any) => sum + c.zips.length, 0)} zip codes
              </div>
            </div>
          )}
        </div>

        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-6 text-black">Change Passwords</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Admin Password</label>
                  <input type="password" value={newAdminPass} onChange={(e) => setNewAdminPass(e.target.value)} placeholder="Leave blank to keep current" className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Agent Password</label>
                  <input type="password" value={newAgentPass} onChange={(e) => setNewAgentPass(e.target.value)} placeholder="Leave blank to keep current" className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowPasswordModal(false)} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg font-semibold hover:bg-gray-300">Cancel</button>
                <button onClick={updatePasswords} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
