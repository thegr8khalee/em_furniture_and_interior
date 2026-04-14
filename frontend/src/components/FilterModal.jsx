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
      <div className="modal-box relative w-full max-w-md p-8 bg-white border rounded-none border-base-300 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral/40 hover:text-neutral transition-colors"
          aria-label="Close filters"
        >
          <X size={24} />
        </button>
        <h2 className="font-heading text-xl font-semibold mb-1 text-center text-neutral">Filter Options</h2>
        <div className="divider-gold mx-auto mb-6" />

        <div className="space-y-4">
          {/* Price Range Filter */}
          <div>
            <label className="block text-sm font-heading font-semibold text-neutral mb-2 tracking-wide">
              Price Range (₦)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min Price"
                className="input input-bordered w-1/2 text-sm focus:border-secondary focus:outline-none"
                value={tempMinPrice}
                onChange={(e) => setTempMinPrice(e.target.value)}
              />
              <input
                type="number"
                placeholder="Max Price"
                className="input input-bordered w-1/2 text-sm focus:border-secondary focus:outline-none"
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
                className="checkbox checkbox-sm border-secondary checked:bg-secondary checked:border-secondary"
                checked={tempIsBestSellerFilter}
                onChange={(e) => setTempIsBestSellerFilter(e.target.checked)}
              />
              <span className="label-text text-sm text-neutral">Best Seller</span>
            </label>
          </div>

          {/* Promo Filter */}
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm border-secondary checked:bg-secondary checked:border-secondary"
                checked={tempIsPromoFilter}
                onChange={(e) => setTempIsPromoFilter(e.target.checked)}
              />
              <span className="label-text text-sm text-neutral">On Promotion</span>
            </label>
          </div>

          {/* Foreign Filter (conditionally rendered) */}
          {isForeignFilter !== undefined && (
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                className="checkbox checkbox-sm border-secondary checked:bg-secondary checked:border-secondary"
                  checked={tempIsForeignFilter}
                  onChange={(e) => setTempIsForeignFilter(e.target.checked)}
                />
                <span className="label-text text-sm text-neutral">Foreign</span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-between gap-4">
          <button
            type="button"
            onClick={handleClear}
            className="btn-elegant-outline flex-1 text-sm"
          >
            Clear Filters
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="btn-elegant flex-1 text-sm"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;
