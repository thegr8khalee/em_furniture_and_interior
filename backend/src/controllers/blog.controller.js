import BlogPost from '../models/blogPost.model.js';

const slugify = (value) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const buildUniqueSlug = async (title) => {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 1;

  while (await BlogPost.findOne({ slug })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

export const getBlogPosts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(parseInt(req.query.limit || '12', 10), 50);
    const skip = (page - 1) * limit;

    const query = { status: 'published' };

    const [items, total] = await Promise.all([
      BlogPost.find(query)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BlogPost.countDocuments(query),
    ]);

    res.status(200).json({ items, total, page, limit });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ message: 'Failed to fetch blog posts.' });
  }
};

export const getBlogPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const post = await BlogPost.findOne({ slug, status: 'published' }).lean();

    if (!post) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    res.status(200).json(post);
  } catch (error) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({ message: 'Failed to fetch blog post.' });
  }
};

export const adminListBlogPosts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      BlogPost.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BlogPost.countDocuments({}),
    ]);

    res.status(200).json({ items, total, page, limit });
  } catch (error) {
    console.error('Error fetching admin blog list:', error);
    res.status(500).json({ message: 'Failed to fetch blog posts.' });
  }
};

export const createBlogPost = async (req, res) => {
  try {
    const { title, excerpt, content, coverImage, tags, status } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required.' });
    }

    const slug = await buildUniqueSlug(title);
    const normalizedStatus = status === 'published' ? 'published' : 'draft';

    const post = await BlogPost.create({
      title,
      slug,
      excerpt: excerpt || '',
      content,
      coverImage,
      tags: Array.isArray(tags) ? tags : [],
      status: normalizedStatus,
      publishedAt: normalizedStatus === 'published' ? new Date() : null,
      author: req.admin?._id,
    });

    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.status(500).json({ message: 'Failed to create blog post.' });
  }
};

export const updateBlogPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, excerpt, content, coverImage, tags, status } = req.body;

    const post = await BlogPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    if (title && title !== post.title) {
      post.title = title;
      post.slug = await buildUniqueSlug(title);
    }

    if (excerpt !== undefined) post.excerpt = excerpt;
    if (content !== undefined) post.content = content;
    if (coverImage !== undefined) post.coverImage = coverImage;
    if (tags !== undefined) post.tags = Array.isArray(tags) ? tags : [];

    if (status) {
      const normalizedStatus = status === 'published' ? 'published' : 'draft';
      post.status = normalizedStatus;
      if (normalizedStatus === 'published' && !post.publishedAt) {
        post.publishedAt = new Date();
      }
      if (normalizedStatus === 'draft') {
        post.publishedAt = null;
      }
    }

    await post.save();

    res.status(200).json(post);
  } catch (error) {
    console.error('Error updating blog post:', error);
    res.status(500).json({ message: 'Failed to update blog post.' });
  }
};

export const deleteBlogPost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await BlogPost.findByIdAndDelete(id);

    if (!post) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    res.status(200).json({ message: 'Blog post deleted successfully.' });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ message: 'Failed to delete blog post.' });
  }
};
