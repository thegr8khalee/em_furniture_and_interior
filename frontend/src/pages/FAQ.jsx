import React, { useEffect } from 'react';
import { useFaqStore } from '../store/useFaqStore';
import { motion } from 'framer-motion';
import { luxuryEase } from '../lib/animations';
import { PageWrapper, FadeIn } from '../components/animations';
import SEO from '../components/SEO';
import { faqJsonLd, breadcrumbJsonLd } from '../lib/seo';

const FAQ = () => {
  const { faqs, isLoading, getFAQs } = useFaqStore();

  useEffect(() => {
    getFAQs();
  }, [getFAQs]);

  return (
    <PageWrapper>
    <SEO
      title="Frequently Asked Questions"
      description="Answers to common questions about EM Furniture & Interior — ordering, shipping, installation, returns, and bespoke design."
      canonical="/faqs"
      jsonLd={[
        faqs.length > 0 ? faqJsonLd(faqs) : null,
        breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'FAQs', path: '/faqs' },
        ]),
      ]}
    />
    <div className="bg-base-100 min-h-screen pt-28 lg:pt-32 pb-16">
      <div className="max-w-4xl mx-auto px-5">
        <FadeIn>
        <div className="mb-10">
          <h1 className="text-4xl lg:text-5xl font-medium font-heading text-primary">
            FAQs
          </h1>
          <p className="text-neutral/70 mt-3">
            Answers to common questions about our furniture and services.
          </p>
        </div>
        </FadeIn>

        {isLoading ? (
          <div className="text-center p-8">Loading FAQs...</div>
        ) : faqs.length === 0 ? (
          <div className="text-center p-10 bg-base-200 rounded-none">
            <p className="text-neutral/70">No FAQs available yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={faq._id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1, ease: luxuryEase }}
                className="collapse collapse-arrow bg-base-200 rounded-none"
              >
                <input type="checkbox" />
                <div className="collapse-title text-lg font-semibold">
                  {faq.question}
                </div>
                <div className="collapse-content text-neutral/70">
                  <p>{faq.answer}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
    </PageWrapper>
  );
};

export default FAQ;
