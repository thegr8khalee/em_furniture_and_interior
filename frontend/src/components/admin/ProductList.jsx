// src/components/AdminProductListCard.jsx
// Renamed from ListCard.jsx to be specific to Products/Cars
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../../store/useAdminStore'; // Assumed to contain delProduct
import { useProductsStore } from '../../store/useProductsStore'; // Assumed to contain getProducts
import { ChevronDown, User } from 'lucide-react'; // Assuming lucide-react icons

const AdminProductListCard = ({ item }) => {
  // NOTE: item.id is assumed to be the product/car ID (_id)
  const [isDropDownOpen, setIsDropDownOpen] = React.useState(null);
  const [dropdownHeight, setDropdownHeight] = React.useState(0);
  const dropdownRef = React.useRef(null);

  // Replace useAdminStore with the actual store where the delete function resides
  const { delProduct } = useAdminStore();
  const { getProducts } = useProductsStore();

  React.useEffect(() => {
    if (dropdownRef.current) {
      // Recalculate height whenever the dropdown is opened/closed
      setDropdownHeight(dropdownRef.current.scrollHeight);
    }
  }, [isDropDownOpen]);

  const handleDropDownClick = (itemId) => {
    // Toggle dropdown open/close state based on item.id
    setIsDropDownOpen(itemId === isDropDownOpen ? null : itemId);
  };

  const navigate = useNavigate();

  // The route is hardcoded for 'cars' in the original file, maintaining it here
  const handleEdit = (id) => {
    navigate(`/admin/products/edit/${id}`);
  };

  const handleDelete = (id) => {
    // The original logic uses window.confirm and then deletes/re-fetches
    window.confirm('Are you sure you want to delete this listing?') &&
      delProduct(id).then(() => {
        getProducts({ page: 1, limit: 10 });
      });
  };

  return (
    <div className="rounded-xl bg-base-100 shadow-md">
      <div className="w-full flex items-center justify-between p-2">
        <figure className="flex-shrink-0">
          {/* Assuming images is an array and item.images[0] is the URL */}
          <img
            src={item.images?.[0]?.url || item.images?.[0] || 'placeholder.jpg'}
            alt={item.make + ' ' + item.model}
            className="w-24 h-18 object-cover rounded-lg"
          />
        </figure>
        <div className="h-full flex flex-col space-y-1 p-1 w-full ml-3 flex-grow">
          {/* Display Car/Product Name */}
          <h2 className="font-medium text-sm sm:text-base font-[inter] flex flex-col sm:flex-row">
            {/* Adapt to product fields if not a car, e.g., item.name */}
            <span className="font-bold">{item.title}</span>
          </h2>
          {/* Display Price */}
          <p className="text-sm font-semibold font-[inter] text-primary">
            {item.isPromo && item.discountedPrice !== undefined ? (
              <>
                <span className="text-red-600 font-bold text-xl">
                  ₦
                  {Number(item.discountedPrice).toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-gray-500 line-through text">
                  ₦
                  {Number(item.price).toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-green-600 text font-semibold">
                  (
                  {(
                    ((item.price - item.discountedPrice) /
                      item.price) *
                    100
                  ).toFixed(0)}
                  % OFF)
                </span>
              </>
            ) : (
              <span className="text-red-600 font-bold text-xl">
                ₦
                {Number(item.price).toLocaleString('en-NG', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            )}
          </p>
          {/* Example of optional extra detail */}
          <p className="text-xs font-[inter] text-gray-500">
            Category: {item.category || 'N/A'}
          </p>
        </div>

        {/* Status/Badge */}
        <div className="flex flex-col items-end flex-shrink-0 mr-2">
          <p
            className={`text-xs font-semibold font-[montserrat] mb-2 px-2 py-0.5 rounded-full ${
              !item.sold
                ? 'bg-green-100 text-green-600'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {item.sold ? 'Sold' : 'Available'}
          </p>
        </div>

        {/* Dropdown Toggle Button */}
        <button
          onClick={() => handleDropDownClick(item._id)} // Use _id for consistency
          className="btn btn-circle btn-ghost btn-sm flex-shrink-0"
        >
          <ChevronDown
            className={`size-5 transition-transform duration-300 ease-in-out ${
              isDropDownOpen === item._id ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </button>
      </div>

      {/* Dropdown Content */}
      <div
        ref={dropdownRef}
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight:
            isDropDownOpen === item._id ? `${dropdownHeight}px` : '0px',
          opacity: isDropDownOpen === item._id ? 1 : 0,
        }}
      >
        <div className="flex p-2 pt-0 border-t border-base-200">
          <button
            onClick={() => handleEdit(item._id)}
            className="btn-primary btn m-2 p-2 flex-1 rounded-full text-white"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(item._id)}
            className="btn-outline border-red-500 border-2 text-red-500 hover:bg-red-500 hover:text-white btn m-2 p-2 flex-1 rounded-full"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminProductListCard;
