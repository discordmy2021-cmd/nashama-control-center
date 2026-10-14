import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  BarChart3,
  Bell,
  Car,
  CheckCircle2,
  ChevronLeft,
  CircleUserRound,
  ClipboardList,
  FileWarning,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  Plus,
  ShieldAlert,
  Trash2,
  UserCog,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/navigate';

type Page = 'overview' | 'admins' | 'drivers' | 'agents' | 'complaints' | 'issues' | 'profile';
type Role = 'owner' | 'admin';
type AdminProfile = { account_id: string; profile_id: number; full_name: string; role: Role; phone: string; avatar_url: string | null };
type Driver = { id: string; name: string; phone: string; national_id: string; vehicle_plate: string; avatar_url: string | null; is_active: boolean };
type Agent = { id: string; name: string; owner_name: string; phone: string; location: string; latitude: number | null; longitude: number | null; available_balance: number; monthly_spend: number; daily_spend: number; status: string };
type Complaint = { id: string; subject: string; description: string; complainant_type: string; driver_id: string | null; priority: string; status: string; created_at: string };
type Issue = { id: string; title: string; description: string; severity: string; status: string; created_at: string };
type DashboardData = { driver_count: number; agent_count: number; open_complaints: number; open_issues: number; drivers: Driver[]; agents: Agent[]; complaints: Complaint[]; issues: Issue[] };
type AdminAccount = { id: string; profile_id: number | null; username: string; full_name: string; role: Role; phone: string; avatar_url: string | null; is_active: boolean; created_at: string };

const supportNumber = '0798939402';
const initialDashboard: DashboardData = { driver_count: 0, agent_count: 0, open_complaints: 0, open_issues: 0, drivers: [], agents: [], complaints: [], issues: [] };

