// src/components/AdminCollectionListCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Star, Tag, DollarSign, Gift } from 'lucide-react';
import { toast } from 'react-hot-toast';

// NOTE: Assuming these stores exist and provide the necessary collection functions
import { useAdminStore } from '../../store/useAdminStore';
import { useCollectionStore } from '../../store/useCollectionStore';

const AdminCollectionListCard = ({ item }) => {
  // item is a Collection object
  const [isDropDownOpen, setIsDropDownOpen] = React.useState(null);
  const [dropdownHeight, setDropdownHeight] = React.useState(0);
  const dropdownRef = React.useRef(null);

  // Assuming delCollection and getCollections are defined in your stores
  const { delCollection } = useAdminStore();
  const { getCollections } = useCollectionStore();

  React.useEffect(() => {
    if (dropdownRef.current) {
      // Recalculate height whenever the dropdown is opened/closed
      setDropdownHeight(dropdownRef.current.scrollHeight);
    }
  }, [isDropDownOpen]);

  const handleDropDownClick = (itemId) => {
    // Toggle dropdown open/close state based on collection ID
    setIsDropDownOpen(itemId === isDropDownOpen ? null : itemId);
  };

  const navigate = useNavigate();

  // Route for editing a collection
  const handleEdit = (id) => {
    // Assuming the route structure is /admin/collections/edit/:id
    navigate(`/admin/collections/edit/${id}`);
  };

  const handleDelete = (id) => {
    // Delete Collection logic
    window.confirm(
      'Are you sure you want to delete this collection and unassign its products?'
    ) &&
      delCollection(id) // Assuming delCollection is available in useAdminStore
        .then(() => {
          toast.success('Collection deleted successfully!');
          getCollections({ page: 1, limit: 10 }); // Re-fetch list
        })
        .catch((error) => {
          toast.error('Failed to delete collection.');
          console.error('Delete collection failed:', error);
        });
  };

  // Use item._id for unique key and dropdown toggle
  const itemId = item._id;

  const displayPrice =
    item.isPromo && item.discountedPrice ? item.discountedPrice : item.price;

  const isDiscounted =
    item.isPromo && item.discountedPrice && item.discountedPrice < item.price;

  return (
    <div className="rounded-xl bg-base-100 shadow-lg border border-base-200">
      <div className="w-full flex items-center justify-between p-3">
        {/* Cover Image */}
        <figure className="flex-shrink-0 relative">
          <img
            src={item.coverImage?.url || 'placeholder-collection.jpg'}
            alt={item.name}
            className="w-24 h-20 object-cover rounded-lg shadow-sm"
          />
          {item.isBestSeller && (
            <span className="absolute top-0 left-0 bg-yellow-500 text-xs font-bold text-white px-2 py-0.5 rounded-br-lg">
              BEST SELLER
            </span>
          )}
        </figure>

        {/* Collection Details */}
        <div className="h-full flex flex-col space-y-1 p-1 w-full ml-3 flex-grow min-w-0">
          {/* Name */}
          <h2 className="font-semibold text-sm sm:text-lg font-[poppins] truncate">
            {item.name}
          </h2>

          {/* Style & Origin */}
          <p className="text-xs font-[inter] text-gray-500 flex items-center">
            <Tag className="size-3 mr-1 text-info" />
            {item.style}
            {item.isForeign && item.origin && ` (${item.origin})`}
          </p>

          {/* Rating */}
          <p className="text-xs font-[inter] text-gray-700 flex items-center">
            <Star className="size-3 mr-1 text-yellow-500 fill-yellow-500" />
            {item.averageRating || 0} ({item.reviews.length} Reviews)
          </p>

          {/* Price/Budget */}
          <div className="flex items-center mt-1">
            <p
              className={`text-sm font-bold font-[inter] ${
                isDiscounted ? 'text-red-500' : 'text-green-600'
              }`}
            >
              ₦{Number(displayPrice).toLocaleString()}
            </p>
            {isDiscounted && (
              <p className="text-xs font-[inter] text-gray-400 ml-2 line-through">
                ₦{Number(item.price).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Status/Promo Badge */}
        <div className="flex flex-col items-end flex-shrink-0 mr-2">
          {item.isPromo && (
            <p className="text-xs font-semibold font-[montserrat] mb-2 px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center">
              <Gift className="size-3 mr-1" />
              PROMO
            </p>
          )}
          <span className="text-xs text-gray-500">
            {item.productIds.length} Products
          </span>
        </div>

        {/* Dropdown Toggle Button */}
        <button
          onClick={() => handleDropDownClick(itemId)}
          className="btn btn-circle btn-ghost btn-sm flex-shrink-0"
        >
          <ChevronDown
            className={`size-5 text-gray-500 transition-transform duration-300 ease-in-out ${
              isDropDownOpen === itemId ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </button>
      </div>

      {/* Dropdown Content */}
      <div
        ref={dropdownRef}
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isDropDownOpen === itemId ? `${dropdownHeight}px` : '0px',
          opacity: isDropDownOpen === itemId ? 1 : 0,
        }}
      >
        <div className="flex p-3 pt-0 border-t border-base-200">
          <button
            onClick={() => handleEdit(itemId)}
            className="btn-primary btn m-1 p-2 flex-1 rounded-full text-white font-semibold"
          >
            Edit Collection
          </button>
          <button
            onClick={() => handleDelete(itemId)}
            className="btn-outline border-red-500 border-2 text-red-500 hover:bg-red-500 hover:text-white btn m-1 p-2 flex-1 rounded-full font-semibold"
          >
            Delete Collection
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminCollectionListCard;
