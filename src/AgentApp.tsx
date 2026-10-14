import { useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  Car,
  CheckCircle2,
  ChevronLeft,
  CircleUserRound,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Receipt,
  Search,
  ShieldAlert,
  Smartphone,
  TrendingUp,
  Wallet,
  WalletCards,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/navigate';

type AgentPage = 'home' | 'topup' | 'history' | 'profile';
type AgentProfile = {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  location: string;
  available_balance: number;
  daily_spend: number;
  monthly_spend: number;
  status: string;
};
type AgentTransaction = {
  id: string;
  driver_id: string;
  driver_name: string;
  amount: number;
  commission: number;
  total_charged: number;
  reference_number: string;
  balance_after: number;
  created_at: string;
};
type AgentDriver = { id: string; name: string; phone: string; avatar_url: string | null };
type AgentLoginResult = {
  session_token: string;
  agent_id: string;
  agent_name: string;
  owner_name: string;
  phone: string;
  location: string;
  available_balance: number;
  daily_spend: number;
  monthly_spend: number;
  status: string;
};
type AgentDashboard = {
  agent: AgentProfile;
  today_count: number;
  today_total: number;
  transactions: AgentTransaction[];
  drivers: AgentDriver[];
};

const supportNumber = '0798939402';

function formatMoney(value: number) {
  return new Intl.NumberFormat('ar-JO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ar-JO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map((p) => p[0]).join('');
}

function AgentApp({ onNavigate = navigate }: { onNavigate?: (path: string) => void }) {
  const [sessionToken, setSessionToken] = useState('');
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [page, setPage] = useState<AgentPage>('home');
  const [dashboard, setDashboard] = useState<AgentDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function loadDashboard(token: string) {
    const { data, error } = await supabase.rpc('get_nashama_agent_dashboard', { p_session_token: token });
    if (error || !data) {
      setMessage('تعذر تحميل بيانات الوكيل. حاول تسجيل الدخول مرة أخرى.');
      return;
    }
    const d = data as AgentDashboard;
    setDashboard(d);
    setProfile(d.agent);
  }

  async function handleLogin(phone: string, password: string) {
    setLoading(true);
    setMessage('');
    const { data, error } = await supabase.rpc('authenticate_nashama_agent', { p_phone: phone, p_password: password });
    if (error || !data?.[0]) {
      setMessage('بيانات الدخول غير صحيحة أو الحساب موقوف.');
      setLoading(false);
      return;
    }
    const agent = data[0] as AgentLoginResult;
    setSessionToken(agent.session_token);
    setProfile({
      id: agent.agent_id, name: agent.agent_name, owner_name: agent.owner_name, phone: agent.phone,
      location: agent.location, available_balance: agent.available_balance,
      daily_spend: agent.daily_spend, monthly_spend: agent.monthly_spend, status: agent.status,
    });
    await loadDashboard(agent.session_token);
    setLoading(false);
  }

  async function handleLogout() {
    if (sessionToken) await supabase.rpc('sign_out_nashama_agent', { p_session_token: sessionToken });
    setSessionToken('');
    setProfile(null);
    setDashboard(null);
    setPage('home');
    setMessage('');
  }

  if (!profile || !sessionToken) {
    return (
      <AgentLogin
        loading={loading}
        message={message}
        onLogin={(phone, password) => void handleLogin(phone, password)}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div dir="rtl" className="admin-app agent-app">
      <AgentSidebar page={page} profile={profile} onNavigate={setPage} onLogout={() => void handleLogout()} />
      <main className="admin-main">
        <AgentTopbar page={page} profile={profile} onMenu={() => document.body.classList.toggle('sidebar-open')} />
        {message && (
          <div className="admin-alert">
            <ShieldAlert size={17} />
            {message}
            <button onClick={() => setMessage('')} aria-label="إغلاق"><X size={15} /></button>
          </div>
        )}
        <div className="admin-content">
          {page === 'home' && dashboard && (
            <AgentHome dashboard={dashboard} onNavigate={setPage} />
          )}
          {page === 'topup' && dashboard && (
            <AgentTopup dashboard={dashboard} token={sessionToken} onRefresh={() => loadDashboard(sessionToken)} onMessage={setMessage} />
          )}
          {page === 'history' && dashboard && <AgentHistory transactions={dashboard.transactions} />}
          {page === 'profile' && (
            <AgentProfilePage
              profile={profile}
              token={sessionToken}
              onProfileUpdate={(updates) => setProfile({ ...profile, ...updates })}
              onMessage={setMessage}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function AgentLogin({ loading, message, onLogin, onNavigate }: { loading: boolean; message: string; onLogin: (phone: string, password: string) => void; onNavigate: (path: string) => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); onLogin(phone.trim(), password); }
  return (
    <main dir="rtl" className="admin-login">
      <div className="login-orbit orbit-gold" />
      <div className="login-orbit orbit-red" />
      <section className="login-panel">
        <div className="login-brand">
          <div className="logo-mark gold-mark"><WalletCards size={25} /></div>
          <strong><span>نشامة</span> درايف</strong>
          <small>بوابة وكلاء الشحن</small>
        </div>
        <div className="login-title">
          <span>دخول الوكيل</span>
          <h1>تسجيل دخول الوكيل</h1>
          <p>ادخل إلى حسابك لإدارة عمليات شحن الكباتن</p>
        </div>
        <form onSubmit={submit} autoComplete="off">
          <label>رقم الهاتف
            <input autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم هاتف الوكيل" dir="ltr" />
          </label>
          <label>كلمة المرور
            <input autoComplete="off" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="أدخل كلمة المرور" />
          </label>
          {message && <div className="login-error"><ShieldAlert size={16} />{message}</div>}
          <button className="gold-button" type="submit" disabled={loading}>
            {loading ? 'جاري التحقق...' : 'دخول'} <ChevronLeft size={18} />
          </button>
        </form>
        <div className="login-security"><LockKeyhole size={16} /><span>دخول محمي بصلاحيات الوكيل</span></div>
        <div className="login-portal-switch"><button type="button" onClick={() => onNavigate('/')}>دخول لوحة الإدارة <ChevronLeft size={14} /></button></div>
      </section>
      <p className="login-foot">NASHAMA DRIVE <i>•</i> AGENT PORTAL</p>
    </main>
  );
}

function AgentSidebar({ page, profile, onNavigate, onLogout }: { page: AgentPage; profile: AgentProfile; onNavigate: (p: AgentPage) => void; onLogout: () => void }) {
  const items: Array<{ id: AgentPage; label: string; icon: ReactNode }> = [
    { id: 'home', label: 'الرئيسية', icon: <LayoutDashboard size={18} /> },
    { id: 'topup', label: 'شحن سائق', icon: <TrendingUp size={18} /> },
    { id: 'history', label: 'سجل المعاملات', icon: <Receipt size={18} /> },
  ];
  return (
    <aside className="sidebar">
      <div className="side-brand">
        <div className="logo-mark gold-mark"><WalletCards size={22} /></div>
        <div><strong><span>نشامة</span> درايف</strong><small>بوابة الوكيل</small></div>
        <button className="side-close" onClick={() => document.body.classList.remove('sidebar-open')}><X size={18} /></button>
      </div>
      <div className="side-profile">
        <div className="profile-avatar gold-avatar">{initials(profile.name)}</div>
        <div><strong>{profile.name}</strong><span>{profile.owner_name || 'وكيل شحن'}</span></div>
        <span className="active-dot" />
      </div>
      <nav>
        {items.map((item) => (
          <button key={item.id} className={page === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { onNavigate(item.id); document.body.classList.remove('sidebar-open'); }}>
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="side-bottom">
        <button className={page === 'profile' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('profile')}>
          <CircleUserRound size={18} /><span>الملف الشخصي</span>
        </button>
        <button className="logout-link" onClick={onLogout}><LogOut size={17} />تسجيل الخروج</button>
      </div>
    </aside>
  );
}

function AgentTopbar({ page, profile, onMenu }: { page: AgentPage; profile: AgentProfile; onMenu: () => void }) {
  const titles: Record<AgentPage, string> = { home: 'الرئيسية', topup: 'شحن سائق', history: 'سجل المعاملات', profile: 'الملف الشخصي' };
  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={onMenu}><span>☰</span></button>
      <div>
        <span className="breadcrumb">بوابة الوكيل <ChevronLeft size={12} /> {titles[page]}</span>
        <h1>{titles[page]}</h1>
      </div>
      <div className="topbar-actions">
        <div className="topbar-user">
          <div className="small-avatar gold-avatar">{initials(profile.name)}</div>
          <span>{profile.name}</span>
        </div>
      </div>
    </header>
  );
}

function AgentHome({ dashboard, onNavigate }: { dashboard: AgentDashboard; onNavigate: (p: AgentPage) => void }) {
  const a = dashboard.agent;
  const recentTx = dashboard.transactions.slice(0, 5);
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">مرحباً بك</span>
          <h2>{a.name}</h2>
          <p>{a.location} · {a.owner_name}</p>
        </div>
      </div>
      <div className="metric-grid">
        <div className="metric-card gold">
          <span className="metric-icon"><Wallet size={28} /></span>
          <div><span>الرصيد المتاح</span><strong>{formatMoney(a.available_balance)} <small>د.أ</small></strong><small>رصيد قابل للشحن</small></div>
        </div>
        <div className="metric-card red">
          <span className="metric-icon"><TrendingUp size={28} /></span>
          <div><span>عمليات اليوم</span><strong>{dashboard.today_count}</strong><small>{formatMoney(dashboard.today_total)} د.أ اليوم</small></div>
        </div>
        <div className="metric-card slate">
          <span className="metric-icon"><Receipt size={28} /></span>
          <div><span>إنفاق الشهر</span><strong>{formatMoney(a.monthly_spend)} <small>د.أ</small></strong><small>إجمالي هذا الشهر</small></div>
        </div>
        <div className="metric-card orange">
          <span className="metric-icon"><Car size={28} /></span>
          <div><span>السائقون</span><strong>{dashboard.drivers.length}</strong><small>سائق متاح للشحن</small></div>
        </div>
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <span className="panel-heading-icon"><TrendingUp size={18} /></span>
            <div><h3>آخر العمليات</h3><p>معاملات الشحن الأخيرة</p></div>
            <button className="dots" onClick={() => onNavigate('history')}>عرض الكل</button>
          </div>
          <div className="activity-list">
            {recentTx.length ? recentTx.map((tx) => (
              <div className="activity-row" key={tx.id}>
                <span className="activity-icon gold"><TrendingUp size={18} /></span>
                <div>
                  <strong>{tx.driver_name}</strong>
                  <small>{formatMoney(tx.amount)} د.أ · {tx.reference_number}</small>
                </div>
                <span className="tx-time">{formatDateTime(tx.created_at)}</span>
              </div>
            )) : <EmptyState text="لا توجد عمليات بعد. ابدأ بشحن سائق." />}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <span className="panel-heading-icon"><ArrowDownLeft size={18} /></span>
            <div><h3>إجراءات سريعة</h3><p>ابدأ عملية شحن الآن</p></div>
          </div>
          <div className="quick-actions">
            <button onClick={() => onNavigate('topup')}><TrendingUp size={19} /><span>شحن سائق جديد</span></button>
            <button onClick={() => onNavigate('history')}><Receipt size={19} /><span>سجل المعاملات</span></button>
            <button onClick={() => onNavigate('profile')}><Smartphone size={19} /><span>إعدادات الحساب</span></button>
          </div>
        </section>
      </div>
    </>
  );
}

function AgentTopup({ dashboard, token, onRefresh, onMessage }: { dashboard: AgentDashboard; token: string; onRefresh: () => Promise<void>; onMessage: (m: string) => void }) {
  const [driverId, setDriverId] = useState('');
  const [amount, setAmount] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{ ref: string; driverName: string; amount: number; newBalance: number } | null>(null);

  const amounts = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  const filteredDrivers = dashboard.drivers.filter(
    (d) => d.name.includes(search) || d.id.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search)
  );
  const selectedDriver = dashboard.drivers.find((d) => d.id === driverId.toUpperCase());
  const totalCharge = amount ? Number(amount) + 1.0 : 0;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!driverId || !amount) return;
    setSaving(true);
    const { data, error } = await supabase.rpc('agent_topup_driver', {
      p_session_token: token,
      p_driver_id: driverId,
      p_amount: Number(amount),
    });
    setSaving(false);
    if (error || !data?.[0]) {
      onMessage('تعذر إتمام الشحن. تأكد من الرصيد ومعرف السائق.');
      return;
    }
    const r = data[0] as { reference_number: string; new_balance: number; driver_name: string; amount: number };
    setLastReceipt({ ref: r.reference_number, driverName: r.driver_name, amount: r.amount, newBalance: r.new_balance });
    setDriverId('');
    setAmount('');
    setSearch('');
    onMessage('تمت عملية الشحن بنجاح.');
    await onRefresh();
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">عملية جديدة</span>
          <h2>شحن سائق</h2>
          <p>اختر السائق والمبلغ لإتمام عملية الشحن. عمولة الوكيل 1.000 د.أ لكل عملية.</p>
        </div>
      </div>
      {lastReceipt && (
        <div className="receipt-banner">
          <CheckCircle2 size={24} />
          <div>
            <strong>تمت عملية الشحن بنجاح</strong>
            <span>تم شحن {lastReceipt.driverName} بمبلغ {formatMoney(lastReceipt.amount)} د.أ</span>
            <small>رقم المرجع: <b dir="ltr">{lastReceipt.ref}</b> · الرصيد المتبقي: {formatMoney(lastReceipt.newBalance)} د.أ</small>
          </div>
          <button onClick={() => setLastReceipt(null)}><X size={18} /></button>
        </div>
      )}
      <div className="agent-topup-grid">
        <section className="panel">
          <div className="panel-heading">
            <span className="panel-heading-icon"><Car size={18} /></span>
            <div><h3>اختر السائق</h3><p>ابحث عن السائق بالاسم أو المعرف</p></div>
          </div>
          <div className="driver-search">
            <Search size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو المعرف..." />
          </div>
          <div className="driver-pick-list">
            {filteredDrivers.map((d) => (
              <button
                key={d.id}
                className={driverId === d.id ? 'driver-pick selected' : 'driver-pick'}
                onClick={() => { setDriverId(d.id); setSearch(''); }}
              >
                <div className="table-avatar driver">{d.avatar_url ? <img src={d.avatar_url} alt="" /> : initials(d.name)}</div>
                <div><strong>{d.name}</strong><small>{d.id} · {d.phone}</small></div>
                {driverId === d.id && <CheckCircle2 size={18} />}
              </button>
            ))}
            {!filteredDrivers.length && <EmptyState text="لا يوجد سائقون مطابقون" />}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <span className="panel-heading-icon"><TrendingUp size={18} /></span>
            <div><h3>تفاصيل الشحن</h3><p>حدد المبلغ وأكد العملية</p></div>
          </div>
          <form onSubmit={submit} className="topup-form">
            {selectedDriver && (
              <div className="selected-driver-box">
                <div className="table-avatar driver">{selectedDriver.avatar_url ? <img src={selectedDriver.avatar_url} alt="" /> : initials(selectedDriver.name)}</div>
                <div><strong>{selectedDriver.name}</strong><small>{selectedDriver.id}</small></div>
                <button type="button" onClick={() => setDriverId('')}><X size={16} /></button>
              </div>
            )}
            <label>معرف السائق
              <input required value={driverId} onChange={(e) => setDriverId(e.target.value)} placeholder="مثال: ND-1045" className="mono-text" dir="ltr" />
            </label>
            <div>
              <label className="amount-label">مبلغ الشحن (د.أ)</label>
              <div className="amount-grid">
                {amounts.map((amt) => (
                  <button
                    type="button"
                    key={amt}
                    className={amount === String(amt) ? 'amount-chip selected' : 'amount-chip'}
                    onClick={() => setAmount(String(amt))}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>
            <div className="charge-summary">
              <div><span>مبلغ الشحن</span><strong>{amount ? formatMoney(Number(amount)) : '—'} د.أ</strong></div>
              <div><span>عمولة الوكيل</span><strong>1.000 د.أ</strong></div>
              <div className="total-row"><span>الإجمالي المخصوم</span><strong>{totalCharge ? formatMoney(totalCharge) : '—'} د.أ</strong></div>
              <div className="balance-row"><span>رصيدك الحالي</span><strong>{formatMoney(dashboard.agent.available_balance)} د.أ</strong></div>
              {totalCharge > dashboard.agent.available_balance && <div className="insufficient-warning"><ShieldAlert size={15} /> الرصيد غير كافٍ لإتمام العملية</div>}
            </div>
            <button type="submit" className="gold-button" disabled={saving || !driverId || !amount || totalCharge > dashboard.agent.available_balance}>
              {saving ? 'جاري المعالجة...' : 'تأكيد الشحن'}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}

function AgentHistory({ transactions }: { transactions: AgentTransaction[] }) {
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">السجل الكامل</span>
          <h2>سجل المعاملات</h2>
          <p>جميع عمليات الشحن التي قمت بها مع السائقين.</p>
        </div>
      </div>
      <section className="panel table-panel">
        <div className="panel-heading">
          <span className="panel-heading-icon"><Receipt size={18} /></span>
          <div><h3>المعاملات</h3><p>{transactions.length} عملية</p></div>
        </div>
        <div className="admin-table agent-tx-table">
          <div className="table-head">
            <span>السائق</span><span>المبلغ</span><span>العمولة</span><span>المرجع</span><span>الرصيد بعد</span><span>التاريخ</span>
          </div>
          {transactions.map((tx) => (
            <div className="table-row" key={tx.id}>
              <div className="person-cell">
                <div className="table-avatar driver">{initials(tx.driver_name)}</div>
                <div><strong>{tx.driver_name}</strong><small dir="ltr">{tx.driver_id}</small></div>
              </div>
              <span className="money-text">{formatMoney(tx.amount)} د.أ</span>
              <span>1.000 د.أ</span>
              <span className="mono-text">{tx.reference_number}</span>
              <span className="money-text">{formatMoney(tx.balance_after)} د.أ</span>
              <span className="tx-time">{formatDateTime(tx.created_at)}</span>
            </div>
          ))}
          {!transactions.length && <EmptyState text="لا توجد معاملات مسجلة بعد" />}
        </div>
      </section>
    </>
  );
}

function AgentProfilePage({ profile, token, onProfileUpdate, onMessage }: { profile: AgentProfile; token: string; onProfileUpdate: (u: Partial<AgentProfile>) => void; onMessage: (m: string) => void }) {
  const [phone, setPhone] = useState(profile.phone);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    setSaving(true);
    const { data, error } = await supabase.rpc('update_nashama_agent_profile', {
      p_session_token: token,
      p_phone: phone || null,
      p_password: newPassword || null,
    });
    setSaving(false);
    if (error || !data?.[0]) {
      onMessage('تعذر حفظ التعديلات.');
      return;
    }
    onProfileUpdate({ phone: data[0].phone });
    setNewPassword('');
    onMessage('تم حفظ تعديلات الملف بنجاح.');
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">الحساب</span>
          <h2>الملف الشخصي</h2>
          <p>بيانات حسابك وإعدادات الوصول.</p>
        </div>
      </div>
      <section className="profile-card panel">
        <div className="profile-hero">
          <div className="profile-large-avatar gold-avatar">{initials(profile.name)}</div>
          <div>
            <span className="eyebrow">حساب الوكيل</span>
            <h2>{profile.name}</h2>
            <p>{profile.location} · {profile.owner_name}</p>
          </div>
          <CheckCircle2 className="verified-profile" size={22} />
        </div>
        <div className="profile-fields">
          <ProfileField label="الموقع" value={profile.location} />
          <ProfileField label="صاحب المركز" value={profile.owner_name || '—'} />
          <ProfileField label="إنفاق اليوم" value={`${formatMoney(profile.daily_spend)} د.أ`} />
          <ProfileField label="إنفاق الشهر" value={`${formatMoney(profile.monthly_spend)} د.أ`} />
        </div>
        <div className="profile-edit">
          <label>رقم الهاتف
            <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          </label>
          <label>كلمة مرور جديدة (اختياري)
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="اتركها فارغة لعدم التغيير" minLength={6} />
          </label>
          <button className="gold-button" onClick={() => void saveProfile()} disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
        <div className="support-banner">
          <Headphones size={21} />
          <div><strong>الدعم الفني عبر واتساب</strong><span dir="ltr">{supportNumber}</span></div>
        </div>
      </section>
    </>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><ClipboardList size={24} /><span>{text}</span></div>;
}

export { AgentApp };
