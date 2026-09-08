import type { PORecord } from "../types";

interface PODataTableProps {
  rows: PORecord[];
  decimalDrafts: Record<string, string>;
  onUpdate: (index: number, patch: Partial<PORecord>) => void;
  onDecimalChange: (index: number, field: "frontDm" | "backDm", value: string) => void;
  onDecimalBlur: (index: number, field: "frontDm" | "backDm") => void;
  onRemove: (index: number) => void;
}

export function PODataTable({ rows, decimalDrafts, onUpdate, onDecimalChange, onDecimalBlur, onRemove }: PODataTableProps) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Ưu tiên</th>
            <th>Lô</th>
            <th>PO</th>
            <th>Mã hàng</th>
            <th>Màu vải</th>
            <th>Số lượng</th>
            <th>ĐM Trước</th>
            <th>ĐM Sau</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row.id}>
              <td><input type="number" value={row.priority} onChange={(e) => onUpdate(index, { priority: Number(e.target.value) || index + 1 })} /></td>
              <td><input value={row.batch} onChange={(e) => onUpdate(index, { batch: e.target.value })} /></td>
              <td><input value={row.po} onChange={(e) => onUpdate(index, { po: e.target.value })} /></td>
              <td><input value={row.itemCode} onChange={(e) => onUpdate(index, { itemCode: e.target.value })} /></td>
              <td><input value={row.color} onChange={(e) => onUpdate(index, { color: e.target.value })} /></td>
              <td><input type="number" value={row.quantity} onChange={(e) => onUpdate(index, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></td>
              {(["frontDm", "backDm"] as const).map((field) => (
                <td key={field}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={decimalDrafts[`${row.id}-${field}`] ?? String(row[field]).replace(".", ",")}
                    onChange={(e) => onDecimalChange(index, field, e.target.value)}
                    onBlur={() => onDecimalBlur(index, field)}
                  />
                </td>
              ))}
              <td><button className="danger-text" onClick={() => onRemove(index)}>Xóa</button></td>
            </tr>
          )) : (
            <tr><td colSpan={9} className="empty-state">Chưa có dữ liệu.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
