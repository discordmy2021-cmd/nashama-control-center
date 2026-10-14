import React, { useState } from 'react';
import { LayoutDashboard, Users, Shield, Briefcase, FileText, AlertTriangle, Clock } from 'lucide-react';
import { RecentActivities } from './components/RecentActivities';

export function App() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex min-h-screen bg-neutral-950 text-white font-sans dir-rtl" dir="rtl">
      
      {/* القائمة الجانبية (Sidebar) */}
      <aside className="w-64 bg-neutral-900 border-l border-neutral-800 p-4 flex flex-col justify-between min-h-screen">
        <div>
          <div className="flex items-center gap-3 p-3 mb-6 bg-neutral-950 rounded-xl border border-neutral-800">
            <div className="p-2 bg-red-600 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg text-white"><span className="text-red-500">نشاما</span> درايف</h1>
              <p className="text-[10px] text-neutral-400">لوحة الإدارة ومركز التحكم</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'overview' ? 'bg-red-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              نظرة عامة
            </button>

            <button
              onClick={() => setActiveTab('activities')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all mt-2 border ${
                activeTab === 'activities' ? 'bg-red-600/20 text-red-500 border-red-600/40' : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border-neutral-800'
              }`}
            >
              <Clock className="w-4 h-4 text-red-500" />
              الحركات الأخيرة
            </button>
          </nav>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 p-8 bg-neutral-950 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">لوحة نظرة عامة</h2>
            <RecentActivities />
          </div>
        )}

        {activeTab === 'activities' && <RecentActivities />}
      </main>
    </div>
  );
}

export default App;