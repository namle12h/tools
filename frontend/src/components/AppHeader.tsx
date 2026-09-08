import type { ReactNode } from "react";

export interface AppTab {
  key: string;
  label: string;
  icon: string;
}

interface AppHeaderProps {
  tabs: AppTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  onClearPO: () => void;
  onDownloadTemplate: () => void;
  onExport: () => void;
  canExport: boolean;
  error?: string;
  children?: ReactNode;
}

export function AppHeader({ tabs, activeTab, onTabChange, onClearPO, onDownloadTemplate, onExport, canExport, error, children }: AppHeaderProps) {
  return (
    <>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">X</div>
          <div>
            <div className="brand-title">Xưởng in lụa</div>
            <div className="brand-subtitle">Lập kế hoạch theo tổ, theo ngày, theo PO</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" onClick={onClearPO}>Xóa PO</button>
          <button className="ghost-button" onClick={onDownloadTemplate}>Tải mẫu Excel</button>
          <button className="primary-button" onClick={onExport} disabled={!canExport}>Xuất kế hoạch</button>
        </div>
      </div>
      <div className="tabs">
        {tabs.map((item) => (
          <button key={item.key} className={`tab-pill ${activeTab === item.key ? "active" : ""}`} onClick={() => onTabChange(item.key)}>
            <span className="tab-icon">{item.icon}</span><span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="formula-banner"><strong>Công thức:</strong> Lượt/ngày = FLOOR(Phút/ngày ÷ ĐM) · NS/ngày = Lượt x Số bàn · Phút dư {'->'} ghép mã phụ</div>
      {error ? <div className="error-banner">{error}</div> : null}
      {children}
    </>
  );
}
