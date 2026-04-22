import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useBlogStore } from '../store/useBlogStore';
import { motion } from 'framer-motion';
import { luxuryEase } from '../lib/animations';
import { PageWrapper, FadeIn } from '../components/animations';
import SEO from '../components/SEO';
import { breadcrumbJsonLd } from '../lib/seo';

const Blog = () => {
  const { posts, isLoading, getBlogPosts } = useBlogStore();

  useEffect(() => {
    getBlogPosts(1, 12);
  }, [getBlogPosts]);

  return (
    <PageWrapper>
    <SEO
      title="Inspiration & Interior Design Blog"
      description="Interior design ideas, styling tips, and behind-the-scenes stories from EM Furniture & Interior. Learn how to transform every room of your home with luxury furniture."
      keywords="interior design blog, home styling tips, furniture inspiration, luxury decor Nigeria"
      canonical="/blog"
      jsonLd={breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blog' },
      ])}
    />
    <div className="bg-base-100 min-h-screen pt-28 lg:pt-32 pb-16">
      <div className="max-w-6xl mx-auto px-5">
        <FadeIn>
        <div className="mb-10">
          <h1 className="text-4xl lg:text-5xl font-medium font-heading text-primary">
            Inspiration & Blog
          </h1>
          <p className="text-neutral/70 mt-3 max-w-2xl">
            Ideas, styling tips, and behind-the-scenes stories from EM Furniture
            & Interior.
          </p>
        </div>
        </FadeIn>

        {isLoading ? (
          <div className="text-center p-8">Loading blog posts...</div>
        ) : posts.length === 0 ? (
          <div className="text-center p-10 bg-base-200 rounded-none">
            <p className="text-neutral/70">No blog posts yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, index) => (
              <motion.div
                key={post._id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1, ease: luxuryEase }}
                whileHover={{ y: -5, boxShadow: '0 16px 32px rgba(0,0,0,0.1)' }}
              >
              <Link
                to={`/blog/${post.slug}`}
                className="group bg-base-200 rounded-none overflow-hidden border border-base-300 hover:shadow-lg transition-all duration-300 block h-full"
              >
                {post.coverImage?.url ? (
                  <img
                    src={post.coverImage.url}
                    alt={post.title}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="h-44 bg-base-300" />
                )}
                <div className="p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-secondary">
                    {post.tags?.[0] || 'Inspiration'}
                  </p>
                  <h3 className="text-xl font-semibold mt-2 group-hover:text-secondary transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-sm text-neutral/70 mt-2 line-clamp-3">
                    {post.excerpt || post.content?.slice(0, 140) + '...'}
                  </p>
                  {post.publishedAt && (
                    <p className="text-xs text-neutral/50 mt-4">
                      {new Date(post.publishedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
    </PageWrapper>
  );
};

export default Blog;