function formatMoney(value: number) { return new Intl.NumberFormat('ar-JO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
function formatDate(value: string) { return new Date(value).toLocaleDateString('ar-JO', { day: 'numeric', month: 'short', year: 'numeric' }); }
function initials(name: string) { return name.split(' ').slice(0, 2).map((part) => part[0]).join(''); }

function App({ onNavigate = navigate }: { onNavigate?: (path: string) => void }) {
  const [sessionToken, setSessionToken] = useState('');
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [page, setPage] = useState<Page>('overview');
  const [dashboard, setDashboard] = useState<DashboardData>(initialDashboard);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function loadDashboard(token: string) {
    const { data, error } = await supabase.rpc('get_nashama_admin_dashboard', { p_session_token: token });
    if (error || !data) { setMessage('تعذر تحميل بيانات الإدارة حالياً. حاول تسجيل الدخول مرة أخرى.'); return; }
    setDashboard(data as DashboardData);
    const { data: adminData } = await supabase.rpc('list_nashama_admin_accounts', { p_session_token: token });
    setAccounts((adminData ?? []) as AdminAccount[]);
  }

  async function handleLogin(username: string, password: string) {
    setLoading(true); setMessage('');
    const { data, error } = await supabase.rpc('authenticate_nashama_admin', { p_username: username, p_password: password });
    if (error || !data?.[0]) { setMessage('بيانات الدخول غير صحيحة أو الحساب موقوف.'); setLoading(false); return; }
    const account = data[0] as AdminProfile & { session_token: string };
    setSessionToken(account.session_token);
    setProfile(account);
    await loadDashboard(account.session_token);
    setLoading(false);
  }

  async function handleLogout() {
    if (sessionToken) await supabase.rpc('sign_out_nashama_admin', { p_session_token: sessionToken });
    setSessionToken(''); setProfile(null); setDashboard(initialDashboard); setAccounts([]); setPage('overview'); setMessage('');
  }

  if (!profile || !sessionToken) return <LoginScreen loading={loading} message={message} onLogin={(username, password) => void handleLogin(username, password)} onNavigate={onNavigate} />;

  return <div dir="rtl" className="admin-app">
    <Sidebar page={page} profile={profile} onNavigate={setPage} onLogout={() => void handleLogout()} />
    <main className="admin-main">
      <Topbar page={page} profile={profile} onMenu={() => document.body.classList.toggle('sidebar-open')} />
      {message && <div className="admin-alert"><AlertTriangle size={17} />{message}<button onClick={() => setMessage('')} aria-label="إغلاق"><X size={15} /></button></div>}
      <div className="admin-content">
        {page === 'overview' && <Overview dashboard={dashboard} onNavigate={setPage} />}
        {page === 'admins' && <AdminsPage accounts={accounts} profile={profile} token={sessionToken} onRefresh={() => loadDashboard(sessionToken)} onMessage={setMessage} />}
        {page === 'drivers' && <DriversPage drivers={dashboard.drivers} token={sessionToken} onRefresh={() => loadDashboard(sessionToken)} onMessage={setMessage} />}
        {page === 'agents' && <AgentsPage agents={dashboard.agents} token={sessionToken} onRefresh={() => loadDashboard(sessionToken)} onMessage={setMessage} />}
        {page === 'complaints' && <ComplaintsPage complaints={dashboard.complaints} />}
        {page === 'issues' && <IssuesPage issues={dashboard.issues} />}
        {page === 'profile' && <ProfilePage profile={profile} token={sessionToken} onProfileUpdate={(updates) => setProfile({ ...profile, ...updates })} onRefresh={() => loadDashboard(sessionToken)} onMessage={setMessage} />}
      </div>
    </main>
  </div>;
}

function LoginScreen({ loading, message, onLogin, onNavigate }: { loading: boolean; message: string; onLogin: (username: string, password: string) => void; onNavigate: (path: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onLogin(username.trim(), password); }
  return <main dir="rtl" className="admin-login"><div className="login-orbit orbit-red" /><div className="login-orbit orbit-gold" /><section className="login-panel"><div className="login-brand"><div className="logo-mark"><Car size={25} /></div><strong><span>نشامة</span> درايف</strong><small>مركز التحكم الرئيسي</small></div><div className="login-title"><span>بوابة الإدارة</span><h1>تسجيل الدخول</h1><p>أهلاً بك في مركز قيادة منظومة نشامة درايف</p></div><form onSubmit={submit} autoComplete="off"><label>اسم المستخدم<input autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="أدخل اسم المستخدم" /></label><label>كلمة المرور<input autoComplete="off" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="أدخل كلمة المرور" /></label>{message && <div className="login-error"><ShieldAlert size={16} />{message}</div>}<button className="red-button" type="submit" disabled={loading}>{loading ? 'جاري التحقق...' : 'دخول إلى لوحة الإدارة'}<ChevronLeft size={18} /></button></form><div className="login-security"><LockKeyhole size={16} /><span>دخول محمي بصلاحيات الإدارة</span></div><div className="login-portal-switch"><button type="button" onClick={() => onNavigate('/agent')}>دخول وكلاء الشحن <ChevronLeft size={14} /></button></div></section><p className="login-foot">NASHAMA DRIVE <i>•</i> ADMIN CONTROL CENTER</p></main>;
}

function Sidebar({ page, profile, onNavigate, onLogout }: { page: Page; profile: AdminProfile; onNavigate: (page: Page) => void; onLogout: () => void }) {
  const items: Array<{ id: Page; label: string; icon: ReactNode; count?: number }> = [
    { id: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard size={18} /> },
    { id: 'admins', label: 'المستخدمون الإداريون', icon: <UserCog size={18} /> },
    { id: 'drivers', label: 'السائقون', icon: <Car size={18} /> },
    { id: 'agents', label: 'وكلاء الشحن', icon: <WalletCards size={18} /> },
    { id: 'complaints', label: 'الشكاوى', icon: <FileWarning size={18} /> },
    { id: 'issues', label: 'مشاكل النظام', icon: <ShieldAlert size={18} /> },
  ];
  return <aside className="sidebar"><div className="side-brand"><div className="logo-mark"><Car size={22} /></div><div><strong><span>نشامة</span> درايف</strong><small>لوحة الإدارة</small></div><button className="side-close" onClick={() => document.body.classList.remove('sidebar-open')}><X size={18} /></button></div><div className="side-profile"><div className="profile-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials(profile.full_name)}</div><div><strong>{profile.full_name}</strong><span>{profile.role === 'owner' ? 'صاحب البرنامج' : 'إداري'}</span></div><span className="active-dot" /></div><nav>{items.map((item) => <button key={item.id} className={page === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { onNavigate(item.id); document.body.classList.remove('sidebar-open'); }}>{item.icon}<span>{item.label}</span>{item.count && <b>{item.count}</b>}</button>)}</nav><div className="side-bottom"><button className={page === 'profile' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('profile')}><CircleUserRound size={18} /><span>الملف الشخصي</span></button><button className="logout-link" onClick={onLogout}><LogOut size={17} />تسجيل الخروج</button></div></aside>;
}

function Topbar({ page, profile, onMenu }: { page: Page; profile: AdminProfile; onMenu: () => void }) {
  const titles: Record<Page, string> = { overview: 'نظرة عامة', admins: 'المستخدمون الإداريون', drivers: 'سجل السائقين', agents: 'وكلاء الشحن', complaints: 'إدارة الشكاوى', issues: 'مشاكل النظام', profile: 'الملف الشخصي' };
  return <header className="topbar"><button className="mobile-menu" onClick={onMenu}><Menu size={21} /></button><div><span className="breadcrumb">لوحة الإدارة <ChevronLeft size={12} /> {titles[page]}</span><h1>{titles[page]}</h1></div><div className="topbar-actions"><button className="notification-button"><Bell size={18} /><i /></button><div className="topbar-user"><div className="small-avatar">{initials(profile.full_name)}</div><span>{profile.full_name}</span></div></div></header>;
}

function Overview({ dashboard, onNavigate }: { dashboard: DashboardData; onNavigate: (page: Page) => void }) {
  const cards = [{ label: 'إجمالي السائقين', value: dashboard.driver_count, detail: 'سائق مسجل', icon: <Car />, tone: 'red', page: 'drivers' as Page }, { label: 'وكلاء الشحن', value: dashboard.agent_count, detail: 'وكيل نشط', icon: <WalletCards />, tone: 'gold', page: 'agents' as Page }, { label: 'شكاوى مفتوحة', value: dashboard.open_complaints, detail: 'تحتاج متابعة', icon: <FileWarning />, tone: 'orange', page: 'complaints' as Page }, { label: 'مشاكل النظام', value: dashboard.open_issues, detail: 'بلاغ مفتوح', icon: <ShieldAlert />, tone: 'slate', page: 'issues' as Page }];
  return <><PageIntro eyebrow="صباح الخير" title="مرحباً بك في مركز القيادة" description="تابع حركة منظومة نشامة درايف وأدر كل تفاصيل التشغيل من مكان واحد." action={<button className="outline-action" onClick={() => onNavigate('admins')}><UserCog size={16} /> إدارة الصلاحيات</button>} /><div className="metric-grid">{cards.map((card) => <button className={`metric-card ${card.tone}`} key={card.label} onClick={() => onNavigate(card.page)}><span className="metric-icon">{card.icon}</span><div><span>{card.label}</span><strong>{card.value}</strong><small>{card.detail} <ChevronLeft size={12} /></small></div></button>)}</div><div className="overview-grid"><section className="panel chart-panel"><PanelHeading title="حالة التشغيل اليوم" subtitle="ملخص مباشر للأنظمة المرتبطة" icon={<BarChart3 size={18} />} /><div className="operation-visual"><div className="donut"><strong>98<span>%</span></strong><small>كفاءة التشغيل</small></div><div className="legend"><Legend color="red" label="طلبات مكتملة" value="74%" /><Legend color="gold" label="طلبات جارية" value="18%" /><Legend color="slate" label="بانتظار الإسناد" value="8%" /></div></div></section><section className="panel activity-panel"><PanelHeading title="آخر التنبيهات" subtitle="تحديثات تحتاج انتباهك" icon={<Bell size={18} />} /><div className="activity-list"><Activity icon={<FileWarning />} title={dashboard.complaints[0]?.subject ?? 'لا توجد شكاوى جديدة'} detail={dashboard.complaints[0] ? 'شكوى بانتظار المراجعة' : 'النظام يعمل دون تنبيهات'} tone="red" /><Activity icon={<ShieldAlert />} title={dashboard.issues[0]?.title ?? 'كل الأنظمة مستقرة'} detail={dashboard.issues[0]?.description ?? 'لا توجد مشاكل مسجلة حالياً'} tone="gold" /></div></section></div><section className="panel quick-panel"><PanelHeading title="الوصول السريع" subtitle="إجراءات الإدارة الأكثر استخداماً" icon={<ArrowDownLeft size={18} />} /><div className="quick-actions"><button onClick={() => onNavigate('drivers')}><Car size={19} /><span>سجل السائقين</span></button><button onClick={() => onNavigate('agents')}><MapPin size={19} /><span>مواقع الوكلاء</span></button><button onClick={() => onNavigate('complaints')}><Headphones size={19} /><span>مركز الشكاوى</span></button><button onClick={() => onNavigate('issues')}><AlertTriangle size={19} /><span>مشاكل التطبيق</span></button></div></section></>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) { return <div className="page-intro"><div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action}</div>; }
function PanelHeading({ title, subtitle, icon }: { title: string; subtitle: string; icon: ReactNode }) { return <div className="panel-heading"><span className="panel-heading-icon">{icon}</span><div><h3>{title}</h3><p>{subtitle}</p></div><button className="dots">•••</button></div>; }
function Legend({ color, label, value }: { color: string; label: string; value: string }) { return <div className="legend-row"><i className={color} /><span>{label}</span><b>{value}</b></div>; }
function Activity({ icon, title, detail, tone }: { icon: ReactNode; title: string; detail: string; tone: string }) { return <div className="activity-row"><span className={`activity-icon ${tone}`}>{icon}</span><div><strong>{title}</strong><small>{detail}</small></div><ChevronLeft size={15} /></div>; }

function AdminsPage({ accounts, profile, token, onRefresh, onMessage }: { accounts: AdminAccount[]; profile: AdminProfile; token: string; onRefresh: () => Promise<void>; onMessage: (message: string) => void }) {
  const [formOpen, setFormOpen] = useState(false); const [saving, setSaving] = useState(false); const [form, setForm] = useState({ username: '', password: '', fullName: '', phone: '', avatarData: '' });
  async function createAccount(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const { error } = await supabase.rpc('create_nashama_admin_account', { p_session_token: token, p_username: form.username, p_password: form.password, p_full_name: form.fullName, p_phone: form.phone, p_avatar_url: form.avatarData }); setSaving(false); if (error) { onMessage('تعذر إنشاء الحساب. تأكد من البيانات وأن اسم المستخدم غير مستخدم.'); return; } setForm({ username: '', password: '', fullName: '', phone: '', avatarData: '' }); setFormOpen(false); onMessage('تم إنشاء الحساب الإداري بنجاح.'); await onRefresh(); }
  async function deactivate(id: string) { const { error } = await supabase.rpc('deactivate_nashama_admin', { p_session_token: token, p_account_id: id }); if (error) { onMessage('لا يمكن تعطيل هذا الحساب من صلاحيتك الحالية.'); return; } onMessage('تم تعطيل الحساب ومنع تسجيل الدخول.'); await onRefresh(); }
  async function deleteAccount(id: string) { const { error } = await supabase.rpc('delete_nashama_admin', { p_session_token: token, p_account_id: id }); if (error) { onMessage('لا يمكن حذف هذا الحساب من صلاحيتك الحالية.'); return; } onMessage('تم حذف الحساب من النظام نهائياً.'); await onRefresh(); }
  return <><PageIntro eyebrow="إدارة الوصول" title="المستخدمون الإداريون" description="أنشئ حسابات فريق الإدارة وحدد من يملك صلاحية الدخول إلى مركز القيادة." action={profile.role === 'owner' ? <button className="red-button compact" onClick={() => setFormOpen(true)}><Plus size={17} /> إنشاء حساب إداري</button> : undefined} /><section className="panel table-panel"><PanelHeading title="حسابات الإدارة" subtitle={`${accounts.length} حسابات مسجلة في النظام`} icon={<Users size={18} />} /><div className="admin-table"><div className="table-head"><span>المستخدم</span><span>اسم العرض</span><span>الصلاحية</span><span>الحالة</span><span>الإجراء</span></div>{accounts.map((account) => <div className="table-row" key={account.id}><div className="person-cell"><div className="table-avatar">{account.avatar_url ? <img src={account.avatar_url} alt="" /> : initials(account.full_name)}</div><div><strong>{account.username}</strong><small>ID: {account.profile_id ?? '—'} · {account.phone || 'لا يوجد رقم'}</small></div></div><span>{account.full_name}</span><span><b className={account.role === 'owner' ? 'role-badge owner' : 'role-badge'}>{account.role === 'owner' ? 'صاحب البرنامج' : 'إداري'}</b></span><span><b className={account.is_active ? 'status-badge active' : 'status-badge blocked'}>{account.is_active ? 'نشط' : 'موقوف'}</b></span><span>{profile.role === 'owner' && account.role === 'admin' ? <div className="action-group">{account.is_active ? <button className="table-action warn" onClick={() => void deactivate(account.id)}><ShieldAlert size={14} /> تعطيل</button> : <span className="muted-action">موقوف</span>}<button className="table-action danger" onClick={() => void deleteAccount(account.id)}><Trash2 size={14} /> حذف</button></div> : <span className="muted-action">محمي</span>}</span></div>)}</div></section>{formOpen && <div className="modal-layer"><div className="form-modal"><div className="modal-title"><div><span>صلاحية المالك</span><h3>إنشاء حساب إداري</h3></div><button className="icon-close" onClick={() => setFormOpen(false)}><X size={18} /></button></div><form onSubmit={(event) => void createAccount(event)}><div className="form-grid"><label>اسم المستخدم<input required minLength={3} autoComplete="off" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label><label>كلمة المرور<input required minLength={8} autoComplete="new-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label>الاسم الكامل<input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label>رقم الهاتف<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><ImagePicker label="صورة الحساب" value={form.avatarData} onChange={(value) => setForm({ ...form, avatarData: value })} /></div><div className="modal-actions"><button type="button" className="ghost-button" onClick={() => setFormOpen(false)}>إلغاء</button><button type="submit" className="red-button" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ الحساب'}</button></div></form></div></div>}</>;
}

function DriversPage({ drivers, token, onRefresh, onMessage }: { drivers: Driver[]; token: string; onRefresh: () => Promise<void>; onMessage: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  return <><PageIntro eyebrow="الأسطول" title="سجل السائقين" description="أضف السائقين ببياناتهم الكاملة ليظهروا في تطبيق الكباتن والوكلاء." action={<button className="red-button compact" onClick={() => setOpen(true)}><Plus size={17} /> إضافة سائق</button>} /><section className="panel table-panel"><PanelHeading title="السائقون المسجلون" subtitle={`${drivers.length} سائق نشط`} icon={<Car size={18} />} /><div className="admin-table"><div className="table-head driver-head"><span>السائق</span><span>المعرف</span><span>الهاتف</span><span>رقم اللوحة</span><span>رقم الهوية</span></div>{drivers.map((driver) => <div className="table-row" key={driver.id}><div className="person-cell"><div className="table-avatar driver">{driver.avatar_url ? <img src={driver.avatar_url} alt={`صورة ${driver.name}`} /> : initials(driver.name)}</div><div><strong>{driver.name}</strong><small>{driver.is_active ? 'متاح في النظام' : 'موقوف'}</small></div></div><span className="mono-text">{driver.id}</span><span>{driver.phone}</span><span>{driver.vehicle_plate || '—'}</span><span>{driver.national_id || '—'}</span></div>)}{!drivers.length && <EmptyState text="لا يوجد سائقون مسجلون بعد. أضف أول سائق من الزر أعلاه." />}</div></section>{open && <DriverForm token={token} onClose={() => setOpen(false)} onRefresh={onRefresh} onMessage={onMessage} />}</>;
}
function AgentsPage({ agents, token, onRefresh, onMessage }: { agents: Agent[]; token: string; onRefresh: () => Promise<void>; onMessage: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [balanceAgent, setBalanceAgent] = useState<Agent | null>(null);
  return <><PageIntro eyebrow="الشبكة المالية" title="وكلاء الشحن" description="أضف مراكز الشحن وحدد موقعها وصاحبها ورصيدها من مكان واحد." action={<button className="red-button compact" onClick={() => setOpen(true)}><Plus size={17} /> إضافة مركز شحن</button>} /><section className="panel table-panel"><PanelHeading title="مراكز الشحن" subtitle={`${agents.length} مركز مسجل · الأرصدة تبدأ من صفر`} icon={<WalletCards size={18} />} /><div className="admin-table"><div className="table-head agent-head"><span>المركز وصاحبه</span><span>الموقع</span><span>الرصيد</span><span>استخدام اليوم</span><span>استخدام الشهر</span></div>{agents.map((agent) => <div className="table-row" key={agent.id}><div className="person-cell"><div className="table-avatar agent"><WalletCards size={16} /></div><div><strong>{agent.name}</strong><small>{agent.owner_name} · {agent.phone}</small></div></div><span><MapPin size={14} className="inline-icon" />{agent.location}</span><button className="money-button" onClick={() => setBalanceAgent(agent)}>{formatMoney(agent.available_balance)} د.أ <Plus size={13} /></button><span>{formatMoney(agent.daily_spend)} د.أ</span><span>{formatMoney(agent.monthly_spend)} د.أ</span></div>)}{!agents.length && <EmptyState text="لا توجد مراكز شحن بعد. أضف أول مركز من الزر أعلاه." />}</div></section>{open && <AgentForm token={token} onClose={() => setOpen(false)} onRefresh={onRefresh} onMessage={onMessage} />}{balanceAgent && <BalanceForm token={token} agent={balanceAgent} onClose={() => setBalanceAgent(null)} onRefresh={onRefresh} onMessage={onMessage} />}</>;
}
async function uploadAvatar(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('nashama-avatars').upload(fileName, file, { contentType: file.type, upsert: false });
  if (uploadError) return null;
  const { data: urlData } = supabase.storage.from('nashama-avatars').getPublicUrl(fileName);
  return urlData.publicUrl;
}

function ImagePicker({ label, value, onChange, onFileChange }: { label: string; value: string; onChange: (value: string) => void; onFileChange?: (file: File | null) => void }) {
  const [uploading, setUploading] = useState(false);
  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5000000) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      if (url) { onChange(url); if (onFileChange) onFileChange(file); }
    } catch { /* ignore */ }
    setUploading(false);
  }
  return <label className="image-picker"><span>{label}</span><div className="image-picker-row">{value ? <img src={value} alt="معاينة الصورة" /> : <CircleUserRound size={25} />}<div><strong>{uploading ? 'جاري رفع الصورة...' : value ? 'تم اختيار الصورة' : 'إضافة صورة من الاستوديو'}</strong><small>الصيغ المدعومة JPG و PNG · حتى 5MB</small></div><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void selectImage(event)} /></div></label>;
}

function DriverForm({ token, onClose, onRefresh, onMessage }: { token: string; onClose: () => void; onRefresh: () => Promise<void>; onMessage: (message: string) => void }) {
  const [form, setForm] = useState({ id: '', name: '', nationalId: '', plate: '', phone: '', avatar: '' }); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const { error } = await supabase.rpc('create_nashama_driver', { p_session_token: token, p_driver_id: form.id, p_name: form.name, p_national_id: form.nationalId, p_vehicle_plate: form.plate, p_phone: form.phone, p_avatar_url: form.avatar || null }); setSaving(false); if (error) { onMessage('تعذر إضافة السائق. تأكد من أن المعرف غير مستخدم وأن البيانات مكتملة.'); return; } onClose(); onMessage('تمت إضافة السائق بنجاح.'); await onRefresh(); }
  return <Modal><ModalTitle eyebrow="إضافة إلى الأسطول" title="إضافة سائق" onClose={onClose} /><form onSubmit={(event) => void submit(event)}><div className="form-grid"><label>معرف السائق<input required value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} placeholder="مثال: ND-2045" /></label><label>الاسم الكامل<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>رقم الهوية<input required value={form.nationalId} onChange={(event) => setForm({ ...form, nationalId: event.target.value })} /></label><label>رقم لوحة السيارة<input required value={form.plate} onChange={(event) => setForm({ ...form, plate: event.target.value })} /></label><label>رقم الهاتف<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><ImagePicker label="صورة السائق" value={form.avatar} onChange={(value) => setForm({ ...form, avatar: value })} /></div><ModalActions saving={saving} label="حفظ السائق" onCancel={onClose} /></form></Modal>;
}

