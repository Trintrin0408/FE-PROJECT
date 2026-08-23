'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { AdminContract } from '@/mocks/adminContractsMock';

interface ContractEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: AdminContract | null;
  onSubmit: (values: {
    eventName: string;
    weddingDate: string;
    venue: string;
    guestCount: number;
    eventNotes: string;
    discount: number;
    deposit: number;
  }) => void;
}

export function ContractEditModal({ isOpen, onClose, contract, onSubmit }: Readonly<ContractEditModalProps>) {
  const [values, setValues] = useState({ eventName: '', weddingDate: '', venue: '', guestCount: 0, eventNotes: '', discount: 0, deposit: 0 });
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen && contract) {
      setValues({
        eventName: contract.eventName,
        weddingDate: contract.weddingDate,
        venue: contract.venue,
        guestCount: contract.guestCount,
        eventNotes: contract.eventNotes,
        discount: contract.discount,
        deposit: contract.deposit,
      });
    }
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Hủy bỏ
      </Button>
      <Button onClick={() => onSubmit(values)}>Lưu thay đổi</Button>
    </>
  );

  if (!contract) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Chỉnh sửa hợp đồng · ${contract.id}`} footer={footer}>
      <div className="flex flex-col gap-4">
        <Input label="Tên sự kiện" value={values.eventName} onChange={(e) => setValues((v) => ({ ...v, eventName: e.target.value }))} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Ngày tổ chức cưới"
            type="date"
            value={values.weddingDate}
            onChange={(e) => setValues((v) => ({ ...v, weddingDate: e.target.value }))}
          />
          <Input label="Địa điểm / Sảnh cưới" value={values.venue} onChange={(e) => setValues((v) => ({ ...v, venue: e.target.value }))} />
        </div>
        <Input
          label="Số lượng khách"
          type="number"
          value={values.guestCount}
          onChange={(e) => setValues((v) => ({ ...v, guestCount: Number(e.target.value) || 0 }))}
        />
        <Textarea
          id="contract-event-notes"
          label="Ghi chú sự kiện"
          rows={3}
          value={values.eventNotes}
          onChange={(e) => setValues((v) => ({ ...v, eventNotes: e.target.value }))}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Chiết khấu giảm giá (VNĐ)"
            type="number"
            step={500_000}
            value={values.discount}
            onChange={(e) => setValues((v) => ({ ...v, discount: Number(e.target.value) || 0 }))}
          />
          <Input
            label="Đặt cọc đợt 1 (VNĐ)"
            type="number"
            step={1_000_000}
            value={values.deposit}
            onChange={(e) => setValues((v) => ({ ...v, deposit: Number(e.target.value) || 0 }))}
          />
        </div>
      </div>
    </Modal>
  );
}

export default ContractEditModal;
