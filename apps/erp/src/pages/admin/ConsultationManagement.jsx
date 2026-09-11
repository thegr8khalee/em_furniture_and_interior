import React, { useEffect, useState, useCallback } from 'react';
import { axiosInstance } from '@em/domain';
import { Loader2, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, Select, SkeletonBlock } from '@em/ui';

const ConsultationManagement = () => {
  const [consultations, setConsultations] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState(null);
  // Billing the design work. Separate from the status form, because deciding
  // that a room costs ₦150,000 and deciding the business is owed it are two
  // different acts — the second one posts to the ledger.
  const [billing, setBilling] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState({
    status: 'new',
    assignedDesigner: '',
    meetingLink: '',
    scheduledAt: '',
    adminNotes: '',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [consultRes, designerRes] = await Promise.all([
        axiosInstance.get(`/consultations/admin${filterStatus ? `?status=${filterStatus}` : ''}`),
        axiosInstance.get('/designers/admin'),
      ]);
      setConsultations(consultRes.data.consultations || []);
      setDesigners(designerRes.data.designers || []);
    } catch {
      toast.error('Failed to load consultation data');
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const naira = (value) =>
    `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

  const submitBill = async (event) => {
    event.preventDefault();

    try {
      const { data } = await axiosInstance.post(
        `/consultations/admin/${billing.id}/bill`,
        { amount: Number(billing.amount), tax: Number(billing.tax || 0) }
      );
      toast.success(data.message);
      setBilling(null);
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not bill that consultation');
    }
  };

  const settleFee = async (consultation) => {
    if (!window.confirm(`Record the ${naira(consultation.fee.total)} fee as paid?`)) return;

    try {
      const { data } = await axiosInstance.post(
        `/consultations/admin/${consultation._id}/fee-payment`,
        { paymentMethod: 'bank_transfer' }
      );
      toast.success(data.message);
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not settle that fee');
    }
  };

  const openEdit = (consultation) => {
    setSelected(consultation);
    setFormData({
      status: consultation.status || 'new',
      assignedDesigner: consultation.assignedDesigner?._id || '',
      meetingLink: consultation.meetingLink || '',
      scheduledAt: consultation.scheduledAt
        ? new Date(consultation.scheduledAt).toISOString().split('T')[0]
        : '',
      adminNotes: consultation.adminNotes || '',
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selected) return;

    setIsUpdating(true);
    try {
      await axiosInstance.put(`/consultations/admin/${selected._id}`, formData);
      toast.success('Consultation updated');
      setSelected(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to update consultation');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AdminPageShell
      title="Consultation Requests"
      subtitle="Manage incoming design consultations"
      actions={
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-auto"
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      }
    >

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-24 w-full" />)}
        </div>
      ) : consultations.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No consultation requests"
          description="No requests match the current filter."
        />
      ) : (
        <div className="grid gap-4">
          {consultations.map((item) => (
            <div key={item._id} className="border border-base-300 p-4 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral">{item.fullName}</h3>
                  <p className="text-sm text-neutral/60">{item.email}</p>
                  <p className="text-sm text-neutral/60">{item.phone}</p>
                  <div className="text-xs text-neutral/50 mt-2">
                    Budget: {item.budgetMin || 0} - {item.budgetMax || 0} NGN
                  </div>
                  <div className="text-xs text-neutral/50">
                    Meeting: {item.preferredMeetingType}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                    Manage
                  </Button>

                  {/* The design work, as money. Unbilled is the usual state:
                      an enquiry that went nowhere is not a debt. */}
                  {!item.fee?.billedAt ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setBilling({ id: item._id, name: item.fullName, amount: '', tax: '' })
                      }
                    >
                      Bill design work
                    </Button>
                  ) : item.fee.paidOn ? (
                    <Badge variant="success">fee paid · {naira(item.fee.total)}</Badge>
                  ) : (
                    <>
                      <Badge variant="warning">owed · {naira(item.fee.total)}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => settleFee(item)}>
                        Mark fee paid
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {(item.stylePreferences || []).map((style) => (
                  <span key={style} className="border border-base-300 px-2 py-1">
                    {style}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(billing)}
        onClose={() => setBilling(null)}
        title={billing ? `Bill ${billing.name} for design work` : ''}
        className="max-w-lg"
      >
        {billing && (
          <form onSubmit={submitBill} className="space-y-4">
            <p className="text-sm text-neutral/60">
              This earns the fee and records it as owed. It is the moment the design side of the
              business appears in the books, and it happens once — a figure already posted is
              changed with a credit note, not a second bill.
            </p>

            <Input
              label="Fee (₦)"
              type="number"
              min="0"
              step="0.01"
              required
              value={billing.amount}
              onChange={(e) => setBilling({ ...billing, amount: e.target.value })}
            />
            <Input
              label="VAT (₦)"
              type="number"
              min="0"
              step="0.01"
              hint="Leave empty if the fee is not taxed"
              value={billing.tax}
              onChange={(e) => setBilling({ ...billing, tax: e.target.value })}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setBilling(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Bill it
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Update Consultation">
        <form onSubmit={handleUpdate} className="space-y-4">
          <Select label="Status" name="status" value={formData.status} onChange={handleChange}>
            <option value="new">New</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>

          <Select label="Assigned Designer" name="assignedDesigner" value={formData.assignedDesigner} onChange={handleChange}>
            <option value="">Unassigned</option>
            {designers.map((designer) => (
              <option key={designer._id} value={designer._id}>
                {designer.name}
              </option>
            ))}
          </Select>

          <Input label="Meeting Link" type="url" name="meetingLink" value={formData.meetingLink} onChange={handleChange} />
          <Input label="Scheduled Date" type="date" name="scheduledAt" value={formData.scheduledAt} onChange={handleChange} />

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Admin Notes</label>
            <textarea name="adminNotes" className="w-full border border-base-300 bg-white px-4 py-3 text-sm text-neutral transition-colors duration-300 placeholder:text-neutral/40 focus:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30" rows={3} value={formData.adminNotes} onChange={handleChange} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setSelected(null)} disabled={isUpdating}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isUpdating}>Save</Button>
          </div>
        </form>
      </Modal>
    </AdminPageShell>
  );
};

export default ConsultationManagement;
