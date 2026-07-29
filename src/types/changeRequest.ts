// UC 2.27 — khớp đúng response thật của backend `D:\sep490-backend-api\src\modules\sales\changeRequest.service.ts`
// (mapChangeRequest) sau khi Backend hoàn thành yêu cầu ở docs/more-require.md mục (an).

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';
export type ChangeRequestType = 'add' | 'remove' | 'replace';
export type ChangeRequestItemAction = 'add' | 'remove';

// Item gửi lên khi tạo change-request — chỉ 3 field, backend tự tra catalog để tính giá.
export interface ChangeRequestItemInput {
  catalogItemId: string;
  quantity: number;
  action: ChangeRequestItemAction;
}

// POST /api/v1/orders/:orderId/change-requests — Leader Staff (mobile) hoặc Manager ghi nhận thêm/bớt/đổi
// thiết bị tại hiện trường. type="replace": items phải gồm đúng 1 item action="remove" (đồ cũ) và 1 item
// action="add" (đồ mới); type="add"/"remove": mọi item cùng action với type.
export interface CreateChangeRequestPayload {
  type: ChangeRequestType;
  items: ChangeRequestItemInput[];
}

// Item trả về trong GET/PUT — có kèm thông tin tra cứu sẵn từ catalog (itemName, rentalPrice hiện tại).
export interface ChangeRequestItem extends ChangeRequestItemInput {
  changeRequestItemId: string;
  itemName: string;
  rentalPrice: number;
}

// GET /api/v1/change-requests, PUT /api/v1/change-requests/:id/approve
// `amount` tính on-the-fly phía backend (không lưu cột riêng) — dương = thu thêm, âm = hoàn/giảm trên hóa
// đơn, cộng dồn vào settlement cuối của order khi status="approved" (mục 1 CLAUDE.md).
export interface ChangeRequest {
  changeRequestId: string;
  orderId: string;
  orderCode: string;
  eventName: string | null;
  customerName: string;
  customerPhone: string;
  type: ChangeRequestType;
  status: ChangeRequestStatus;
  amount: number;
  createdAt: string;
  items: ChangeRequestItem[];
}
