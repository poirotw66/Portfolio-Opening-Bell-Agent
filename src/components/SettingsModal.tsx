import React, { useState, useEffect } from 'react';
import { X, Key, Cpu } from 'lucide-react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const MODELS = [
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite Preview' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
];

export function SettingsModal({ isOpen, onClose }: Props) {
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [hasKey, setHasKey] = useState(false);
  const [manualApiKey, setManualApiKey] = useState('');

  useEffect(() => {
    const savedModel = localStorage.getItem('geminiModel');
    if (savedModel) {
      setSelectedModel(savedModel);
    }
    
    const savedApiKey = localStorage.getItem('customGeminiApiKey');
    if (savedApiKey) {
      setManualApiKey(savedApiKey);
      setHasKey(true);
    }

    const checkKey = async () => {
      if (window.aistudio && !savedApiKey) {
        try {
          const has = await window.aistudio.hasSelectedApiKey();
          setHasKey(has);
        } catch (e) {
          console.error("Failed to check API key status", e);
        }
      }
    };
    
    if (isOpen) {
      checkKey();
    }
  }, [isOpen]);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    setSelectedModel(newModel);
    localStorage.setItem('geminiModel', newModel);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setManualApiKey(newKey);
    if (newKey.trim() !== '') {
      localStorage.setItem('customGeminiApiKey', newKey);
      setHasKey(true);
    } else {
      localStorage.removeItem('customGeminiApiKey');
      // Re-check AI Studio key if manual key is cleared
      if (window.aistudio) {
        window.aistudio.hasSelectedApiKey().then(setHasKey).catch(() => setHasKey(false));
      } else {
        setHasKey(false);
      }
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        // Assume success after triggering
        setHasKey(true);
      } catch (e) {
        console.error("Failed to open select key dialog", e);
      }
    } else {
      alert("API Key selection is not available in this environment.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">系統設定</h2>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Model Selection */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Cpu className="w-4 h-4 text-indigo-600" />
              AI 模型選擇
            </label>
            <select
              value={selectedModel}
              onChange={handleModelChange}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              {MODELS.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              選擇用於分析投資組合與產生報告的 Gemini 模型。
            </p>
          </div>

          {/* API Key Selection */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Key className="w-4 h-4 text-indigo-600" />
              Gemini API Key
            </label>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${hasKey ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="text-sm text-slate-700">
                  {hasKey ? '已設定自訂 API Key' : '使用系統預設 API Key'}
                </span>
              </div>
              {window.aistudio && (
                <button
                  onClick={handleSelectKey}
                  className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                >
                  {hasKey ? '重新選擇' : '選擇 API Key'}
                </button>
              )}
            </div>
            
            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                手動輸入 API Key (選填)
              </label>
              <input
                type="password"
                value={manualApiKey}
                onChange={handleApiKeyChange}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
              />
            </div>
            
            <p className="text-xs text-slate-500">
              您可以透過上方按鈕選擇 Google Cloud 專案，或直接在下方貼上您的 Gemini API Key。手動輸入的 Key 會優先使用。
            </p>
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
