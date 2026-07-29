# API màn "Thêm nhân sự" (modal `EmployeeFormModal`)

> Tài liệu API riêng cho **modal "Thêm nhân sự"** (ảnh mẫu người dùng cung cấp) trong màn Nhân viên Admin.
>
> Được viết dựa trên:
> - Code FE: `src/components/employees/EmployeeFormModal.tsx`, `src/mocks/db/employees.ts`.
> - **Đây KHÔNG phải endpoint mới**: modal này chỉ là form tạo mới cho entity `AdminEmployee` đặc tả đầy đủ
>   ở [`docs/admin_danhsachnguoidung__api.md`](admin_danhsachnguoidung__api.md) (mục 1, 1.1, 2.2, 3 — chốt
>   với Product ngày 2026-07-20). Tài liệu này trích riêng phần liên quan tới modal "Thêm nhân sự".
>
> ⚠️ **Cập nhật 2026-07-20 — đã đối chiếu được schema DB thật (do người dùng cung cấp trực tiếp, không qua
> MCP)**: **không tồn tại bảng `employees` hay `employee_roles`**. Toàn bộ actor có tài khoản trong hệ
> thống — kể cả Leader Staff/Technical Staff dùng mobile app — nằm chung trong **một bảng `users` duy
> nhất**, với `role` là **enum cố định 4 giá trị** `ADMIN`/`MANAGER`/`LEADER`/`TECHNICAL` (không có bảng
> danh mục role riêng, không cho thêm role tùy ý). Xem schema thật ở mục 2.
>
> Điều này **mâu thuẫn trực tiếp** với quyết định đã "chốt" ở `docs/admin_danhsachnguoidung__api.md` mục 3
> (quyết định 1 & 2): tài liệu đó giả định "Nhân sự vận hành sự kiện" là một entity **hoàn toàn tách biệt**
> khỏi tài khoản đăng nhập — không username/password/role RBAC, có PK `NV###` sinh riêng, có danh mục
> `employee_roles` mở rộng được (Admin tự thêm/sửa/xóa). Với schema thật chỉ có `users`, entity tách biệt đó
> **không tồn tại ở tầng DB**. Mục 3 của tài liệu này ghi lại đề xuất hòa giải (theo yêu cầu "làm theo
> khuyến nghị") nhưng đây là **quyết định nghiệp vụ cần Product xác nhận lại**, không phải việc code tự
> quyết một mình — xem cảnh báo ở mục 3.3.
>
> ✅ **Đã chốt với Product ngày 2026-07-21**: chọn **Hướng A** ở mục 3.3 — nhân sự vận hành sự kiện là tài
> khoản `LEADER`/`TECHNICAL` thật trong bảng `users` (không tạo bảng `employees` riêng). Điều này **ghi đè**
> quyết định 1 & 2 ở `docs/admin_danhsachnguoidung__api.md` mục 3 (đã cập nhật lại ở đó): giữ nguyên base
> path FE gọi là `/api/v1/employees` (route riêng, dễ đọc), nhưng backend implement bằng cách insert/đọc từ
> `users` (role `LEADER`/`TECHNICAL`) thay vì bảng `employees` không tồn tại. "Vai trò chuyên môn" lưu ở cột
> `job_title` mới trên `users` (danh sách tĩnh 6 giá trị cố định, **không phải** danh mục Admin tự thêm được
> — thu hẹp so với quyết định gốc, xem mục 3.2/3.4). Backend/Product cần xác nhận thêm 2 câu hỏi còn mở ở
> mục 3.3 (chọn `role` mặc định `TECHNICAL` hay cho phép chọn `LEADER`/`TECHNICAL`) trước khi implement.
>
> Vì dự án đang ở giai đoạn UI-first (CLAUDE.md mục 0), mâu thuẫn này **không chặn việc code UI** — FE vẫn
> dùng mock cho tới khi Backend implement xong endpoint theo Hướng A. Tài liệu này chỉ cập nhật để backend
> có thông tin đúng khi tới lượt nối API thật.

## 1. Bối cảnh UI

Modal "Thêm nhân sự" mở từ trang danh sách Nhân viên (`/admin/settings/users`, sẽ đổi thành
`/admin/settings/employees` — xem quyết định 1 ở file gốc), nút "+ Thêm nhân sự". Các trường trên form
(đúng theo ảnh mẫu):

| Trường trên UI | Bắt buộc | Control | Ghi chú |
|---|---|---|---|
| Họ và tên | Có (`*`) | Input text | FE validate: không rỗng (`values.name.trim()`). |
| Số điện thoại di động | Có (`*`) | Input text | FE validate: không rỗng. **Chưa validate định dạng** — nên bổ sung ở backend. |
| Thư điện tử doanh nghiệp (Email) | Không | Input email | Không bắt buộc, FE chưa validate định dạng. |
| Vai trò chuyên môn | Có (luôn có giá trị mặc định) | Select | Mặc định chọn giá trị đầu tiên trong danh mục vai trò. FE hiện hardcode `EMPLOYEE_ROLES` (6 giá trị: Quản lý, Điều phối viên, Kỹ thuật, Bếp trưởng, MC/MC Lead, Trang trí). **Lưu ý**: schema thật không có bảng danh mục cho các giá trị này — xem mục 3.2 để biết đề xuất lưu trữ. |
| Trạng thái vận hành | Có (mặc định "Đang trực") | Select | 2 giá trị: `active` (nhãn "Đang trực") / `inactive` (nhãn "Ngoại tuyến"). `users.status` thật có 3 giá trị (`ACTIVE`/`INACTIVE`/`SUSPENDED`) — xem mục 3.3 về cách map. |
| "Mã nhân sự dự kiến: NV023" | — | Text hiển thị (subtitle modal) | Chỉ là preview phía client, tính bằng `nextAdminEmployeeId()` (số lớn nhất hiện có + 1). **Không** gửi lên server. Với schema thật, mã này không thể là PK (PK là `user_id` uuid) — xem mục 3.1 về đề xuất lưu mã hiển thị riêng. |

## 2. Schema thật đã xác nhận: bảng `users` (không có `employees`/`employee_roles`)

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| user_id | uuid | PK | Định danh người dùng |
| username | varchar(100) | UK | Tên đăng nhập, duy nhất |
| password_hash | varchar(255) | | Mật khẩu đã băm (không lưu plaintext) |
| full_name | varchar(255) | | Họ tên hiển thị |
| role | user_role (enum) | | RBAC cố định: `ADMIN`/`MANAGER`/`LEADER`/`TECHNICAL` — không có bảng `roles` riêng |
| status | user_status (enum) | | `ACTIVE`/`INACTIVE`/`SUSPENDED` |
| email, phone, bio, avatar_url | varchar/text | | Thông tin hồ sơ (tùy chọn) |
| created_at, updated_at | timestamptz | | Thời điểm tạo/cập nhật |

Không có cột/bảng nào khác liên quan tới "employees" — mọi actor có tài khoản (kể cả Leader/Technical Staff
dùng mobile app) đều là một dòng trong `users`.

## 3. Đề xuất hòa giải với schema thật (khuyến nghị — cần Backend/Product xác nhận)

### 3.1. Mã nhân sự (`NV###`) — sinh an toàn với concurrent request

Vì `users` không có PK dạng `NV###` (PK thật là `user_id` uuid), đề xuất: **giữ `user_id` uuid làm PK**,
thêm một cột hiển thị riêng `employee_code varchar(10) UNIQUE` chỉ để hiển thị/tìm kiếm ngoài đời (giống
tinh thần `customerId` ở `docs/khach_hang_api.md`), sinh bằng **SEQUENCE của Postgres**:

```sql
CREATE SEQUENCE employee_code_seq START 1;
-- khi insert:
employee_code = 'NV' || LPAD(nextval('employee_code_seq')::text, 3, '0')
```

`nextval()` tăng nguyên tử ở tầng DB, an toàn với concurrent insert mà không cần lock thủ công — tránh
pattern `SELECT MAX(id)+1 FROM users` (race condition khi 2 Admin tạo cùng lúc). Không cần bảng/sequence
riêng cho "employees" vì tất cả vẫn insert vào `users`.

### 3.2. "Vai trò chuyên môn" — thay cho danh mục `employee_roles`

Vì không có bảng danh mục, và giá trị này (Quản lý, Điều phối viên, Kỹ thuật, Bếp trưởng, MC/MC Lead, Trang
trí) **không map 1-1 với `users.role` RBAC** (4 giá trị, dùng cho quyền đăng nhập, không có "Bếp trưởng"),
đề xuất:

- Thêm cột mới `job_title varchar(100) NULL` trên `users`, tách biệt hoàn toàn khỏi cột `role` — giữ đúng
  tinh thần "độc lập với RBAC" đã chốt ở file gốc, chỉ khác là cùng nằm trên `users` thay vì bảng riêng.
- **Bỏ khả năng Admin tự thêm/sửa/xóa vai trò** (phần "danh mục mở rộng được" ở
  `docs/admin_danhsachnguoidung__api.md` mục 1.1) cho tới khi có nhu cầu thật — trước mắt `job_title` chỉ
  nhận 1 trong 6 giá trị cố định, validate ở backend bằng constant list (không phải FK). Đây là **thu hẹp
  phạm vi so với quyết định đã chốt trước đó** — ✅ **đã chốt với Product ngày 2026-07-21: chấp nhận thu hẹp
  phạm vi này**, không tạo bảng `employee_roles` thật.

### 3.3. `POST /api/v1/employees` — impl trên bảng `users`

✅ **Đã chốt với Product ngày 2026-07-21: chọn Hướng A** — nhân sự vận hành sự kiện là tài khoản
`LEADER`/`TECHNICAL` thật trong bảng `users` (không tạo bảng `employees` riêng, không giữ "không đăng
nhập" như quyết định gốc ở `docs/admin_danhsachnguoidung__api.md`).

- **Hướng A (đã chọn) — nhân sự = tài khoản `LEADER`/`TECHNICAL` thật**: `POST /api/v1/employees` insert
  thẳng vào `users` với `role` mặc định `TECHNICAL` (hoặc cho chọn `LEADER`/`TECHNICAL` — **câu hỏi còn mở**,
  cần Backend/Product chốt tiếp trước khi implement, xem mục 5), tự sinh `username` (ví dụ từ số điện
  thoại) + mật khẩu tạm, bắt đổi mật khẩu ở lần đăng nhập mobile đầu tiên. Ưu điểm: nhân sự tạo ra dùng
  được ngay trên mobile app, không tốn bảng mới. Đánh đổi đã được Product chấp nhận: đảo ngược quyết định
  "không đăng nhập" đã chốt trước đó — modal FE cần thêm luồng hiển thị/giao mật khẩu tạm cho nhân sự
  (chưa có trong ảnh mẫu hiện tại, cần thiết kế bổ sung khi tới lượt code FE).
- ~~Hướng B — giữ nguyên "không đăng nhập"~~ — **không chọn** (yêu cầu tạo bảng `employees` riêng, mâu
  thuẫn với schema thật hiện có).

**Request/response đề xuất cho Hướng A**:

```json
// Request
{
  "name": "string, required, not blank",
  "phone": "string, required, not blank",
  "email": "string, optional",
  "jobTitle": "string, required — 1 trong 6 giá trị cố định (mục 3.2)",
  "role": "LEADER | TECHNICAL, default TECHNICAL",
  "status": "active | inactive, default: active"
}

// Response 201
{
  "id": "b2e1...-uuid",
  "employeeCode": "NV023",
  "name": "Nguyễn Văn A",
  "phone": "0912345678",
  "email": "a.nv@bnwems.vn",
  "jobTitle": "Kỹ thuật",
  "role": "TECHNICAL",
  "status": "active",
  "assignedBookings": 0
}
```

- `id`: `user_id` uuid thật (PK). `employeeCode`: mã `NV###` hiển thị, sinh theo mục 3.1 — **không** dùng
  làm PK.
- `assignedBookings`: mặc định `0` khi vừa tạo, tính từ `COUNT(...)` các bảng phân công — xem ghi chú đã có
  ở `docs/admin_danhsachnguoidung__api.md` mục 1 (cần đổi các bảng phân công sang FK `user_id` thật, ngoài
  phạm vi sửa lần này).

**Validate tối thiểu (backend)**

- `name`, `phone` không rỗng; `jobTitle` thuộc 6 giá trị cố định (mục 3.2).
- `username` tự sinh phải đảm bảo unique (retry với hậu tố nếu trùng); validate định dạng số điện thoại
  VN, định dạng email nếu có nhập (FE hiện chưa có, nên bổ sung ở backend).

**Permission**: chỉ **Admin** (Manager/Leader Staff/Technical Staff không có quyền tạo nhân sự — theo
CLAUDE.md mục 1 và quyết định 7 ở file gốc).

### 3.4. `GET /api/v1/employee-roles` — impl khi không có bảng danh mục

Vì không có bảng `employee_roles`, đề xuất route này trả về **danh sách tĩnh cấu hình phía backend** (constant
trong code, không truy vấn DB) thay vì CRUD catalog:

```
GET /api/v1/employee-roles
→ [
    { "id": "quan-ly", "name": "Quản lý" },
    { "id": "dieu-phoi-vien", "name": "Điều phối viên" },
    { "id": "ky-thuat", "name": "Kỹ thuật" },
    { "id": "bep-truong", "name": "Bếp trưởng" },
    { "id": "mc-lead", "name": "MC/MC Lead" },
    { "id": "trang-tri", "name": "Trang trí" }
  ]
```

Giữ được hợp đồng API cũ với FE (FE vẫn gọi endpoint này để lấy options, không hardcode `EMPLOYEE_ROLES`
trong component) mà không cần bảng mới. Nếu về sau Product xác nhận cần Admin tự quản lý danh mục này, mới
nâng cấp thành bảng thật + CRUD (mục 1.1 ở file gốc).

## 4. Việc cần làm ở FE khi nối API thật (chưa làm, ghi chú lại)

- Đổi `EmployeeFormModal` từ dùng `EMPLOYEE_ROLES` hardcode sang gọi `GET /api/v1/employee-roles`, lưu
  `jobTitle` (string) thay vì `roleId` (không còn là FK sau khi bỏ bảng danh mục — xem mục 3.2).
- Bỏ `nextAdminEmployeeId()` phía client khỏi luồng submit (chỉ giữ lại để hiển thị preview mã dự kiến,
  không gửi lên server) — mã thật (`employeeCode`) do backend sinh theo mục 3.1.
- Theo Hướng A đã chốt (mục 3.3): cần thêm UI hiển thị/giao mật khẩu tạm cho nhân sự mới tạo — chưa có
  trong ảnh mẫu hiện tại, cần thiết kế bổ sung.
- Gọi qua `services/employee.service.ts` (chưa tồn tại — cần tạo mới theo đúng pattern
  `services/*.service.ts` ở CLAUDE.md mục 4), không gọi axios trực tiếp trong `EmployeeFormModal.tsx`.

## 5. Việc cần làm ở Backend

1. ~~Xác nhận lại tên bảng/cột thật cho `employees` và `employee_roles`~~ — **đã xác nhận (mục 2)**: không
   có bảng `employees`/`employee_roles`, toàn bộ actor nằm trong `users`.
2. ~~Product xác nhận hướng hòa giải (Hướng A vs B)~~ — **✅ đã chốt 2026-07-21: Hướng A**. Implement
   `POST /api/v1/employees` và `GET /api/v1/employee-roles` theo mục 3.3/3.4 (insert vào `users` + trả
   danh sách vai trò tĩnh).
3. **Câu hỏi còn mở, cần Backend/Product chốt tiếp trước khi implement**: `role` khi tạo nhân sự luôn mặc
   định `TECHNICAL`, hay cho Admin chọn `LEADER`/`TECHNICAL` ngay trên modal "Thêm nhân sự"? (mục 3.3 chưa
   chốt điểm này).
4. Sinh mã `employeeCode` dạng `NV###` an toàn với concurrent request bằng Postgres `SEQUENCE` (mục 3.1),
   không dùng `SELECT MAX+1`.
5. Thêm 2 cột mới trên `users`: `employee_code varchar(10) UNIQUE`, `job_title varchar(100) NULL`
   (migration nhỏ, không cần bảng mới).
