// src/components/animations/AnimatedCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { luxuryEase } from '../../lib/animations';

const AnimatedCard = ({
  children,
  className = '',
  index = 0,
  hoverLift = true,
  ...props
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      whileInView={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.6,
        ease: luxuryEase,
        delay: index * 0.1,
      }}
      whileHover={
        hoverLift
          ? {
              y: -6,
              transition: { duration: 0.35, ease: luxuryEase },
            }
          : undefined
      }
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedCard;
