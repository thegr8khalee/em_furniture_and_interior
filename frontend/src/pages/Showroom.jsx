// src/pages/Showroom.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { luxuryEase, elegantEase } from '../lib/animations';
import { PageWrapper, SlideIn } from '../components/animations';
// import Hero1 from '../images/Hero1.png';

const Showroom = () => {
    // REPLACE THESE WITH YOUR ACTUAL SHOWROOM'S LATITUDE AND LONGITUDE
    // You can find these by right-clicking on your location in Google Maps and selecting "What's here?"
    const showroomLatitude = 10.526371;   // Example Latitude (e.g., for Lagos, Nigeria)
    const showroomLongitude = 7.401133; // Example Longitude (e.g., for Lagos, Nigeria)

    // A descriptive address for display purposes, even if using coordinates for the map
    const descriptiveAddress = "C16 Bamaiyi Road, Kaduna Nigeria.";

    // IMPORTANT: Get your Google Maps API Key from Google Cloud Console
    const googleMapsApiKey = import.meta.env.VITE_REACT_APP_GOOGLE_MAPS_API_KEY;

    // Google Maps Embed API URL
    // 'center' parameter sets the center of the map using lat,lng
    // 'q' parameter places a marker at the specified lat,lng (or address). Using coordinates for precision.
    // 'zoom' can be adjusted (e.g., 17 for very close, 15 for closer view)
    const googleMapsEmbedUrl = `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${showroomLatitude},${showroomLongitude}&center=${showroomLatitude},${showroomLongitude}&zoom=17`;

    return (
        <PageWrapper>
        <div className="min-h-screen bg-base-200 pt-16 pb-12">
            <div className="relative h-48 sm:h-64 overflow-hidden">
                <motion.img src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png"} alt="Showroom Hero" className="object-cover h-full w-full" initial={{ scale: 1.15, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.4, ease: luxuryEase }} />
                <div className="absolute inset-0 bg-primary/80 flex items-center justify-center">
                    <motion.h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-white text-center" initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.8, delay: 0.5, ease: elegantEase }}>
                        Showroom
                    </motion.h1>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Showroom Information Section */}
                    <SlideIn direction="left">
                    <div className="bg-white p-8 border border-base-300 shadow-xl">
                        <h2 className="text-2xl font-heading font-semibold text-neutral mb-6">Visit Our Showroom</h2>
                        <div className="space-y-6 text-neutral/70 leading-relaxed font-body">
                            <div>
                                <h3 className="font-heading font-medium text-secondary text-lg mb-1">Address:</h3>
                                <p>{descriptiveAddress}</p> {/* Display the descriptive address */}
                            </div>
                            <div>
                                <h3 className="font-heading font-medium text-secondary text-lg mb-1">Phone:</h3>
                                <p><a href="tel:+2349037691860" className=" hover:underline">+2349037691860</a></p>
                            </div>
                            <div>
                                <h3 className="font-heading font-medium text-secondary text-lg mb-1">Email:</h3>
                                <p><a href="mailto:emfurnitreandinterior@gmail.com" className=" hover:underline">emfurnitureandinterior@gmail.com</a></p>
                            </div>
                            <div>
                                <h3 className="font-heading font-medium text-secondary text-lg mb-1">Business Hours:</h3>
                                <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
                                <p>Saturday: 10:00 AM - 4:00 PM</p>
                                <p>Sunday: Closed</p>
                            </div>
                            <p className="mt-6 text-sm text-neutral/70">
                                We invite you to visit our showroom to experience the quality and craftsmanship of our furniture firsthand. Our team will be happy to assist you in finding the perfect pieces for your home.
                            </p>
                        </div>
                    </div>
                    </SlideIn>

                    {/* Google Map Embed Section */}
                    <SlideIn direction="right">
                    <div className="bg-white h-full p-8 border border-base-300 shadow-xl flex flex-col items-center justify-center">
                        <h2 className="text-2xl font-heading font-semibold text-neutral mb-6">Find Us on the Map</h2>
                        <div className="w-full h-96 overflow-hidden border border-secondary/20 shadow-inner">
                            {googleMapsApiKey ? (
                                <iframe
                                    src={googleMapsEmbedUrl}
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    allowFullScreen=""
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    title="Our Showroom Location"
                                ></iframe>
                            ) : (
                                <div className="flex items-center justify-center h-full text-center text-error">
                                    <p>Google Maps API Key is missing or unauthorized. Please check your console.</p>
                                </div>
                            )}
                        </div>
                        <p className="mt-4 text-sm text-neutral/70 text-center">
                            Click on the map for directions.
                        </p>
                    </div>
                    </SlideIn>
                </div>
            </div>
        </div>
        </PageWrapper>
    );
};

export default Showroom;
