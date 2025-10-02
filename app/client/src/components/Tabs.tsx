import './Tabs.css';
import { ReactNode } from 'react';

export interface TabDefinition {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: TabDefinition[];
  activeKey: string;
  onChange: (key: string) => void;
  actions?: ReactNode;
}

export function Tabs({ tabs, activeKey, onChange, actions }: TabsProps) {
  return (
    <div className="tabs">
      <div className="tabs-bar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-button ${tab.key === activeKey ? 'active' : ''}`}
            onClick={() => onChange(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {actions ? <div className="tabs-actions">{actions}</div> : null}
    </div>
  );
}

export default Tabs;
