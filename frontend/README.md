# Silk Screen Planning Tool

## 1. Mục Đích Dự Án

Đây là ứng dụng web nội bộ dùng để lập kế hoạch sản xuất cho xưởng in lụa.

Ứng dụng nhận danh sách PO, mã hàng, màu vải, số lượng và định mức thời gian in thân trước/thân sau. Sau đó hệ thống:

- Tách mỗi dòng PO thành job FRONT và BACK.
- Phân công job cho các tổ in bằng thuật toán greedy.
- Tính kế hoạch theo từng ngày làm việc thực tế.
- Giữ thứ tự ưu tiên và thứ tự lô sản xuất.
- Ghép mã hàng khác vào thời gian còn trống.
- Ghép phần số lượng còn thiếu để đủ một lượt theo số bàn.
- Hiển thị kế hoạch theo ngày, theo tổ và báo cáo năng suất.
- Xuất toàn bộ kế hoạch ra Excel.

Đây là frontend thuần client-side. Hiện tại không có backend, database, API bên ngoài hoặc AI trong logic lập kế hoạch.

## 2. Công Nghệ

- React 19.
- TypeScript 5.
- Vite 7.
- SheetJS (xlsx) để đọc và xuất Excel.
- CSS thuần trong src/styles.css.
- Lưu dữ liệu bằng localStorage trên trình duyệt.
- Vercel dùng static deployment từ thư mục dist.

## 3. Chạy Dự Án

Chạy các lệnh bên trong thư mục frontend:

~~~bash
npm install
npm run dev
~~~

Mở địa chỉ Vite hiển thị trong terminal, thường là:

~~~text
http://localhost:5173
~~~

Build production:

~~~bash
npm run build
~~~

Lệnh build thực hiện hai bước:

1. tsc --noEmit: kiểm tra TypeScript.
2. vite build: tạo bản production vào thư mục dist.

Chạy thử bản production:

~~~bash
npm run preview
~~~

Nếu gặp lỗi "vite is not recognized", cần chạy npm install trong đúng thư mục frontend, không chạy ở thư mục cha.

## 4. Cấu Trúc Source

~~~text
frontend/
├─ index.html
├─ package.json
├─ package-lock.json
├─ pnpm-lock.yaml
├─ vite.config.js
├─ vite.config.ts
├─ vercel.json
├─ dist/                         # build output, không phải source chính
└─ src/
   ├─ main.tsx                   # entrypoint React
   ├─ App.tsx                    # state chính và các màn hình
   ├─ types.ts                   # type/model dùng chung
   ├─ styles.css                 # toàn bộ giao diện
   ├─ components/
   │  ├─ AppHeader.tsx           # header, tabs, nút thao tác
   │  ├─ PODataTable.tsx         # bảng nhập/sửa PO
   │  └─ ProgressBar.tsx         # thanh thời gian Chính/Ghép
   └─ utils/
      ├─ planning.ts             # engine phân tổ và lập kế hoạch
      ├─ excel.ts                # import/export Excel
      ├─ calendar.ts             # ngày làm việc, ngày lễ, lịch tháng
      └─ date.ts                 # xử lý ngày, thứ và format ngày
~~~

### Vai trò của từng file

#### src/main.tsx

- Tạo React root.
- Render App.
- Import styles.css.
- Bọc ứng dụng trong React.StrictMode.

#### src/App.tsx

Đây là component điều phối chính. File này quản lý:

- Tab hiện tại.
- Cấu hình phút/ngày, số tổ và số bàn.
- Ngày bắt đầu, ngày làm việc và ngày nghỉ.
- Danh sách PO.
- File upload.
- Kế hoạch sinh ra từ buildSchedule.
- Ngày đang chọn.
- Số lượng thực tế trong báo cáo.
- Lưu/đọc state từ localStorage.
- Render các màn hình Cấu hình, Lịch làm việc, Nhập PO, Kế hoạch, Theo tổ và Báo cáo.

#### src/components/AppHeader.tsx

Component giao diện dùng chung ở đầu trang:

- Tên xưởng.
- Các tab điều hướng.
- Nút xóa PO.
- Nút tải mẫu Excel.
- Nút xuất kế hoạch.
- Thông báo lỗi.

#### src/components/PODataTable.tsx

