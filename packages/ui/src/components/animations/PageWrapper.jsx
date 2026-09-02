// src/components/animations/PageWrapper.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { luxuryEase } from '../../lib/animations';

const PageWrapper = ({ children, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: luxuryEase }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default PageWrapper;
