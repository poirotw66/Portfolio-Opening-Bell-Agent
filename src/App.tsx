import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Activity, TrendingUp, BarChart3, LineChart, PieChart, Settings } from "lucide-react";
import { AnalysisPage } from "./pages/AnalysisPage";
import { MarketPage } from "./pages/MarketPage";
import { PortfolioSummaryPage } from "./pages/PortfolioSummaryPage";
import { SavedReportsPage } from "./pages/SavedReportsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { FileText, User } from "lucide-react";
import { SettingsModal } from "./components/SettingsModal";

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className="min-h-dvh w-full flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
        <header className="shrink-0 bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  開盤投資組合助理
                </h1>
              </div>
              
              <nav className="hidden md:flex items-center space-x-1">
                <NavLink 
                  to="/" 
                  className={({ isActive }) => 
                    `px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <BarChart3 className="w-4 h-4" />
                  分析中心
                </NavLink>
                <NavLink 
                  to="/market" 
                  className={({ isActive }) => 
                    `px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <LineChart className="w-4 h-4" />
                  即時行情庫存
                </NavLink>
                <NavLink 
                  to="/summary" 
                  className={({ isActive }) => 
                    `px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <PieChart className="w-4 h-4" />
                  帳務總覽
                </NavLink>
                <NavLink 
                  to="/saved-reports" 
                  className={({ isActive }) => 
                    `px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <FileText className="w-4 h-4" />
                  歷史報告
                </NavLink>
                <NavLink 
                  to="/profile" 
                  className={({ isActive }) => 
                    `px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <User className="w-4 h-4" />
                  個人設定
                </NavLink>
              </nav>
            </div>
            <div className="text-sm font-medium text-slate-500 flex items-center gap-4">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                部位感知 AI
              </div>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="系統設定"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full min-h-0 flex flex-col px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8">
          <div className="flex-1 min-h-0 w-full flex flex-col min-w-0">
            <Routes>
              <Route path="/" element={<AnalysisPage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/summary" element={<PortfolioSummaryPage />} />
              <Route path="/saved-reports" element={<SavedReportsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Routes>
          </div>
        </main>
        
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      </div>
    </BrowserRouter>
  );
}

