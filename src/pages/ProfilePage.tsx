import { useState, useEffect } from "react";
import { User, Shield, Target, CheckCircle2 } from "lucide-react";
import PortfolioInput from "../components/PortfolioInput";
import { InvestmentStrategy } from "../types";
import { motion } from "motion/react";

const STRATEGIES: { id: InvestmentStrategy; label: string; description: string }[] = [
  { id: 'value', label: '價值投資', description: '尋找被市場低估且具有良好基本面的股票。' },
  { id: 'growth', label: '成長投資', description: '專注於具有高於平均增長潛力的公司。' },
  { id: 'index', label: '指數投資', description: '追蹤市場指數，追求市場平均報酬。' },
  { id: 'dividend', label: '股息投資', description: '偏好穩定發放股息且殖利率高的公司。' },
  { id: 'technical', label: '技術交易', description: '利用圖表模式與技術指標進行短期交易。' },
  { id: 'dca', label: '定期定額', description: '固定時間投入固定金額，分散進場成本。' },
];

export function ProfilePage() {
  const [strategy, setStrategy] = useState<InvestmentStrategy>('growth');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedStrategy = localStorage.getItem('investmentStrategy') as InvestmentStrategy;
    if (savedStrategy) {
      setStrategy(savedStrategy);
    }
  }, []);

  const handleSaveStrategy = (newStrategy: InvestmentStrategy) => {
    setStrategy(newStrategy);
    localStorage.setItem('investmentStrategy', newStrategy);
    showSaveFeedback();
  };

  const handlePortfolioSave = () => {
    showSaveFeedback();
  };

  const showSaveFeedback = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <User className="w-6 h-6 text-indigo-600" />
            使用者資料與設定
          </h1>
          <p className="text-slate-500 mt-1">管理您的投資組合與偏好的投資策略</p>
        </div>
        {isSaved && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 font-medium text-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            設定已儲存
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              投資策略
            </h2>
            <div className="space-y-3">
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSaveStrategy(s.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    strategy === s.id
                      ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200'
                      : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-sm text-slate-900">{s.label}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">{s.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
            <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4" />
              隱私說明
            </h3>
            <p className="text-xs text-indigo-800 leading-relaxed">
              您的持股資料與策略設定僅儲存在瀏覽器的本地存儲 (Local Storage) 中，不會上傳至任何伺服器。
            </p>
          </div>
        </div>

        <div className="md:col-span-2">
          <PortfolioInput 
            onSave={handlePortfolioSave} 
            isLoading={false} 
          />
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 italic">
            提示：在此處更新您的持股後，分析中心將自動使用最新的部位進行分析。
          </div>
        </div>
      </div>
    </div>
  );
}
