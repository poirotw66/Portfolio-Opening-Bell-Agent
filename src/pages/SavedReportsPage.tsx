import React, { useState, useEffect } from "react";
import { SavedReport } from "../types";
import { FileText, Trash2, Calendar, ChevronRight } from "lucide-react";
import ReportDisplay from "../components/ReportDisplay";
import { motion, AnimatePresence } from "motion/react";

export function SavedReportsPage() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('savedReports');
    if (saved) {
      try {
        setReports(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved reports", e);
      }
    }
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = reports.filter(r => r.id !== id);
    setReports(updated);
    localStorage.setItem('savedReports', JSON.stringify(updated));
    if (selectedReport?.id === id) {
      setSelectedReport(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  const formatGroupDate = (dateString: string) => {
    const date = new Date(dateString);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const groupedReports = reports.reduce((acc, report) => {
    const dateKey = formatGroupDate(report.date);
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(report);
    return acc;
  }, {} as Record<string, SavedReport[]>);

  const sortedGroupKeys = Object.keys(groupedReports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* Sidebar List */}
      <div className="w-full md:w-1/3 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-slate-900">已儲存的報告</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {reports.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              尚未儲存任何報告
            </div>
          ) : (
            sortedGroupKeys.map(dateKey => (
              <div key={dateKey} className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 pt-2 pb-1 sticky top-0 bg-white/90 backdrop-blur-sm z-10">
                  {dateKey}
                </h3>
                {groupedReports[dateKey].map((report) => (
                  <div 
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className={`p-4 rounded-xl cursor-pointer transition-all ${
                      selectedReport?.id === report.id 
                        ? 'bg-indigo-50 border-indigo-200 border' 
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-semibold text-sm line-clamp-2 ${
                        selectedReport?.id === report.id ? 'text-indigo-900' : 'text-slate-900'
                      }`}>
                        {report.title}
                      </h3>
                      <button 
                        onClick={(e) => handleDelete(report.id, e)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors shrink-0 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(report.date).split(' ')[1]}
                      </span>
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                        {report.type === 'portfolio' ? '投資組合' : '單股'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full md:w-2/3 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {selectedReport ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6 pb-6 border-b border-slate-100">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedReport.title}</h2>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(selectedReport.date)}
                </span>
                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md font-medium">
                  {selectedReport.type === 'portfolio' ? '投資組合分析' : '單股開盤指南'}
                </span>
              </div>
            </div>
            <ReportDisplay report={selectedReport.content} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <FileText className="w-16 h-16 mb-4 text-slate-200" />
            <p className="text-lg font-medium text-slate-500">請從左側選擇一份報告</p>
            <p className="text-sm mt-2">點擊報告列表即可在此查看詳細內容</p>
          </div>
        )}
      </div>
    </div>
  );
}