Bảng nhập dữ liệu PO trực tiếp:

- Ưu tiên.
- Lô.
- PO.
- Mã hàng.
- Màu vải.
- Số lượng.
- FRONT.
- BACK.

FRONT và BACK dùng input text với inputMode decimal để cho phép nhập cả 16.5 và 16,5.

#### src/components/ProgressBar.tsx

Vẽ thanh lấp đầy thời gian của một tổ trong một ngày:

- Màu xanh: thời gian mã Chính.
- Màu cam: thời gian mã Ghép.
- Phần trăm được tính theo công suất ngày của tổ.
- Không được hiển thị quá 100%.

#### src/utils/planning.ts

Đây là file quan trọng nhất của nghiệp vụ. Không thay đổi thuật toán trong file này nếu chưa hiểu các quy tắc ở mục 8.

#### src/utils/excel.ts

- Đọc sheet đầu tiên của file Excel.
- Chuẩn hóa tên cột.
- Chuyển số lượng/lượt thành số nguyên.
- Giữ FRONT/BACK là số thập phân.
- Bỏ các dòng không phải dữ liệu sản xuất.
- Xuất ba sheet kế hoạch.

#### src/utils/calendar.ts

- Xác định ngày làm việc.
- Bỏ qua cuối tuần và ngày nghỉ.
- Tạo lịch tháng.
- Nạp các ngày lễ Việt Nam có sẵn.
- Tìm ngày làm việc kế tiếp.

#### src/utils/date.ts

- Chuyển ngày input HTML thành Date.
- Format dd/mm/yyyy.
- Lấy thứ trong tuần.
- Tạo key tháng và cộng ngày.

## 5. Mô Hình Dữ Liệu

### PORecord

Một dòng dữ liệu đầu vào:

| Field | Ý nghĩa | Kiểu |
|---|---|---|
| id | ID nội bộ của dòng | string |
| priority | Thứ tự ưu tiên, số nhỏ chạy trước | number nguyên |
| batch | Tên lô, ví dụ A, B, C | string |
| po | Số đơn hàng | string |
| itemCode | Mã hàng | string |
| color | Màu vải | string |
| quantity | Số lượng cần sản xuất | number nguyên |
| frontDm | Định mức thân trước, phút/lượt | number |
| backDm | Định mức thân sau, phút/lượt | number |

### JobItem

Một job được sinh từ một PORecord:

- Một dòng có FRONT > 0 sẽ tạo job FRONT.
- Một dòng có BACK > 0 sẽ tạo job BACK.
- Nếu cả FRONT và BACK > 0 thì tạo hai job riêng.
- FRONT và BACK của cùng dòng có siblingId.
- Hai job sibling phải được phân cho hai tổ khác nhau.
- remaining là số lượng còn lại của job.
- loadScore = quantity × dm.
- assignedTeamId là tổ được phân công chính.

### PlanRow

Một dòng kế hoạch của một tổ trong một ngày:

- type: Chính hoặc Ghép.
- date, weekday, teamName, tables.
- priority, batch, po, itemCode, color, role.
- dm: định mức phút/lượt.
- rounds: số lượt.
- minutes: phút sử dụng.
- plannedQty: sản lượng trong ngày.
- remainingStart: còn lại đầu đoạn kế hoạch.
- remainingEnd: còn lại sau đoạn kế hoạch.
- sourceTeamName: tổ gốc khi mã được tổ khác mượn để ghép.
- groupId, groupTotalQty, groupRounds: thông tin nhóm ghép đủ một lượt.

### TeamDaySummary

Tổng hợp kế hoạch của một tổ trong một ngày:

- capacityMinutes: công suất phút của ngày đó.
- mainMinutes: phút cho mã Chính.
- extraMinutes: phút cho mã Ghép.
- totalMinutes = mainMinutes + extraMinutes.
- fillRate: phần trăm lấp đầy, tối đa 100%.

### ScheduleResult

Kết quả của engine:

- jobs: danh sách job sau khi phân tổ và cập nhật remaining.
- rows: toàn bộ dòng kế hoạch.
- teamDays: tổng hợp theo tổ/ngày.
- byDate: Map ngày -> danh sách tổ.
- byTeam: Map tổ -> danh sách dòng.
- theoreticalMinutes: tổng tải lý thuyết.
- theoreticalDays: số ngày lý thuyết.
- calendarDays: số ngày làm việc thực tế có kế hoạch.
- roundingMinutes: phần phút tăng do làm tròn/quy tắc lượt.

