import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useCompareStore } from '../store/useCompareStore';
import { useProductsStore } from '../store/useProductsStore';
import { PageWrapper } from '../components/animations';
import SEO from '../components/SEO';

const formatPrice = (value) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return '-';
  }
  return `NGN ${Number(value).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatShippingWindow = (minDays, maxDays) => {
  if (minDays === undefined && maxDays === undefined) {
    return '-';
  }
  if (minDays !== undefined && maxDays !== undefined) {
    return `${minDays} to ${maxDays}`;
  }
  if (minDays !== undefined) {
    return `${minDays}`;
  }
  return `${maxDays}`;
};

const CompareProducts = () => {
  const navigate = useNavigate();
  const { compareIds, removeFromCompare, clearCompare, setCompareIds } =
    useCompareStore();
  const { getProductsByIds } = useProductsStore();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      if (!compareIds.length) {
        setProducts([]);
        return;
      }

      setIsLoading(true);
      const data = await getProductsByIds(compareIds);
      setProducts(data);

      const validIds = data.map((product) => product._id);
      if (validIds.length !== compareIds.length) {
        setCompareIds(validIds);
      }
      setIsLoading(false);
    };

    loadProducts();
  }, [compareIds, getProductsByIds, setCompareIds]);

  const rows = useMemo(
    () => [
      {
        label: 'Price',
        value: (product) =>
          product.isPromo && product.discountedPrice !== undefined
            ? `${formatPrice(product.discountedPrice)} (was ${formatPrice(product.price)})`
            : formatPrice(product.price),
      },
      {
        label: 'Category',
        value: (product) => product.category || '-',
      },
      {
        label: 'Style',
        value: (product) => product.style || '-',
      },
      {
        label: 'Items',
        value: (product) => product.items || '-',
      },
      {
        label: 'Origin',
        value: (product) =>
          product.isForeign ? product.origin || 'Foreign' : 'Local',
      },
      {
        label: 'Lead time (days)',
        value: (product) =>
          product.leadTimeDays !== undefined ? product.leadTimeDays : '-',
      },
      {
        label: 'Shipping window (days)',
        value: (product) =>
          formatShippingWindow(product.shippingMinDays, product.shippingMaxDays),
      },
    ],
    []
  );

  if (compareIds.length === 0) {
    return (
      <div className="min-h-screen bg-white pt-20">
        <div className="max-w-4xl mx-auto px-6 py-10 text-center">
          <h1 className="font-heading text-3xl font-bold text-neutral mb-3">
            Compare Products
          </h1>
          <p className="text-neutral/70 mb-6">
            Your compare list is empty. Add products from the shop to compare.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/shop')}
          >
            Go to shop
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper>
    <SEO title="Compare Products" description="Compare your selected products." canonical="/compare" noindex />
    <div className="min-h-screen bg-white pt-20">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl font-bold text-neutral">
              Compare Products
            </h1>
            <p className="text-neutral/70 text-sm">
              Compare up to four products side by side.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={clearCompare}
          >
            Clear compare
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-base-300">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="bg-base-200 text-left">Attribute</th>
                  {products.map((product) => (
                    <th key={product._id} className="bg-base-200 text-left">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm">
                          {product.name}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => removeFromCompare(product._id)}
                          aria-label="Remove from compare"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold">Preview</td>
                  {products.map((product) => (
                    <td key={product._id}>
                      <div className="flex flex-col gap-2">
                        <img
                          src={product.images?.[0]?.url}
                          alt={product.name}
                          className="w-full max-w-[180px] h-28 object-cover"
                        />
                        <Link
                          to={`/product/${product._id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          View product
                        </Link>
                      </div>
                    </td>
                  ))}
                </tr>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td className="font-semibold">{row.label}</td>
                    {products.map((product) => (
                      <td key={`${row.label}-${product._id}`}>
                        {row.value(product)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </PageWrapper>
  );
};

export default CompareProducts;
