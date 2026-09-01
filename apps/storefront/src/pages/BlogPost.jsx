import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useBlogStore } from '../store/useBlogStore';
import { motion } from 'framer-motion';
import { elegantEase } from '../lib/animations';
import { PageWrapper, FadeIn } from '../components/animations';
import SEO from '../components/SEO';
import { articleJsonLd, breadcrumbJsonLd, truncate } from '../lib/seo';

const BlogPost = () => {
  const { slug } = useParams();
  const { activePost, isLoading, getBlogPostBySlug } = useBlogStore();

  useEffect(() => {
    getBlogPostBySlug(slug);
  }, [getBlogPostBySlug, slug]);

  if (isLoading) {
    return <div className="pt-28 text-center p-8">Loading post...</div>;
  }

  if (!activePost) {
    return (
      <div className="pt-28 text-center p-8">
        <p>Post not found.</p>
        <Link to="/blog" className="text-secondary underline">
          Back to blog
        </Link>
      </div>
    );
  }

  return (
    <PageWrapper>
    <SEO
      title={activePost.title}
      description={truncate(activePost.excerpt || activePost.content || '', 160)}
      image={activePost.coverImage?.url}
      imageAlt={activePost.title}
      type="article"
      canonical={`/blog/${activePost.slug}`}
      keywords={(activePost.tags || []).join(', ')}
      jsonLd={[
        articleJsonLd(activePost),
        breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
          { name: activePost.title, path: `/blog/${activePost.slug}` },
        ]),
      ]}
    />
    <div className="bg-base-100 min-h-screen pt-28 lg:pt-32 pb-16">
      <div className="max-w-4xl mx-auto px-5">
        <Link to="/blog" className="text-sm text-secondary">
          Back to blog
        </Link>
        <motion.h1 className="text-4xl lg:text-5xl font-bold font-heading text-primary mt-4" initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.8, delay: 0.2, ease: elegantEase }}>
          {activePost.title}
        </motion.h1>
        {activePost.publishedAt && (
          <p className="text-sm text-neutral/60 mt-2">
            {new Date(activePost.publishedAt).toLocaleDateString()}
          </p>
        )}
        {activePost.coverImage?.url && (
          <img
            src={activePost.coverImage.url}
            alt={activePost.title}
            className="w-full h-72 object-cover mt-6 rounded-none"
          />
        )}
        <FadeIn>
        <div className="mt-8 text-base leading-7 text-neutral/80 whitespace-pre-line">
          {activePost.content}
        </div>
        </FadeIn>
      </div>
    </div>
    </PageWrapper>
  );
};

export default BlogPost;
