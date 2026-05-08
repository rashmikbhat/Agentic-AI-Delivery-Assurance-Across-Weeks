import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  Database, 
  FileText, 
  Layers, 
  LayoutDashboard, 
  Mail, 
  MessageSquare, 
  RefreshCcw, 
  ShieldCheck, 
  Settings,
  Cpu,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Types ---
import { 
  WeekBucket, 
  RiskAlert, 
  AgentAction, 
  MOCK_BOTTLE_NECKS, 
  MOCK_PRODUCT_MIX, 
  MOCK_WEEK_STATUS 
} from './types';
import { analyzeDeliveryRisk } from './services/agentService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const StatusBadge = ({ severity }: { severity: 'low' | 'medium' | 'high' }) => {
  const styles = {
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold border capitalize", styles[severity])}>
      {severity}
    </span>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agent' | 'strategy' | 'kpi' | 'design'>('dashboard');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [risks, setRisks] = useState<RiskAlert[]>([]);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');

  useEffect(() => {
    runAnalysis();
  }, []);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    const data = await analyzeDeliveryRisk({ bottlenecks: MOCK_BOTTLE_NECKS, mix: MOCK_PRODUCT_MIX });
    setRisks(data.risks);
    setActions(data.actions);
    setAiSummary(data.summary);
    setIsAnalyzing(false);
  };

  const handleActionResolve = (id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, status: 'completed' as const } : a));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100Selection">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-slate-900 text-slate-300 p-6 flex flex-col gap-8 shadow-2xl z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Cpu className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-white font-bold tracking-tight text-lg leading-tight uppercase">ManuSense</h1>
            <p className="text-[10px] tracking-widest text-slate-500 font-semibold uppercase">AI Delivery Agent</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          <NavItem active={activeTab === 'dashboard'} icon={LayoutDashboard} label="Real-time Ops" onClick={() => setActiveTab('dashboard')} />
          <NavItem active={activeTab === 'agent'} icon={MessageSquare} label="Agent Log" onClick={() => setActiveTab('agent')} count={actions.filter(a => a.status === 'pending').length} />
          <NavItem active={activeTab === 'strategy'} icon={Layers} label="Mix Strategy" onClick={() => setActiveTab('strategy')} />
          <NavItem active={activeTab === 'kpi'} icon={BarChart3} label="KPI Analysis" onClick={() => setActiveTab('kpi')} />
          <div className="my-4 h-px bg-slate-800/50" />
          <NavItem active={activeTab === 'design'} icon={FileText} label="Design & MVP" onClick={() => setActiveTab('design')} />
        </nav>

        <div className="mt-auto">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">System Health</span>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Online</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-emerald-500"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="ml-64 p-8 min-h-screen">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-800">
              {activeTab === 'dashboard' && "W1-W4 Delivery Assurance"}
              {activeTab === 'agent' && "Agent Insight & Execution"}
              {activeTab === 'strategy' && "Product Mix Trade-offs"}
              {activeTab === 'kpi' && "Historical Performance"}
              {activeTab === 'design' && "Solution Architecture"}
            </h2>
            <p className="text-slate-500 mt-1 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Rolling Horizon Update: 5 mins ago
            </p>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCcw className={cn("w-4 h-4", isAnalyzing && "animate-spin")} />
              Refresh Data
            </button>
            <div className="bg-indigo-600 px-6 py-2 rounded-xl text-white font-semibold flex items-center gap-2 shadow-lg shadow-indigo-200">
              <Database className="w-4 h-4" />
              MES Sync: Real-time
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <DashboardView risks={risks} summary={aiSummary} />}
          {activeTab === 'agent' && <AgentLogView actions={actions} onResolve={handleActionResolve} />}
          {activeTab === 'strategy' && <StrategyView />}
          {activeTab === 'kpi' && <KPIView />}
          {activeTab === 'design' && <DesignView />}
        </AnimatePresence>
      </main>
    </div>
  );
}