### AppSettings

~~~ts
interface AppSettings {
  minutesPerDay: number;
  dailyMinutes: Record<string, number>;
  startDate: string;
  workdays: number[];
  holidays: HolidayItem[];
  teams: TeamConfig[];
}
~~~

- minutesPerDay: mặc định 483.
- dailyMinutes: key yyyy-mm-dd, dùng cho tăng ca hoặc giảm giờ một ngày.
- startDate: ngày bắt đầu sản xuất.
- workdays: chỉ số thứ theo JavaScript Date.getDay(): CN=0, T2=1, ..., T7=6.
- holidays: ngày nghỉ thủ công hoặc ngày lễ tải sẵn.
- teams: danh sách tổ và số bàn từng tổ.

## 6. Excel Đầu Vào

### Cột bắt buộc

File phải có ít nhất các cột:

- PO.
- Mã hàng.
- Màu vải.
- Số lượng.
- FRONT.
- BACK.

### Cột nên có

- ƯU TIÊN: số nhỏ hơn được ưu tiên trước.
- LÔ: lô sản xuất, ví dụ A, B, C.

Các tên tương đương được hỗ trợ gồm:

- PO: PO.
- Mã hàng: Mã hàng, Mã hàng hóa, Code.
- Màu: Màu vải, Màu.
- Số lượng: Số lượng, SL.
- FRONT: FRONT, ĐM Trước.
- BACK: BACK, ĐM Sau.
- Ưu tiên: Ưu tiên, Thứ tự.
- Lô: Lô, Lot, Phân lô.

Parser chỉ đọc sheet đầu tiên.

Một dòng được xem là PO hợp lệ khi:

1. Có ít nhất một trong các thông tin nhận diện: PO, mã hàng hoặc màu vải.
2. Số lượng > 0.
3. FRONT hoặc BACK > 0.

Vì vậy dòng tổng ở cuối Excel, ví dụ chỉ có tổng số lượng và tổng ngày nhưng không có mã hàng/định mức, sẽ bị bỏ qua. Đây là chủ ý để không biến dòng tổng thành một PO giả.

### Quy tắc số

- Số lượng và số lượt luôn là số nguyên.
- FRONT/BACK cho phép số thập phân.
- Có thể nhập 25.4 hoặc 25,4.
- Khi xuất kế hoạch, số lượng và lượt vẫn là số nguyên.
- Phút có thể có phần thập phân nếu định mức là số thập phân.
- Mọi phép chia công suất đều phải bảo đảm tổng phút của tổ không vượt công suất ngày.

## 7. Cấu Hình Giao Diện

### Tab Cấu hình

- Phút/ngày: mặc định 483.
- Phút ngày đang chọn/tăng ca: ghi đè cho riêng một ngày.
- Số tổ: mặc định 15.
- Số bàn từng tổ: mặc định 120, chỉnh riêng từng tổ.
- Ngày bắt đầu.
- Nút áp dụng.
- Nút reset số bàn về 120.

### Tab Lịch làm việc

- Chọn ngày bắt đầu.
- Bật/tắt T2 đến CN.
- Thêm ngày nghỉ bất thường bằng ngày và tên.
- Nạp ngày lễ Việt Nam cho năm bắt đầu và năm kế tiếp.
- Chọn ngày trên lịch để làm ngày đang xem.

Ngày lễ âm lịch hiện đang được khai báo thủ công trong calendar.ts cho một số năm. Muốn hỗ trợ thêm năm cần bổ sung dữ liệu trong hai Map:

- tetNguyenDan.
- gioToHungVuong.

### Tab Nhập PO

- Upload .xlsx hoặc .xls.
- Tải dữ liệu mẫu.
- Thêm dòng thủ công.
- Sửa trực tiếp các ô.
- Xóa từng dòng hoặc xóa tất cả.

### Tab Kế hoạch

