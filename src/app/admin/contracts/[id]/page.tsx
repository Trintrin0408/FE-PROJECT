'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, ChevronLeft, Plus } from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { INSTALLMENT_STATUS_META, getAdminContractById } from '@/mocks/adminContractsMock';
import { getAdminQuotationById } from '@/mocks/db/quotations';
import { getAdminOrders } from '@/mocks/db/orders';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import Reveal from '@/components/ui/Reveal';

// Trang thuần giao diện — xem giải thích ở đầu src/mocks/adminContractsMock.ts. Toàn bộ trang port
// theo ảnh mẫu văn bản pháp lý do người dùng cung cấp: chỉ giữ header tối giản (nút quay lại + tiêu
// đề + trạng thái đơn liên kết), nội dung chính là văn bản hợp đồng dạng quốc hiệu/tiêu ngữ — Bên A/
// Bên B — các Điều khoản, dùng font-serif riêng cho khối văn bản để đúng cảm giác văn bản pháp lý in
// ấn. Đã bỏ thanh hành động (in/gửi khách/ký/chỉnh sửa) và các card sidebar (thanh toán/tiến trình/
// điều khoản dạng card) của bản trước theo yêu cầu — nếu cần thao tác đổi trạng thái hợp đồng trở lại,
// cân nhắc bổ sung ở trang danh sách /admin/contracts.

const COMPANY_SHORT_NAME = 'Công ty Sự kiện BN';
const COMPANY_LEGAL_NAME = 'Công ty TNHH Giải pháp Sự kiện BN';
const COMPANY_TAX_CODE = '0317654321';
const COMPANY_PHONE = '0944 556 677';
const COMPANY_ADDRESS = '120 Điện Biên Phủ, Đa Kao, Quận 1, TP. HCM';

const GENERAL_TERMS = [
  'Khách hàng thanh toán đúng hạn theo lịch đặt cọc/thanh toán đã thống nhất trong hợp đồng.',
  'Mọi thay đổi hạng mục dịch vụ cần thông báo trước tối thiểu 7 ngày so với ngày tổ chức.',
  'Bên A chịu trách nhiệm về chất lượng dịch vụ đúng như hạng mục đã cam kết trong hợp đồng.',
  'Hai bên cùng ký xác nhận biên bản nghiệm thu sau khi hoàn tất sự kiện.',
];

function itemUnit(category: string): string {
  return category === 'Tiệc bàn' ? 'Bàn' : 'Gói';
}