const NavItem = ({ active, icon: Icon, label, onClick, count }: { active: boolean, icon: any, label: string, onClick: () => void, count?: number }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group relative",
      active ? "bg-indigo-500/10 text-white font-medium" : "hover:bg-white/5"
    )}
  >
    <div className="flex items-center gap-3">
      <Icon className={cn("w-5 h-5", active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300")} />
      <span>{label}</span>
      {active && <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full" />}
    </div>
    {count ? (
      <span className="w-5 h-5 bg-indigo-500 text-white text-[10px] font-bold rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
        {count}
      </span>
    ) : null}
  </button>
);

// --- Sub-Views ---

const DashboardView = ({ risks, summary }: { risks: RiskAlert[], summary: string }) => {
  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1
          }
        }
      }}
      className="space-y-6"
    >
      {/* Summary Banner */}
      <motion.div 
        variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
        className="bg-indigo-900 rounded-2xl p-6 text-white flex items-center gap-6 shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md">
          <Zap className="w-10 h-10 text-indigo-300" />
        </div>
        <div>
          <h3 className="text-xl font-bold mb-1 italic">Agent Verdict</h3>
          <p className="text-indigo-100 max-w-2xl leading-relaxed">
            {summary || "Analyzing delivery pipeline across W1-W4..."}
          </p>
        </div>
      </motion.div>

      {/* Week Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {(Object.entries(MOCK_WEEK_STATUS) as [WeekBucket, any][]).map(([week, status]) => (
          <motion.div 
            key={week} 
            variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            <div className={cn(
              "absolute top-0 left-0 w-full h-1",
              status.risk === 'high' ? 'bg-rose-500' : status.risk === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
            )} />
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{week} Outlook</span>
                <h4 className="text-2xl font-black text-slate-900 mt-1">{status.otif}% <span className="text-sm font-medium text-slate-400">OTIF</span></h4>
              </div>
              <StatusBadge severity={status.risk as any} />
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Primary Driver</p>
                <p className="text-xs font-bold text-slate-700 mt-0.5 truncate">{status.primaryDriver}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risks Column */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <AlertTriangle className="text-amber-500 w-5 h-5" />
                Delivery Risks Detected
              </h3>
              <span className="text-xs font-semibold text-slate-400">{risks.length} Issues Identifed</span>
            </div>
            <div className="divide-y divide-slate-100">
              {risks.map(risk => (
                <motion.div 
                  key={risk.id} 
                  variants={{ hidden: { x: -20, opacity: 0 }, visible: { x: 0, opacity: 1 } }}
                  className="p-6 hover:bg-slate-50/50 transition-colors flex gap-4"
                >
                  <div className={cn(
                    "w-1 h-auto rounded-full",
                    risk.severity === 'high' ? 'bg-rose-500' : 'bg-amber-500'
                  )} />
                  <div className="flex-1">
                    <div className="flex justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2 py-1 bg-slate-900 text-white rounded uppercase">{risk.week}</span>
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{risk.type}</span>
                      </div>
                      <StatusBadge severity={risk.severity} />
                    </div>
                    <h4 className="font-bold text-slate-800 text-lg">{risk.reason}</h4>
                    <p className="text-sm text-slate-500 mt-1">{risk.evidence}</p>
                    <div className="mt-4 flex gap-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded-md">
                        <Layers className="w-3 h-3" /> {risk.productFamily}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Bottleneck Utilization */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold flex items-center gap-2 mb-6">
              <Activity className="text-indigo-500 w-5 h-5" />
              Bottleneck Constraint Health
            </h3>
            <div className="space-y-6">
              {MOCK_BOTTLE_NECKS.map(bn => (
                <div key={bn.id} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div>
                      <h5 className="font-bold text-slate-800 flex items-center gap-2">
                        {bn.name}
                        {bn.status === 'critical' && <span className="animate-pulse w-2 h-2 bg-rose-500 rounded-full" />}
                      </h5>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Efficiency Index: {(bn.currentUph/bn.baselineUph * 100).toFixed(0)}%</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-600">{bn.utilization}% Load</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                    <motion.div 
                      className={cn(
                        "h-full",
                        bn.status === 'critical' ? 'bg-rose-500' : 'bg-indigo-500'
                      )}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${bn.utilization}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {bn.activeIssues.map((issue, idx) => (
                      <span key={idx} className="text-[10px] bg-slate-50 border border-slate-100 text-slate-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-500" /> {issue}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Real-time Load Data */}
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden relative">
             <div className="absolute top-0 right-0 p-3 opacity-10">
               <BarChart3 className="w-16 h-16" />
             </div>
             <h3 className="font-bold text-slate-800 mb-6">Capacity vs Mix Plan</h3>
             <div className="h-80 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={MOCK_PRODUCT_MIX} layout="vertical" margin={{ left: -10, right: 10 }}>
                   <XAxis type="number" hide />
                   <YAxis dataKey="family" type="category" width={100} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                   <Tooltip 
                     cursor={{ fill: '#f8fafc' }} 
                     contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                   />
                   <Bar dataKey="currentPlan" name="Plan" fill="#6366f1" radius={[0, 4, 4, 0]} />
                   <Bar dataKey="commit" name="Commit" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
             <p className="text-[10px] text-slate-400 font-medium italic mt-2">*Units adjusted by Product Load Factor</p>
          </section>

          <section className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
               <div className="bg-indigo-500 p-2 rounded-lg text-white shadow-lg shadow-indigo-200">
                 <ShieldCheck className="w-5 h-5" />
               </div>
               <h4 className="font-bold text-indigo-900">Agent Assurance</h4>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-xs text-indigo-700/80">
                <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                Validated WIP position across 22 critical process steps.
              </li>
              <li className="flex items-start gap-2 text-xs text-indigo-700/80">
                <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                Correlated OEE dips with Maintenance ERP tickets.
              </li>
              <li className="flex items-start gap-2 text-xs text-indigo-700/80">
                <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                Automated 4 follow-ups for 'Wait-for-Disposition' lots.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </motion.div>
  );
};

const AgentLogView = ({ actions, onResolve }: { actions: AgentAction[], onResolve: (id: string) => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl space-y-6"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 rounded-full p-2 text-white">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Autonomous Communication Log</h3>
              <p className="text-xs text-slate-400">Agent follows up on blockers automatically</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live Agent Active
            </span>
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {actions.map(action => (
            <div key={action.id} className="p-6 hover:bg-slate-50 transition-colors group">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    action.type === 'follow-up' ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'
                  )}>
                    {action.type === 'follow-up' ? <Mail className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{action.type} to {action.target}</span>
                    <h4 className="font-bold text-slate-800 mt-0.5">{action.message}</h4>
                  </div>
                </div>
                <div className="text-right">
                  {action.status === 'completed' ? (
                     <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                       <CheckCircle2 className="w-3.5 h-3.5" /> Sent / Logged
                     </div>
                  ) : (
                    <button 
                      onClick={() => onResolve(action.id)}
                      className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                    >
                      Process Recommendation
                    </button>
                  )}
                </div>
              </div>
              {action.outcome && (
                <div className="mt-3 ml-11 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Event Trace</p>
                  <p className="text-xs text-slate-600 font-medium">{action.outcome}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const StrategyView = () => (
  <motion.div 
    initial={{ opacity: 0 }} 
    animate={{ opacity: 1 }} 
    className="space-y-6"
  >
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative group">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-emerald-50/50 rounded-full blur-3xl group-hover:bg-emerald-100/50 transition-colors" />
        <h3 className="text-2xl font-black text-slate-900 mb-2">Build-Ahead Logic</h3>
        <p className="text-slate-500 mb-8 max-w-sm">Agent evaluates shifting W1 capacity to W2-W3 gaps when bottleneck utilization allows for "low-mix" families.</p>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="font-bold text-slate-700">Level Loading (Current)</span>
            <span className="text-emerald-600 font-black text-sm">OPTIMIZED</span>
          </div>
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <p className="text-xs font-bold text-indigo-900 mb-1 italic">Agent Strategy Suggestion</p>
            <p className="text-xs text-indigo-700 leading-relaxed">
              Consolidate 400 units of "IoT Edge" in W1. This frees up 15% bottleneck time in W2 for the high-margin "Automotive" ramp.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl flex flex-col justify-between">
        <div>
          <h3 className="text-2xl font-black mb-2">Multi-Horizon Optimization</h3>
          <p className="text-slate-400 mb-6 font-medium">Quantifying how W1 escalations ripple through W2-W4 capacity.</p>
        </div>
        
        <div className="space-y-4 py-4">
           <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">W1 Expedite Cost</span>
                <span className="text-rose-400 text-xs font-black">-14% W3 Cap</span>
              </div>
              <p className="text-[10px] text-slate-500">Expediting Family A now consumes shared tool group L-400, creating a mandatory PM cycle in W3.</p>
           </div>
           <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mix Balancing Benefit</span>
                <span className="text-emerald-400 text-xs font-black">+8% OTIF</span>
              </div>
              <p className="text-[10px] text-slate-500">Shifting Family B to Low-Mix Tools stabilizes W2 throughput.</p>
           </div>
        </div>

        <button className="w-full bg-indigo-500 py-3 rounded-2xl font-bold hover:bg-indigo-400 transition-colors mt-4">
          Simulate Trade-off Impact
        </button>
      </div>
    </div>
  </motion.div>
);

const KPIView = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[
        { label: 'Avg OTIF Coverage', val: '92.4%', change: '+1.2%', up: true },
        { label: 'Agent Resolve Rate', val: '84%', change: '-2%', up: false },
        { label: 'Bottleneck Stability', val: '98.2%', change: '+3.5%', up: true }
      ].map((kpi, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-black text-slate-900">{kpi.val}</span>
            <span className={cn("text-xs font-bold flex items-center mb-1.5", kpi.up ? 'text-emerald-500' : 'text-rose-500')}>
              {kpi.up ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {kpi.change}
            </span>
          </div>
        </div>
      ))}
    </div>

    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm h-96">
      <h3 className="font-bold text-slate-800 mb-8">Delivery Accuracy vs. Target (Monthly Context)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[
          { name: 'Mon', val: 85, target: 90 },
          { name: 'Tue', val: 88, target: 90 },
          { name: 'Wed', val: 92, target: 90 },
          { name: 'Thu', val: 91, target: 90 },
          { name: 'Fri', val: 94, target: 90 },
          { name: 'Sat', val: 95, target: 90 },
          { name: 'Sun', val: 93, target: 90 },
        ]}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
          />
          <Line type="monotone" dataKey="val" stroke="#6366f1" strokeWidth={4} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} name="Actual OTIF" />
          <Line type="stepAfter" dataKey="target" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" name="Target" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </motion.div>
);

const DesignView = () => {
  const [showSlides, setShowSlides] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Slide 1: End-to-End W1-W4 Workflow",
      content: (
        <div className="space-y-6">
          <div className="bg-indigo-900 p-8 rounded-3xl text-indigo-100 shadow-2xl h-full flex flex-col justify-center">
            <h4 className="text-white font-black text-3xl mb-8 flex items-center gap-3">
              <Layers className="w-8 h-8 text-indigo-400" /> Agentic Delivery Lifecycle
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { t: "Continuous Monitoring", d: "Real-time stream from MES (WIP), ERP (Commit), and SCADA (OEE). High-fidelity risk assessment for W1-W4." },
                { t: "Classification & Root Cause", d: "Classifies risks into WIP Aging, UPH Degradation, or Equipment Downtime using specialized reasoning models." },
                { t: "Autonomous Follow-up", d: "Direct engagement with Tool Owners and Engineers for missing ETAs or yield insights via enterprise channels." },
                { t: "Execution & Recommendation", d: "Dynamic lot re-sequencing and mix-balancing proposals based on cross-week capacity impact analysis." }
              ].map((item, i) => (
                <div key={i} className="bg-white/5 p-6 rounded-2xl border border-white/5">
                   <h5 className="font-bold text-white mb-2">{item.t}</h5>
                   <p className="text-sm text-indigo-200/70 leading-relaxed">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Slide 2: Data Agent Architecture",
      content: (
        <div className="bg-slate-900 p-10 rounded-3xl text-white shadow-2xl h-full flex flex-col justify-center">
           <h4 className="text-white font-black text-3xl mb-8 flex items-center gap-3">
              <Database className="w-8 h-8 text-indigo-400" /> Data Unification & Integrity
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                 <div>
                    <h5 className="font-bold text-indigo-400 uppercase tracking-widest text-xs mb-3">Key Entities & Joins</h5>
                    <ul className="space-y-3 text-sm">
                      <li className="flex items-center gap-3"><ChevronRight className="w-4 h-4 text-indigo-500" /> <strong>Lot Master:</strong> Joined with Product Family & Load Factors</li>
                      <li className="flex items-center gap-3"><ChevronRight className="w-4 h-4 text-indigo-500" /> <strong>Tool Status:</strong> Linked to MES Queue Times & ERP Maintenance</li>
                      <li className="flex items-center gap-3"><ChevronRight className="w-4 h-4 text-indigo-500" /> <strong>Weekly Plan:</strong> Unified with real-time Commit tracker</li>
                    </ul>
                 </div>
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-xs font-bold text-emerald-400 mb-1 tracking-tighter">DATA QUALITY CHECKS</p>
                    <p className="text-xs text-slate-400">Strict freshness alerts (&gt;15m lag), referential integrity for Tool Groups, and UPH sanity flags.</p>
                 </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                 <h5 className="font-bold text-indigo-400 uppercase tracking-widest text-xs mb-4">Sync Cadence</h5>
                 <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                       <span className="text-sm font-bold">W1 (Operational)</span>
                       <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded">REAL-TIME</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                       <span className="text-sm font-bold">W2-W3 (Tactical)</span>
                       <span className="text-[10px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded">HOURLY BATCH</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                       <span className="text-sm font-bold">W4 (Strategic)</span>
                       <span className="text-[10px] font-black bg-slate-500 text-white px-2 py-0.5 rounded">DAILY SYNC</span>
                    </div>
                 </div>
              </div>
            </div>
        </div>
      )
    },
    {
      title: "Slide 3: Tools & Guardrails",
      content: (
        <div className="bg-white border-4 border-slate-900 p-10 rounded-3xl shadow-2xl h-full flex flex-col justify-center">
            <h4 className="text-slate-900 font-black text-3xl mb-8 flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-rose-500" /> Governance & System Integrations
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h5 className="font-bold text-slate-800 mb-4 text-sm uppercase">Read/Write Access</h5>
                  <div className="flex flex-wrap gap-2">
                    {['MES Query', 'ERP Write', 'Slack API', 'Ticketing (CMMS)', 'OEE Stream'].map(sys => (
                      <span key={sys} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-500">{sys}</span>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100">
                  <h5 className="font-bold text-rose-900 mb-2 text-sm uppercase">Audit & Evidence</h5>
                  <p className="text-xs text-rose-700 leading-relaxed font-medium italic">Every agent recommendation is anchored in data-citations (e.g., "See OEE Ticket #88x") and logged for IE review.</p>
                </div>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl text-white">
                 <h5 className="font-bold text-indigo-400 uppercase tracking-widest text-xs mb-4">Human-in-the-Loop</h5>
                 <div className="space-y-4">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                       <p className="text-[10px] font-black text-emerald-400 uppercase">Automated</p>
                       <p className="text-xs font-medium">ETA Follow-ups, Status Alerts, Maintenance Triage</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                       <p className="text-[10px] font-black text-rose-400 uppercase">Approval Required</p>
                       <p className="text-xs font-medium">W1 Priority Bypassing, Capacity Shifting &gt;5% Mix</p>
                    </div>
                 </div>
              </div>
            </div>
        </div>
      )
    },
    {
      title: "Slide 4: Evaluation & KPIs",
      content: (
        <div className="bg-indigo-50 p-10 rounded-3xl border-2 border-indigo-200 shadow-2xl h-full flex flex-col justify-center">
            <h4 className="text-indigo-900 font-black text-3xl mb-12 flex items-center gap-3">
              <BarChart3 className="w-8 h-8" /> Measuring Success (OTIF Focused)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {[
                { l: "OTIF Accuracy", v: "W1-W4 Commit vs Actual", s: "Target: 95%+" },
                { l: "Risk Lead Time", v: "Detection Speed", s: "Target: <30 min" },
                { l: "Action Closure", v: "Bottleneck Issue Resolution", s: "Target: <2h" },
                { l: "Avoidable Expedites", v: "Volume Reduction", s: "Target: -20%" },
                { l: "Planner Capacity", v: "Manual Workload Saved", s: "Target: +40%" },
                { l: "Bottleneck Stability", v: "OEE Standard Deviation", s: "Target: <5% Volatility" }
              ].map((kpi, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 group hover:bg-indigo-600 transition-colors">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase group-hover:text-indigo-200">{kpi.l}</p>
                  <p className="text-sm font-black text-indigo-900 my-1 group-hover:text-white leading-tight">{kpi.v}</p>
                  <p className="text-[10px] text-slate-400 group-hover:text-indigo-300 font-bold">{kpi.s}</p>
                </div>
              ))}
            </div>
        </div>
      )
    },
    {
      title: "Slide 5: MVP Roadmap (28 Days)",
      content: (
        <div className="bg-slate-50 p-10 rounded-3xl border border-slate-200 shadow-2xl h-full flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <h4 className="text-slate-900 font-black text-3xl mb-10 flex items-center gap-3">
              <RefreshCcw className="w-8 h-8 text-indigo-500" /> Immediate Value Sprint
            </h4>
            <div className="space-y-6 max-w-3xl">
              {[
                { w: "Week 1: Shadow Intelligence", d: "Mirror existing WIP flows. Agent validates historical risk detection vs human planner actions. No external comms enabled." },
                { w: "Week 2: Follow-up Expansion", d: "Enable 'Read-Followup' triggers. Agent requests ETAs for down tools and dispositions for engineering holds." },
                { w: "Week 3: Tactical Pilot", d: "Roll out priority recommendations to shadow group of 3 Planners. Establish trust in 'Wait-to-OTIF' impact scores." },
                { w: "Week 4: Closed-Loop Assurance", d: "Full deployment to bottleneck groups. Enable automated ticketing for non-critical recovery workflows." }
              ].map((step, i) => (
                <div key={i} className="flex gap-6 items-start">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center font-black text-white shrink-0 shadow-lg">{i+1}</div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-lg">{step.w}</h5>
                    <p className="text-sm text-slate-500 leading-relaxed mt-1">{step.d}</p>
                  </div>
                </div>
              ))}
            </div>
        </div>
      )
    }
  ];

  const nextSlide = () => setCurrentSlide(prev => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide(prev => (prev - 1 + slides.length) % slides.length);

  const downloadDesignSummary = () => {
    const content = `
# ManuSense AI: Delivery Assurance Design Summary
Generating Date: ${new Date().toLocaleDateString()}

## 1. End-to-End Workflow (W1-W4)
- Continuous Monitoring: Real-time stream from MES, ERP, and SCADA.
- Conflict Detection: Graph RAG to identify W1-W4 capacity ripples.
- Multi-Channel Follow-up: Autonomous engagement with tool owners.
- Human-in-the-Loop: Re-sequencing proposals (>5% impact) for IE approval.

## 2. Data Agent Architecture
- WIP & Lot Status: Near Real-time (MES)
- OEE / UPH Trends: 1 min interval (SCADA)
- Plan & Commit: Daily (ERP)
- Tool Maintenance: Event-driven (CMMS)

## 3. Guardrails & Governance
- Automated: ETA follow-ups, maintenance ticketing, status alerts.
- Approval Required: Lot re-sequencing delaying Priority Customers, capacity shifts >5%.
- Audit: Every recommendation includes data-citations and evidence logs.

## 4. Key Performance Indicators (KPIs)
- OTIF Accuracy Accuracy (Target: 95%+)
- Risk Detection Lead Time (Target: <30 min)
- Action Closure Time (Target: <2h)
- Avoidable Expedites Reduction (-20%)
- IE Effort Saved (+40%)

## 5. MVP Plan (4 Weeks)
- Week 1: Shadow Monitoring (Silent Mode)
- Week 2: Automated Follow-up (Maintenance/ETA)
- Week 3: Recommendation Pilot (Planner UL)
- Week 4: Closed-Loop OTIF Assurance
    `;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ManuSense_Design_Summary.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-black text-slate-900">Agentic AI Design & PPT</h3>
          <p className="text-slate-500">Structured solution architecture for W1-W4 Delivery Assurance</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={downloadDesignSummary}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-6 py-2.5 rounded-xl font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
          >
            <Database className="w-4 h-4" />
            Download Summary
          </button>
          <button 
            onClick={() => setShowSlides(!showSlides)}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold shadow-xl hover:bg-slate-800 transition-colors"
          >
            {showSlides ? <LayoutDashboard className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            {showSlides ? "Back to Technical View" : "Presentation Mode"}
          </button>
        </div>
      </div>

      {showSlides ? (
        <div className="space-y-8">
          <div className="relative min-h-[600px]">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentSlide}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="w-full h-full"
              >
                {slides[currentSlide].content}
              </motion.div>
            </AnimatePresence>

            <div className="absolute -bottom-16 left-0 w-full flex justify-between items-center">
              <div className="flex items-center gap-4">
                 <button onClick={prevSlide} className="p-3 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors shadow-sm">
                   <ChevronRight className="w-5 h-5 rotate-180" />
                 </button>
                 <span className="text-sm font-black text-slate-400">Slide {currentSlide + 1} of {slides.length}</span>
                 <button onClick={nextSlide} className="p-3 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors shadow-sm">
                   <ChevronRight className="w-5 h-5" />
                 </button>
              </div>
              <div className="flex gap-2">
                {slides.map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => setCurrentSlide(i)}
                    className={cn("w-2 h-2 rounded-full transition-all", currentSlide === i ? "w-8 bg-indigo-500" : "bg-slate-300")}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-indigo-900 p-8 rounded-3xl text-indigo-100 space-y-6 shadow-2xl">
                <h4 className="text-white font-bold text-lg flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" /> End-to-End Workflow
                </h4>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center font-bold text-white shrink-0">1</div>
                    <p className="text-sm leading-relaxed"><strong>Autonomous Monitoring:</strong> Connects to MES (WIP), ERP (Plan), and SCADA (OEE) via real-time stream. Continuously calculates W1-W4 probability of delivery.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center font-bold text-white shrink-0">2</div>
                    <p className="text-sm leading-relaxed"><strong>Conflict Detection:</strong> Uses Graph RAG to identify how W1 expedites affect W2 capacity availability for different product mix load factors.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center font-bold text-white shrink-0">3</div>
                    <p className="text-sm leading-relaxed"><strong>Multi-Channel Follow-up:</strong> Triggers emails/Slack/Teams messages to Tool owners for downtime ETAs or Engineers for UPH degradation insights.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center font-bold text-white shrink-0">4</div>
                    <p className="text-sm leading-relaxed"><strong>Human-in-the-Loop:</strong> Proposes high-impact re-sequencing (OTIF impact &gt; 5%) to Planners for one-click approval via dashboard.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-500" /> Data Agent Schema
                  </h4>
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-widest">
                        <tr>
                          <th className="px-4 py-3">Entity</th>
                          <th className="px-4 py-3">Source</th>
                          <th className="px-4 py-3">Frequency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr><td className="px-4 py-3 font-bold">WIP & Lot Status</td><td className="px-4 py-3 italic">MES (Oracle/SAP)</td><td className="px-4 py-3 text-indigo-600 font-bold">Near Real-time</td></tr>
                        <tr><td className="px-4 py-3 font-bold">OEE / UPH Trends</td><td className="px-4 py-3 italic">SCADA / IoT Edge</td><td className="px-4 py-3 text-indigo-600 font-bold">1 min interval</td></tr>
                        <tr><td className="px-4 py-3 font-bold">Plan & Commit</td><td className="px-4 py-3 italic">ERP (S/4HANA)</td><td className="px-4 py-3 text-slate-500 font-medium">Daily Refresh</td></tr>
                        <tr><td className="px-4 py-3 font-bold">Tool Maintenance</td><td className="px-4 py-3 italic">CMMS (Maximo)</td><td className="px-4 py-3 text-indigo-600 font-bold">Push on Event</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                   <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-500" /> Guardrails & Approvals
                  </h4>
                  <ul className="space-y-3">
                    <li className="flex gap-3 text-sm text-slate-600">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                      <strong>Automated:</strong> Follow-ups for ETA, creating internal maintenance tickets, alerting on UPH &lt; 80% baseline.
                    </li>
                    <li className="flex gap-3 text-sm text-slate-600">
                      <div className="w-2 h-2 bg-rose-500 rounded-full mt-1.5 shrink-0" />
                      <strong>Approval Required:</strong> Any lot re-sequencing that delays a "Priority Customer", Build-ahead mix shifts &gt; 10% of weekly capacity.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
             <h3 className="text-xl font-bold text-slate-800 mb-6">MVP Plan (4-Week Sprint)</h3>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               {[
                 { week: 'Week 1', label: 'Shadow Monitoring', desc: 'Ingest WIP/OEE data. Agent runs in "Silent Mode" generating internal audit logs of detected risks.' },
                 { week: 'Week 2', label: 'Automated Follow-up', desc: 'Enable Email/Slack triggers for missing information (ETAs, Hold dispositions). Pilot with 2 tool groups.' },
                 { week: 'Week 3', label: 'Recommendation Pilot', desc: 'Deliver priority/mix trade-off suggestions to Planners. Establish Human-in-loop approval UI.' },
                 { week: 'Week 4', label: 'Closed-Loop OTIF', desc: 'Full pipeline visibility. Track "Action to Resolution" lead times. Roll out to all bottleneck groups.' },
               ].map((w, i) => (
                 <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                   <span className="text-[10px] font-black uppercase text-indigo-500 mb-2 block">{w.week}</span>
                   <h5 className="font-bold text-slate-900 mb-2 truncate">{w.label}</h5>
                   <p className="text-xs text-slate-500 leading-relaxed">{w.desc}</p>
                 </div>
               ))}
             </div>
          </section>
        </>
      )}
    </motion.div>
  );
};

