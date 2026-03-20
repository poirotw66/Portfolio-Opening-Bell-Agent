import React, { useState, useEffect } from "react";
// @ts-ignore - react-dom/client types can be tricky in some versions
import { createRoot } from "react-dom/client";
import { SavedReport } from "../types";
import { FileText, Trash2, Calendar, Download, Loader2 } from "lucide-react";
import ReportDisplay from "../components/ReportDisplay";
import { DecisionDashboardDisplay } from "../components/DecisionDashboardDisplay";
import { StockReportPdfView } from "../components/StockReportPdfView";
import JSZip from "jszip";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// ─── PDF export helpers ────────────────────────────────────────────────────────

const PDF_CAPTURE_WIDTH = 800;

/** Render StockReportPdfView into an off-screen div and capture it as a PDF blob. */
async function renderSingleStockPdf(report: SavedReport): Promise<Blob> {
  if (!report.dashboard) throw new Error("No dashboard data");

  // Create an off-screen container that is in the DOM but not visible.
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: -9999px;
    width: ${PDF_CAPTURE_WIDTH}px;
    min-width: ${PDF_CAPTURE_WIDTH}px;
    max-width: ${PDF_CAPTURE_WIDTH}px;
    background: #ffffff;
    z-index: -1;
    overflow: visible;
  `;
  document.body.appendChild(container);

  // Mount the white-background PDF view
  const root = createRoot(container);
  root.render(
    <StockReportPdfView data={report.dashboard} reportDate={report.date} />
  );

  // Wait for React to paint and fonts to settle
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 600));

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: false,
      imageTimeout: 0,
      width: PDF_CAPTURE_WIDTH,
      // The container is off-screen; tell html2canvas where to find it
      scrollX: 0,
      scrollY: 0,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // First page
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);

    // Additional pages: shift image upward by one page-height each time
    let pageOffset = pageHeight;
    while (pageOffset < imgHeight) {
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, -pageOffset, imgWidth, imgHeight);
      pageOffset += pageHeight;
    }

    return pdf.output("blob");
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── main component ────────────────────────────────────────────────────────────

export function SavedReportsPage() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("savedReports");
    if (saved) {
      try {
        setReports(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved reports", e);
      }
    }
  }, []);

  const formatGroupDate = (dateString: string): string => {
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatDateTime = (dateString: string): string => {
    const d = new Date(dateString);
    return `${formatGroupDate(dateString)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const buildReportFilename = (report: SavedReport, ext: "pdf" | "md"): string => {
    const dateKey = formatGroupDate(report.date).replace(/-/g, "");
    const typePart = report.type === "portfolio" ? "portfolio" : "single-stock";
    const safeTitle = report.title.replace(/[^\w\-]+/g, "_") || report.id;
    return `${dateKey}_${typePart}_${safeTitle}.${ext}`;
  };

  const handleToggleSelect = (
    id: string,
    e: React.MouseEvent | React.ChangeEvent<HTMLInputElement>
  ) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDownloadSingle = async (report: SavedReport, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingId(report.id);

    try {
      if (report.type === "single-stock" && report.dashboard) {
        // Render a clean white PDF view and capture it
        const pdfBlob = await renderSingleStockPdf(report);
        triggerBlobDownload(pdfBlob, buildReportFilename(report, "pdf"));
      } else {
        // Portfolio report → export as Markdown
        const content = report.dashboard?.full_report_markdown || report.content;
        const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
        triggerBlobDownload(blob, buildReportFilename(report, "md"));
      }
    } catch (err) {
      console.error("Download failed", err);
      window.alert("下載時發生錯誤，請稍後再試。");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadSelectedZip = async () => {
    if (!selectedIds.length) {
      window.alert("請先選取至少一份報告");
      return;
    }
    const zip = new JSZip();
    reports.forEach((report) => {
      if (selectedIds.includes(report.id)) {
        const content = report.dashboard?.full_report_markdown || report.content;
        zip.file(buildReportFilename(report, "md"), content);
      }
    });
    const blob = await zip.generateAsync({ type: "blob" });
    triggerBlobDownload(blob, "saved-reports.zip");
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = reports.filter((r) => r.id !== id);
    setReports(updated);
    localStorage.setItem("savedReports", JSON.stringify(updated));
    if (selectedReport?.id === id) setSelectedReport(null);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const groupedReports = reports.reduce((acc, report) => {
    const dateKey = formatGroupDate(report.date);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(report);
    return acc;
  }, {} as Record<string, SavedReport[]>);

  const sortedGroupKeys = Object.keys(groupedReports).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-6 w-full">
      {/* ── Sidebar ── */}
      <div className="w-full lg:w-[min(22rem,28vw)] shrink-0 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-0 lg:max-h-full lg:h-full">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900">已儲存的報告</h2>
          </div>
          <button
            onClick={handleDownloadSelectedZip}
            className="px-2 py-1 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!selectedIds.length}
          >
            下載選取 ZIP
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {reports.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">尚未儲存任何報告</div>
          ) : (
            sortedGroupKeys.map((dateKey) => (
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
                        ? "bg-indigo-50 border-indigo-200 border"
                        : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2 items-start">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedIds.includes(report.id)}
                          onClick={(e) => handleToggleSelect(report.id, e)}
                          onChange={(e) => handleToggleSelect(report.id, e)}
                        />
                        <div className="flex flex-col gap-1">
                          <h3
                            className={`font-semibold text-sm line-clamp-2 ${
                              selectedReport?.id === report.id ? "text-indigo-900" : "text-slate-900"
                            }`}
                          >
                            {report.title}
                          </h3>
                          {report.dashboard?.decision_type && (
                            <div className="flex mt-1">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  report.dashboard.decision_type === "buy"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : report.dashboard.decision_type === "sell"
                                    ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                }`}
                              >
                                {report.dashboard.decision_type === "buy"
                                  ? "建議買入"
                                  : report.dashboard.decision_type === "sell"
                                  ? "建議賣出"
                                  : "建議觀望"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleDownloadSingle(report, e)}
                          disabled={downloadingId === report.id}
                          className="text-slate-500 hover:text-indigo-600 px-2 py-1 text-xs rounded-md hover:bg-indigo-50 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-wait"
                        >
                          {downloadingId === report.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          {report.type === "single-stock" ? "PDF" : "MD"}
                        </button>
                        <button
                          onClick={(e) => handleDelete(report.id, e)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors shrink-0 ml-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(report.date).split(" ")[1]}
                      </span>
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                        {report.type === "portfolio" ? "投資組合" : "單股"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden lg:h-full">
        {selectedReport ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-slate-900">{selectedReport.title}</h2>
                {selectedReport.dashboard?.decision_type && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                      selectedReport.dashboard.decision_type === "buy"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : selectedReport.dashboard.decision_type === "sell"
                        ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    }`}
                  >
                    {selectedReport.dashboard.decision_type === "buy"
                      ? "建議買入"
                      : selectedReport.dashboard.decision_type === "sell"
                      ? "建議賣出"
                      : "建議觀望"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDateTime(selectedReport.date)}
                </span>
                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md font-medium">
                  {selectedReport.type === "portfolio" ? "投資組合分析" : "單股決策儀表盤"}
                </span>
              </div>
            </div>

            {selectedReport.dashboard ? (
              <DecisionDashboardDisplay data={selectedReport.dashboard} />
            ) : (
              <ReportDisplay report={selectedReport.content} />
            )}
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
