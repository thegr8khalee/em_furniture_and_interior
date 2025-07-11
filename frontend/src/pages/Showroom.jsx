// src/pages/Showroom.jsx
import React from 'react';
import Hero1 from '../images/Hero1.png';

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
        <div className="pt-16">
            <div className="relative">
                <img src={Hero1} alt="Showroom Hero" className="object-cover h-40 w-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-center pb-14">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center text-base-100 font-[poppins]">
                        Showroom
                    </h1>
                </div>
            </div>

            <div className="container mx-auto p-4 sm:p-6 lg:p-8 my-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Showroom Information Section */}
                    <div className="bg-base-100 p-6 rounded-lg shadow-xl">
                        <h2 className="text-2xl font-semibold font-[poppins] mb-6">Visit Our Showroom</h2>
                        <div className="space-y-4 text-base-content font-[montserrat]">
                            <div>
                                <h3 className="font-bold text-lg font-[poppins]">Address:</h3>
                                <p>{descriptiveAddress}</p> {/* Display the descriptive address */}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg font-[poppins]">Phone:</h3>
                                <p><a href="tel:+2349037691860" className=" hover:underline">+2349037691860</a></p>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg font-[poppins]">Email:</h3>
                                <p><a href="mailto:emfurnitreandinterior@gmail.com" className=" hover:underline">emfurnitureandinterior@gmail.com</a></p>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg font-[poppins]">Business Hours:</h3>
                                <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
                                <p>Saturday: 10:00 AM - 4:00 PM</p>
                                <p>Sunday: Closed</p>
                            </div>
                            <p className="mt-6 text-sm text-gray-600">
                                We invite you to visit our showroom to experience the quality and craftsmanship of our furniture firsthand. Our team will be happy to assist you in finding the perfect pieces for your home.
                            </p>
                        </div>
                    </div>

                    {/* Google Map Embed Section */}
                    <div className="bg-base-100 p-6 rounded-lg shadow-xl flex flex-col items-center justify-center">
                        <h2 className="text-2xl font-semibold font-[poppins] mb-6">Find Us on the Map</h2>
                        <div className="w-full h-80 rounded-lg overflow-hidden border border-base-300">
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
                        <p className="mt-4 text-sm text-gray-600 text-center">
                            Click on the map for directions.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Showroom;
