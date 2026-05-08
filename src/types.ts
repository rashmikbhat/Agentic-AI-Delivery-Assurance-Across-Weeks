import { LucideIcon } from 'lucide-react';

export type WeekBucket = 'W1' | 'W2' | 'W3' | 'W4';

export interface ProductMix {
  family: string;
  loadFactor: number; // Consumption rate at bottleneck
  currentPlan: number;
  commit: number;
}

export interface MetricData {
  oee: number;
  uph: number;
  availability: number;
}

export interface BottleneckInfo {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  currentUph: number;
  baselineUph: number;
  utilization: number;
  activeIssues: string[];
}

export interface RiskAlert {
  id: string;
  week: WeekBucket;
  type: 'Capacity' | 'WIP' | 'Equipment' | 'Yield';
  severity: 'low' | 'medium' | 'high';
  productFamily: string;
  reason: string;
  evidence: string;
}

export interface AgentAction {
  id: string;
  timestamp: string;
  type: 'follow-up' | 'recommendation' | 'auto-fix';
  target: string; // Person or System
  message: string;
  status: 'pending' | 'completed' | 'rejected' | 'automated';
  outcome?: string;
}

export const MOCK_BOTTLE_NECKS: BottleneckInfo[] = [
  {
    id: 'BN-01',
    name: 'Photolithography L-400',
    status: 'critical',
    currentUph: 85,
    baselineUph: 120,
    utilization: 98,
    activeIssues: ['Unscheduled downtime on Tool #4', 'UPH degradation due to new resist batch'],
  },
  {
    id: 'BN-02',
    name: 'Die Attach High Precision',
    status: 'warning',
    currentUph: 210,
    baselineUph: 230,
    utilization: 92,
    activeIssues: ['Material shortage for Alloy-Z leads'],
  }
];

export const MOCK_PRODUCT_MIX: ProductMix[] = [
  { family: 'Automotive Power', loadFactor: 1.5, currentPlan: 5000, commit: 4800 },
  { family: 'IoT Edge', loadFactor: 0.8, currentPlan: 12000, commit: 12500 },
  { family: 'Data Center HPC', loadFactor: 2.2, currentPlan: 2000, commit: 19500 }, 
];

export const MOCK_WEEK_STATUS = {
  W1: { otif: 92, risk: 'high', primaryDriver: 'Photolithography Downtime' },
  W2: { otif: 88, risk: 'medium', primaryDriver: 'WIP Staging Delay' },
  W3: { otif: 95, risk: 'low', primaryDriver: 'Healthy Pipeline' },
  W4: { otif: 91, risk: 'medium', primaryDriver: 'Forecast Shift' },
};
