import React, { useEffect, useMemo, useState } from 'react';
import { useBlogStore } from '../../store/useBlogStore';
import { FileText, Edit2, Trash2 } from 'lucide-react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { SkeletonBlock } from '../ui/Skeleton';

const emptyForm = {
  title: '',
  excerpt: '',
  content: '',
  tags: '',
  status: 'draft',
  coverImageUrl: '',
};

const BlogManagement = () => {
  const {
    posts,
    isLoading,
    adminListBlogPosts,
    createBlogPost,
    updateBlogPost,
    deleteBlogPost,
  } = useBlogStore();

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    adminListBlogPosts();
  }, [adminListBlogPosts]);

  const isEditing = useMemo(() => Boolean(editingId), [editingId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (post) => {
    setEditingId(post._id);
    setForm({
      title: post.title || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      tags: (post.tags || []).join(', '),
      status: post.status || 'draft',
      coverImageUrl: post.coverImage?.url || '',
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      title: form.title.trim(),
      excerpt: form.excerpt.trim(),
      content: form.content.trim(),
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      status: form.status,
      coverImage: form.coverImageUrl
        ? { url: form.coverImageUrl }
        : undefined,
    };

    if (isEditing) {
      const updated = await updateBlogPost(editingId, payload);
      if (updated) {
        await adminListBlogPosts();
        resetForm();
      }
      return;
    }

    const created = await createBlogPost(payload);
    if (created) {
      await adminListBlogPosts();
      resetForm();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this blog post?')) return;
    const ok = await deleteBlogPost(id);
    if (ok) {
      adminListBlogPosts();
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold text-neutral">Manage Blog</h2>

      <form
        onSubmit={handleSubmit}
        className="border border-base-300 bg-white p-5 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Title" name="title" value={form.title} onChange={handleChange} required />
          <Select label="Status" name="status" value={form.status} onChange={handleChange}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Excerpt</label>
          <textarea name="excerpt" value={form.excerpt} onChange={handleChange} className="w-full border border-base-300 bg-white px-4 py-3 text-sm text-neutral transition-colors duration-300 placeholder:text-neutral/40 focus:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30" rows={2} />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Content</label>
          <textarea name="content" value={form.content} onChange={handleChange} className="w-full border border-base-300 bg-white px-4 py-3 text-sm text-neutral transition-colors duration-300 placeholder:text-neutral/40 focus:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30" rows={6} required />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Tags (comma-separated)" name="tags" value={form.tags} onChange={handleChange} />
          <Input label="Cover Image URL" name="coverImageUrl" value={form.coverImageUrl} onChange={handleChange} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" variant="primary">
            {isEditing ? 'Update Post' : 'Create Post'}
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
        ) : posts.length === 0 ? (
          <EmptyState icon={FileText} title="No blog posts" description="Create your first blog post above." />
        ) : (
          <div className="divide-y divide-base-200">
            {posts.map((post) => (
              <div key={post._id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-medium text-neutral">{post.title}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge status={post.status === 'published' ? 'delivered' : 'pending'}>
                      {post.status}
                    </Badge>
                    <span className="text-xs text-neutral/50">
                      {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Not published'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" leftIcon={Edit2} onClick={() => handleEdit(post)}>Edit</Button>
                  <Button variant="danger" size="sm" leftIcon={Trash2} onClick={() => handleDelete(post._id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogManagement;
