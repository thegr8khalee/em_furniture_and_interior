// src/components/animations/StaggerItem.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { luxuryEase } from '../../lib/animations';

const StaggerItem = ({
  children,
  className = '',
  direction = 'up',
  ...props
}) => {
  const offsets = {
    up: { y: 30, x: 0 },
    down: { y: -30, x: 0 },
    left: { x: -30, y: 0 },
    right: { x: 30, y: 0 },
    scale: { scale: 0.95, y: 15 },
  };

  const offset = offsets[direction] || offsets.up;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, ...offset },
        visible: {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          transition: { duration: 0.6, ease: luxuryEase },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default StaggerItem;