- Chọn một ngày cụ thể.
- Xem từng tổ trong ngày.
- Xem mã Chính và mã Ghép.
- Xem định mức, lượt, phút, số lượng và số còn lại.
- Thanh tiến trình hiển thị mức lấp đầy.
- Phần đầu tab hiển thị đồng thời:
  - Số ngày lịch thực tế.
  - Số ngày tải lý thuyết.
  - Phần chênh do dứt điểm lô và lấp đầy theo lượt.

### Tab Theo tổ

- Chọn một tổ.
- Xem toàn bộ kế hoạch của tổ đó theo ngày.
- Có các cột ngày, thứ, loại, mã hàng, màu, vai trò, định mức, lượt, phút, sản lượng và còn lại.

### Tab Báo cáo

- Chọn ngày.
- Nhập số lượng thực tế của từng tổ.
- Tự tính:
  - Lượt thực tế = Math.floor(thực tế / số bàn).
  - % đạt = thực tế / kế hoạch × 100.
- Đánh giá:
  - Đạt nếu >= 100%.
  - Gần đạt nếu >= 90%.
  - Chưa đạt nếu < 90%.

## 8. Thuật Toán Lập Kế Hoạch

### 8.1. Tách job

cloneJobs duyệt toàn bộ PO:

1. Nếu FRONT > 0, tạo job thân trước.
2. Nếu BACK > 0, tạo job thân sau.
3. Số lượng ban đầu của mỗi job bằng số lượng PO.
4. remaining bắt đầu bằng số lượng ban đầu.
5. Hai job cùng dòng PO liên kết bằng siblingId.

### 8.2. Sắp xếp và phân tổ

assignJobs dùng greedy:

1. Sắp xếp theo lô tăng dần: A, B, C...
2. Dòng không có lô được đưa xuống cuối.
3. Trong cùng lô, ưu tiên số nhỏ chạy trước.
4. Nếu cùng ưu tiên, job có loadScore = quantity × dm lớn hơn được xét trước.
5. Mỗi job được đưa vào tổ đang có tải thấp nhất.
6. Nếu tải bằng nhau, ưu tiên tổ có nhiều bàn hơn.
7. FRONT và BACK của cùng một dòng không được vào cùng tổ.

Sau khi phân tổ, queue của từng tổ vẫn sắp theo:

1. Lô.
2. Ưu tiên.
3. Tải job giảm dần.

### 8.3. Thứ tự lô

Engine chỉ xử lý một lô đang hoạt động tại một thời điểm:

- Lô hiện tại được lấy theo thứ tự A, B, C...
- Mã thuộc lô sau không được dùng làm mã phụ khi lô hiện tại chưa hoàn thành.
- Khi toàn bộ job của lô hiện tại có remaining <= 0, engine chuyển sang lô kế tiếp.
- Nếu lô hoàn thành giữa ngày, phần công suất còn lại được dùng cho lô kế tiếp ngay trong ngày đó.
- Vì vậy kết quả vừa giữ thứ tự lô, vừa không bỏ phí toàn bộ phần phút còn lại.

### 8.4. Công suất của từng tổ trong ngày

Với mỗi ngày làm việc và mỗi tổ:

~~~text
capacity = dailyMinutes[date] ?? minutesPerDay
~~~

Nếu không có cấu hình riêng, mặc định:

~~~text
capacity = 483 phút
~~~

Khi một tổ đã có nhiều đoạn trong cùng ngày:

~~~text
availableCapacity = capacity - tổng phút đã dùng trong ngày
~~~

Mã chính luôn được tính trước. Mã ghép chỉ được lấy trong phần còn lại.

### 8.5. Tính mã Chính

Với định mức dm:

~~~text
fullRounds = Math.floor(availableCapacity / dm)
fullDayQty = fullRounds * số bàn của tổ
~~~

Nếu số lượng còn lại lớn hơn fullDayQty:

- In đủ fullRounds.
- Sản lượng = fullRounds × số bàn.
- Trừ sản lượng vào remaining.

Nếu số lượng còn lại nhỏ hơn hoặc bằng công suất của ngày:

~~~text
neededRounds = Math.max(1, Math.ceil(remaining / số bàn))
roundedQty = neededRounds * số bàn
missingQuantity = roundedQty - remaining
~~~

Có hai trường hợp:

