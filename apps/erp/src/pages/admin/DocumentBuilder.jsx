import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Search,
  X,
  Clock,
  FolderOpen,
  Save,
  RotateCcw,
  CheckCircle,
  Receipt,
  Link2,
} from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Button, Input, Select, Pagination, SkeletonBlock, EmptyState } from '@em/ui';

const emptyItem = () => ({ description: '', quantity: 1, price: '' });
const emptySection = () => ({ name: '', items: [emptyItem()] });

const getDocStatusColor = (status) => {
  switch (status) {
    case 'draft':
      return 'badge-warning';
    case 'issued':
      return 'badge-info';
    case 'partially_paid':
      return 'bg-amber-100 text-amber-900 border border-amber-300';
    case 'paid':
      return 'badge-success';
    case 'cancelled':
      return 'badge-error';
    default:
      return 'badge-ghost';
  }
};

const DocumentBuilder = () => {
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'history'
  const [editingDocId, setEditingDocId] = useState(null);
  const [editingDocNumber, setEditingDocNumber] = useState('');

  const [documentType, setDocumentType] = useState('invoice');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [validityDays, setValidityDays] = useState(14);
  const [depositPercent, setDepositPercent] = useState(70);
  const [depositType, setDepositType] = useState('percentage');
  const [depositValue, setDepositValue] = useState('');
  const [projectFeeType, setProjectFeeType] = useState('percentage');
  const [projectFeeValue, setProjectFeeValue] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');

  // Invoice-Receipt relation states
  const [relatedDocumentId, setRelatedDocumentId] = useState(null);
  const [relatedDocumentNumber, setRelatedDocumentNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');

  // Linked receipts inspection modal
  const [inspectingInvoice, setInspectingInvoice] = useState(null);
  const [linkedReceiptsData, setLinkedReceiptsData] = useState(null);
  const [isLoadingLinked, setIsLoadingLinked] = useState(false);

  // Flat items for invoice/receipt
  const [items, setItems] = useState([emptyItem()]);
  // Sections for quotation
  const [sections, setSections] = useState([emptySection()]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  /* ── Saved Documents History State ── */
  const [savedDocs, setSavedDocs] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docPage, setDocPage] = useState(1);
  const [docTotalPages, setDocTotalPages] = useState(1);
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [docStatusFilter, setDocStatusFilter] = useState('');
  const [docSearch, setDocSearch] = useState('');
  const [downloadingDocId, setDownloadingDocId] = useState(null);

  /* ── Customer Picker ── */
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerMatches, setCustomerMatches] = useState([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [linkedCustomer, setLinkedCustomer] = useState(null);

  const findCustomers = async () => {
    const term = customerQuery.trim();
    if (!term) return;

    setIsSearchingCustomers(true);
    try {
      const { data } = await axiosInstance.get(
        `/customers?limit=8&search=${encodeURIComponent(term)}`
      );
      setCustomerMatches(data.customers);
      if (data.customers.length === 0) toast('Nobody matched that.');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not search customers');
    } finally {
      setIsSearchingCustomers(false);
    }
  };

  const chooseCustomer = async (customer) => {
    setLinkedCustomer(customer);
    setCustomerMatches([]);
    setCustomerQuery('');

    setClientName(customer.username || '');
    setClientEmail(customer.email || '');
    setClientPhone(customer.phoneNumber || '');

    try {
      const { data } = await axiosInstance.get(`/customers/${customer._id}/addresses`);
      const last = data.addresses?.[0];
      if (last) setClientAddress([last.address, last.city, last.state].filter(Boolean).join(', '));
    } catch {
      // Address is a convenience here
    }
  };

  const unlinkCustomer = () => {
    setLinkedCustomer(null);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientAddress('');
  };

  /* ── Flat-item helpers ── */
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (index) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };
  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  /* ── Section helpers (quotations) ── */
  const addSection = () => setSections((prev) => [...prev, emptySection()]);
  const removeSection = (sectionIndex) => {
    if (sections.length === 1) return;
    setSections((prev) => prev.filter((_, i) => i !== sectionIndex));
  };
  const updateSectionName = (sectionIndex, name) => {
    setSections((prev) => {
      const copy = [...prev];
      copy[sectionIndex] = { ...copy[sectionIndex], name };
      return copy;
    });
  };
  const addItemToSection = (sectionIndex) => {
    setSections((prev) => {
      const copy = [...prev];
      copy[sectionIndex] = {
        ...copy[sectionIndex],
        items: [...copy[sectionIndex].items, emptyItem()],
      };
      return copy;
    });
  };
  const removeItemFromSection = (sectionIndex, itemIndex) => {
    setSections((prev) => {
      const copy = [...prev];
      if (copy[sectionIndex].items.length === 1) return prev;
      copy[sectionIndex] = {
        ...copy[sectionIndex],
        items: copy[sectionIndex].items.filter((_, i) => i !== itemIndex),
      };
      return copy;
    });
  };
  const updateSectionItem = (sectionIndex, itemIndex, field, value) => {
    setSections((prev) => {
      const copy = [...prev];
      const itemsCopy = [...copy[sectionIndex].items];
      itemsCopy[itemIndex] = { ...itemsCopy[itemIndex], [field]: value };
      copy[sectionIndex] = { ...copy[sectionIndex], items: itemsCopy };
      return copy;
    });
  };

  /* ── Live Totals ── */
  const isQuotation = documentType === 'quotation';
  const isReceipt = documentType === 'receipt';

  const subtotal = useMemo(() => {
    if (isQuotation) {
      return sections.reduce((secAcc, sec) => {
        return (
          secAcc +
          sec.items.reduce((itAcc, it) => {
            const qty = Number(it.quantity) || 0;
            const price = Number(it.price) || 0;
            return itAcc + qty * price;
          }, 0)
        );
      }, 0);
    }
    return items.reduce((acc, it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      return acc + qty * price;
    }, 0);
  }, [isQuotation, sections, items]);

  const discountVal = Number(discountValue) || 0;
  const discountAmount =
    discountType === 'percentage'
      ? Math.round(subtotal * (discountVal / 100))
      : discountVal;

  const totalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const projectFeeAmount = isQuotation
    ? projectFeeType === 'percentage'
      ? Math.round(totalAfterDiscount * ((Number(projectFeeValue) || 0) / 100))
      : Number(projectFeeValue) || 0
    : 0;

  const grandTotal = totalAfterDiscount + projectFeeAmount;
  const paid = Number(amountPaid) || 0;
  const balance = grandTotal - paid;
  const isInvoice = documentType === 'invoice';
  const depositPct = Number(depositPercent) || 0;
  const deposit = isInvoice ? Math.round((grandTotal * depositPct) / 100) : 0;
  const quotationDeposit = isQuotation
    ? depositType === 'percentage'
      ? Math.round(grandTotal * ((Number(depositValue) || 0) / 100))
      : Number(depositValue) || 0
    : 0;
  const quotationBalance = grandTotal - quotationDeposit;

  /* ── Build Payload ── */
  const buildPayload = (status = 'issued') => {
    const payload = {
      id: editingDocId || undefined,
      documentType,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      customerId: linkedCustomer?._id,
      notes,
      discountType,
      discountValue: discountVal,
      status,
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
      payload.depositType = Number(depositValue) > 0 ? depositType : undefined;
      payload.depositValue = Number(depositValue) || undefined;
      payload.projectFeeType = Number(projectFeeValue) > 0 ? projectFeeType : undefined;
      payload.projectFeeValue = Number(projectFeeValue) || undefined;
      payload.validityDays = validityDays;
    } else {
      payload.items = items
        .filter((it) => it.description.trim() && Number(it.price) > 0)
        .map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity) || 1,
          price: Number(it.price),
        }));
      if (documentType === 'invoice') {
        payload.depositPercent = Number(depositPercent) || undefined;
      }
    }

    if (isReceipt) {
      payload.totalAmount = grandTotal;
      payload.amountPaid = paid;
      payload.relatedDocumentId = relatedDocumentId || undefined;
      payload.relatedDocumentNumber = relatedDocumentNumber?.trim() || undefined;
      payload.paymentMethod = paymentMethod;
      payload.paymentReference = paymentReference?.trim() || undefined;
    }

    return payload;
  };

  /* ── Generate & Auto-Save ── */
  const handleGenerate = async () => {
    if (isQuotation) {
      const valid = sections.some(
        (s) =>
          s.name.trim() &&
          s.items.some((it) => it.description.trim() && Number(it.price) > 0)
      );
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
      const payload = buildPayload('issued');
      const response = await axiosInstance.post('/admin/documents/generate', payload, {
        responseType: 'blob',
      });

      const disposition = response.headers?.['content-disposition'] || '';
      const headerName = /filename="?([^"]+)"?/i.exec(disposition)?.[1] || '';
      const docNumber =
        response.headers?.['x-document-number'] ||
        headerName.replace(/\.pdf$/i, '').split('-').slice(1).join('-') ||
        String(Date.now());

      const safeClient =
        (clientName || 'client')
          .trim()
          .replace(/[\\/:*?"<>|]+/g, '')
          .replace(/\s+/g, '_') || 'client';
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `${safeClient}_${dateStr}_${documentType}-${docNumber}.pdf`;

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success(
        `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} generated & saved (${docNumber})`
      );

      // Reset editing ID since new generation completed
      setEditingDocId(null);
      setEditingDocNumber('');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate document');
    } finally {
      setIsGenerating(false);
    }
  };

  /* ── Save as Draft ── */
  const handleSaveDraft = async () => {
    if (!clientName.trim()) {
      toast.error('Client name is required to save a draft');
      return;
    }

    setIsSavingDraft(true);
    try {
      const payload = buildPayload('draft');
      const { data } = await axiosInstance.post('/admin/documents', payload);
      setEditingDocId(data.document.id);
      setEditingDocNumber(data.document.documentNumber);
      toast.success(
        `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} saved as draft (${data.document.documentNumber})`
      );
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  /* ── Load Document into Builder ── */
  const handleLoadIntoBuilder = (doc) => {
    setEditingDocId(doc.id);
    setEditingDocNumber(doc.documentNumber);
    setDocumentType(doc.documentType);
    setClientName(doc.clientName || '');
    setClientEmail(doc.clientEmail || '');
    setClientPhone(doc.clientPhone || '');
    setClientAddress(doc.clientAddress || '');
    setNotes(doc.notes || '');
    setValidityDays(doc.validityDays || 14);
    setDepositPercent(doc.depositPercent != null ? doc.depositPercent : 70);
    setDepositType(doc.depositType || 'percentage');
    setDepositValue(doc.depositValue ? String(doc.depositValue) : '');
    setProjectFeeType(doc.projectFeeType || 'percentage');
    setProjectFeeValue(doc.projectFeeValue ? String(doc.projectFeeValue) : '');
    setAmountPaid(doc.amountPaid ? String(doc.amountPaid) : '');
    setDiscountType(doc.discountType || 'percentage');
    setDiscountValue(doc.discountValue ? String(doc.discountValue) : '');
    setRelatedDocumentId(doc.relatedDocumentId || null);
    setRelatedDocumentNumber(doc.relatedDocumentNumber || '');
    setPaymentMethod(doc.paymentMethod || 'bank_transfer');
    setPaymentReference(doc.paymentReference || '');

    if (doc.sections && doc.sections.length > 0) {
      setSections(doc.sections);
      setItems([emptyItem()]);
    } else if (doc.items && doc.items.length > 0) {
      setItems(doc.items);
      setSections([emptySection()]);
    }

    setActiveTab('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success(`Loaded ${doc.documentNumber} into builder`);
  };

  /* ── Issue Receipt from Saved Invoice ── */
  const handleIssueReceiptFromInvoice = (invoiceDoc) => {
    setEditingDocId(null);
    setEditingDocNumber('');
    setDocumentType('receipt');
    setRelatedDocumentId(invoiceDoc.id);
    setRelatedDocumentNumber(invoiceDoc.documentNumber);
    setClientName(invoiceDoc.clientName || '');
    setClientEmail(invoiceDoc.clientEmail || '');
    setClientPhone(invoiceDoc.clientPhone || '');
    setClientAddress(invoiceDoc.clientAddress || '');
    setPaymentMethod('bank_transfer');
    setPaymentReference('');
    setNotes(`Payment received for Invoice ${invoiceDoc.documentNumber}`);
    setDiscountType(invoiceDoc.discountType || 'percentage');
    setDiscountValue(invoiceDoc.discountValue ? String(invoiceDoc.discountValue) : '');

    // Suggest remaining balance or required deposit
    const remainingBal = invoiceDoc.balance != null ? Number(invoiceDoc.balance) : Number(invoiceDoc.totalAmount) || 0;
    setAmountPaid(remainingBal > 0 ? String(remainingBal) : String(invoiceDoc.totalAmount || ''));

    if (invoiceDoc.items && invoiceDoc.items.length > 0) {
      setItems(invoiceDoc.items);
      setSections([emptySection()]);
    } else if (invoiceDoc.sections && invoiceDoc.sections.length > 0) {
      const flattened = [];
      invoiceDoc.sections.forEach((s) => {
        (s.items || []).forEach((it) => flattened.push(it));
      });
      setItems(flattened.length > 0 ? flattened : [emptyItem()]);
      setSections([emptySection()]);
    } else {
      setItems([emptyItem()]);
    }

    setActiveTab('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success(`Issuing receipt for Invoice ${invoiceDoc.documentNumber}`);
  };

  /* ── Inspect Linked Receipts Modal ── */
  const handleOpenLinkedReceipts = async (invoiceDoc) => {
    setInspectingInvoice(invoiceDoc);
    setIsLoadingLinked(true);
    try {
      const { data } = await axiosInstance.get(`/admin/documents/${invoiceDoc.id}/linked`);
      setLinkedReceiptsData(data);
    } catch (err) {
      console.error(err);
      toast.error('Could not load linked receipts');
    } finally {
      setIsLoadingLinked(false);
    }
  };

  const handleReset = () => {
    setEditingDocId(null);
    setEditingDocNumber('');
    setLinkedCustomer(null);
    setCustomerQuery('');
    setCustomerMatches([]);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientAddress('');
    setNotes('');
    setValidityDays(14);
    setDepositPercent(70);
    setDepositType('percentage');
    setDepositValue('');
    setProjectFeeType('percentage');
    setProjectFeeValue('');
    setAmountPaid('');
    setDiscountType('percentage');
    setDiscountValue('');
    setRelatedDocumentId(null);
    setRelatedDocumentNumber('');
    setPaymentMethod('bank_transfer');
    setPaymentReference('');
    setItems([emptyItem()]);
    setSections([emptySection()]);
  };

  /* ── Fetch Saved Documents History ── */
  const fetchSavedDocs = useCallback(async () => {
    setIsLoadingDocs(true);
    try {
      const params = new URLSearchParams({
        page: docPage,
        limit: 15,
      });
      if (docTypeFilter) params.append('type', docTypeFilter);
      if (docStatusFilter) params.append('status', docStatusFilter);
      if (docSearch.trim()) params.append('search', docSearch.trim());

      const { data } = await axiosInstance.get(`/admin/documents?${params.toString()}`);
      setSavedDocs(data.documents || []);
      setDocTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load saved documents');
    } finally {
      setIsLoadingDocs(false);
    }
  }, [docPage, docTypeFilter, docStatusFilter, docSearch]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchSavedDocs();
    }
  }, [activeTab, fetchSavedDocs]);

  /* ── Download Saved Document PDF ── */
  const handleDownloadSaved = async (doc) => {
    setDownloadingDocId(doc.id);
    try {
      const response = await axiosInstance.get(`/admin/documents/${doc.id}/pdf`, {
        responseType: 'blob',
      });
      const safeClient = (doc.clientName || 'client')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '_') || 'client';
      const dateStr = new Date(doc.createdAt).toISOString().slice(0, 10);
      const filename = `${safeClient}_${dateStr}_${doc.documentType}-${doc.documentNumber}.pdf`;

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Document downloaded');
    } catch (error) {
      console.error(error);
      toast.error('Failed to download document PDF');
    } finally {
      setDownloadingDocId(null);
    }
  };

  /* ── Update Document Status ── */
  const handleStatusChange = async (docId, newStatus) => {
    try {
      await axiosInstance.patch(`/admin/documents/${docId}/status`, { status: newStatus });
      toast.success('Status updated');
      fetchSavedDocs();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status');
    }
  };

  /* ── Delete Document ── */
  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`Delete document ${doc.documentNumber}? This cannot be undone.`)) {
      return;
    }
    try {
      await axiosInstance.delete(`/admin/documents/${doc.id}`);
      toast.success('Document deleted');
      fetchSavedDocs();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete document');
    }
  };

  return (
    <AdminPageShell
      title="Document Builder"
      subtitle="Create, save, and track custom invoices, receipts, and quotations"
    >
      {/* Tab Switcher */}
      <div className="flex border-b border-base-300 gap-2 mb-6">
        <button
          onClick={() => setActiveTab('builder')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
            activeTab === 'builder'
              ? 'border-secondary text-secondary bg-secondary/5'
              : 'border-transparent text-neutral/60 hover:text-neutral'
          }`}
        >
          <FileText size={16} />
          <span>Document Builder</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
            activeTab === 'history'
              ? 'border-secondary text-secondary bg-secondary/5'
              : 'border-transparent text-neutral/60 hover:text-neutral'
          }`}
        >
          <Clock size={16} />
          <span>Saved Documents</span>
        </button>
      </div>

      {/* ──────────────── TAB 1: BUILDER ──────────────── */}
      {activeTab === 'builder' && (
        <div className="space-y-6">
          {editingDocId && (
            <div className="flex items-center justify-between border border-secondary bg-secondary/10 px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-secondary" />
                <span>
                  Editing saved document: <strong className="font-mono">{editingDocNumber}</strong>
                </span>
              </div>
              <button
                onClick={handleReset}
                className="text-xs font-semibold text-secondary hover:underline"
              >
                Create New Document Instead
              </button>
            </div>
          )}

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

          {/* Linked Invoice indicator for receipts */}
          {isReceipt && (
            <div className="border border-base-300 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral/60 flex items-center gap-1.5">
                  <Link2 size={14} className="text-secondary" />
                  Related Invoice
                </span>
                {relatedDocumentNumber && (
                  <button
                    type="button"
                    onClick={() => {
                      setRelatedDocumentId(null);
                      setRelatedDocumentNumber('');
                    }}
                    className="text-xs text-error hover:underline flex items-center gap-1"
                  >
                    <X size={12} /> Unlink Invoice
                  </button>
                )}
              </div>
              {relatedDocumentNumber ? (
                <div className="flex items-center justify-between border border-secondary/40 bg-secondary/5 px-4 py-2.5 text-sm">
                  <div>
                    <span className="text-xs text-neutral/50 block">This receipt is settling:</span>
                    <strong className="font-mono text-secondary text-sm">
                      {relatedDocumentNumber}
                    </strong>
                  </div>
                  <span className="badge badge-info text-xs">Linked to Invoice</span>
                </div>
              ) : (
                <Input
                  label="For Invoice # (Optional)"
                  placeholder="e.g. INV-1725968400000-123"
                  value={relatedDocumentNumber}
                  onChange={(e) => setRelatedDocumentNumber(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Client Information */}
          <div className="border border-base-300 bg-white p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">
              Client Information
            </h2>
            {linkedCustomer ? (
              <div className="flex items-center gap-3 border border-secondary bg-secondary/5 px-4 py-3">
                <div className="flex-1 text-sm">
                  <p className="font-medium">{linkedCustomer.username}</p>
                  <p className="text-neutral/50">{linkedCustomer.email}</p>
                </div>
                <Button variant="ghost" leftIcon={X} onClick={unlinkCustomer}>
                  Use a different name
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    label="Find a customer"
                    icon={Search}
                    placeholder="Name, email or phone"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        findCustomers();
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={findCustomers}
                    isLoading={isSearchingCustomers}
                  >
                    Search
                  </Button>
                </div>
                {customerMatches.length > 0 && (
                  <div className="border border-base-300 bg-base-100 p-2 space-y-1">
                    {customerMatches.map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => chooseCustomer(c)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white transition-colors"
                      >
                        <span className="font-medium">{c.username}</span>
                        <span className="text-neutral/50">{c.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Client Name"
                placeholder="Amina Bello"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
              <Input
                label="Email"
                type="email"
                placeholder="amina@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
              <Input
                label="Phone"
                placeholder="+234 800 000 0000"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
              />
              <Input
                label="Delivery Address"
                placeholder="Plot 4, Independence Way, Kaduna"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
              />
            </div>
          </div>

          {/* Line Items / Sections */}
          {isQuotation ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">
                  Sections & Items
                </h2>
                <Button variant="outline" size="sm" onClick={addSection} leftIcon={Plus}>
                  Add Section
                </Button>
              </div>

              {sections.map((section, sIdx) => (
                <div key={sIdx} className="border border-base-300 bg-white p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <input
                      type="text"
                      className="border-b border-base-300 bg-transparent py-1 text-base font-bold text-neutral placeholder:text-neutral/30 focus:border-secondary focus:outline-none"
                      placeholder={`Section ${sIdx + 1} Name (e.g., Living Room)`}
                      value={section.name}
                      onChange={(e) => updateSectionName(sIdx, e.target.value)}
                    />
                    {sections.length > 1 && (
                      <button
                        onClick={() => removeSection(sIdx)}
                        className="text-error/60 hover:text-error transition-colors"
                        title="Remove section"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {section.items.map((item, iIdx) => (
                      <div key={iIdx} className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[200px]">
                          <input
                            type="text"
                            className="w-full border border-base-300 bg-white px-3 py-2 text-sm text-neutral focus:border-secondary focus:outline-none"
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => updateSectionItem(sIdx, iIdx, 'description', e.target.value)}
                          />
                        </div>
                        <div className="w-20">
                          <input
                            type="number"
                            min="1"
                            className="w-full border border-base-300 bg-white px-3 py-2 text-sm text-neutral focus:border-secondary focus:outline-none"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateSectionItem(sIdx, iIdx, 'quantity', e.target.value)}
                          />
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            min="0"
                            className="w-full border border-base-300 bg-white px-3 py-2 text-sm text-neutral focus:border-secondary focus:outline-none"
                            placeholder="Price (₦)"
                            value={item.price}
                            onChange={(e) => updateSectionItem(sIdx, iIdx, 'price', e.target.value)}
                          />
                        </div>
                        <div className="w-24 text-right text-sm font-semibold text-neutral">
                          ₦{((Number(item.quantity) || 1) * (Number(item.price) || 0)).toLocaleString('en-NG')}
                        </div>
                        {section.items.length > 1 && (
                          <button
                            onClick={() => removeItemFromSection(sIdx, iIdx)}
                            className="text-error/60 hover:text-error transition-colors"
                            title="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => addItemToSection(sIdx)} leftIcon={Plus}>
                    Add Item to {section.name || `Section ${sIdx + 1}`}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-base-300 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">
                  Line Items
                </h2>
                <Button variant="outline" size="sm" onClick={addItem} leftIcon={Plus}>
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <input
                        type="text"
                        className="w-full border border-base-300 bg-white px-3 py-2 text-sm text-neutral focus:border-secondary focus:outline-none"
                        placeholder="Description (e.g. Royal Armchair)"
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      />
                    </div>
                    <div className="w-20">
                      <input
                        type="number"
                        min="1"
                        className="w-full border border-base-300 bg-white px-3 py-2 text-sm text-neutral focus:border-secondary focus:outline-none"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                      />
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-base-300 bg-white px-3 py-2 text-sm text-neutral focus:border-secondary focus:outline-none"
                        placeholder="Price (₦)"
                        value={item.price}
                        onChange={(e) => updateItem(idx, 'price', e.target.value)}
                      />
                    </div>
                    <div className="w-24 text-right text-sm font-semibold text-neutral">
                      ₦{((Number(item.quantity) || 1) * (Number(item.price) || 0)).toLocaleString('en-NG')}
                    </div>
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-error/60 hover:text-error transition-colors"
                        title="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing & Terms */}
          <div className="border border-base-300 bg-white p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">
              Pricing, Discounts & Terms
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
                  Discount Type
                </label>
                <select
                  className="w-full border border-base-300 bg-white px-4 py-2.5 text-sm text-neutral focus:border-secondary focus:outline-none"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₦)</option>
                </select>
              </div>

              <Input
                label={`Discount Value (${discountType === 'percentage' ? '%' : '₦'})`}
                type="number"
                min="0"
                placeholder="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />

              {isQuotation && (
                <>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
                      Project Management Fee
                    </label>
                    <select
                      className="w-full border border-base-300 bg-white px-4 py-2.5 text-sm text-neutral focus:border-secondary focus:outline-none"
                      value={projectFeeType}
                      onChange={(e) => setProjectFeeType(e.target.value)}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (₦)</option>
                    </select>
                  </div>

                  <Input
                    label={`Project Fee Value (${projectFeeType === 'percentage' ? '%' : '₦'})`}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={projectFeeValue}
                    onChange={(e) => setProjectFeeValue(e.target.value)}
                  />

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
                      Deposit Requirement
                    </label>
                    <select
                      className="w-full border border-base-300 bg-white px-4 py-2.5 text-sm text-neutral focus:border-secondary focus:outline-none"
                      value={depositType}
                      onChange={(e) => setDepositType(e.target.value)}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (₦)</option>
                    </select>
                  </div>

                  <Input
                    label={`Deposit Value (${depositType === 'percentage' ? '%' : '₦'})`}
                    type="number"
                    min="0"
                    placeholder="70"
                    value={depositValue}
                    onChange={(e) => setDepositValue(e.target.value)}
                  />

                  <Input
                    label="Validity Period (Days)"
                    type="number"
                    min="1"
                    value={validityDays}
                    onChange={(e) => setValidityDays(Number(e.target.value) || 14)}
                  />
                </>
              )}

              {isInvoice && (
                <Input
                  label="Required Deposit (%)"
                  type="number"
                  min="0"
                  max="100"
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(Number(e.target.value))}
                />
              )}
            </div>

            {/* Calculations Summary */}
            <div className="border-t border-base-200 pt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <span className="text-xs uppercase tracking-[0.14em] text-neutral/50">Subtotal</span>
                <p className="text-base font-semibold text-neutral">₦{subtotal.toLocaleString('en-NG')}</p>
              </div>
              <div>
                <span className="text-xs uppercase tracking-[0.14em] text-neutral/50">Discount</span>
                <p className="text-base font-semibold text-error">
                  {discountAmount > 0 ? `-₦${discountAmount.toLocaleString('en-NG')}` : '₦0'}
                </p>
              </div>
              <div>
                <span className="text-xs uppercase tracking-[0.14em] text-neutral/50">Grand Total</span>
                <p className="text-lg font-bold text-neutral">₦{grandTotal.toLocaleString('en-NG')}</p>
              </div>
              {isInvoice && (
                <div>
                  <span className="text-xs uppercase tracking-[0.14em] text-neutral/50">
                    Deposit ({depositPct}%)
                  </span>
                  <p className="text-base font-semibold text-secondary">
                    ₦{deposit.toLocaleString('en-NG')}
                  </p>
                </div>
              )}
              {isQuotation && (
                <>
                  <div>
                    <span className="text-xs uppercase tracking-[0.14em] text-neutral/50">Deposit</span>
                    <p className="text-base font-semibold text-secondary">
                      ₦{quotationDeposit.toLocaleString('en-NG')}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-[0.14em] text-neutral/50">Balance on Delivery</span>
                    <p className="text-base font-semibold text-neutral">
                      ₦{quotationBalance.toLocaleString('en-NG')}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Receipt Settlement Section */}
          {isReceipt && (
            <div className="border border-base-300 bg-white p-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral/60">
                Receipt Settlement
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50">
                    {relatedDocumentNumber ? 'Invoice Total' : 'Grand Total'}
                  </span>
                  <p className="text-lg font-bold text-neutral">₦{grandTotal.toLocaleString('en-NG')}</p>
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
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50">
                    Remaining Balance
                  </span>
                  <p className={`text-lg font-bold ${balance > 0 ? 'text-error' : 'text-success'}`}>
                    ₦{balance.toLocaleString('en-NG')}
                  </p>
                </div>
              </div>

              {/* Payment Method & Reference */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-3 border-t border-base-200">
                <Select
                  label="Payment Method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="bank_transfer">Taj Bank / Bank Transfer</option>
                  <option value="pos">POS / Card Terminal</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="online">Online Payment</option>
                </Select>
                <Input
                  label="Payment Reference / Session ID"
                  placeholder="e.g. TRX-982137 or Bank Session ID"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
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

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="elegant"
              size="lg"
              onClick={handleGenerate}
              isLoading={isGenerating}
              leftIcon={Download}
            >
              {isGenerating ? 'Generating...' : `Generate & Download ${documentType.charAt(0).toUpperCase() + documentType.slice(1)}`}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleSaveDraft}
              isLoading={isSavingDraft}
              leftIcon={Save}
            >
              Save as Draft
            </Button>
            <Button variant="ghost" size="lg" onClick={handleReset}>
              Clear Form
            </Button>
          </div>
        </div>
      )}

      {/* ──────────────── TAB 2: SAVED DOCUMENTS HISTORY ──────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="border border-base-300 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <Input
                  icon={Search}
                  placeholder="Search by document #, client name, or email..."
                  value={docSearch}
                  onChange={(e) => {
                    setDocSearch(e.target.value);
                    setDocPage(1);
                  }}
                />
              </div>

              <Select
                value={docTypeFilter}
                onChange={(e) => {
                  setDocTypeFilter(e.target.value);
                  setDocPage(1);
                }}
                className="w-auto"
              >
                <option value="">All Document Types</option>
                <option value="quotation">Quotations</option>
                <option value="invoice">Invoices</option>
                <option value="receipt">Receipts</option>
              </Select>

              <Select
                value={docStatusFilter}
                onChange={(e) => {
                  setDocStatusFilter(e.target.value);
                  setDocPage(1);
                }}
                className="w-auto"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </Select>

              <Button variant="outline" onClick={fetchSavedDocs} leftIcon={RotateCcw}>
                Refresh
              </Button>
            </div>
          </div>

          {/* Table */}
          {isLoadingDocs ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonBlock key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : savedDocs.length === 0 ? (
            <div className="border border-base-300 bg-white p-12 text-center">
              <EmptyState
                icon={FolderOpen}
                title="No documents found"
                description="Documents generated or saved as draft will be archived here."
              />
              <Button
                variant="primary"
                className="mt-4"
                onClick={() => setActiveTab('builder')}
                leftIcon={Plus}
              >
                Create Document
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-base-300 bg-white">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-base-300 text-xs uppercase tracking-[0.14em] text-neutral/60">
                    <th>Doc #</th>
                    <th>Type</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Total & Balance (₦)</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedDocs.map((doc) => (
                    <tr key={doc.id} className="hover">
                      <td>
                        <span className="font-mono text-sm font-semibold text-neutral block">
                          {doc.documentNumber}
                        </span>
                        {doc.documentType === 'receipt' && doc.relatedDocumentNumber && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setDocSearch(doc.relatedDocumentNumber);
                                setDocTypeFilter('invoice');
                              }}
                              className="inline-flex items-center gap-1 text-[11px] text-secondary font-medium hover:underline"
                              title={`Filter by parent invoice ${doc.relatedDocumentNumber}`}
                            >
                              <Link2 size={10} />
                              For: {doc.relatedDocumentNumber}
                            </button>
                          </div>
                        )}
                        {doc.documentType === 'receipt' && doc.paymentMethod && (
                          <div className="text-[10px] uppercase font-mono text-neutral/50">
                            {doc.paymentMethod.replace('_', ' ')}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="text-xs uppercase font-medium tracking-wider">
                          {doc.documentType}
                        </span>
                      </td>
                      <td>
                        <div>
                          <p className="font-semibold text-sm text-neutral">{doc.clientName}</p>
                          {doc.clientEmail && (
                            <p className="text-xs text-neutral/50">{doc.clientEmail}</p>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-sm">
                          {new Date(doc.createdAt).toLocaleDateString('en-NG')}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold text-sm text-neutral block">
                          ₦{(doc.totalAmount || 0).toLocaleString('en-NG', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        {doc.documentType === 'invoice' && (
                          <div className="mt-1 space-y-0.5 text-[11px]">
                            <span className="text-success font-medium block">
                              Paid: ₦{(doc.amountPaid || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 })}
                            </span>
                            {doc.balance > 0 && (
                              <span className="text-amber-800 font-medium block">
                                Bal: ₦{(doc.balance || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 })}
                              </span>
                            )}
                            {doc.linkedReceiptCount > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenLinkedReceipts(doc)}
                                className="inline-flex items-center gap-1 text-primary text-[10px] font-semibold hover:underline"
                              >
                                <Receipt size={11} />
                                {doc.linkedReceiptCount} receipt{doc.linkedReceiptCount > 1 ? 's' : ''}
                              </button>
                            )}
                          </div>
                        )}
                        {doc.documentType === 'receipt' && (
                          <div className="mt-1 text-[11px]">
                            <span className="text-success font-medium">
                              Received: ₦{(doc.amountPaid || doc.totalAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 })}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <select
                          value={doc.status}
                          onChange={(e) => handleStatusChange(doc.id, e.target.value)}
                          className={`badge text-xs font-semibold border-none py-1 px-2.5 cursor-pointer ${getDocStatusColor(doc.status)}`}
                        >
                          <option value="draft">Draft</option>
                          <option value="issued">Issued</option>
                          <option value="partially_paid">Partially Paid</option>
                          <option value="paid">Paid</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td>
                        <span className="text-xs text-neutral/60">
                          {doc.createdByName || 'Staff'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {doc.documentType === 'invoice' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Issue Receipt for this Invoice"
                              onClick={() => handleIssueReceiptFromInvoice(doc)}
                              className="text-secondary hover:bg-secondary/10"
                            >
                              <Receipt size={14} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Download PDF"
                            onClick={() => handleDownloadSaved(doc)}
                            isLoading={downloadingDocId === doc.id}
                          >
                            <Download size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Load into Builder to Edit or Revise"
                            onClick={() => handleLoadIntoBuilder(doc)}
                          >
                            <RotateCcw size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete Document"
                            onClick={() => handleDeleteDoc(doc)}
                            className="text-error hover:bg-error/10"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {docTotalPages > 1 && (
            <div className="flex justify-center pt-4">
              <Pagination
                currentPage={docPage}
                totalPages={docTotalPages}
                onPageChange={(page) => setDocPage(page)}
              />
            </div>
          )}
        </div>
      )}

      {/* ──────────────── MODAL: LINKED RECEIPTS ──────────────── */}
      {inspectingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-white border border-base-300 shadow-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-base-200 pb-3">
              <div>
                <h3 className="font-semibold text-lg text-neutral">
                  Receipts for Invoice{' '}
                  <span className="font-mono text-secondary">{inspectingInvoice.documentNumber}</span>
                </h3>
                <p className="text-xs text-neutral/60 mt-0.5">
                  Client: {inspectingInvoice.clientName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInspectingInvoice(null);
                  setLinkedReceiptsData(null);
                }}
                className="text-neutral/40 hover:text-neutral"
              >
                <X size={20} />
              </button>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-3 gap-3 bg-base-100 p-3 text-sm">
              <div>
                <span className="text-xs text-neutral/50 block">Invoice Total</span>
                <span className="font-bold text-neutral">
                  ₦{(inspectingInvoice.totalAmount || 0).toLocaleString('en-NG')}
                </span>
              </div>
              <div>
                <span className="text-xs text-neutral/50 block">Total Paid</span>
                <span className="font-bold text-success">
                  ₦{(inspectingInvoice.amountPaid || 0).toLocaleString('en-NG')}
                </span>
              </div>
              <div>
                <span className="text-xs text-neutral/50 block">Remaining Balance</span>
                <span
                  className={`font-bold ${
                    inspectingInvoice.balance > 0 ? 'text-amber-800' : 'text-success'
                  }`}
                >
                  ₦{(inspectingInvoice.balance || 0).toLocaleString('en-NG')}
                </span>
              </div>
            </div>

            {/* Receipts List */}
            {isLoadingLinked ? (
              <div className="py-8 text-center text-sm text-neutral/60">
                Loading linked receipts...
              </div>
            ) : !linkedReceiptsData?.receipts || linkedReceiptsData.receipts.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-base-300">
                <p className="text-sm text-neutral/60">No receipts issued for this invoice yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-base-300">
                <table className="table w-full text-xs">
                  <thead>
                    <tr className="bg-base-200/50">
                      <th>Receipt #</th>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Ref</th>
                      <th className="text-right">Amount Received</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedReceiptsData.receipts.map((r) => (
                      <tr key={r.id} className="hover">
                        <td className="font-mono font-semibold">{r.documentNumber}</td>
                        <td>{new Date(r.createdAt).toLocaleDateString('en-NG')}</td>
                        <td className="capitalize font-mono">
                          {(r.paymentMethod || 'transfer').replace('_', ' ')}
                        </td>
                        <td className="text-neutral/60">{r.paymentReference || '—'}</td>
                        <td className="text-right font-bold text-success">
                          ₦{(r.amountPaid || r.totalAmount || 0).toLocaleString('en-NG')}
                        </td>
                        <td className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Download Receipt PDF"
                            onClick={() => handleDownloadSaved(r)}
                            isLoading={downloadingDocId === r.id}
                          >
                            <Download size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-base-200">
              <Button
                variant="primary"
                size="sm"
                leftIcon={Plus}
                onClick={() => {
                  const inv = inspectingInvoice;
                  setInspectingInvoice(null);
                  setLinkedReceiptsData(null);
                  handleIssueReceiptFromInvoice(inv);
                }}
              >
                Issue Another Receipt
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInspectingInvoice(null);
                  setLinkedReceiptsData(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
};

export default DocumentBuilder;
