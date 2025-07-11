EM Furniture and Interior - E-commerce Web Application (MVP)

1. About the Project
This repository contains the Minimum Viable Product (MVP) for EM furnitre and Interior, a modern and responsive e-commerce web application designed for selling furniture and interior decor. Built with React and leveraging a robust backend (separate repository), this application provides a seamless shopping experience for customers and efficient content management for administrators.

The MVP focuses on core e-commerce functionalities, including product browsing, cart management, wishlist features, and essential informational pages, along with interactive elements like an e-catalog and showroom map.

2. Features
Here's a high-level overview of the key features implemented in this MVP:

User Authentication: Secure user registration, login, and profile management.

Product & Collection Catalog: Comprehensive display of products and curated collections with detailed pages.

Intuitive Browsing: Filtering by categories (Sofas, Bedrooms, etc.) and design styles (Modern, Antique/Royal, etc.).

Shopping Cart: Add, update quantities, remove, and clear items. Cart contents persist for both authenticated and unauthenticated users.

Wishlist: Save favorite products/collections, view them on a dedicated page, and easily move them to the cart. Wishlist contents persist.

WhatsApp Integration: Direct communication channels for product inquiries and full cart order placement via WhatsApp, including item links and total price.

Admin Panel: Secure dashboard for administrators to manage products and collections (add, edit).

Informational Pages: Dedicated pages for Contact Us (with form), Terms & Conditions, and Privacy Policy.

E-Catalog: An integrated PDF viewer for browsing the digital product catalog.

Showroom Map: An interactive Google Map displaying the physical showroom location with precise coordinates.

Responsive Design: Optimized for seamless experience across desktop, tablet, and mobile devices.

Floating WhatsApp Button: Always accessible button for quick communication.

3. Technologies Used
Frontend:

React.js (JavaScript library for building user interfaces)

Tailwind CSS (Utility-first CSS framework)

DaisyUI (Tailwind CSS component library)

Zustand (Small, fast, and scalable bearbones state-management solution)

React Router DOM (Declarative routing for React)

Axios (Promise-based HTTP client)

react-hot-toast (Lightweight, customizable toast notifications)

@react-pdf-viewer/core & @react-pdf-viewer/default-layout (PDF viewer components)

Lucide React (Beautiful & consistent open-source icons)

Backend: (Assumed to be a separate repository, e.g., Node.js/Express, MongoDB)

Node.js (JavaScript runtime)

Express.js (Web application framework)

MongoDB (NoSQL database)

Nodemailer (For sending emails via Contact Us form)

4. Installation
Follow these steps to set up the project locally.

Prerequisites
Node.js (LTS version recommended)

npm or Yarn

Cloning the Repository
git clone https://github.com/thegr8khalee/em-furniture-and-interior.git
cd frontend

Installing Dependencies
# Using npm
npm install

# Or using Yarn
yarn install

Environment Variables
This project uses environment variables for sensitive information like API keys and backend URLs.

Create a file named .env in the root of the frontend directory (the same directory as package.json).

Add the following variables, replacing the placeholder values with your actual keys and URLs:

# Backend API URL
VITE_BACKEND_URL=http://localhost:5000/api/v1 # Or your production backend URL

# Google Maps API Key (for Showroom page)
# Get this from Google Cloud Console: console.cloud.google.com
# Ensure 'Maps Embed API' is enabled and your key is restricted to your domain(s).
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

# Add any other frontend-specific environment variables here

Note: If you're using Create React App instead of Vite, the environment variables should be prefixed with REACT_APP_ (e.g., REACT_APP_GOOGLE_MAPS_API_KEY).

Running the Application
To start the development server:

# Using npm
npm run dev

# Or using Yarn
yarn dev

The application will typically be available at http://localhost:5173 (or another port if 5173 is in use).

5. Usage
User Access
Browse Products/Collections: Navigate to /shop or /collections.

Add to Cart/Wishlist: Click the respective buttons on product/collection detail pages.

Manage Cart/Wishlist: Visit /cart or /wishlist.

Contact Us: Use the form at /contact.

Admin Access
To access the admin dashboard:

Navigate to /admin/login.

Log in with valid administrator credentials (these are managed on the backend).

Once logged in, you can access /admin/dashboard to manage products and collections.

6. Project Structure
your-app-frontend/
├── public/                     # Static assets (favicons, index.html)
├── src/
│   ├── assets/                 # Images, fonts, etc.
│   ├── components/             # Reusable UI components (Navbar, Footer, Modal, etc.)
│   │   ├── Admin/              # Admin-specific components
│   │   └── ...
│   ├── pages/                  # Top-level page components (Home, Shop, Cart, AdminDashboard, etc.)
│   │   ├── Admin/              # Admin-specific pages
│   │   └── ...
│   ├── store/                  # Zustand stores for state management (auth, cart, wishlist)
│   ├── utils/                  # Utility functions (axiosInstance, etc.)
│   ├── App.jsx                 # Main application component, handles routing
│   ├── main.jsx                # Entry point for React app
│   └── index.css               # Global styles
├── .env                        # Environment variables (local development)
├── .gitignore                  # Specifies intentionally untracked files to ignore
├── package.json                # Project dependencies and scripts
├── README.md                   # This file
└── LICENSE                     # Project license information

7. License
This software is proprietary and all rights are reserved. Please refer to the LICENSE file for detailed licensing information.

8. Contact
For any inquiries or support, please contact:

PixelsPulse.dev

Email: pixelspulse.dev@gmail.com

Website: pixelspulse.dev

9. Acknowledgements
Built with React.js

Styled with Tailwind CSS and DaisyUI

Mapping powered by Google Maps Platform
