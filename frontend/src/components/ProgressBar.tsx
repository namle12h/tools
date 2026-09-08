interface ProgressBarProps {
  mainMinutes: number;
  extraMinutes: number;
  capacityMinutes: number;
}

export function ProgressBar({ mainMinutes, extraMinutes, capacityMinutes }: ProgressBarProps) {
  const capacity = Math.max(1, capacityMinutes);
  const mainWidth = Math.min(100, (mainMinutes / capacity) * 100);
  const extraWidth = Math.min(100 - mainWidth, (extraMinutes / capacity) * 100);
  const total = mainMinutes + extraMinutes;

  return (
    <div className="progress-shell">
      <div className="progress-main" style={{ width: `${mainWidth}%` }} />
      {extraMinutes > 0 ? <div className="progress-extra" style={{ width: `${extraWidth}%` }} /> : null}
      <div className="progress-label">{Math.min(100, Math.round((total / capacity) * 100))}%</div>
    </div>
  );
}