export default function AdminContractDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const contract = getAdminContractById(id);

  if (!contract) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Không tìm thấy hợp đồng.</p>
        <Link href="/admin/contracts" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const sourceQuotation = getAdminQuotationById(contract.quotationId);
  const linkedOrder = getAdminOrders().find((o) => o.quotationId === contract.quotationId);
  const referenceCode = `HDXN-${sourceQuotation?.code ?? contract.quotationId.toUpperCase()}`;
  const signingDate = contract.signedDate || contract.createdAt;

  const remainingAfterDeposit = contract.grandTotal - contract.deposit;
  const vatAmount = Math.round((contract.subTotal - contract.discount) * contract.vatRate);

  return (
    <div className="p-6">
      <Breadcrumb
        items={[
          { label: 'Hợp đồng' },
          { label: 'Danh sách hợp đồng', href: '/admin/contracts' },
          { label: referenceCode },
        ]}
        className="mb-3"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/contracts"
            aria-label="Quay lại danh sách hợp đồng"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Hợp đồng Xác nhận Dịch vụ</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Bản dự thảo pháp lý tạo lập từ báo giá {sourceQuotation?.code ?? contract.quotationId} đã phê duyệt.
            </p>
          </div>
        </div>

        {linkedOrder ? (
          <Link
            href={`/admin/orders_audit/${linkedOrder.orderId}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            Đã lập đơn {linkedOrder.orderId}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href="/admin/orders_audit"
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <Plus className="h-4 w-4" />
            Lập đơn đặt hàng
          </Link>
        )}
      </div>

      <Reveal className="mx-auto mt-8 max-w-4xl font-serif text-slate-800 sm:p-10 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="text-center">
          <p className="text-lg font-bold uppercase tracking-wide">Cộng hòa Xã hội Chủ nghĩa Việt Nam</p>
          <p className="mt-1 inline-block border-b border-slate-800 pb-1 text-sm font-semibold italic">Độc lập - Tự do - Hạnh phúc</p>
        </div>

        <div className="mt-8 text-center">
          <h2 className="text-2xl font-bold uppercase tracking-wide">Hợp đồng Cung cấp Dịch vụ Sự kiện</h2>
          <p className="mt-2 text-sm italic text-slate-500">Số tham chiếu: {referenceCode}</p>
        </div>

        <hr className="mt-6 border-slate-200" />

        <p className="mt-6 text-justify text-sm leading-relaxed">
          Căn cứ vào Luật Thương mại nước Cộng hòa Xã hội Chủ nghĩa Việt Nam hiện hành. Hôm nay, ngày {formatDate(signingDate)} tại Văn phòng{' '}
          {COMPANY_SHORT_NAME}, chúng tôi gồm các bên dưới đây đồng thuận ký kết hợp đồng này:
        </p>

        <div className="mt-6">
          <p className="text-sm font-bold uppercase">Bên A: Đơn vị cung ứng ({COMPANY_SHORT_NAME.toUpperCase()})</p>
          <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <p>
              <span className="font-semibold">Tên đại diện:</span> {COMPANY_LEGAL_NAME}
            </p>
            <p>
              <span className="font-semibold">Mã số thuế:</span> {COMPANY_TAX_CODE}
            </p>
            <p>
              <span className="font-semibold">Điện thoại:</span> {COMPANY_PHONE}
            </p>
            <p>
              <span className="font-semibold">Địa chỉ:</span> {COMPANY_ADDRESS}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-bold uppercase">Bên B: Bên thụ hưởng (Khách hàng)</p>
          <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <p>
              <span className="font-semibold">Họ và tên:</span> {contract.customerName}
            </p>
            <p>
              <span className="font-semibold">Số điện thoại:</span> {contract.customerPhone}
            </p>
            <p>
              <span className="font-semibold">Hòm thư email:</span> {contract.customerEmail || 'Chưa cập nhật'}
            </p>
            <p>
              <span className="font-semibold">Địa chỉ:</span> {contract.customerAddress || 'Chưa cập nhật'}
            </p>
          </div>
        </div>

        <div className="mt-7">
          <p className="text-sm font-bold uppercase">Điều 1: Nội dung hạng mục dịch vụ</p>
          <p className="mt-2 text-justify text-sm leading-relaxed">
            Bên A đồng ý cung cấp cho Bên B trọn gói các trang thiết bị và dịch vụ phục vụ sự kiện {contract.eventName.toLowerCase()} tại {contract.venue}, bao
            gồm chi tiết như sau:
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-xs font-bold uppercase">
                  <th className="w-10 py-2 pr-2">STT</th>
                  <th className="py-2 pr-2">Hạng mục chi tiết</th>
                  <th className="w-16 py-2 pr-2 text-center">ĐVT</th>
                  <th className="w-14 py-2 pr-2 text-center">SL</th>
                  <th className="py-2 pr-2 text-right">Đơn giá</th>
                  <th className="py-2 pl-2 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contract.items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-2 align-top text-slate-500">{index + 1}</td>
                    <td className="py-2.5 pr-2 align-top">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      {item.description && <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>}
                    </td>
                    <td className="py-2.5 pr-2 text-center align-top text-slate-600">{itemUnit(item.category)}</td>
                    <td className="py-2.5 pr-2 text-center align-top font-medium text-slate-700">{item.qty}</td>
                    <td className="py-2.5 pr-2 text-right align-top text-slate-700">{formatCurrency(item.price)}</td>
                    <td className="py-2.5 pl-2 text-right align-top font-bold text-slate-900">{formatCurrency(item.price * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-7">
          <p className="text-sm font-bold uppercase">Điều 2: Giá trị hợp đồng và thanh toán</p>
          <p className="mt-2 text-justify text-sm leading-relaxed">
            Tổng giá trị hợp đồng, các khoản khấu trừ và lịch thanh toán giữa hai bên được thống nhất như sau:
          </p>
          <div className="mt-3 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span>Tạm tính</span>
                <span className="font-medium">{formatCurrency(contract.subTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Giảm giá</span>
                <span className="font-medium">-{formatCurrency(contract.discount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Thuế VAT ({Math.round(contract.vatRate * 100)}%)</span>
                <span className="font-medium">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-base font-bold">
                <span>Tổng cộng</span>
                <span>{formatCurrency(contract.grandTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Đặt cọc</span>
                <span className="font-medium">-{formatCurrency(contract.deposit)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Còn lại phải thanh toán</span>
                <span>{formatCurrency(remainingAfterDeposit)}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-xs font-bold uppercase">
                  <th className="py-2 pr-2">Đợt thanh toán</th>
                  <th className="py-2 pr-2">Hạn thanh toán</th>
                  <th className="py-2 pl-2 text-right">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contract.installments.map((ins) => (
                  <tr key={ins.id}>
                    <td className="py-2 pr-2">{ins.name}</td>
                    <td className="py-2 pr-2 text-slate-600">
                      {formatDate(ins.dueDate)} ({INSTALLMENT_STATUS_META[ins.status].label})
                    </td>
                    <td className="py-2 pl-2 text-right font-semibold">{formatCurrency(ins.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-7">
          <p className="text-sm font-bold uppercase">Điều 3: Điều khoản chung</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
            {GENERAL_TERMS.map((term) => (
              <li key={term} className="text-justify">
                {term}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 text-center text-sm sm:grid-cols-2">
          <div>
            <p className="font-bold uppercase">Đại diện Bên A</p>
            <p className="text-xs italic text-slate-500">(Ký, ghi rõ họ tên)</p>
            <p className="mt-16 font-semibold">{COMPANY_LEGAL_NAME}</p>
          </div>
          <div>
            <p className="font-bold uppercase">Đại diện Bên B</p>
            <p className="text-xs italic text-slate-500">(Ký, ghi rõ họ tên)</p>
            <p className="mt-16 font-semibold">{contract.customerName}</p>
            {contract.signedDate && <p className="mt-1 text-xs text-slate-500">Ngày ký: {formatDate(contract.signedDate)}</p>}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