function AgentForm({ token, onClose, onRefresh, onMessage }: { token: string; onClose: () => void; onRefresh: () => Promise<void>; onMessage: (message: string) => void }) {
  const [form, setForm] = useState({ name: '', owner: '', phone: '', location: '', latitude: '', longitude: '' }); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const { error } = await supabase.rpc('create_nashama_agent', { p_session_token: token, p_name: form.name, p_owner_name: form.owner, p_phone: form.phone, p_location: form.location, p_latitude: form.latitude ? Number(form.latitude) : null, p_longitude: form.longitude ? Number(form.longitude) : null }); setSaving(false); if (error) { onMessage('تعذر إضافة مركز الشحن. تأكد من إكمال البيانات.'); return; } onClose(); onMessage('تمت إضافة مركز الشحن برصيد صفر.'); await onRefresh(); }
  return <Modal><ModalTitle eyebrow="شبكة الوكلاء" title="إضافة مركز شحن" onClose={onClose} /><form onSubmit={(event) => void submit(event)}><div className="form-grid"><label>اسم المركز<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>اسم صاحب المكان<input required value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} /></label><label>رقم الهاتف<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label className="wide">عنوان الموقع<input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="المدينة، الشارع، وصف الموقع" /></label><label>خط العرض<input value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} placeholder="اختياري" /></label><label>خط الطول<input value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} placeholder="اختياري" /></label></div><div className="location-note"><MapPin size={16} />يمكن لاحقاً ربط الموقع بخريطة تفاعلية</div><ModalActions saving={saving} label="حفظ المركز" onCancel={onClose} /></form></Modal>;
}

