// src/components/Shop/FilterModal.jsx
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const FilterModal = ({
  isOpen,
  onClose,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  isBestSellerFilter,
  setIsBestSellerFilter,
  isPromoFilter,
  setIsPromoFilter,
  isForeignFilter,
  setIsForeignFilter,
  setIsPriceFilterApplied,
  onApplyFilters,
  onClearFilters,
}) => {
  // Internal states for the modal inputs
  const [tempMinPrice, setTempMinPrice] = useState(minPrice);
  const [tempMaxPrice, setTempMaxPrice] = useState(maxPrice);
  const [tempIsBestSellerFilter, setTempIsBestSellerFilter] =
    useState(isBestSellerFilter);
  const [tempIsPromoFilter, setTempIsPromoFilter] = useState(isPromoFilter);
  const [tempIsForeignFilter, setTempIsForeignFilter] =
    useState(isForeignFilter);

  // Effect to synchronize internal states with props when the modal opens
  useEffect(() => {
    if (isOpen) {
      setTempMinPrice(minPrice);
      setTempMaxPrice(maxPrice);
      setTempIsBestSellerFilter(isBestSellerFilter);
      setTempIsPromoFilter(isPromoFilter);
      setTempIsForeignFilter(isForeignFilter);
    }
  }, [
    isOpen,
    minPrice,
    maxPrice,
    isBestSellerFilter,
    isPromoFilter,
    isForeignFilter,
  ]);

  // Handle applying filters
  const handleApply = () => {
    // Update parent's states with temporary values from the modal
    setMinPrice(tempMinPrice);
    setMaxPrice(tempMaxPrice);
    setIsBestSellerFilter(tempIsBestSellerFilter);
    setIsPromoFilter(tempIsPromoFilter);
    setIsForeignFilter(tempIsForeignFilter);
    setIsPriceFilterApplied(true); // Indicate that price filters were explicitly applied
    onApplyFilters(); // Trigger the parent's apply function (which will close the modal and re-fetch)
  };

  // Handle clearing filters
  const handleClear = () => {
    // Reset temporary states to default values
    setTempMinPrice('');
    setTempMaxPrice('');
    setTempIsBestSellerFilter(false);
    setTempIsPromoFilter(false);
    setTempIsForeignFilter(false);

    // Reset parent's states to default values
    setMinPrice('');
    setMaxPrice('');
    setIsBestSellerFilter(false);
    setIsPromoFilter(false);
    setIsForeignFilter(false);
    setIsPriceFilterApplied(false); // Clear the price filter applied flag
    onClearFilters(); // Trigger the parent's clear function (which will close the modal and re-fetch)
  };

  if (!isOpen) return null;

  return (
    <div className="px-2 modal modal-open flex items-center justify-center z-50">
      <div className="modal-box relative w-full max-w-md p-6 rounded-lg shadow-2xl bg-base-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          aria-label="Close filters"
        >
          <X size={24} />
        </button>
        <h2 className="text-2xl font-bold mb-6 text-center">Filter Options</h2>

        <div className="space-y-4">
          {/* Price Range Filter */}
          <div>
            <label className="block text-lg font-semibold mb-2">
              Price Range (₦)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min Price"
                className="input input-bordered w-1/2 rounded-md"
                value={tempMinPrice}
                onChange={(e) => setTempMinPrice(e.target.value)}
              />
              <input
                type="number"
                placeholder="Max Price"
                className="input input-bordered w-1/2 rounded-md"
                value={tempMaxPrice}
                onChange={(e) => setTempMaxPrice(e.target.value)}
              />
            </div>
          </div>

          {/* Best Seller Filter */}
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={tempIsBestSellerFilter}
                onChange={(e) => setTempIsBestSellerFilter(e.target.checked)}
              />
              <span className="label-text text-lg">Best Seller</span>
            </label>
          </div>

          {/* Promo Filter */}
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={tempIsPromoFilter}
                onChange={(e) => setTempIsPromoFilter(e.target.checked)}
              />
              <span className="label-text text-lg">On Promotion</span>
            </label>
          </div>

          {/* Foreign Filter (conditionally rendered) */}
          {isForeignFilter !== undefined && (
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={tempIsForeignFilter}
                  onChange={(e) => setTempIsForeignFilter(e.target.checked)}
                />
                <span className="label-text text-lg">Foreign</span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-between gap-4">
          <button
            type="button"
            onClick={handleClear}
            className="btn btn-ghost rounded-xl flex-1"
          >
            Clear Filters
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="btn btn-primary flex-1 rounded-xl text-black"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;
