@AGENTS.md

# BNWEMS Web Frontend — Hướng dẫn cho Claude

## Lưu ý: không tự ý sửa UI, và BE

## 0. ƯU TIÊN HIỆN TẠI: Giai đoạn dựng giao diện thuần (tạm thời)

> **Trạng thái: đang áp dụng.** Gỡ bỏ mục này (và khôi phục lại đầy đủ ràng buộc bên dưới) ngay khi dự án quay lại giai đoạn nối API/backend thật.

Dự án hiện đang ở giai đoạn tập trung dựng giao diện (UI-first). Khi build màn hình mới hoặc chỉnh sửa màn hình hiện có:

- **Không bắt buộc đọc `docs/api/`, không bắt buộc đối chiếu database/schema backend, không bắt buộc tra cứu "Quy tắc nghiệp vụ cốt lõi" ở mục 1** trước khi code — nội dung nghiệp vụ ở mục 1 và mục 2 (Quy ước API) trong file này **tạm thời chỉ mang tính tham khảo**, không phải yêu cầu bắt buộc phải tuân theo khi làm UI trong giai đoạn này.
- Chỉ cần code giao diện khớp đúng ảnh mẫu/thiết kế do người dùng cung cấp (bố cục, màu sắc, thành phần, luồng thao tác) — theo hệ thống thiết kế ở mục 3.
- Dữ liệu hiển thị dùng mock tùy ý cho khớp giao diện, không cần bám sát field/model backend thật. **Không bắt buộc phải hiển thị in nghiêng hay ghi vào `docs/more-require.md`** (bullet cuối mục 4 tạm ngưng áp dụng) — trừ khi người dùng yêu cầu khác cho từng trường hợp cụ thể.
- Vẫn giữ nguyên hiệu lực: quy tắc thiết kế (mục 3) và các quy ước không liên quan tới API/backend ở mục 4 (tái dùng component dùng chung, toàn bộ text tiếng Việt, mobile-friendly, scroll-reveal, không hardcode role rời rạc ngoài `usePermission`...).
- Khi dự án quay lại giai đoạn nối API thật, phục hồi lại toàn bộ ràng buộc ở mục 1/2/4 như trước.

## 1. Tổng quan dự án

**BNWEMS (Binh Nguyen Wedding Event Management System)** là hệ thống quản lý nội bộ cho doanh nghiệp dịch vụ cưới hỏi/sự kiện **Bình Nguyên**, số hóa toàn bộ quy trình vận hành: từ tiếp nhận yêu cầu khách hàng → khảo sát → báo giá → đặt cọc → khóa tồn kho → điều phối nhân sự → xuất kho → thi công → nghiệm thu → thu hồi → quyết toán → hoàn kho → tính công Staff → theo dõi công nợ Supplier.

Đây là phần mềm quản trị nội bộ (back-office), **không phải** website public cho khách hàng cuối — ưu tiên hiệu năng nhập liệu, mật độ thông tin hợp lý và độ chính xác số liệu hơn là yếu tố marketing.