function BalanceForm({ token, agent, onClose, onRefresh, onMessage }: { token: string; agent: Agent; onClose: () => void; onRefresh: () => Promise<void>; onMessage: (message: string) => void }) {
  const [balance, setBalance] = useState(String(agent.available_balance)); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const { error } = await supabase.rpc('set_nashama_agent_balance', { p_session_token: token, p_agent_id: agent.id, p_balance: Number(balance) }); setSaving(false); if (error) { onMessage('تعذر تحديث الرصيد.'); return; } onClose(); onMessage('تم تحديث رصيد المركز بنجاح.'); await onRefresh(); }
  return <Modal><ModalTitle eyebrow="المحفظة" title={`إضافة رصيد إلى ${agent.name}`} onClose={onClose} /><form onSubmit={(event) => void submit(event)}><label>الرصيد الجديد بالدينار الأردني<input required min="0" step="0.01" type="number" value={balance} onChange={(event) => setBalance(event.target.value)} /></label><div className="balance-preview">الرصيد الحالي <strong>{formatMoney(agent.available_balance)} د.أ</strong></div><ModalActions saving={saving} label="تحديث الرصيد" onCancel={onClose} /></form></Modal>;
}

function Modal({ children }: { children: ReactNode }) { return <div className="modal-layer"><div className="form-modal">{children}</div></div>; }
function ModalTitle({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) { return <div className="modal-title"><div><span>{eyebrow}</span><h3>{title}</h3></div><button type="button" className="icon-close" onClick={onClose}><X size={18} /></button></div>; }
function ModalActions({ saving, label, onCancel }: { saving: boolean; label: string; onCancel: () => void }) { return <div className="modal-actions"><button type="button" className="ghost-button" onClick={onCancel}>إلغاء</button><button type="submit" className="red-button" disabled={saving}>{saving ? 'جاري الحفظ...' : label}</button></div>; }

function ComplaintsPage({ complaints }: { complaints: Complaint[] }) { return <><PageIntro eyebrow="خدمة المتابعة" title="الشكاوى" description="راجع بلاغات العملاء والكباتن واتخذ الإجراء المناسب." action={<div className="summary-pill"><FileWarning size={16} /> {complaints.filter((item) => item.status !== 'resolved').length} مفتوحة</div>} /><section className="panel table-panel"><PanelHeading title="قائمة الشكاوى" subtitle="آخر البلاغات الواردة من التطبيقات" icon={<Headphones size={18} />} /><div className="admin-table complaints-table"><div className="table-head"><span>الموضوع</span><span>المرسل</span><span>السائق</span><span>الأولوية</span><span>الحالة</span></div>{complaints.map((complaint) => <div className="table-row" key={complaint.id}><div><strong>{complaint.subject}</strong><small className="row-description">{complaint.description}</small></div><span>{complaint.complainant_type === 'customer' ? 'عميل' : 'كابتن'}</span><span className="mono-text">{complaint.driver_id ?? '—'}</span><span><b className={`priority-badge ${complaint.priority}`}>{complaint.priority === 'high' ? 'عالية' : complaint.priority === 'low' ? 'منخفضة' : 'متوسطة'}</b></span><span><b className="status-badge warning">{complaint.status === 'open' ? 'مفتوحة' : 'قيد المتابعة'}</b></span></div>)}{!complaints.length && <EmptyState text="لا توجد شكاوى مسجلة" />}</div></section></>; }
function IssuesPage({ issues }: { issues: Issue[] }) { return <><PageIntro eyebrow="المراقبة التقنية" title="مشاكل النظام" description="تابع المشاكل القادمة من تطبيق الإدارة والوكلاء والكباتن والعملاء." action={<div className="summary-pill red-pill"><ShieldAlert size={16} /> مراقبة مباشرة</div>} /><section className="panel table-panel"><PanelHeading title="سجل المشاكل" subtitle="الأخطاء والتنبيهات التي تحتاج معالجة" icon={<AlertTriangle size={18} />} /><div className="issue-list">{issues.map((issue) => <div className="issue-card" key={issue.id}><span className={`issue-severity ${issue.severity}`}><AlertTriangle size={18} /></span><div><strong>{issue.title}</strong><p>{issue.description}</p><small>{formatDate(issue.created_at)}</small></div><b className="status-badge warning">{issue.status === 'in_progress' ? 'قيد الحل' : 'مفتوحة'}</b></div>)}{!issues.length && <EmptyState text="لا توجد مشاكل مسجلة" />}</div></section></>; }
function ProfilePage({ profile, token, onProfileUpdate, onRefresh, onMessage }: { profile: AdminProfile; token: string; onProfileUpdate: (updates: Partial<AdminProfile>) => void; onRefresh: () => Promise<void>; onMessage: (message: string) => void }) {
  const [phone, setPhone] = useState(profile.phone); const [avatar, setAvatar] = useState(profile.avatar_url ?? ''); const [saving, setSaving] = useState(false);
  async function saveProfile() { setSaving(true); const { data, error } = await supabase.rpc('update_nashama_admin_profile', { p_session_token: token, p_phone: phone, p_avatar_url: avatar || null }); setSaving(false); if (error || !data?.[0]) { onMessage('تعذر حفظ تعديلات الملف الشخصي.'); return; } onProfileUpdate({ phone: data[0].phone, avatar_url: data[0].avatar_url }); onMessage('تم حفظ تعديلات الملف الشخصي.'); await onRefresh(); }
  return <><PageIntro eyebrow="الحساب" title="الملف الشخصي" description="بيانات الحساب وصلاحيات الوصول إلى مركز القيادة." /><section className="profile-card panel"><div className="profile-hero"><div className="profile-large-avatar">{avatar ? <img src={avatar} alt="صورة الملف الشخصي" /> : initials(profile.full_name)}</div><div><span className="eyebrow">الحساب الحالي</span><h2>{profile.full_name}</h2><p>{profile.role === 'owner' ? 'صاحب البرنامج · صلاحية كاملة' : 'إداري · صلاحيات تشغيلية'}</p></div><CheckCircle2 className="verified-profile" size={22} /></div><div className="profile-fields"><ProfileField label="رقم الحساب" value={String(profile.profile_id)} /><ProfileField label="رقم الدعم الفني الرسمي" value={supportNumber} /><ProfileField label="الصلاحية" value={profile.role === 'owner' ? 'صاحب البرنامج' : 'إداري'} /></div><div className="profile-edit"><label>رقم هاتف الحساب<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label><ImagePicker label="تعديل صورة الملف الشخصي" value={avatar} onChange={setAvatar} /><button className="red-button" onClick={() => void saveProfile()} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ تعديلات الملف'}</button></div><div className="support-banner"><Headphones size={21} /><div><strong>الدعم الفني عبر واتساب</strong><span dir="ltr">{supportNumber}</span></div></div></section></>; }
function ProfileField({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><ClipboardList size={24} /><span>{text}</span></div>; }

export { App as AdminApp };