1. Nếu tìm được mã bù phù hợp, ghép phần thiếu để đủ roundedQty.
2. Nếu phần thiếu <= 30 pcs mà không tìm được mã bù, hệ thống làm tròn lên và đánh dấu job hoàn thành.
3. Nếu phần thiếu > 30 pcs và không có mã bù, hệ thống chỉ lập đúng số lượng còn lại.

Job có remaining <= 30 được xem là hoàn thành và đưa về 0 để tránh tạo các mảnh quá nhỏ.

### 8.6. Ghép phần thiếu của một lượt

Ví dụ:

- Tổ có 120 bàn.
- Mã chính còn 347 pcs.
- Số lượt cần là 3.
- Một lượt đủ nhóm là 360 pcs.
- Phần thiếu là 13 pcs.

Hệ thống tìm mã bù với các điều kiện:

- Thuộc lô hiện tại.
- Khác dòng PO với mã chính.
- Thuộc tổ khác.
- Còn ít nhất 13 pcs.
- Định mức chênh lệch tối đa ±20 phút.
- Không bị tổ khác đặt trước trong cùng vòng.
- Ưu tiên định mức gần mã chính nhất.

Kết quả nhóm:

- Mã chính: 347 pcs.
- Mã bù: 13 pcs.
- Tổng nhóm: 360 pcs.
- Tổng lượt nhóm: 3 lượt.
- Phút của từng dòng được phân bổ theo tỷ lệ số lượng trong nhóm.

Mã bù được ghi type = Ghép, có sourceTeamName để biết nó được mượn từ tổ nào.

### 8.7. Ghép mã phụ vào phút dư

Khi còn phút sau mã chính, engine tìm trong các job chưa hoàn thành của lô hiện tại:

- remaining > 30.
- Định mức <= phút còn lại.
- Không phải mã chính đang xử lý.
- Không bị đặt trước trong cùng vòng.
- Không lấy mã chính của tổ chưa tới lượt trong vòng hiện tại.
- Ưu tiên ưu tiên sản xuất trước, sau đó định mức khớp nhất với số phút còn lại.

Số lượt ghép:

~~~text
rounds = Math.floor(remainingMinutes / dm)
plannedQty = Math.min(rounds * số bàn, remaining)
~~~

Việc ghép lặp tối đa 15 vòng cho một tổ trong một lượt xử lý để tránh vòng lặp vô hạn.

### 8.8. Không vượt 483 phút

Đây là quy tắc bắt buộc:

~~~text
remainingMinutes = availableCapacity - mainMinutes - extraMinutes
~~~

Mọi mã ghép đều phải trừ vào remainingMinutes. Vì vậy:

~~~text
mainMinutes + extraMinutes <= capacityMinutes
~~~

Không được chỉ trừ phút mã chính rồi tiếp tục ghép, vì sẽ tạo lỗi kiểu 492,08 / 483 phút.

### 8.9. Khóa mã của tổ chưa tới lượt

Trong một vòng xử lý ngày:

- Tổ hiện tại được xử lý trước.
- Sau khi tổ đó đã được xét, job của tổ đó mới được phép làm mã phụ ở tổ khác.
- Không cho Tổ 1 lấy mã chính của Tổ 3/Tổ 4 trước khi các tổ đó được xét.
- Mục đích là tránh trường hợp một tổ mượn hết mã của tổ sau, khiến tổ sau bị rỗng và phần cuối lô dồn về một tổ.

## 9. Ngày Lý Thuyết Và Ngày Lịch

Hai chỉ số này có ý nghĩa khác nhau.

### Ngày lý thuyết

Với mỗi job:

~~~text
jobMinutes = quantity * dm / số bàn của tổ được phân công
~~~

Tổng tải:

~~~text
theoreticalMinutes = tổng jobMinutes
~~~

Số ngày lý thuyết:

~~~text
theoreticalDays = theoreticalMinutes / (số tổ * phút/ngày)
~~~

Đây là con số dùng để đối chiếu tải thuần túy, chưa tính:

- Làm tròn số lượt.
- Phần dư <= 30 pcs.
- Việc không trộn lô sau vào lô trước.
- Ngày chuyển từ lô này sang lô khác.
- Ràng buộc mỗi job có tổ chính.

### Ngày lịch thực tế

~~~text
calendarDays = số key trong schedule.byDate
~~~

Đây là số ngày có kế hoạch sau khi chạy qua lịch làm việc, cuối tuần, ngày lễ, số lượt nguyên và thứ tự lô.

