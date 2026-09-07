# Silk Screen Planning Tool

Ứng dụng web React + TypeScript để lập kế hoạch sản xuất cho xưởng in lụa theo tổ, theo ngày, và theo PO.

## Chức năng

- Cấu hình số phút/ngày, số tổ, số bàn từng tổ
- Cấu hình ngày bắt đầu, ngày làm việc, ngày nghỉ lễ
- Nhập PO bằng tay hoặc upload Excel
- Tính kế hoạch theo ngày và theo tổ
- Báo cáo năng suất theo ngày
- Xuất kế hoạch ra Excel

## Cột Excel đầu vào

- `PO`
- `Mã hàng`
- `Màu vải`
- `Số lượng`
- `FRONT`
- `BACK`

## Chạy dự án

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Ghi chú

- Logic tính toán được viết thuần TypeScript.
- Dữ liệu và cấu hình được lưu bằng `localStorage`.
- Lịch lễ Việt Nam có sẵn bộ mẫu cho các năm gần đây; với lễ âm lịch, bạn có thể thêm tay nếu cần mở rộng năm khác.
