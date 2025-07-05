// src/components/Shop/FilterModal.jsx
import React from 'react';
import { X } from 'lucide-react'; // For close icon

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
    setIsPriceFilterApplied, // To indicate price inputs were touched
    onApplyFilters, // Callback for Apply button
    onClearFilters // Callback for Clear button
}) => {
    if (!isOpen) return null;

    return (
        <div className="px-2 modal modal-open flex items-center justify-center z-50">
            <div className="modal-box relative w-full max-w-md p-6 rounded-lg shadow-2xl bg-base-100">
                <button
                    className="btn btn-sm btn-circle absolute right-4 top-4"
                    onClick={onClose}
                    aria-label="Close filters"
                >
                    <X size={20} />
                </button>
                <h3 className="font-bold text-2xl mb-6 text-primary font-[poppins]">More Filters</h3>

                <div className="space-y-6">
                    {/* Price Range Filter */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text text-lg font-semibold">Price Range</span>
                        </label>
                        <div className="flex space-x-3">
                            <input
                                type="number"
                                placeholder="Min Price"
                                className="input input-bordered w-1/2 rounded-xl"
                                value={minPrice}
                                onChange={(e) => { setMinPrice(e.target.value); setIsPriceFilterApplied(true); }}
                            />
                            <input
                                type="number"
                                placeholder="Max Price"
                                className="input input-bordered w-1/2 rounded-xl"
                                value={maxPrice}
                                onChange={(e) => { setMaxPrice(e.target.value); setIsPriceFilterApplied(true); }}
                            />
                        </div>
                    </div>

                    {/* Checkbox Filters */}
                    <div className="space-y-3">
                        <div className="form-control">
                            <label className="label cursor-pointer gap-4">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-primary"
                                    checked={isBestSellerFilter}
                                    onChange={(e) => setIsBestSellerFilter(e.target.checked)}
                                />
                                <span className="label-text text-lg">Best Seller</span>
                            </label>
                        </div>

                        <div className="form-control">
                            <label className="label cursor-pointer gap-4">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-primary"
                                    checked={isPromoFilter}
                                    onChange={(e) => setIsPromoFilter(e.target.checked)}
                                />
                                <span className="label-text text-lg">Promotion</span>
                            </label>
                        </div>

                        <div className="form-control">
                            <label className="label cursor-pointer gap-4">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-primary"
                                    checked={isForeignFilter}
                                    onChange={(e) => setIsForeignFilter(e.target.checked)}
                                />
                                <span className="label-text text-lg">Foreign</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="modal-action mt-8 flex justify-end space-x-3">
                    <button
                        className="btn btn-ghost rounded-xl"
                        onClick={onClearFilters}
                    >
                        Clear Filters
                    </button>
                    <button
                        className="btn btn-primary rounded-xl text-black"
                        onClick={onApplyFilters}
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FilterModal;