Ví dụ với file Excel hiện tại:

- Tải lý thuyết khoảng 321,9 ngày.
- Ngày lịch thực tế có thể cao hơn vì phải dứt điểm từng lô và chia theo lượt.
- Không được thay số ngày lịch bằng số ngày lý thuyết vì như vậy kế hoạch chi tiết sẽ không còn khớp với ngày cuối cùng.

## 10. Lưu Trữ Trình Duyệt

Key lưu localStorage:

~~~text
silk-screen-planner-v1
~~~

State được lưu gồm:

- settings.
- rows.
- tab.
- visibleMonth.
- selectedDay.
- actuals.
- teamFilter.

Đặc điểm:

- Dữ liệu chỉ nằm trong trình duyệt hiện tại.
- Xóa cache/localStorage sẽ mất dữ liệu chưa xuất Excel.
- Không có đồng bộ giữa nhiều máy/người dùng.
- Khi mở lại app, các dòng PO không hợp lệ hoặc dòng tổng không có định mức sẽ bị lọc.

## 11. Xuất Excel

Hàm exportScheduleToExcel tạo file:

~~~text
ke-hoach-in-lua.xlsx
~~~

Các sheet:

### KeHoachTheoNgay

Gồm ngày, thứ, tổ, loại, mã hàng, màu, vai trò, định mức, lượt, phút, số lượng hôm nay và còn lại.

Có thêm thông tin nhóm ghép:

- Ưu tiên.
- Lô.
- Nhóm ghép.
- Tổng nhóm.
- Lượt nhóm.

### KeHoachTheoTo

Gồm toàn bộ kế hoạch theo tổ:

- Tổ.
- Bàn.
- Ngày.
- Thứ.
- Loại.
- PO.
- Mã hàng.
- Màu.
- Vai trò.
- Định mức.
- Lượt.
- Phút.
- Số lượng hôm nay.
- Còn lại.

### PO_Goc

Lưu lại dữ liệu đầu vào đã chuẩn hóa:

- Ưu tiên.
- Lô.
- PO.
- Mã hàng.
- Màu vải.
- Số lượng.
- FRONT.
- BACK.

## 12. Lịch Ngày Lễ

loadVietnamHolidays(year) thêm:

- Tết Dương lịch.
- Giỗ Tổ Hùng Vương.
- 30/4.
- 1/5.
- 2/9.
- Tết Nguyên Đán.

Các ngày này chỉ là ngày nghỉ mẫu theo ngày chính. Lịch nghỉ thực tế có thể có ngày nghỉ bù hoặc lịch nghỉ nhiều ngày, vì vậy người dùng vẫn cần kiểm tra và thêm tay nếu cần.

## 13. Triển Khai Vercel

Repository có frontend nằm trong thư mục con:

~~~text
repository/
└─ frontend/
~~~

Cấu hình Vercel cần:

- Root Directory: frontend.
- Framework Preset: Vite.
- Build Command: npm run build.
- Output Directory: dist.
- Install Command: npm install.

File frontend/vercel.json có rewrite:

~~~json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
~~~

Rewrite này giúp route frontend không bị lỗi 404 khi refresh trực tiếp.

Sau khi build thành công:

~~~bash
git add frontend
git commit -m "Update production planning tool"
git push origin main
~~~

Nếu Git báo remote có commit mới:

~~~bash
git pull --rebase origin main
git push origin main
~~~

Không dùng git push với URL có dấu ngoặc hoặc markdown. URL phải là URL Git thuần.

## 14. Kiểm Tra Sau Khi Sửa

Mỗi lần sửa thuật toán nên kiểm tra:

1. npm run build không lỗi TypeScript.
2. Không có tổng phút tổ/ngày vượt capacityMinutes.
3. Lượt là số nguyên.
4. Số lượng kế hoạch là số nguyên.
5. Số lượng không âm.
6. FRONT/BACK cùng PO nằm ở hai tổ khác nhau.
7. Lô B không xuất hiện trước khi lô A hoàn thành.
8. Ngày nghỉ và cuối tuần không có kế hoạch.
9. Mã ghép phần thiếu không vượt số lượng còn lại của mã nguồn.
10. File Excel xuất ra mở được bằng Excel.
11. Refresh Vercel không trả về 404.
12. Dòng tổng cuối Excel không xuất hiện thành một PO.

