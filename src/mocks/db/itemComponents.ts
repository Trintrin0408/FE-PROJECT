import type { OrderItem } from '@/types/order';

// BOM (Bill of Materials) tạm thời cho tab "Thiết bị & Kho hàng" → mục "Chuẩn bị kho".
//
// Bảng `item_components` (id/parent_id/child_id/quantity) là khái niệm nghiệp vụ CÓ THẬT trên đúng DB
// backend đang trỏ tới (đối chiếu `USER()`/`@@port` qua MySQL MCP khớp `DATABASE_URL` trong
// `bnwems-backend-api/.env` — Aiven cloud), đã seed dữ liệu thật cho 3 "gói" dưới đây, và có hẳn 2
// migration riêng (`add_item_components_baseline` → `remove_item_components_json_add_relation_table`)
// chứng minh đây là tính năng có chủ đích, không phải bảng rác. Tuy nhiên repo backend đang checkout
// (mọi nhánh, kể cả commit remote chưa pull) CHƯA có route/controller nào đọc được bảng này — xem
// docs/thietbikhohang_api.md mục 8 để biết chi tiết + đề xuất endpoint thật cần bổ sung.
//
// Vì vậy mock tạm ở đây theo đúng TÊN hạng mục cha (không theo itemId — itemId thật đổi theo môi
// trường/lần seed lại, còn tên thì ổn định và đã là dữ liệu hiển thị sẵn trên order.items[].itemName),
// khớp chính xác dữ liệu thật đã xác nhận qua DB. Khi Backend có endpoint thật (vd
// `GET /catalog/items/:id/components`), chỉ cần sửa `explodePhysicalDemand` đọc từ API thay vì từ
// `ITEM_COMPONENTS_BY_PARENT_NAME`, phần gọi ở `page.tsx` giữ nguyên.
export interface ItemComponentMockEntry {
  childItemName: string;
  quantityPerUnit: number;
}

export const ITEM_COMPONENTS_BY_PARENT_NAME: Record<string, ItemComponentMockEntry[]> = {
  'Gói Âm Thanh Hội Trường (100-300 khách)': [
    { childItemName: 'Loa JBL EON715 (500W)', quantityPerUnit: 4 },
    { childItemName: 'Amply công suất Crown XLS2502', quantityPerUnit: 1 },
    { childItemName: 'Micro không dây Shure SM58', quantityPerUnit: 2 },
    { childItemName: 'Dây cáp tín hiệu Canon (bộ 20m)', quantityPerUnit: 2 },
    { childItemName: 'Bàn mixer Yamaha MG16XU', quantityPerUnit: 1 },
  ],
  'Gói Ánh Sáng Sân Khấu Tiêu Chuẩn': [
    { childItemName: 'Đèn Moving Head Wash 19x15W', quantityPerUnit: 4 },
    { childItemName: 'Truss vuông 290 (cây 2m)', quantityPerUnit: 4 },
    { childItemName: 'Đèn Beam 230 7R', quantityPerUnit: 2 },
    { childItemName: 'Đèn Par LED 54x3W', quantityPerUnit: 8 },
  ],
  'Gói Âm Thanh Ngoài Trời (500-1000 khách)': [
    { childItemName: 'Loa Sub JBL SRX828S 18inch', quantityPerUnit: 2 },
    { childItemName: 'Dây cáp tín hiệu Canon (bộ 20m)', quantityPerUnit: 4 },
    { childItemName: 'Loa Line Array RCF TTL55A', quantityPerUnit: 2 },
    { childItemName: 'Vang số DBX DriveRack PA2', quantityPerUnit: 1 },
    { childItemName: 'Micro không dây Shure SM58', quantityPerUnit: 4 },
    { childItemName: 'Bàn mixer Soundcraft Signature 12', quantityPerUnit: 1 },
  ],
};

export interface ExplodedDemandRow {
  /** Tên vật tư/thiết bị vật lý cần chuẩn bị — dùng làm khoá gộp/dedupe. */
  physicalItemName: string;
  quantityNeeded: number;
  /** Có sẵn khi dòng này đến từ 1 order item lá (không phải nổ từ gói) — dùng thẳng, không cần tra cứu. */
  knownItemId?: string;
  unit?: string;
  /** Tên các hạng mục "gói" đã sinh ra dòng này (rỗng nếu là hạng mục lá được đặt trực tiếp). */
  componentOfPackages: string[];
}

/** Nổ danh sách order items thành nhu cầu vật tư vật lý thật (theo BOM mock ở trên khi có, giữ nguyên
 * khi không phải hạng mục "gói"), gộp theo tên vật tư để tránh trùng lặp khi 1 vật tư xuất hiện ở
 * nhiều dòng đặt/nhiều gói khác nhau. */
export function explodePhysicalDemand(items: OrderItem[]): ExplodedDemandRow[] {
  const byName = new Map<string, ExplodedDemandRow>();

  const addRow = (row: ExplodedDemandRow) => {
    const existing = byName.get(row.physicalItemName);
    if (existing) {
      existing.quantityNeeded += row.quantityNeeded;
      existing.knownItemId ??= row.knownItemId;
      existing.unit ??= row.unit;
      row.componentOfPackages.forEach((p) => {
        if (!existing.componentOfPackages.includes(p)) existing.componentOfPackages.push(p);
      });
    } else {
      byName.set(row.physicalItemName, { ...row, componentOfPackages: [...row.componentOfPackages] });
    }
  };

  items.forEach((item) => {
    if (item.isCombo && item.components && item.components.length > 0) {
      item.components.forEach((c) => {
        addRow({
          physicalItemName: c.childItemName || c.childItemCode,
          quantityNeeded: item.quantity * c.quantity,
          knownItemId: c.childItemId,
          unit: c.unit,
          componentOfPackages: [item.itemName as string],
        });
      });
    } else {
      addRow({
        physicalItemName: item.itemName ?? item.itemId,
        quantityNeeded: item.quantity,
        knownItemId: item.itemId,
        unit: item.unit,
        componentOfPackages: [],
      });
    }
  });

  return Array.from(byName.values());
}
