import React, { useEffect, useMemo, useState } from 'react';
import { useFaqStore } from '../../store/useFaqStore';
import { HelpCircle, Edit2, Trash2 } from 'lucide-react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { SkeletonBlock } from '../ui/Skeleton';

const emptyForm = {
  question: '',
  answer: '',
  order: 0,
  isActive: true,
};

const FAQManagement = () => {
  const { faqs, isLoading, adminListFAQs, createFAQ, updateFAQ, deleteFAQ } =
    useFaqStore();

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    adminListFAQs();
  }, [adminListFAQs]);

  const isEditing = useMemo(() => Boolean(editingId), [editingId]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (faq) => {
    setEditingId(faq._id);
    setForm({
      question: faq.question || '',
      answer: faq.answer || '',
      order: faq.order || 0,
      isActive: faq.isActive !== false,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      order: Number(form.order) || 0,
      isActive: form.isActive,
    };

    if (isEditing) {
      const updated = await updateFAQ(editingId, payload);
      if (updated) {
        await adminListFAQs();
        resetForm();
      }
      return;
    }

    const created = await createFAQ(payload);
    if (created) {
      await adminListFAQs();
      resetForm();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this FAQ?')) return;
    const ok = await deleteFAQ(id);
    if (ok) {
      adminListFAQs();
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold text-neutral">Manage FAQs</h2>

      <form
        onSubmit={handleSubmit}
        className="border border-base-300 bg-white p-5 space-y-4"
      >
        <Input label="Question" name="question" value={form.question} onChange={handleChange} required />

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Answer</label>
          <textarea name="answer" value={form.answer} onChange={handleChange} className="w-full border border-base-300 bg-white px-4 py-3 text-sm text-neutral transition-colors duration-300 placeholder:text-neutral/40 focus:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30" rows={4} required />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Order" type="number" name="order" value={form.order} onChange={handleChange} />
          <div className="flex items-center gap-3 pt-6">
            <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} className="checkbox checkbox-sm" />
            <span className="text-sm text-neutral">Active</span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" variant="primary">
            {isEditing ? 'Update FAQ' : 'Create FAQ'}
          </Button>
          {isEditing && (
            <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
          )}
        </div>
      </form>

      <div className="border border-base-300 bg-white">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-16 w-full" />)}
          </div>
        ) : faqs.length === 0 ? (
          <EmptyState icon={HelpCircle} title="No FAQs" description="Create your first FAQ above." />
        ) : (
          <div className="divide-y divide-base-200">
            {faqs.map((faq) => (
              <div key={faq._id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-medium text-neutral">{faq.question}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={faq.isActive ? 'success' : 'neutral'}>
                      {faq.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <span className="text-xs text-neutral/50">Order: {faq.order || 0}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" leftIcon={Edit2} onClick={() => handleEdit(faq)}>Edit</Button>
                  <Button variant="danger" size="sm" leftIcon={Trash2} onClick={() => handleDelete(faq._id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FAQManagement;