> Tài liệu nghiệp vụ đầy đủ (use case, ERD, database, Gantt): [Google Doc dự án](https://docs.google.com/document/d/1UYUB5pETgvW0TIbZW9RlYGfz-0uM-kWIbiiPNJpvVgw/edit). Tóm tắt phần liên quan tới frontend ở dưới — khi cần chi tiết quy tắc nghiệp vụ chưa có ở đây, tra lại doc gốc trước khi giả định.

### Phạm vi nghiệp vụ (module chính)

- Quản lý tài khoản & phân quyền (RBAC)
- Master data: dịch vụ, thiết bị (catalog), kho, Supplier, bảng giá, chính sách cọc/hoàn cọc/phí phát sinh, quy tắc tiền công
- Khách hàng & vòng đời Order
- Khảo sát hiện trường (Survey), Báo giá (Quotation, có versioning)
- Thanh toán: tạo yêu cầu cọc → sinh QR thanh toán qua VNPay hoặc khách trả tiền mặt/chuyển khoản (Leader Staff có thể ghi nhận chứng từ thanh toán tại hiện trường) → Manager xác nhận cọc/thanh toán cuối; settlement cuối cũng có thể được Leader Staff ghi nhận tại hiện trường trước khi Manager xác nhận.
- Tồn kho theo ngày (Date-based Inventory Lock) — tính theo **loại + số lượng**, không theo serial/item riêng lẻ
- Giao dịch Supplier (thuê/mua thiết bị, công nợ, đền bù thiếu/hỏng)
- Điều phối nhân sự & phương tiện: **Schedule Plan** (kế hoạch tổng thể cho khảo sát/chuẩn bị/vận chuyển/thi công/thu hồi/hoàn kho) tách biệt với **Work Task** (giao việc cụ thể cho từng Staff); Pick-list xuất kho.
- Vận hành hiện trường: vận chuyển, thi công, Change Request (thêm/bớt/đổi thiết bị), nghiệm thu/bàn giao, ghi nhận hỏng/mất
- Settlement (quyết toán cuối) & đóng Order; hoàn kho & trả Supplier
- Chấm công (Attendance) & tính tiền công Staff theo buổi
- Audit log, Evidence file (ảnh minh chứng), Notification; Dashboard/báo cáo: **Operational Dashboard** (Manager — trạng thái order/task/thanh toán/kho/vấn đề vận hành) tách biệt với **Administrative Dashboard + Revenue/Order/Inventory Reports** (Admin — audit-oriented).

### Vai trò & phân quyền

Hệ thống có 4 role; **web frontend (repo này) chỉ phục vụ Admin và Manager** — Leader Staff và Technical Staff dùng app mobile riêng, không thuộc phạm vi repo này nhưng vẫn cần hiểu để dữ liệu hiển thị đúng (vd: tiến độ task do Leader/Technical Staff thực hiện).

- **Admin** (Web only): quyền cao nhất nhưng **không xử lý vận hành hằng ngày**. Chỉ quản lý master data, cấu hình hệ thống/chính sách, phân quyền, xem & audit toàn bộ dữ liệu sau vận hành. Admin **không** trực tiếp ghi nhận cọc/thanh toán, phê duyệt change request, xác nhận hoàn kho hay đóng order — ranh giới này phải tôn trọng khi thiết kế UI/permission gating.
- **Manager** (Web + Mobile): vai trò vận hành chính, chịu trách nhiệm toàn bộ vòng đời Order — tạo order, khảo sát, báo giá, ghi nhận cọc/thanh toán, phân công nhân sự, làm việc với Supplier, phê duyệt Change Request, xác nhận biên bản/hỏng-mất/settlement/hoàn kho, đóng order, xử lý tranh chấp. Phần lớn dữ liệu hiện trường (khảo sát, xuất/nhận/trả kho nội bộ và Supplier, biên bản bàn giao, hỏng/mất, settlement, chứng từ thanh toán tại hiện trường) do **Leader Staff (mobile) ghi nhận trước, Manager chỉ xác nhận (confirm) trên web** — khi thiết kế UI Manager cần có hàng đợi/badge "chờ xác nhận" theo từng loại biên bản.
- *(Ngoài phạm vi web)* Leader Staff (Mobile, điều phối hiện trường) và Technical Staff (Mobile, chỉ thực hiện task được giao).
- **Customer và Supplier không có tài khoản đăng nhập** — chỉ là dữ liệu được quản lý; giao tiếp với họ diễn ra ngoài hệ thống (gọi điện, Zalo, Messenger), hệ thống không có cổng khách hàng hay chữ ký điện tử.

### Vòng đời Order (state machine quan trọng nhất)

Request → Survey → (đặt thêm Supplier nếu thiếu kho) → Quotation cuối + yêu cầu cọc → xác nhận cọc + khóa inventory theo ngày → điều phối nhân sự/phương tiện → xuất kho & nhận hàng Supplier → vận chuyển → thi công + xử lý Change Request → nghiệm thu/bàn giao → thu hồi & kiểm đếm (hỏng/mất) → phụ phí + settlement cuối → hoàn kho + trả Supplier → Manager đóng order → Admin audit. Đây là quy trình nghiệp vụ đầy đủ theo doc gốc — UI/luồng màn hình nên được thiết kế theo các bước này.

**Enum `OrderStatus` hiện tại trong code có 7 giá trị lowercase** (`src/types/order.ts`): `draft`, `confirmed`, `in_progress`, `completed`, `cancelled`, `deposit_paid`, `settlement_pending`. **Không khớp** `docs/api/09-orders.md` (doc vẫn ghi 5 giá trị PascalCase `DRAFT`/`QUOTED`/`CONFIRMED`/`IN_PROGRESS`/`COMPLETED` — có `QUOTED` mà code không có, không có `cancelled`). `deposit_paid`/`settlement_pending` là 2 giá trị runtime phát sinh thêm (khi xác nhận cọc, khi ghi nhận settlement) chưa được khai báo chính thức ở `docs/api/` hay comment schema backend — chi tiết & đề xuất đồng bộ xem [`docs/more-require.md`](docs/more-require.md) mục (h). Doc nghiệp vụ gốc có định nghĩa state machine chi tiết hơn nhiều (`REQUEST_SUBMITTED`, `SURVEY_*`, `INVENTORY_LOCKED`, `HANDOVER_*`, `SETTLEMENT_*`, `CLOSURE_*`...) nhưng **chưa được implement** — khi build các màn hình theo từng giai đoạn vận hành chi tiết (khảo sát, khóa kho, thu hồi, settlement...), cần mở rộng enum này và đồng bộ lại `docs/api/09-orders.md` trước, không tự thêm giá trị enum chỉ ở phía frontend. Trạng thái Inventory (chưa có type/constant riêng trong code, tham khảo doc gốc khi cần): `Available`, `Reserved`, `Checked-out`, `In-use`, `Returned Pending Approval`, `Maintenance`, `Damaged`, `Lost`, `Removed from Available Inventory`.

### Quy tắc nghiệp vụ cốt lõi (áp dụng đúng khi build tính năng/tính toán liên quan)

- **Đổi ngày**: miễn phí nếu yêu cầu trước >3 ngày so với ngày lắp đặt.
- **Hủy đơn — hoàn cọc**: ≥30 ngày trước → hoàn 100%; 7–30 ngày → hoàn 50%; <7 ngày → không hoàn.
- **Bớt thiết bị tại hiện trường**: trừ 100% giá trị thiết bị bị bớt khỏi hóa đơn.
- **Thay thiết bị**: `Tổng hóa đơn mới = cũ - giá thiết bị cũ + giá thiết bị mới`.
- **Thêm thiết bị tại hiện trường**: chỉ kiểm tra kho nội bộ (không liên hệ Supplier ở giai đoạn thi công); phụ phí vận chuyển nếu khoảng cách kho → địa điểm > 2km.
- **Đền bù thiết bị hỏng/mất**: `Số tiền = Giá mua thiết bị × Số lượng hỏng/mất` (tính theo giá mua, không theo giá thuê/bán).
- **Đền bù Supplier** (đồ thuê ngoài thiếu/hỏng): theo đơn giá mua của Supplier.
- **Tiền công Staff**: tính theo **buổi** (không theo giờ, không phụ cấp ngoài giờ); Leader Staff > Technical Staff; tổng hợp & trả cuối tháng; khấu trừ do hỏng/mất trừ trực tiếp vào lương tháng đó. **Chấm công xác nhận qua 2 lớp trước khi tính lương**: Technical Staff tự check-in → Leader Staff xác nhận điểm danh & hoàn thành việc của Technical Staff trong nhóm mình phụ trách → Manager xác nhận tổng hợp công/lương cuối cùng.
- Mọi biên bản (bàn giao, hỏng/mất, settlement) đều cần **Manager xác nhận trên hệ thống** trước khi gửi Customer qua kênh ngoài hệ thống — không có bước tự động hóa hay chữ ký điện tử.
- **Xóa draft**: Quotation và Supplier Rental/Purchase Order chỉ được xóa khi còn ở trạng thái draft (chưa confirm, chưa gắn Order/Supplier debt active); sau khi confirm/liên kết dữ liệu thì không xóa được nữa, chỉ cập nhật hoặc đổi trạng thái. `docs/api/08-quotations.md` đã có `DELETE /api/v1/quotations/:id` (chỉ xóa được khi chưa `ACCEPTED`). `docs/api/04-suppliers.md` vẫn **chưa có endpoint DELETE** tương ứng cho Supplier Rental/Purchase Order — cần đồng bộ lại doc API/backend trước khi build chức năng xóa cho phần đó trên UI.

### Giới hạn / Out of scope đáng chú ý

Không có Customer/Supplier self-service portal; không chữ ký điện tử; không tự động đối soát ngân hàng; không AI khảo sát/thiết kế tự động; không tối ưu lịch/tuyến tự động; không RFID/IoT; không phải hệ thống kế toán/payroll đầy đủ; không BI/dự báo nâng cao. Mọi cột mốc quan trọng cần xác nhận thủ công bởi Manager (không tự động hóa).

### Pattern dữ liệu cần tái sử dụng

Backend dùng nhiều polymorphic relationship — `evidence_attachments (entity_type, entity_id)` dùng chung cho mọi loại ảnh minh chứng, `inventory_transactions (reference_type, reference_id)` dùng chung cho mọi biến động kho. Khi thiết kế type/UI cho file đính kèm hoặc lịch sử biến động kho, theo cùng pattern entity_type/entity_id thay vì tạo field riêng cho từng loại.

### Prototype UI tham khảo (Manager Portal)

Thư mục `docs/bnwems-manager-portal/` chứa **prototype giao diện Manager Portal** do người dùng tự thiết kế (xuất từ Google AI Studio) — khi người dùng nói "xem/theo prototype" mà không chỉ rõ đường dẫn khác, mặc định hiểu là thư mục này.

- **Bản chất**: app React + Vite + TailwindCSS v4 độc lập (KHÔNG phải Next.js, không dùng chung code với app chính) — chỉ để tham khảo look-and-feel/layout/luồng màn hình, không phải code sản phẩm thật.
- **Dữ liệu**: toàn bộ mock, giữ in-memory qua React state (`src/mockData.ts` + `useState` trong `src/App.tsx`) — không gọi API thật, không có auth thật, không kết nối `docs/api/` hay backend.
- **Chạy thử**: `cd docs/bnwems-manager-portal && npm install && npm run dev` → `http://localhost:3002` (port đã đổi từ mặc định 3000 → 3002 trong `vite.config.ts` để không đụng port dev 3000 của app Next.js chính).
- **Các màn hình có sẵn** (`src/components/`, điều hướng qua `Sidebar.tsx`/`App.tsx`): Dashboard, Khách hàng, Báo giá, Đơn hàng, Lịch trình (Schedule/Plan/Task), Khảo sát, Tồn kho, Nhà cung cấp, Mua sắm/Procurement, Thanh toán (cọc/công nợ), Công & lương, Hồ sơ cá nhân.
- **Cách dùng khi build tính năng thật**: dùng prototype để đối chiếu bố cục/luồng thao tác/thứ tự trường trên UI thật (`src/app/manager/...`) — **không** copy nguyên field/logic nghiệp vụ hay endpoint từ đây, vì dữ liệu là mock tự bịa cho đẹp giao diện, có thể không khớp `docs/api/` hay quy tắc nghiệp vụ ở trên. Khi có mâu thuẫn giữa prototype và `docs/api/`/quy tắc nghiệp vụ đã ghi trong file này, **ưu tiên `docs/api/` và quy tắc nghiệp vụ** — prototype chỉ thắng ở phần thuần UI (màu sắc, spacing, sắp xếp card...) miễn không trái mục 3 (Quy tắc thiết kế).

## 2. Đây là dự án dùng Next.js

- **Next.js 16 (App Router)** + **TypeScript** + **TailwindCSS v4** + **Axios** (JWT interceptor).
- Icon: `lucide-react`. Chart: `recharts`. Test: Jest + Testing Library. `playwright` đã có trong devDependencies nhưng **chưa wire up E2E** (chưa có `playwright.config.*`, chưa có thư mục `e2e/`/test file, chưa có script npm nào gọi) — đừng giả định có thể chạy E2E ngay.
- State: React Context (`AuthContext`, `PermissionContext`).
- Cấu trúc thư mục chi tiết: xem [README.md](README.md). ⚠️ README.md hiện mô tả route `admin/warehouse/` (View Warehouse Information) nhưng route này **không còn tồn tại** trong code — đã đổi thành `admin/inventory/` (`stock-status/`, `maintenance/`); cần sửa lại README khi đụng tới phần này.
- ⚠️ Next.js 16 có breaking changes so với kiến thức huấn luyện — luôn đọc `node_modules/next/dist/docs/` trước khi dùng API mới (đã ghi rõ trong `AGENTS.md`, được import ở đầu file này — không xóa khối đó).
- Phân khu theo vai trò bằng path segment thật (không phải route group): `auth/` (`/auth/...`), `admin/` (`/admin/...`), `manager/` (`/manager/...`). Không trộn UI/logic giữa hai role trừ khi dùng component dùng chung trong `components/`.

## 3. Quy tắc thiết kế

Phong cách tham chiếu: dashboard quản trị tối giản, hiện đại, chuyên nghiệp (kiểu "Bliss Network" trong ảnh mẫu). Mọi UI mới phải tuân theo hệ thống dưới đây để toàn site đồng nhất.

### Layout tổng thể

- **Sidebar trái cố định, nền tối** (slate/navy đậm, ví dụ `slate-900` / `#0F172A`), chữ và icon màu xám sáng/trắng, item active có nền highlight nhạt + viền/indicator màu accent.
- **Vùng nội dung chính nền sáng** (trắng hoặc `slate-50`), tương phản rõ với sidebar.
- **Topbar/header** mỏng, gọn: search, notification, avatar + tên người dùng ở góc phải.
- Bố cục dạng **card** trên nền content: mỗi khối thông tin (KPI, bảng, chart) là một card nền trắng, `rounded-xl`, shadow rất nhẹ, padding thoáng — tránh viền cứng (border) nặng.

### Màu sắc

- **Accent chính: xanh blue** (`blue-600`/`#2563EB`) cho nút primary, link, biểu đồ chính.
- **Màu trạng thái (status badge)** dùng nhất quán toàn site:
  - Xanh lá (`green-500/600`) = hoàn thành / thành công / đã thanh toán
  - Vàng/cam (`amber-500`) = đang chờ / đang xử lý
  - Đỏ (`red-500`) = quá hạn / hủy / lỗi
  - Xám (`slate-400`) = nháp / không hoạt động
- Badge dạng pill nhỏ, nền màu nhạt (10–15% opacity) + chữ màu đậm cùng tông, không dùng màu nền đặc gắt.

### Typography & Component

- Font sans-serif hệ thống/Inter, hierarchy rõ: số liệu KPI lớn-đậm, label phụ nhỏ-xám.
- **KPI Card**: số liệu lớn ở trên, label mô tả dưới, có thể kèm icon hoặc % thay đổi (màu xanh/đỏ theo chiều tăng giảm).
- **Table**: hàng gọn, có avatar/icon nhận diện ở cột đầu khi liên quan đến người (khách hàng, nhân viên), cột trạng thái dùng badge, có pagination ở cuối, hỗ trợ search + filter phía trên bảng.
- **Button primary**: nền xanh, chữ trắng, `rounded-md`/`rounded-lg`, không dùng gradient cầu kỳ.
- **Modal/Form**: tối giản, label rõ, khoảng trắng thoáng, không nhồi nhét nhiều trường trên một dòng.
- Hạn chế trang trí thừa (gradient, shadow đậm, animation phô trương) — giữ cảm giác **gọn, chuyên nghiệp, đáng tin cậy** vì đây là phần mềm quản lý tài chính/vận hành thật.

### Responsive

- Một số luồng (ví dụ check-in QR tại tiệc cưới) cần tối ưu cho **mobile/tablet** — giao diện đơn giản hơn, tập trung 1 hành động chính (quét QR, xác nhận check-in).

> Khi tạo component UI mới, ưu tiên tái sử dụng từ `components/ui/` (`Button`, `Table`, `Badge`, `Modal`...) đã liệt kê trong README trước khi viết mới.

## 4. Quy tắc bắt buộc

- **Không** tự ý đổi cấu trúc thư mục đã định nghĩa trong README mà không hỏi trước.
- Mọi gọi API phải đi qua lớp `services/*.service.ts`, không gọi `axios`/`fetch` trực tiếp trong component/page.
- Mọi endpoint, request/response shape, mã lỗi phải đúng theo [`docs/api/`](docs/api/) (mục 2). Nếu doc API thay đổi (cập nhật lại từ repo gốc), đồng bộ lại `docs/api/` và rà soát các `service.ts` liên quan.
- Type rõ ràng cho mọi dữ liệu domain trong `types/`; không dùng `any` trừ khi không thể tránh.
- Phân quyền theo vai trò (Admin/Manager) phải kiểm tra qua `PermissionContext`/`usePermission`, không hardcode điều kiện role rời rạc trong UI. ⚠️ Một số component layout (`Header.tsx`, `Sidebar.tsx`, `ProtectedRoute.tsx`, `auth/login/page.tsx`) đang so sánh trực tiếp `role.roleName === 'Admin'` để chọn route/nav — chấp nhận được vì là điều hướng, không phải feature-gating, nhưng feature-gating mới vẫn bắt buộc qua `usePermission`.
- Định dạng tiền tệ và ngày giờ luôn qua `utils/formatCurrency.ts` và `utils/formatDate.ts`, không format thủ công. ⚠️ Hiện có 2 chỗ đang bypass rule này bằng `toLocaleDateString` thủ công (`src/app/manager/dashboard/page.tsx`, `src/components/dashboard/ScheduleTimeline.tsx`) vì `formatDate.ts` chưa hỗ trợ định dạng có tên thứ/ngày dài — khi gặp nhu cầu tương tự, mở rộng `formatDate.ts` thay vì thêm chỗ format thủ công mới.
- Không thêm thư viện UI/CSS framework mới (ngoài Tailwind) nếu chưa thống nhất với người dùng.
- Viết test cho service và hook quan trọng (đặt trong `__tests__/`) khi thêm logic nghiệp vụ mới. *(Hiện coverage còn thấp — phần lớn `services/*.service.ts` chưa có test; khi sửa/thêm logic ở service nào, ưu tiên bổ sung test cho service đó.)*
- **Sau mỗi thay đổi UI lớn**: chụp screenshot màn hình vừa sửa và so sánh với ảnh design gốc (mục 3) trước khi báo là hoàn tất; nêu rõ điểm còn lệch nếu có.
- **Website phải mobile-friendly**: mọi trang (không chỉ luồng check-in) đều phải responsive tốt trên mobile/tablet, không riêng desktop.
- **Mọi section phải có animation khi scroll** (scroll-reveal khi section xuất hiện trong viewport): dùng thống nhất một thư viện animation cho toàn site, animation tinh tế/nhanh (không lặp lại quá đà), giữ đúng tinh thần tối giản ở mục 3 — tránh hiệu ứng nặng làm chậm trang hoặc gây rối mắt cho dashboard nhiều số liệu. **`framer-motion` đã được cài** (`package.json`) và là lib chuẩn duy nhất của site — **không cài thêm lib animation khác**. Đã dùng scroll-reveal thật (`whileInView` + `viewport={{ once: true, margin: '-40px' }}`) ở một số component: `components/dashboard/{ScheduleTimeline,ApprovalCard,AnalyticsCard,ActivityFeed}.tsx`, `components/orders/{FieldChangeRequestCard,SurveyAssignmentCard,ExecutionPersonnelCard}.tsx`, `components/reports/DashboardStats.tsx`, `components/layout/Header.tsx`, `app/manager/dashboard/page.tsx` — tái dùng đúng pattern này khi thêm section mới. Nhiều trang khác (đặc biệt phía `admin/`) vẫn chưa có scroll-reveal — cần bổ sung dần theo cùng pattern khi sửa/tạo màn hình đó.
- **Toàn bộ text trên giao diện khi generate phải là tiếng Việt** — label, placeholder, tiêu đề, thông báo, tooltip, nội dung nút... Chỉ giữ tiếng Anh cho thuật ngữ kỹ thuật/tên riêng không có bản dịch chuẩn (vd tên field nội bộ, mã trạng thái, tên biến).
- **Khi build màn hình mà một phần dữ liệu cần thiết backend chưa có** (thiếu field/endpoint so với `docs/api/`): phần nào lấy được từ backend thật thì vẫn lấy qua `services/*.service.ts` như bình thường; phần còn thiếu thì tự sinh mock data hợp lý khớp đúng yêu cầu UI để không chặn tiến độ, đồng thời **luôn ghi yêu cầu bổ sung vào [`docs/more-require.md`](docs/more-require.md)** (nối tiếp theo format mục (a)(b)(c)... đã có trong file) để backend biết cần làm gì. **Phần dữ liệu mock phải hiển thị in nghiêng (`italic`) trên UI** để phân biệt rõ với dữ liệu thật — gỡ in nghiêng ngay khi backend đã bổ sung field/endpoint thật và đã nối API xong. (Rule này áp dụng cho tầng hiển thị khi *biết rõ* backend chưa hỗ trợ — không mâu thuẫn với quy tắc "không tự suy diễn endpoint/field" ở mục 2, vốn áp dụng cho tầng gọi API/service.)

## 5. Workflow

- Trước khi code: xác nhận lại phạm vi thay đổi nếu yêu cầu chưa rõ ràng (đặc biệt với màn hình tài chính/công nợ — sai số liệu ảnh hưởng nghiệp vụ thật).
- Khi thêm màn hình mới: tham chiếu phong cách ở mục 3, tái dùng component có sẵn trước khi tạo mới.
- Chạy `npm run test` trước khi coi một thay đổi logic là hoàn tất.
- Không tự ý commit/push — chỉ thực hiện khi được yêu cầu rõ ràng.
