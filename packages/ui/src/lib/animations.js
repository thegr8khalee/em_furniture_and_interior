// src/lib/animations.js
// Luxurious Framer Motion animation presets for EM Furniture & Interior

// ─── Easing Curves ───
// Custom cubic-bezier curves crafted for a premium, silky feel
export const luxuryEase = [0.25, 0.1, 0.25, 1]; // smooth deceleration
export const elegantEase = [0.6, 0.01, 0.05, 0.95]; // dramatic slow-in, slow-out
export const softBounce = [0.34, 1.56, 0.64, 1]; // subtle overshoot
export const silkEase = [0.43, 0.13, 0.23, 0.96]; // silk-like motion

// ─── Transition Presets ───
export const luxuryTransition = {
  duration: 0.8,
  ease: luxuryEase,
};

export const elegantTransition = {
  duration: 1,
  ease: elegantEase,
};

export const slowReveal = {
  duration: 1.2,
  ease: silkEase,
};

export const springTransition = {
  type: 'spring',
  stiffness: 100,
  damping: 15,
  mass: 0.8,
};

export const gentleSpring = {
  type: 'spring',
  stiffness: 60,
  damping: 20,
  mass: 1,
};

// ─── Fade Variants ───
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: luxuryTransition,
  },
};

export const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: luxuryTransition,
  },
};

export const fadeInDown = {
  hidden: { opacity: 0, y: -40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: luxuryTransition,
  },
};

export const fadeInLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: elegantTransition,
  },
};

export const fadeInRight = {
  hidden: { opacity: 0, x: 60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: elegantTransition,
  },
};

// ─── Scale Variants ───
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: elegantTransition,
  },
};

export const scaleInSoft = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: luxuryTransition,
  },
};

// ─── Reveal / Slide Variants ───
export const slideUp = {
  hidden: { y: 80, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: slowReveal,
  },
};

export const slideDown = {
  hidden: { y: -60, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: luxuryTransition,
  },
};

export const curtainReveal = {
  hidden: { scaleY: 0, originY: 1 },
  visible: {
    scaleY: 1,
    transition: {
      duration: 0.9,
      ease: elegantEase,
    },
  },
};

// ─── Stagger Container Variants ───
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerSlow = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.15,
    },
  },
};

export const staggerContainerFast = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

// ─── Card / Item Variants (for use inside stagger containers) ───
export const cardItem = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: luxuryEase,
    },
  },
};

export const cardItemScale = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.7,
      ease: luxuryEase,
    },
  },
};

// ─── Hero Variants ───
export const heroText = {
  hidden: { opacity: 0, y: 50, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 1.2,
      ease: elegantEase,
    },
  },
};

export const heroSubtext = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 1,
      ease: elegantEase,
      delay: 0.3,
    },
  },
};

export const heroButtons = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: luxuryEase,
      delay: 0.6,
    },
  },
};

// ─── Section Header Variants ───
export const sectionLabel = {
  hidden: { opacity: 0, y: 15, letterSpacing: '0.1em' },
  visible: {
    opacity: 1,
    y: 0,
    letterSpacing: '0.2em',
    transition: {
      duration: 0.8,
      ease: luxuryEase,
    },
  },
};

export const sectionTitle = {
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.9,
      ease: elegantEase,
      delay: 0.1,
    },
  },
};

export const dividerExpand = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: {
    scaleX: 1,
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: elegantEase,
      delay: 0.2,
    },
  },
};

// ─── Navbar Variants ───
export const navbarSlide = {
  hidden: { y: -100, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.7,
      ease: luxuryEase,
    },
  },
};

// ─── Page Transition Variants ───
export const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: luxuryEase,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.3,
      ease: luxuryEase,
    },
  },
};

// ─── Image Reveal ───
export const imageReveal = {
  hidden: { opacity: 0, scale: 1.05 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 1,
      ease: silkEase,
    },
  },
};

// ─── Hover Animation Helpers ───
export const luxuryHover = {
  scale: 1.02,
  transition: {
    duration: 0.4,
    ease: luxuryEase,
  },
};

export const luxuryTap = {
  scale: 0.98,
  transition: {
    duration: 0.15,
  },
};

// ─── Floating / Parallax ───
export const floatingAnimation = {
  y: [0, -8, 0],
  transition: {
    duration: 4,
    ease: 'easeInOut',
    repeat: Infinity,
  },
};

// ─── Gold Line Draw ───
export const goldLineDraw = {
  hidden: { width: 0, opacity: 0 },
  visible: {
    width: '2.5rem',
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: elegantEase,
      delay: 0.3,
    },
  },
};

// ─── Counter / Number Reveal ───
export const numberReveal = {
  hidden: { opacity: 0, y: 20, scale: 0.8 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: softBounce,
    },
  },
};

// ─── Footer Variants ───
export const footerReveal = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: luxuryEase,
    },
  },
};

export const footerStagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export const footerItem = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: luxuryEase,
    },
  },
};
