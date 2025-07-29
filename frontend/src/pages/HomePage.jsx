// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'; // Import icons for navigation

// Import your hero images
// import Hero1 from '../images/Hero1.png';
// import Hero2 from '../images/Hero2.png';
// import Hero3 from '../images/Hero3.png';
// import Hero4 from '../images/Hero4.png';
// import Hero5 from '../images/Hero5.png';
// import shipping from '../images/worldwide-shipping.png';
// import quality from '../images/verify.png';
// import installation from '../images/easy-installation.png';
// import sofa from '../images/sofa.jpeg';
// import armchair from '../images/Panama-Armchair.jpg';
// import living from '../images/living.jpg';
// import livingRoom from '../images/Livingroom.png';
// import bed from '../images/Modern Bedroom design.jpeg';
// import dinign from '../images/Dining.jpeg';
// import center from '../images/center.jpeg';
// import wardrobe from '../images/wardrobe.jpeg';
// import tv from '../images/TV unit.jpeg';
// import carpet from '../images/carpets.jpeg';
// import contempoeary from '../images/contemporary.jpeg';
// import antique from '../images/antique.jpeg';
// import bespoke from '../images/bespoke.jpeg';
// import minimalist from '../images/minimalist.jpeg';
// import diningroom from '../images/diningroom.png';
// import bedroom from '../images/bedroom.png';
// import corner from '../images/corner.png';
import { useProductsStore } from '../store/useProductsStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  // Array of hero images
  const heroImages = ["https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png", "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787006/Hero2_mnsyx3.png", "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787005/Hero3_mmltlv.png", "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787010/Hero4_d42fq3.png", "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787007/Hero5_kcqj5j.png"];
  const [currentSlide, setCurrentSlide] = useState(0); // State to track the current slide index
  const slideIntervalTime = 5000; // Time in milliseconds for automatic slide transition (5 seconds)

  // Function to go to the next slide
  const nextSlide = () => {
    setCurrentSlide((prevSlide) =>
      prevSlide === heroImages.length - 1 ? 0 : prevSlide + 1
    );
  };
  // useEffect for automatic slide transition
  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, slideIntervalTime);

    // Clear the interval when the component unmounts or dependencies change
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlide]); // Re-run effect when currentSlide changes to reset timer

  const designs = [
    { id: '1', name: 'Modern', link: 'modern', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787010/sofa_k5et34.jpg" },
    {
      id: '2',
      name: 'Contemporary',
      link: 'contemporary',
      image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787001/contemporary_uunph9.jpg",
    },
    { id: '3', name: 'Antique/Royal', link: 'antique%2Froyal', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753786997/antique_ktxajm.jpg" },
    { id: '4', name: 'Bespoke', link: 'bespoke', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753786997/bespoke_bs55kv.jpg" },
    { id: '5', name: 'Minimalist', link: 'minimalist', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787007/minimalist_c5zk8r.jpg" },
    { id: '6', name: 'Glam', link: 'glam', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787006/Livingroom_dahbsh.png" }, // Using Hero1 as a placeholder for now
  ];

  //   const [uniqueCategories, setUniqueCategories] = useState([]);

  const { products, getProducts, isGettingProducts } = useProductsStore();
  const { collections, getCollections, isGettingCollections } =
    useCollectionStore();

  const promotionProducts = products.filter((products) => products.isPromo);

  const BestSeller = products.filter((products) => products.isBestSeller);

  //   console.log(promotionProducts);
  useEffect(() => {
    getProducts(1, 10, {}, false);
    getCollections(1, 10, {}, false);
  }, [getProducts, getCollections]);

  const categories = [
    { id: '1', name: 'Sofas', link: 'Living%20Room', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787010/sofa_k5et34.jpg" },
    { id: '2', name: 'Armchairs', link: 'Armchair', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787010/Panama-Armchair_djdgqt.jpg" },
    { id: '3', name: 'Living Rooms', link: 'Living%20Room', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787006/Livingroom_dahbsh.png" },
    { id: '4', name: 'Bedrooms', link: 'Bedroom', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787010/Modern_Bedroom_design_gvw20n.jpg" },
    { id: '5', name: 'Dining Rooms', link: 'Dining%20Room', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787002/Dining_reagth.jpg" },
    { id: '6', name: 'Center Tables', link: 'Center%20Table', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753787001/center_i487sg.jpg" }, // Using Hero1 as a placeholder for now
    { id: '7', name: 'Wardrobe', link: 'Wardrobe', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/wardrobe_j5c6to.jpg" },
    { id: '8', name: 'TV Unit', link: 'TV%20unit', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/TV_unit_goevgl.jpg" },
    { id: '9', name: 'Carpets', link: 'Carpet', image: "https://res.cloudinary.com/dnwppcwec/image/upload/v1753786997/carpets_bdy56z.jpg" }, // Using Hero2 as a placeholder for now
  ];

  const navigate = useNavigate();

  const handleExploreLivingRoomsClick = () => {
    // Navigate to the shop page and pass 'Living Room' as a category query parameter
    navigate('/shop?category=Living%20Room');
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleShopNow = () => {
    navigate('/shop');
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleExploreDiningRoomsClick = () => {
    navigate('/shop?category=Dining%20Room');
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleExploreBedRoomsClick = () => {
    navigate('/shop?category=Bedroom');
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleExploreCornerSofasClick = () => {
    navigate('/shop?category=Corner%20Sofas');
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleCategoryClick = (category) => {
    navigate(`/shop?category=${category}`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleProductClick = (Id) => {
    navigate(`/product/${Id}`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleStyleClick = (style) => {
    navigate(`/styles/${style}`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleCollectionClick = (Id) => {
    navigate(`/collection/${Id}`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleContatClick = () => {
    navigate(`/contact`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  console.log(promotionProducts);

  if (isGettingProducts || isGettingCollections) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="justify-center pb-30 items-start min-h-screen bg-base-100">
      <section className="lg:h-150 relative w-full overflow-hidden z-0">
        {/* This container will now dynamically take its height based on the images. */}
        {/* The 'invisible' image acts as a height placeholder for the 'relative' parent. */}
        <div className="w-full">
          {/* Invisible placeholder image to define the container's height based on its aspect ratio */}
          {/* This ensures the parent div has a height even when children are absolute */}
          <img
            src={heroImages[0]}
            alt=""
            className="w-full  h-100 max-h-screen object-cover invisible"
            aria-hidden="true"
          />

          {/* All images are absolutely positioned to allow for smooth opacity transitions */}
          {heroImages.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`Hero Slide ${index + 1}`}
              className={`absolute lg:pt-16 top-0 left-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out
                            ${
                              index === currentSlide
                                ? 'opacity-100'
                                : 'opacity-0'
                            }`}
            />
          ))}

          {/* Dot Indicators */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10 items-end">
            {heroImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-7 h-0.5 transition-colors duration-300
                                ${
                                  index === currentSlide
                                    ? 'bg-primary h-1'
                                    : 'bg-gray-300 hover:bg-gray-200'
                                }`}
                aria-label={`Go to slide ${index + 1}`}
              ></button>
            ))}
          </div>

          <div  className="absolute flex flex-col items-start justify-end pb-22 bottom-0 left-1/2 bg-black/30 h-full -translate-x-1/2 font-black text-3xl sm:text-4xl md:text-6xl w-full px-6 sm:px-10 lg:px-15 text-base-100 text-shadow-lg">
            <div>Transforming Spaces.</div>
            <div>Elevating Lives.</div>
          </div>
          <div className="absolute flex space-x-2 bottom-8 left-1/2 -translate-x-1/2 font-black text-3xl sm:text-4xl md:text-6xl w-full px-6 sm:px-10 lg:px-15 text-base-100 text-shadow-lg">
            <button onClick={() => handleShopNow()} className='btn sm:w-50 bg-primary border-0 shadow-none rounded-xl'>Shop Now!</button>
            <button onClick={() => handleContatClick()} className='btn sm:w-50 bg-secondary text-white border-0 shadow-none rounded-xl'> Contact Us</button>
          </div>
        </div>
      </section>
      <section className="h-25 bg-secondary flex items-center justify-center space-x-7 sm:space-x-25 md:space-x-35 lg:space-x-45">
        <div className="text-white space-y-1 text-xxs sm:text-sm font-[montserrat] items-center flex flex-col">
          <img src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753786997/worldwide-shipping_by9zox.png"} alt="" className="size-12" />
          <h1>World Wide Shipping</h1>
        </div>

        <div className="text-white space-y-1 text-xxs font-[montserrat] items-center flex flex-col">
          <img src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/verify_vnl0hf.png"} alt="" className="size-12" />
          <h1>Quality Assurance</h1>
        </div>

        <div className="text-white space-y-1 text-xxs font-[montserrat] items-center flex flex-col">
          <img src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753787002/easy-installation_dmiwxi.png"} alt="" className="size-12" />
          <h1>Free Installation</h1>
        </div>
      </section>
      <section className="my-10 pl-4 sm:pl-8 lg:pl-16">
        <h2 className="text-2xl font-bold mb-4 font-[poppins]">
          Featured Products
        </h2>
        <div
          className="flex space-x-4 overflow-x-auto pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categories.map((category) => (
            <button
              key={category.id}
              className="relative flex-shrink-0 w-60 h-60 rounded-2xl overflow-hidden shadow-md group"
              onClick={() => handleCategoryClick(category.link)}
            >
              {/* Image with object-cover to maintain aspect ratio and fill container */}
              <img
                src={category.image}
                alt={category.name}
                className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
              />
              {/* Overlay for text and subtle hover effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent flex items-end p-4">
                <div className="">
                  <h3 className="text-white text-xl font-semibold font-[poppins]">
                    {category.name}
                  </h3>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
      {promotionProducts.length !== 0 ? (
        <section className="pl-4 sm:pl-8 lg:pl-16">
          <h2 className="text-2xl font-bold mb-4 font-[poppins]">Promotions</h2>
          <div
            className="flex space-x-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-400 scrollbar-track-gray-100"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {promotionProducts.map((product) => (
              <div
                key={product.id}
                className="flex-shrink-0 w-75 md:w-90 lg:w-100 rounded-lg overflow-hidden"
              >
                <div className="relative">
                  <button
                    className="w-full h-full"
                    onClick={() => handleProductClick(product._id)}
                  >
                    <img
                      src={product?.images[0].url}
                      alt={product.name}
                      className="w-full h-50 md:h-60 lg:h-70 rounded-lg object-cover rounded-t-lg"
                    />
                  </button>
                  {/* Discount Badge */}
                  <div className="absolute top-4 left-4 bg-red-500 text-white font-bold text-sm px-3 py-1.5 rounded-full shadow-md">
                    {product.price && product.discountedPrice
                      ? `${Math.round(
                          ((product.price - product.discountedPrice) /
                            product.price) *
                            100
                        )}% OFF`
                      : ''}
                  </div>
                </div>
                <div className="mt-1">
                  <h3 className="text-lg font-medium truncate font-[poppins]">
                    {product.name}
                  </h3>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-red-600 font-bold text-lg">
                      ₦{product.discountedPrice.toLocaleString()}
                    </span>
                    <span className="text-gray-500 line-through text-sm">
                      ₦{product.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div className="w-full h-full py-20 lg:py-30">
              <button
                onClick={() => handleShopNow()}
                className="btn bg-primary rounded-xl mx-4 w-30 font-semibold"
              >
                Shop Now
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {BestSeller.length !== 0 ? (
        <section className="pl-4 sm:pl-8 lg:pl-16">
          <h2 className="text-2xl font-bold mb-4 font-[poppins]">
            Best Sellers
          </h2>
          <div
            className="flex space-x-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-400 scrollbar-track-gray-100"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {BestSeller.map((product) => (
              <div
                key={product.id}
                className="flex-shrink-0 w-75 md:w-90 lg:w-100 rounded-lg overflow-hidden"
              >
                <div className="relative">
                  <button
                    className="w-full h-full"
                    onClick={() => handleProductClick(product._id)}
                  >
                    <img
                      src={product.images[0].url}
                      alt={product.name}
                      className="w-full h-50 md:h-60 lg:h-70 rounded-lg object-cover rounded-t-lg"
                    />
                  </button>
                </div>
                <div className="mt-1">
                  <h3 className="text-lg font-medium truncate font-[poppins]">
                    {product.name}
                  </h3>
                  <div className="flex items-baseline space-x-2">
                    <span className=" text-gray-500">
                      ₦{product.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div className="w-full h-full py-20 lg:py-30">
              <button
                onClick={() => handleShopNow()}
                className="btn bg-primary rounded-xl mx-4 w-30 font-semibold"
              >
                Shop Now
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {collections.length !== 0 ? (
        <section className="pl-4 sm:pl-8 lg:pl-16">
          <h2 className="text-2xl font-bold mb-4 font-[poppins]">
            Collections
          </h2>
          <div
            className="flex space-x-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-400 scrollbar-track-gray-100"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {collections.map((product) => (
              <div
                key={product.id}
                className="flex-shrink-0 w-75 md:w-90 lg:w-100 rounded-lg overflow-hidden"
              >
                <div className="relative">
                  <button
                    className="w-full h-full"
                    onClick={() => handleCollectionClick(product._id)}
                  >
                    <img
                      src={product.coverImage.url}
                      alt={product.name}
                      className="w-full h-50 md:h-60 lg:h-70 rounded-lg object-cover rounded-t-lg"
                    />
                  </button>
                </div>
                <div className="mt-1">
                  <h3 className="text-lg font-medium truncate font-[poppins]">
                    {product.name}
                  </h3>
                  <div className="flex items-baseline space-x-2">
                    <span className=" text-gray-500">
                      ₦{product.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div className="w-full h-full py-20 lg:py-30">
              <button
                onClick={() => handleShopNow()}
                className="btn bg-primary rounded-xl mx-4 w-30 font-semibold"
              >
                Shop Now
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="my-10 pl-4 sm:pl-8 lg:pl-16">
        <h2 className="text-2xl font-bold mb-4 font-[poppins]">
          Featured Styles
        </h2>
        <div
          className="flex space-x-4 overflow-x-auto pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {designs.map((category) => (
            <button
              key={category.id}
              className="relative flex-shrink-0 w-60 h-60 rounded-2xl overflow-hidden shadow-md group"
              onClick={() => handleStyleClick(category.link)}
            >
              <img
                src={category.image}
                alt={category.name}
                className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
              />
              {/* Overlay for text and subtle hover effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent flex items-end p-4">
                <div className="">
                  <h3 className="text-white text-xl font-semibold font-[poppins]">
                    {category.name}
                  </h3>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="my-10 px-4 sm:px-8 lg:px-16">
        <div className="md:flex md:items-center md:space-x-8 lg:space-x-16">
          {' '}
          {/* Increased space-x for larger screens */}
          <div className="md:flex-1 mb-6 md:mb-0">
            {' '}
            {/* Added bottom margin for mobile, removed for desktop */}
            <img
              src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753787006/living_lsdtn8.jpg"} // Use the imported image
              alt="Luxurious Living Room"
              className="w-full h-auto rounded-lg object-cover" // Added rounded corners and shadow
            />
          </div>
          <div className="md:flex-1 md:items-startmd:text-left">
            {' '}
            {/* Text alignment responsive */}
            <div className="text-4xl sm:text-5xl md:text-4xl lg:text-5xl font-extrabold font-[poppins] mb-4">
              {' '}
              {/* Responsive font sizes */}
              <span className="text-primary">Luxurious</span> Living Rooms
            </div>
            <div className="font-[montserrat] text-base lg:text-lg mb-6">
              {' '}
              {/* Responsive font size and bottom margin */}
              The Living room is where we spend long hours of the day watching
              television, reading a book or newspaper, relaxing, hosting guests,
              or enjoying coffee; it stands out as one of the most important and
              decorated living spaces.
            </div>
            <button
              className="btn border-0 shadow-none text-lg btn-primary w-full rounded-xl text-secondary px-8 py-3"
              onClick={handleExploreLivingRoomsClick} // NEW: Add onClick handler
            >
              Explore Living Rooms{' '}
              {/* Text remains "Dining Rooms" as per your code */}
            </button>
          </div>
        </div>
      </section>
      <section className="my-10 px-4 sm:px-8 lg:px-16">
        <div className="flex flex-col-reverse md:flex-row md:items-center md:space-x-8 lg:space-x-16">
          {/* 🟨 TEXT SECTION (comes second on mobile, first on desktop) */}
          <div className="md:flex-1">
            <div className="text-4xl sm:text-5xl md:text-4xl lg:text-5xl font-extrabold font-[poppins] mb-4">
              <span className="text-primary">Perfect</span> Dining Rooms
            </div>
            <div className="font-[montserrat] text-base mb-6">
              The dining room is where we gather to share meals, engage in
              conversations, and create cherished memories with family and
              friends. It serves as a central space for celebration, connection,
              and hospitality, making it one of the most inviting and
              thoughtfully curated areas of the home.
            </div>
            <button
              className="btn border-0 shadow-none text-lg btn-primary w-full rounded-xl text-secondary px-8"
              onClick={handleExploreDiningRoomsClick}
            >
              Explore Dining Rooms
            </button>
          </div>

          {/* 🟩 IMAGE SECTION (comes first on mobile, second on desktop) */}
          <div className="md:flex-1 mb-6 md:mb-0">
            <img
              src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753787006/diningroom_voqqk6.png"}
              alt="Luxurious Living Room"
              className="w-full h-auto rounded-lg object-cover"
            />
          </div>
        </div>
      </section>
      <section className="my-10 px-4 sm:px-8 lg:px-16">
        <div className="md:flex md:items-center md:space-x-8 lg:space-x-16">
          {' '}
          {/* Increased space-x for larger screens */}
          <div className="md:flex-1 mb-6 md:mb-0">
            {' '}
            {/* Added bottom margin for mobile, removed for desktop */}
            <img
              src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753786997/bedroom_mv5jzr.png"} // Use the imported image
              alt="Luxurious Living Room"
              className="w-full h-auto rounded-lg object-cover" // Added rounded corners and shadow
            />
          </div>
          <div className="md:flex-1 md:items-startmd:text-left">
            {' '}
            {/* Text alignment responsive */}
            <div className="text-4xl sm:text-5xl md:text-4xl lg:text-5xl font-extrabold font-[poppins] mb-4">
              {' '}
              {/* Responsive font sizes */}
              <span className="text-primary">Elegant</span> Bed Rooms
            </div>
            <div className="font-[montserrat] text-base lg:text-lg mb-6">
              {' '}
              {/* Responsive font size and bottom margin */}
              The bedroom is a personal retreat where we unwind, find comfort,
              and recharge for the day ahead. It offers a sanctuary of
              tranquility and intimacy, adorned with cozy fabrics, soothing
              colors, and elements that reflect our deepest sense of style and
              relaxation.
            </div>
            <button
              className="btn border-0 shadow-none text-lg btn-primary w-full rounded-xl text-secondary px-8"
              onClick={handleExploreBedRoomsClick}
            >
              {' '}
              {/* Responsive width and padding */}
              Explore Bed Rooms
            </button>
          </div>
        </div>
      </section>
      <section className="my-10 px-4 sm:px-8 lg:px-16">
        <div className="flex flex-col-reverse md:flex-row md:items-center md:space-x-8 lg:space-x-16">
          {/* 🟨 TEXT SECTION (comes second on mobile, first on desktop) */}
          <div className="md:flex-1">
            <div className="text-4xl sm:text-5xl md:text-4xl lg:text-5xl font-extrabold font-[poppins] mb-4">
              <span className="text-primary">Sophisticated</span> Corner Sofas
            </div>
            <div className="font-[montserrat] text-base mb-6">
              Corner sofas transform any living space into a haven of comfort
              and style. Perfect for maximizing seating and creating a cozy
              atmosphere, they offer both functionality and elegance, becoming
              the centerpiece for relaxation, conversation, and modern living.
            </div>
            <button
              className="btn border-0 shadow-none text-lg btn-primary w-full rounded-xl text-secondary px-8"
              onClick={handleExploreCornerSofasClick}
            >
              Explore Corner Sofas
            </button>
          </div>

          {/* 🟩 IMAGE SECTION (comes first on mobile, second on desktop) */}
          <div className="md:flex-1 mb-6 md:mb-0">
            <img
              src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753787002/corner_it609b.png"}
              alt="Luxurious Living Room"
              className="w-full h-auto rounded-lg object-cover"
            />
          </div>
        </div>
      </section>
      <section className="items-center justify-center flex px-4 sm:px-8 lg:px-16">
        <div className="max-w-5xl text-center">
          <h1 className="font-bold text-xl sm:text-5xl font-[poppins]">
            The Epitome of Luxury & Craftsmanship
          </h1>
          <p className="font-[montserrat] pt-2">
            At EM Group Limited, we redefine elegance by blending exceptional
            craftsmanship, timeless design, and the finest materials to create
            luxury furniture and interior solutions that transform spaces into
            breathtaking havens. With a deep-rooted passion for aesthetics and
            functionality, we specialize in bespoke, handcrafted furniture,
            ensuring that every piece reflects sophistication, durability, and
            comfort. Each creation is meticulously crafted by master artisans,
            using only premium wood, rich fabrics, and exquisite finishes,
            making every piece a statement of prestige.
          </p>
        </div>
      </section>
      <div className="items-center justify-center flex px-8 mt-10 sm:px-8 lg:px-16">
        <button
          className="btn bg-primary font-[poppins] rounded-xl w-full"
          onClick={() => handleContatClick()}
        >
          Contact Us
        </button>
      </div>
    </div>
  );
};

export default HomePage;
