// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

void motion;

import { useProductsStore } from '../store/useProductsStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore } from '../store/useProjectsStore';
import ProjectCardHome from '../components/ProjectCardHome';
import {
  PageWrapper,
  FadeIn,
  SectionReveal,
  AnimatedCard,
  GoldDivider,
  SlideIn,
} from '../components/animations';
import { ProductCardSkeleton } from '../components/ui';
import {
  heroText,
  heroSubtext,
  heroButtons,
  elegantEase,
  luxuryEase,
} from '../lib/animations';
import SEO from '../components/SEO';
import {
  organizationJsonLd,
  localBusinessJsonLd,
  websiteJsonLd,
} from '../lib/seo';

const HomePage = () => {
  const heroImages = [
    'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png',
    'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787006/Hero2_mnsyx3.png',
    'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787005/Hero3_mmltlv.png',
    'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787010/Hero4_d42fq3.png',
    'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787007/Hero5_kcqj5j.png',
  ];
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideIntervalTime = 5000;

  const nextSlide = () => {
    setCurrentSlide((prevSlide) =>
      prevSlide === heroImages.length - 1 ? 0 : prevSlide + 1,
    );
  };

  useEffect(() => {
    const interval = setInterval(() => nextSlide(), slideIntervalTime);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlide]);

  const designs = [
    {
      id: '1',
      name: 'Modern',
      link: 'modern',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787010/sofa_k5et34.jpg',
    },
    {
      id: '2',
      name: 'Contemporary',
      link: 'contemporary',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787001/contemporary_uunph9.jpg',
    },
    {
      id: '3',
      name: 'Antique/Royal',
      link: 'antique%2Froyal',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786997/antique_ktxajm.jpg',
    },
    {
      id: '4',
      name: 'Bespoke',
      link: 'bespoke',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786997/bespoke_bs55kv.jpg',
    },
    {
      id: '5',
      name: 'Minimalist',
      link: 'minimalist',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787007/minimalist_c5zk8r.jpg',
    },
    {
      id: '6',
      name: 'Glam',
      link: 'glam',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787006/Livingroom_dahbsh.png',
    },
  ];

  const { products, getProducts, isGettingProducts } = useProductsStore();
  const { collections, getCollections, isGettingCollections } =
    useCollectionStore();
  const {
    fetchProjects,
    loading: LoadingProjects,
    projects,
  } = useProjectsStore();

  const promotionProducts = products.filter((p) => p.isPromo);
  const BestSeller = products.filter((p) => p.isBestSeller);

  useEffect(() => {
    if (products.length === 0) getProducts(1, 10, {}, false);
    if (collections.length === 0) getCollections(1, 10, {}, false);
    if (projects.length === 0) fetchProjects(1, 10);
  }, [
    getProducts,
    getCollections,
    fetchProjects,
    products.length,
    collections.length,
    projects.length,
  ]);

  const categories = [
    {
      id: '1',
      name: 'Sofas',
      link: 'Living%20Room',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787010/sofa_k5et34.jpg',
    },
    {
      id: '2',
      name: 'Armchairs',
      link: 'Armchair',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787010/Panama-Armchair_djdgqt.jpg',
    },
    {
      id: '3',
      name: 'Living Rooms',
      link: 'Living%20Room',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787006/Livingroom_dahbsh.png',
    },
    {
      id: '4',
      name: 'Bedrooms',
      link: 'Bedroom',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787010/Modern_Bedroom_design_gvw20n.jpg',
    },
    {
      id: '5',
      name: 'Dining Rooms',
      link: 'Dining%20Room',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787002/Dining_reagth.jpg',
    },
    {
      id: '6',
      name: 'Center Tables',
      link: 'Center%20Table',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787001/center_i487sg.jpg',
    },
    {
      id: '7',
      name: 'Wardrobe',
      link: 'Wardrobe',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/wardrobe_j5c6to.jpg',
    },
    {
      id: '8',
      name: 'TV Unit',
      link: 'TV%20unit',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/TV_unit_goevgl.jpg',
    },
    {
      id: '9',
      name: 'Carpets',
      link: 'Carpet',
      image:
        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786997/carpets_bdy56z.jpg',
    },
  ];

  const navigate = useNavigate();

  const nav = (path) => {
    navigate(path);
    setTimeout(() => window.scrollTo(0, 0), 10);
  };

  if (isGettingProducts || isGettingCollections || LoadingProjects) {
    return (
      <PageWrapper className="min-h-screen bg-white">
        <section className="content-shell section-shell">
          <div className="mb-8 flex flex-col items-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-secondary" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              Preparing the showroom
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-primary">
              Curating your experience
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        </section>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="min-h-screen bg-white">
      <SEO
        title="Luxury Furniture & Bespoke Interior Design in Nigeria"
        description="Transform your space with EM Furniture & Interior — luxury sofas, bedrooms, dining sets, wardrobes, and bespoke interior design from Kaduna, Nigeria. Worldwide shipping, quality assured, free installation."
        keywords="luxury furniture Nigeria, interior design Kaduna, bespoke furniture, sofas, bedrooms, dining rooms, wardrobes, EM Furniture"
        canonical="/"
        jsonLd={[organizationJsonLd(), localBusinessJsonLd(), websiteJsonLd()]}
      />
      {/* ===== Hero Section ===== */}
      <section className="relative w-full h-[85vh] lg:h-screen overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentSlide}
            src={heroImages[currentSlide]}
            alt={`Hero Slide ${currentSlide + 1}`}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: elegantEase }}
          />
        </AnimatePresence>
        {/* accent image temporarily removed */}
        {/* Overlay */}
        <div className="absolute inset-0 bg-primary/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

        {/* Hero Content */}
        <div className="absolute inset-0 flex flex-col justify-end pb-24 sm:pb-28 lg:pb-32 px-6 sm:px-10 lg:px-20">
          <div className="max-w-2xl">
            <motion.h1
              variants={heroText}
              initial="hidden"
              animate="visible"
              className="font-heading text-3xl sm:text-4xl lg:text-6xl font-medium text-white leading-tight mb-3"
            >
              Transforming{' '}
              <span className="text-secondary italic font-light">Spaces.</span>
            </motion.h1>
            <motion.h1
              variants={heroText}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
              className="font-heading text-3xl sm:text-4xl lg:text-6xl font-medium text-white leading-tight mb-3"
            >
              Elevating{' '}
              <span className="text-secondary italic font-light">Lives.</span>
            </motion.h1>
            <motion.p
              variants={heroSubtext}
              initial="hidden"
              animate="visible"
              className="text-white text-lg sm:text-xl tracking-wide mb-8 max-w-md"
            >
              Elevating lives through exceptional craftsmanship and timeless
              design.
            </motion.p>
            <motion.div
              variants={heroButtons}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap gap-3"
            >
              <motion.button
                onClick={() => nav('/shop')}
                className="btn-elegant border-secondary bg-secondary px-8 py-3.5 text-primary hover:bg-white"
                whileHover={{
                  scale: 1.04,
                  boxShadow: '0 8px 25px rgba(201,168,76,0.3)',
                }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.3 }}
              >
                Shop Now
              </motion.button>
              <motion.button
                onClick={() => nav('/contact')}
                className="btn-elegant border-white/40 text-white hover:bg-white hover:text-primary px-8 py-3.5"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.3 }}
              >
                Contact Us
              </motion.button>
            </motion.div>
          </div>
        </div>

        {/* Slide Indicators */}
        <motion.div
          className="absolute bottom-8 left-6 sm:left-10 lg:left-20 flex gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6, ease: luxuryEase }}
        >
          {heroImages.map((_, index) => (
            <motion.button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`rounded-full ${index === currentSlide ? 'w-8 h-1.5 bg-secondary' : 'w-4 h-1.5 bg-white/40 hover:bg-white/60'}`}
              aria-label={`Go to slide ${index + 1}`}
              animate={{ width: index === currentSlide ? 32 : 16 }}
              transition={{ duration: 0.4, ease: luxuryEase }}
            />
          ))}
        </motion.div>
      </section>

      {/* ===== Trust Bar ===== */}
      <SectionReveal className="bg-primary py-6 sm:py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-around px-4">
          {[
            {
              img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786997/worldwide-shipping_by9zox.png',
              text: 'Worldwide Shipping',
            },
            {
              img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/verify_vnl0hf.png',
              text: 'Quality Assured',
            },
            {
              img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787002/easy-installation_dmiwxi.png',
              text: 'Free Installation',
            },
          ].map((item, i) => (
            <FadeIn
              key={item.text}
              direction="up"
              delay={i * 0.15}
              duration={0.7}
            >
              <div className="flex flex-col items-center gap-2">
                <img
                  src={item.img}
                  alt={item.text}
                  className="w-8 h-8 sm:w-10 sm:h-10 opacity-80"
                />
                <span className="text-white/80 text-[10px] sm:text-xs font-medium tracking-wider uppercase">
                  {item.text}
                </span>
              </div>
            </FadeIn>
          ))}
        </div>
      </SectionReveal>

      {/* Promotions are now shown in the rotating top bar above the navbar. */}

      {/* ===== Featured Projects ===== */}
      {projects.length > 0 && (
        <SectionReveal className="py-16 sm:py-20 px-6 sm:px-10 lg:px-20">
          <div className="flex justify-between items-end mb-8">
            <FadeIn direction="left">
              <div>
                <span className="text-xs font-medium tracking-[0.2em] uppercase text-secondary">
                  Portfolio
                </span>
                <h2 className="font-heading text-3xl sm:text-4xl font-medium text-neutral mt-1">
                  Featured Projects
                </h2>
              </div>
            </FadeIn>
            <FadeIn direction="right" delay={0.2}>
              <motion.button
                onClick={() => nav('/projects')}
                className="text-secondary text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all"
                whileHover={{ x: 5 }}
                transition={{ duration: 0.3 }}
              >
                View All <ArrowRight size={14} />
              </motion.button>
            </FadeIn>
          </div>
          <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4">
            {projects.map((project, index) => (
              <AnimatedCard
                key={project._id}
                index={index}
                hoverLift={false}
                className="flex-shrink-0"
              >
                <ProjectCardHome project={project} />
              </AnimatedCard>
            ))}
          </div>
        </SectionReveal>
      )}

      {/* ===== Browse Categories ===== */}
      <SectionReveal className="py-16 sm:py-20 px-6 sm:px-10 lg:px-20 bg-base-200">
        <div className="text-center mb-10">
          <FadeIn direction="up">
            <span className="text-xs font-medium tracking-[0.2em] uppercase text-secondary">
              Explore
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-medium text-neutral mt-1">
              Browse by Category
            </h2>
          </FadeIn>
          <GoldDivider className="mt-4" />
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
          {categories.map((category, index) => (
            <AnimatedCard key={category.id} index={index} hoverLift={false}>
              <motion.button
                className="relative flex-shrink-0 w-64 sm:w-76 h-76 sm:h-84 overflow-hidden group"
                onClick={() => nav(`/shop?category=${category.link}`)}
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.4, ease: luxuryEase }}
              >
                <motion.img
                  src={category.image}
                  alt={category.name}
                  className="object-cover w-full h-full"
                  whileHover={{ scale: 1.08 }}
                  transition={{ duration: 0.6, ease: luxuryEase }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent group-hover:from-black/70 transition-all duration-300" />
                <div className="absolute text-start bottom-0 left-0 right-0 p-4">
                  <h3 className="text-white text-lg sm:text-xl font-medium tracking-wide">
                    {category.name}
                  </h3>
                  <motion.div
                    className="h-0.5 bg-secondary mt-2"
                    initial={{ width: '1.5rem' }}
                    whileHover={{ width: '2.5rem' }}
                    transition={{ duration: 0.3 }}
                    style={{ width: '1.5rem' }}
                  />
                </div>
              </motion.button>
            </AnimatedCard>
          ))}
        </div>
      </SectionReveal>

      {/* ===== Promotions ===== */}
      {promotionProducts.length !== 0 && (
        <SectionReveal className="py-16 sm:py-20 px-6 sm:px-10 lg:px-20">
          <div className="flex justify-between items-end mb-8">
            <FadeIn direction="left">
              <div>
                <span className="text-xs font-medium tracking-[0.2em] uppercase text-secondary">
                  Special Offers
                </span>
                <h2 className="font-heading text-3xl sm:text-4xl font-medium text-neutral mt-1">
                  Promotions
                </h2>
              </div>
            </FadeIn>
            <FadeIn direction="right" delay={0.2}>
              <motion.button
                onClick={() => nav('/shop')}
                className="text-secondary text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all"
                whileHover={{ x: 5 }}
                transition={{ duration: 0.3 }}
              >
                Shop All <ArrowRight size={14} />
              </motion.button>
            </FadeIn>
          </div>
          <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4">
            {promotionProducts.map((product, index) => (
              <AnimatedCard
                key={product._id}
                index={index}
                className="flex-shrink-0 w-64 sm:w-72 group cursor-pointer"
                onClick={() => nav(`/product/${product._id}`)}
              >
                <div className="relative overflow-hidden">
                  <motion.img
                    src={product?.images[0]?.url}
                    alt={product.name}
                    className="w-full h-56 sm:h-64 object-cover"
                    whileHover={{ scale: 1.06 }}
                    transition={{ duration: 0.5, ease: luxuryEase }}
                  />
                  {product.price && product.discountedPrice && (
                    <div className="absolute top-3 left-3 bg-error text-white text-[10px] font-medium px-3 py-1 tracking-wider uppercase">
                      {Math.round(
                        ((product.price - product.discountedPrice) /
                          product.price) *
                          100,
                      )}
                      % Off
                    </div>
                  )}
                </div>
                <div className="pt-3 pb-1">
                  <h3 className="text-sm font-medium text-neutral truncate tracking-wide">
                    {product.name}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-secondary font-medium text-base">
                      ₦{product.discountedPrice?.toLocaleString()}
                    </span>
                    <span className="text-neutral/40 line-through text-xs">
                      ₦{product.price?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </SectionReveal>
      )}

      {/* ===== Best Sellers ===== */}
      {BestSeller.length !== 0 && (
        <SectionReveal className="py-16 sm:py-20 px-6 sm:px-10 lg:px-20 bg-base-200">
          <div className="flex justify-between items-end mb-8">
            <FadeIn direction="left">
              <div>
                <span className="text-xs font-medium tracking-[0.2em] uppercase text-secondary">
                  Most Popular
                </span>
                <h2 className="font-heading text-3xl sm:text-4xl font-medium text-neutral mt-1">
                  Best Sellers
                </h2>
              </div>
            </FadeIn>
            <FadeIn direction="right" delay={0.2}>
              <motion.button
                onClick={() => nav('/shop')}
                className="text-secondary text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all"
                whileHover={{ x: 5 }}
                transition={{ duration: 0.3 }}
              >
                Shop All <ArrowRight size={14} />
              </motion.button>
            </FadeIn>
          </div>
          <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4">
            {BestSeller.map((product, index) => (
              <AnimatedCard
                key={product._id}
                index={index}
                className="flex-shrink-0 w-64 sm:w-72 group cursor-pointer"
                onClick={() => nav(`/product/${product._id}`)}
              >
                <div className="relative overflow-hidden">
                  <motion.img
                    src={product.images[0]?.url}
                    alt={product.name}
                    className="w-full h-56 sm:h-64 object-cover"
                    whileHover={{ scale: 1.06 }}
                    transition={{ duration: 0.5, ease: luxuryEase }}
                  />
                </div>
                <div className="pt-3 pb-1">
                  <h3 className="text-sm font-medium text-neutral truncate tracking-wide">
                    {product.name}
                  </h3>
                  <span className="text-neutral/60 text-sm mt-1 block">
                    ₦{product.price?.toLocaleString()}
                  </span>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </SectionReveal>
      )}

      {/* ===== Collections ===== */}
      {collections.length !== 0 && (
        <SectionReveal className="py-16 sm:py-20 px-6 sm:px-10 lg:px-20">
          <div className="flex justify-between items-end mb-8">
            <FadeIn direction="left">
              <div>
                <span className="text-xs font-medium tracking-[0.2em] uppercase text-secondary">
                  Curated Sets
                </span>
                <h2 className="font-heading text-3xl sm:text-4xl font-medium text-neutral mt-1">
                  Collections
                </h2>
              </div>
            </FadeIn>
            <FadeIn direction="right" delay={0.2}>
              <motion.button
                onClick={() => nav('/shop?view=collections')}
                className="text-secondary text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all"
                whileHover={{ x: 5 }}
                transition={{ duration: 0.3 }}
              >
                View All <ArrowRight size={14} />
              </motion.button>
            </FadeIn>
          </div>
          <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4">
            {collections.map((collection, index) => (
              <AnimatedCard
                key={collection._id}
                index={index}
                className="flex-shrink-0 w-64 sm:w-72 group cursor-pointer"
                onClick={() => nav(`/collection/${collection._id}`)}
              >
                <div className="relative overflow-hidden">
                  <motion.img
                    src={collection.coverImage?.url}
                    alt={collection.name}
                    className="w-full h-56 sm:h-64 object-cover"
                    whileHover={{ scale: 1.06 }}
                    transition={{ duration: 0.5, ease: luxuryEase }}
                  />
                </div>
                <div className="pt-3 pb-1">
                  <h3 className="text-sm font-medium text-neutral truncate tracking-wide">
                    {collection.name}
                  </h3>
                  <span className="text-neutral/60 text-sm mt-1 block">
                    ₦{collection.price?.toLocaleString()}
                  </span>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </SectionReveal>
      )}

      {/* ===== Featured Styles ===== */}
      <SectionReveal className="py-16 sm:py-20 px-6 sm:px-10 lg:px-20 bg-base-200">
        <div className="text-center mb-10">
          <FadeIn direction="up">
            <span className="text-xs font-medium tracking-[0.2em] uppercase text-secondary">
              Aesthetics
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-medium text-neutral mt-1">
              Featured Styles
            </h2>
          </FadeIn>
          <GoldDivider className="mt-4" />
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
          {designs.map((design, index) => (
            <AnimatedCard key={design.id} index={index} hoverLift={false}>
              <motion.button
                className="relative flex-shrink-0 w-64 sm:w-76 h-76 sm:h-84 overflow-hidden group"
                onClick={() => nav(`/styles/${design.link}`)}
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.4, ease: luxuryEase }}
              >
                <motion.img
                  src={design.image}
                  alt={design.name}
                  className="object-cover w-full h-full"
                  whileHover={{ scale: 1.08 }}
                  transition={{ duration: 0.6, ease: luxuryEase }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent group-hover:from-black/70 transition-all duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-white text-sm sm:text-base font-medium tracking-wide">
                    {design.name}
                  </h3>
                  <div className="w-6 h-0.5 bg-secondary mt-2 group-hover:w-10 transition-all duration-300"></div>
                </div>
              </motion.button>
            </AnimatedCard>
          ))}
        </div>
      </SectionReveal>

      {/* ===== Interior Design Section ===== */}
      <SectionReveal className="relative py-20 sm:py-28 px-6 sm:px-10 lg:px-20 bg-primary text-white overflow-hidden">
        {/* accent image temporarily removed */}
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-10 lg:gap-16">
          {/* Image Grid */}
          <SlideIn direction="left" className="md:flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="row-span-2 overflow-hidden">
                <motion.img
                  src="https://res.cloudinary.com/dnwppcwec/image/upload/v1753787006/Livingroom_dahbsh.png"
                  alt="Interior Design - Living Space"
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.6, ease: luxuryEase }}
                />
              </div>
              <div className="overflow-hidden">
                <motion.img
                  src="https://res.cloudinary.com/dnwppcwec/image/upload/v1753787010/Modern_Bedroom_design_gvw20n.jpg"
                  alt="Interior Design - Bedroom"
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.6, ease: luxuryEase }}
                />
              </div>
              <div className="overflow-hidden">
                <motion.img
                  src="https://res.cloudinary.com/dnwppcwec/image/upload/v1753787002/Dining_reagth.jpg"
                  alt="Interior Design - Dining"
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.6, ease: luxuryEase }}
                />
              </div>
            </div>
          </SlideIn>

          {/* Content */}
          <SlideIn direction="right" delay={0.2} className="md:flex-1">
            <span className="text-xs font-medium tracking-[0.2em] uppercase text-secondary">
              Our Services
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-medium text-white mt-2 mb-6 leading-tight">
              Bespoke{' '}
              <span className="text-secondary italic font-light">Interior</span>{' '}
              Design
            </h2>
            <p className="text-white/70 text-base leading-relaxed mb-8 max-w-md">
              From concept to completion, our expert designers craft
              personalized interiors that reflect your unique taste. We blend
              functionality with luxury to create spaces that inspire and
              elevate everyday living.
            </p>

            <div className="space-y-4 mb-10">
              {[
                {
                  title: 'Space Planning',
                  desc: 'Optimized layouts tailored to your lifestyle',
                },
                {
                  title: 'Custom Furnishing',
                  desc: 'Handpicked furniture and bespoke pieces',
                },
                {
                  title: 'Full Room Makeovers',
                  desc: 'Complete transformations from floor to ceiling',
                },
              ].map((service, i) => (
                <FadeIn key={i} direction="up" delay={0.3 + i * 0.1}>
                  <div className="flex items-start gap-3">
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-secondary mt-2 flex-shrink-0"
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 + i * 0.1, duration: 0.3 }}
                    />
                    <div>
                      <h4 className="text-white text-sm font-medium tracking-wide">
                        {service.title}
                      </h4>
                      <p className="text-white/50 text-xs mt-0.5">
                        {service.desc}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>

            <motion.div
              className="flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.7, ease: luxuryEase }}
            >
              <motion.button
                onClick={() => nav('/consultation')}
                className="btn- bg-secondary px-8 py-3.5"
                whileHover={{
                  scale: 1.04,
                  boxShadow: '0 8px 25px rgba(201,168,76,0.3)',
                }}
                whileTap={{ scale: 0.97 }}
              >
                Book a Consultation
              </motion.button>
              <motion.button
                onClick={() => nav('/projects')}
                className="btn-elegant border-white/40 text-white hover:bg-white hover:text-primary px-8 py-3.5"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                View Our Work
              </motion.button>
            </motion.div>
          </SlideIn>
        </div>
      </SectionReveal>

      {/* ===== Room Showcases ===== */}
      {[
        {
          title: 'Luxurious',
          highlight: 'Living Rooms',
          img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787006/living_lsdtn8.jpg',
          desc: 'The living room stands out as one of the most important and beautifully decorated living spaces — where comfort meets elegance.',
          cat: 'Living%20Room',
          reverse: false,
        },
        {
          title: 'Perfect',
          highlight: 'Dining Rooms',
          img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787006/diningroom_voqqk6.png',
          desc: 'A central space for celebration, connection, and hospitality — one of the most inviting areas of the home.',
          cat: 'Dining%20Room',
          reverse: true,
        },
        {
          title: 'Elegant',
          highlight: 'Bedrooms',
          img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786997/bedroom_mv5jzr.png',
          desc: 'A personal retreat where you unwind, find comfort, and recharge — adorned with cozy fabrics and soothing colors.',
          cat: 'Bedroom',
          reverse: false,
        },
        {
          title: 'Sophisticated',
          highlight: 'Corner Sofas',
          img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787002/corner_it609b.png',
          desc: 'Transform any living space into a haven of comfort and style — perfect for maximizing seating and creating a cozy atmosphere.',
          cat: 'Corner%20Sofas',
          reverse: true,
        },
      ].map((room, i) => (
        <SectionReveal
          key={i}
          className="py-16 sm:py-20 px-6 sm:px-10 lg:px-20"
        >
          <div
            className={`flex flex-col ${room.reverse ? 'md:flex-row-reverse' : 'md:flex-row'} md:items-center gap-8 lg:gap-16 max-w-6xl mx-auto`}
          >
            <SlideIn
              direction={room.reverse ? 'right' : 'left'}
              className="md:flex-1 overflow-hidden"
            >
              <motion.img
                src={room.img}
                alt={`${room.highlight}`}
                className="w-full h-72 sm:h-80 md:h-96 object-cover"
                whileHover={{ scale: 1.04 }}
                transition={{ duration: 0.6, ease: luxuryEase }}
              />
            </SlideIn>
            <SlideIn
              direction={room.reverse ? 'left' : 'right'}
              delay={0.15}
              className="md:flex-1"
            >
              <motion.div
                className="w-10 h-0.5 bg-secondary mb-6"
                initial={{ scaleX: 0, opacity: 0 }}
                whileInView={{ scaleX: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: elegantEase }}
                style={{ originX: 0 }}
              />
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-medium text-neutral mb-4">
                <span className="text-gold-gradient italic">{room.title}</span>
                <br />
                {room.highlight}
              </h2>
              <p className="text-neutral/60 text-base leading-relaxed mb-8 max-w-md">
                {room.desc}
              </p>
              <motion.button
                className="btn-elegant"
                onClick={() => nav(`/shop?category=${room.cat}`)}
                whileHover={{ scale: 1.04, x: 5 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.3 }}
              >
                Explore {room.highlight}
              </motion.button>
            </SlideIn>
          </div>
        </SectionReveal>
      ))}

      {/* ===== Brand Statement ===== */}
      <SectionReveal className="py-20 sm:py-28 px-6 sm:px-10 lg:px-20 bg-primary text-white text-center">
        <div className="max-w-3xl mx-auto">
          <GoldDivider className="mb-8" style={{ background: '#c9a84c' }} />
          <FadeIn direction="up" blur>
            <h2 className="font-heading text-2xl sm:text-4xl font-medium leading-snug mb-6">
              The Epitome of Luxury
              <br />& Craftsmanship
            </h2>
          </FadeIn>
          <FadeIn direction="up" delay={0.2}>
            <p className="text-white/60 text-sm sm:text-base leading-relaxed mb-10">
              At EM Group Limited, we redefine elegance by blending exceptional
              craftsmanship, timeless design, and the finest materials to create
              luxury furniture and interior solutions that transform spaces into
              breathtaking havens.
            </p>
          </FadeIn>
          <FadeIn direction="up" delay={0.4}>
            <motion.button
              className="m-4 btn-secondary border-white/30 text-white bg-secondary hover:border-secondary hover:text-primary px-10 py-3.5"
              onClick={() => nav('/contact')}
              whileHover={{
                scale: 1.04,
                boxShadow: '0 8px 25px rgba(201,168,76,0.3)',
              }}
              whileTap={{ scale: 0.97 }}
            >
              Get in Touch
            </motion.button>
            <motion.button
              className="btn-secondary-outline border-white/30 text-white bg-secondary hover:border-secondary hover:text-primary px-10 py-3.5"
              onClick={() => nav('/consultation')}
              whileHover={{
                scale: 1.04,
                boxShadow: '0 8px 25px rgba(201,168,76,0.3)',
              }}
              whileTap={{ scale: 0.97 }}
            >
              Book a Consultation
            </motion.button>
          </FadeIn>
        </div>
      </SectionReveal>
    </PageWrapper>
  );
};

export default HomePage;
