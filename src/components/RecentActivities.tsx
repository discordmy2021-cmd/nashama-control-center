import React, { useEffect, useState } from 'react';
import { Clock, Shield, Briefcase, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const RecentActivities: React.FC = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentActivities = async () => {
    setLoading(true);
    try {
      const { data: captains } = await supabase.from('nashama_captains_requests').select('*');
      const { data: agents } = await supabase.from('nashama_agents_requests').select('*');

      const captainsList = (captains || []).map((c) => ({
        id: c.id,
        type: 'captain',
        title: 'طلب انضمام كابتن جديد',
        name: c.full_name,
        phone: c.phone,
        info: `السيارة: ${c.car_type} (${c.car_model}) - لوحة: ${c.plate_number}`,
        createdAt: new Date(c.created_at),
      }));

      const agentsList = (agents || []).map((a) => ({
        id: a.id,
        type: 'agent',
        title: 'طلب انضمام وكيل شحن',
        name: a.company_name,
        phone: a.phone,
        info: `الموقع GPS: ${a.location_gps}`,
        createdAt: new Date(a.created_at),
      }));

      const merged = [...captainsList, ...agentsList].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      setActivities(merged);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivities();
  }, []);

  return (
    <div className="p-6 bg-neutral-950 text-white border border-neutral-800 rounded-2xl dir-rtl mt-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-bold text-white">الحركات الأخيرة</h2>
        </div>
        <button
          onClick={fetchRecentActivities}
          className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-xs flex items-center gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-neutral-500">جاري تحميل الحركات الأخيرة...</div>
      ) : activities.length === 0 ? (
        <div className="py-8 text-center text-xs text-neutral-500">لا توجد حركات أو طلبات حتى الآن</div>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => (
            <div
              key={act.id}
              className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                {act.type === 'captain' ? <Shield className="w-5 h-5 text-blue-500 mt-1" /> : <Briefcase className="w-5 h-5 text-amber-500 mt-1" />}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{act.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">{act.name}</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    الهاتف: <span className="text-neutral-200">{act.phone}</span> | {act.info}
                  </p>
                </div>
              </div>
              <div className="text-xs text-neutral-500 whitespace-nowrap">
                {act.createdAt.toLocaleTimeString('ar-JO')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};