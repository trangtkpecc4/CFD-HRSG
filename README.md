# Mô phỏng 3D CFD & Giả lập Vận hành DCS — Lò thu hồi nhiệt HRSG (3 Cấp Áp suất)

## 1. Danh mục sản phẩm bàn giao
- **[HRSG_CFD_3D_Simulator.html](HRSG_CFD_3D_Simulator.html)**: File HTML duy nhất, tích hợp sẵn dữ liệu JSON, bộ giải CFD 3D, mô hình động lực học & điều khiển PID, cảnh 3D tương tác và 8 màn hình DCS (SVG). **Mở trực tiếp bằng trình duyệt Chrome/Edge không cần cài đặt server.**
- **[hrsg_data.json](hrsg_data.json)**: Cơ sở dữ liệu cấu trúc JSON trích xuất từ 14 bản vẽ P&ID, mặt bằng bố trí GA và 3 kịch bản Cân bằng nhiệt (Heat Balance).
- **[hrsg_cfd_sim.js](hrsg_cfd_sim.js)**: Lõi mô phỏng CFD 3D & điều khiển PID bằng JavaScript thuần.
- **[verify_sim.js](verify_sim.js)**: Kịch bản kiểm chứng tự động trên Node.js cho 3 chế độ tải HB và 8 kịch bản sự cố.

## 2. Hướng dẫn mở và sử dụng
1. Nhấp đúp chuột vào file **`HRSG_CFD_3D_Simulator.html`** để mở trực tiếp bằng Google Chrome hoặc Microsoft Edge.
2. **Chế độ tải Cân bằng nhiệt (CFD)**: Chọn ở thanh trên cùng:
   - `HB Base Load (100%)` (Khói 2631.1 t/h, 660.3°C → 80.3°C, Q ≈ 451.5 MW)
   - `HB 85% Load` (Khói 2257.1 t/h, 693.9°C → 70.2°C, Q ≈ 416.5 MW)
   - `HB 50% Load` (Khói 1568.3 t/h, 720.4°C → 64.7°C, Q ≈ 304.7 MW)
3. **Quan sát cảnh 3D & CFD**:
   - Kéo chuột để xoay góc nhìn 3D, cuộn chuột để phóng to/thu nhỏ.
   - Bấm vào các lớp hiển thị CFD (`CFD Nhiệt độ`, `CFD Vận tốc`, `CFD Áp suất`) hoặc góc nhìn nhanh (`Toàn cảnh 3D`, `Mặt cắt CFD`, `Mặt bằng`).
   - Bấm vào tên từng **Khu (1–8)** ở góc dưới để camera bay tới khu đó và hiển thị thông số Tag, kịch bản sự cố ở panel phải.
4. **Thực hành vận hành trên DCS (SVG)**:
   - Bấm **`Bắt đầu bài thi`** ở panel phải → chuyển sang **`Màn hình DCS (SVG)`**.
   - Thao tác chuyển chế độ `AUTO`/`MAN`, thay đổi điểm đặt `SP`, điều chỉnh độ mở van `OP` trên các Faceplate PID hoặc `START`/`STOP` bơm dự phòng để đưa cả 3 tiêu chí về trạng thái **`ĐẠT`**.

## 3. Các điểm ghi nhận `CHƯA RÕ` từ tài liệu P&ID cần kiểm tra lại
1. **Áp suất vận hành chi tiết một số nhánh nước cấp (HP/IP Eco, CPH)**: Bảng Operating Condition trên P&ID ghi `LATER`; mô phỏng hiện sử dụng giá trị chuẩn từ sơ đồ Cân bằng nhiệt (HBD) và áp suất bao hơi tương ứng.
2. **Kích thước đường ống phun giảm ôn (HP DSH & RH DSH)**: P&ID ghi `SIZE HOLD`.
3. **Đường kính danh nghĩa một số ống phụ trợ & cảm biến nhiệt ổ trục bơm**: P&ID ghi `DNXX`/`DNXXX` và `NOTE 3` (tùy bản vẽ nhà cung cấp bơm).
4. **Profile nhiệt độ khói trung gian giữa từng Module #1–#8 ở tải 85% và 50%**: P&ID Exhaust Gas cung cấp đầy đủ cho Base Load (OP1); các tải 85% và 50% được nội suy bảo toàn cân bằng năng lượng từ HBD.