### Case kiểm tra bắt buộc: phần dư 347 + 13

Dùng:

- Số bàn: 120.
- Phút/ngày: 483.
- Mã chính còn 347 pcs.
- Mã chính có định mức khoảng 101,64 phút.
- Mã bù còn >= 13 pcs.
- Định mức mã bù nằm trong khoảng ±20 phút.
- Mã bù thuộc tổ khác và cùng lô.

Kết quả mong đợi:

- Tổng nhóm = 360 pcs.
- Mã chính kế hoạch = 347 pcs.
- Mã bù = 13 pcs.
- Không hiển thị mã chính thành 360 pcs nếu thực tế mã đó chỉ còn 347 pcs.
- Tổng phút nhóm không vượt công suất còn lại.

## 15. Giới Hạn Hiện Tại

- Chưa có backend hoặc database.
- Dữ liệu chỉ lưu theo browser.
- Parser chỉ lấy sheet đầu tiên.
- Lịch lễ Việt Nam có dữ liệu mẫu giới hạn trong các năm đã khai báo.
- File App.tsx vẫn là component điều phối lớn; các phần giao diện dùng chung đã tách thành components riêng.
- Bundle có thể lớn hơn 500 kB do thư viện SheetJS. Đây là cảnh báo tối ưu, không phải lỗi build.
- Ngày lý thuyết và ngày lịch thực tế không bắt buộc bằng nhau khi giữ quy tắc dứt điểm từng lô.
- Thuật toán hiện tại là greedy heuristic, không phải bài toán tối ưu toàn cục tuyệt đối.

## 16. Hướng Dẫn Cho AI Khi Sửa Source

AI cần đọc mục này trước khi thay đổi code.

### Không được phá vỡ

- Không đổi 483 thành 480 nếu người dùng không yêu cầu.
- Không dùng số lượt thập phân.
- Không để totalMinutes > capacityMinutes.
- Không cho lô sau chen vào khi lô trước chưa hoàn thành.
- Không cho FRONT và BACK của cùng một dòng vào cùng tổ.
- Không làm mất priority hoặc batch khi import, lưu localStorage hoặc export.
- Không coi dòng tổng Excel là PO.
- Không làm mất hỗ trợ nhập định mức bằng dấu phẩy.
- Không dùng calendarDays để thay thế theoreticalDays, hoặc ngược lại.
- Không sửa trực tiếp dist để thay thế source. Hãy sửa src rồi chạy build.

### Khi thay đổi planner

- Đọc toàn bộ src/utils/planning.ts.
- Kiểm tra cả mainMinutes và extraMinutes.
- Nếu thêm một loại ghép mới, phải cập nhật PlanRow, export Excel và giao diện.
- Nếu đổi điều kiện mã bù, phải kiểm tra lại case 347 + 13.
- Sau mỗi thay đổi phải chạy build và một test dữ liệu mẫu.
- Ưu tiên giữ hàm nhỏ, có tên thể hiện nghiệp vụ.
- Không gọi API hoặc thêm AI vào engine nếu chỉ cần thuật toán TypeScript thuần.

### Khi thay đổi Excel

- Giữ alias header hiện tại.
- Phân biệt số lượng nguyên và định mức thập phân.
- Kiểm tra file có dòng tổng hoặc dòng ghi chú.
- Không làm parser nhận các dòng không có mã/PO/màu và không có định mức.

### Khi thay đổi UI

- Giữ giao diện tiếng Việt.
- Giữ responsive cho desktop và mobile.
- Các phần trăm tiến trình phải chặn tối đa 100%.
- Các số lượng/lượt hiển thị dạng số nguyên theo locale Việt Nam.
- Định mức và phút hiển thị đủ độ chính xác cần thiết.

## 17. Tóm Tắt Một Câu Cho AI

Đây là ứng dụng React/Vite chạy client-side để phân công và lập lịch sản xuất in lụa theo PO; engine TypeScript tách FRONT/BACK thành job, phân tổ greedy, xử lý theo thứ tự ưu tiên và lô, chia lượt nguyên theo số bàn, ghép mã trong phút dư, bỏ ngày nghỉ, lưu localStorage và xuất Excel.
