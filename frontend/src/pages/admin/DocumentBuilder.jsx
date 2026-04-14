import React, { useState, useMemo } from 'react';
import { FileText, Plus, Trash2, Download, Loader2 } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const emptyItem = () => ({ description: '', quantity: 1, price: '' });
const emptySection = () => ({ name: '', items: [emptyItem()] });

const DocumentBuilder = () => {
  const [documentType, setDocumentType] = useState('invoice');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [validityDays, setValidityDays] = useState(14);
  const [depositPercent, setDepositPercent] = useState(80);
  const [amountPaid, setAmountPaid] = useState('');

  // Flat items for invoice/receipt
  const [items, setItems] = useState([emptyItem()]);
  // Sections for quotation
  const [sections, setSections] = useState([emptySection()]);

  const [isGenerating, setIsGenerating] = useState(false);

  /* ── Flat‑item helpers ── */
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (index) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };
  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  /* ── Section helpers ── */
  const addSection = () => setSections((prev) => [...prev, emptySection()]);
  const removeSection = (si) => {
    if (sections.length === 1) return;
    setSections((prev) => prev.filter((_, i) => i !== si));
  };
  const updateSectionName = (si, name) => {
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, name } : s)));
  };
  const addSectionItem = (si) => {
    setSections((prev) =>
      prev.map((s, i) => (i === si ? { ...s, items: [...s.items, emptyItem()] } : s))
    );
  };
  const removeSectionItem = (si, ii) => {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== si || s.items.length === 1) return s;
        return { ...s, items: s.items.filter((_, j) => j !== ii) };
      })
    );
  };
  const updateSectionItem = (si, ii, field, value) => {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        return { ...s, items: s.items.map((it, j) => (j === ii ? { ...it, [field]: value } : it)) };
      })
    );
  };

  /* ── Computed totals ── */
  const isQuotation = documentType === 'quotation';
  const isReceipt = documentType === 'receipt';

  const subtotal = useMemo(() => {
    if (isQuotation) {
      return sections.reduce(
        (sum, s) => sum + s.items.reduce((s2, it) => s2 + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0),
        0
      );
    }
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);
  }, [items, sections, isQuotation]);

  const paid = Number(amountPaid) || 0;
  const balance = subtotal - paid;
  const deposit = isQuotation ? Math.round(subtotal * (Number(depositPercent) || 0) / 100) : 0;

  /* ── Generate ── */
  const handleGenerate = async () => {
    if (isQuotation) {
      const valid = sections.some((s) => s.name.trim() && s.items.some((it) => it.description.trim() && Number(it.price) > 0));
      if (!valid) {
        toast.error('Add at least one section with a name and an item');
        return;
      }
    } else {
      const validItems = items.filter((it) => it.description.trim() && Number(it.price) > 0);
      if (validItems.length === 0) {
        toast.error('Add at least one item with a description and price');
        return;
      }
    }

    setIsGenerating(true);
    try {
      const payload = {
        documentType,
        clientName,
        clientEmail,
        clientPhone,
        clientAddress,
        notes,
      };

      if (isQuotation) {
        payload.sections = sections
          .filter((s) => s.name.trim())
          .map((s) => ({
            name: s.name.trim(),
            items: s.items
              .filter((it) => it.description.trim() && Number(it.price) > 0)
              .map((it) => ({
                description: it.description.trim(),
                quantity: Number(it.quantity) || 1,
                price: Number(it.price),
              })),
          }));
        payload.depositPercent = Number(depositPercent) || undefined;
        payload.validityDays = validityDays;
      } else {
        payload.items = items
          .filter((it) => it.description.trim() && Number(it.price) > 0)
          .map((it) => ({
            description: it.description.trim(),
            quantity: Number(it.quantity) || 1,
            price: Number(it.price),
          }));
      }

      if (isReceipt) {
        payload.totalAmount = subtotal;
        payload.amountPaid = paid;
      }

      const response = await axiosInstance.post('/admin/documents/generate', payload, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${documentType}-${Date.now()}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success(`${documentType.charAt(0).toUpperCase() + documentType.slice(1)} downloaded`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate document');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientAddress('');
    setNotes('');
    setValidityDays(14);
    setDepositPercent(80);
    setAmountPaid('');
    setItems([emptyItem()]);
    setSections([emptySection()]);
  };

  return (
    <AdminPageShell
      title="Document Builder"
      subtitle="Create custom invoices, receipts, and quotations"
    >
      {/* Document Type Selector */}
      <div className="flex gap-2">
        {['invoice', 'receipt', 'quotation'].map((type) => (
          <button
            key={type}
            onClick={() => setDocumentType(type)}
            className={`px-4 py-2 text-sm font-medium border transition-colors duration-200 ${
              documentType === type
                ? 'border-secondary bg-secondary/10 text-secondary'
                : 'border-base-300 bg-white text-neutral/60 hover:border-secondary/30'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Client Information */}
      <div className="border border-base-300 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">
          Client Information
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Client Name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Full name" />
          <Input label="Email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@email.com" type="email" />
          <Input label="Phone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+234..." />
          <Input label="Address" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Street, City, State" />
        </div>
      </div>

      {/* ── QUOTATION: Sections ── */}
      {isQuotation ? (
        <div className="space-y-4">
          {sections.map((section, si) => (
            <div key={si} className="border border-base-300 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Input
                  label={`Section ${si + 1} Name`}
                  value={section.name}
                  onChange={(e) => updateSectionName(si, e.target.value)}
                  placeholder="e.g. Living Room, Master Bedroom"
                  wrapperClassName="flex-1"
                />
                {sections.length > 1 && (
                  <button
                    onClick={() => removeSection(si)}
                    className="mt-5 flex h-10 w-10 items-center justify-center text-neutral/40 transition-colors hover:text-error"
                    title="Remove section"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Header row (desktop) */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_100px_120px_40px] gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50 px-1">
                <span>Description</span>
                <span>Qty</span>
                <span>Price (₦)</span>
                <span />
              </div>

              {section.items.map((item, ii) => (
                <div key={ii} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_100px_120px_40px] items-start">
                  <Input
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => updateSectionItem(si, ii, 'description', e.target.value)}
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={item.quantity}
                    onChange={(e) => updateSectionItem(si, ii, 'quantity', e.target.value)}
                  />
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={item.price}
                    onChange={(e) => updateSectionItem(si, ii, 'price', e.target.value)}
                  />
                  <button
                    onClick={() => removeSectionItem(si, ii)}
                    disabled={section.items.length === 1}
                    className="mt-1 flex h-10 w-10 items-center justify-center text-neutral/40 transition-colors hover:text-error disabled:opacity-30"
                    title="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <div className="flex items-center justify-between border-t border-base-300 pt-3">
                <Button variant="ghost" size="sm" onClick={() => addSectionItem(si)}>
                  <Plus size={16} className="mr-1" /> Add Item
                </Button>
                <div className="text-sm font-semibold text-neutral/70">
                  Subtotal: ₦{section.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0).toLocaleString('en-NG')}
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addSection} className="w-full">
            <Plus size={16} className="mr-1" /> Add Section
          </Button>
        </div>
      ) : (
        /* ── INVOICE / RECEIPT: Flat items ── */
        <div className="border border-base-300 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">
              Line Items
            </h2>
            <Button variant="ghost" size="sm" onClick={addItem}>
              <Plus size={16} className="mr-1" /> Add Item
            </Button>
          </div>

          {/* Header row (desktop) */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_100px_120px_40px] gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50 px-1">
            <span>Description</span>
            <span>Qty</span>
            <span>Price (₦)</span>
            <span />
          </div>

          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_100px_120px_40px] items-start">
              <Input
                placeholder="Product / service description"
                value={item.description}
                onChange={(e) => updateItem(index, 'description', e.target.value)}
              />
              <Input
                type="number"
                min="1"
                placeholder="1"
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
              />
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={item.price}
                onChange={(e) => updateItem(index, 'price', e.target.value)}
              />
              <button
                onClick={() => removeItem(index)}
                disabled={items.length === 1}
                className="mt-1 flex h-10 w-10 items-center justify-center text-neutral/40 transition-colors hover:text-error disabled:opacity-30"
                title="Remove item"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {/* Subtotal */}
          <div className="flex justify-end border-t border-base-300 pt-4">
            <div className="text-right">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50">Total</span>
              <p className="text-xl font-bold text-neutral">
                ₦{subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── RECEIPT: Amount Paid & Balance ── */}
      {isReceipt && (
        <div className="border border-base-300 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">
            Payment Details
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50">Total</span>
              <p className="text-lg font-bold text-neutral">₦{subtotal.toLocaleString('en-NG')}</p>
            </div>
            <Input
              label="Amount Paid (₦)"
              type="number"
              min="0"
              placeholder="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50">Balance</span>
              <p className={`text-lg font-bold ${balance > 0 ? 'text-error' : 'text-success'}`}>
                ₦{balance.toLocaleString('en-NG')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── QUOTATION: Deposit & Summary ── */}
      {isQuotation && (
        <div className="border border-base-300 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">
            Quotation Settings
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Deposit (%)"
              type="number"
              min="0"
              max="100"
              value={depositPercent}
              onChange={(e) => setDepositPercent(e.target.value)}
            />
            <Input
              label="Validity (days)"
              type="number"
              min="1"
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
            />
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50">Grand Total</span>
              <p className="text-lg font-bold text-neutral">₦{subtotal.toLocaleString('en-NG')}</p>
              {Number(depositPercent) > 0 && (
                <p className="text-sm text-neutral/60 mt-1">
                  Deposit: ₦{deposit.toLocaleString('en-NG')} &middot; Balance: ₦{(subtotal - deposit).toLocaleString('en-NG')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="border border-base-300 bg-white p-6 space-y-2">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
          Notes
        </label>
        <textarea
          className="w-full border border-base-300 bg-white px-4 py-3 text-sm text-neutral transition-colors duration-300 placeholder:text-neutral/40 focus:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30"
          rows={3}
          placeholder="Payment terms, delivery notes, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="elegant" size="lg" onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Download size={18} className="mr-2" />}
          {isGenerating ? 'Generating...' : `Download ${documentType.charAt(0).toUpperCase() + documentType.slice(1)}`}
        </Button>
        <Button variant="ghost" size="lg" onClick={handleReset}>
          Clear Form
        </Button>
      </div>
    </AdminPageShell>
  );
};

export default DocumentBuilder;
