// src/components/animations/StaggerContainer.jsx
import React from 'react';
import { motion } from 'framer-motion';

const StaggerContainer = ({
  children,
  staggerDelay = 0.12,
  delayChildren = 0.1,
  className = '',
  once = true,
  amount = 0.2,
  ...props
}) => {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren,
          },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default StaggerContainer;
