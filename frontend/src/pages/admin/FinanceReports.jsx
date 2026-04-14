import React, { useState, useEffect } from 'react';
import { Download, DollarSign, TrendingUp, Loader2 } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonBlock } from '../../components/ui/Skeleton';

const FinanceReports = () => {
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [range, setRange] = useState({ start: '', end: '' });
  const [includeUnpaid, setIncludeUnpaid] = useState(false);
  const [includeRefunded, setIncludeRefunded] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchRevenue = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (includeUnpaid) params.append('includeUnpaid', 'true');
      if (includeRefunded) params.append('includeRefunded', 'true');

      const response = await axiosInstance.get(`/finance/admin/revenue?${params}`);
      setSummary(response.data.summary);
      setDaily(response.data.daily);
      setRange(response.data.range);
    } catch (error) {
      toast.error('Failed to load revenue data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (includeUnpaid) params.append('includeUnpaid', 'true');
      if (includeRefunded) params.append('includeRefunded', 'true');

      const response = await axiosInstance.get(`/finance/admin/revenue/export?${params}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `revenue-${startDate || 'all'}-${endDate || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV downloaded');
    } catch (error) {
      toast.error('Failed to download CSV');
    }
  };

  useEffect(() => {
    fetchRevenue();
  }, []);

  return (
    <AdminPageShell
      title="Finance Reports"
      subtitle="View revenue breakdown and export reports"
      actions={
        <Button variant="primary" leftIcon={Download} onClick={downloadCsv}>
          Export CSV
        </Button>
      }
    >

      <div className="border border-base-300 bg-white p-5 space-y-4">
        <h2 className="font-heading text-lg font-semibold text-neutral">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="toggle toggle-sm" checked={includeUnpaid} onChange={(e) => setIncludeUnpaid(e.target.checked)} />
            <span className="text-sm text-neutral">Include unpaid</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="toggle toggle-sm" checked={includeRefunded} onChange={(e) => setIncludeRefunded(e.target.checked)} />
            <span className="text-sm text-neutral">Include refunded</span>
          </label>
        </div>
        <Button variant="secondary" onClick={fetchRevenue}>Apply Filters</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-20 w-full" />)}
        </div>
      ) : summary ? (
        <>
          <div className="stats shadow w-full">
            <div className="stat">
              <div className="stat-figure text-primary">
                <DollarSign size={32} />
              </div>
              <div className="stat-title">Total Revenue</div>
              <div className="stat-value text-primary">₦{(summary.totalAmount || 0).toLocaleString()}</div>
              <div className="stat-desc">{summary.orderCount || 0} orders</div>
            </div>
            <div className="stat">
              <div className="stat-figure text-secondary">
                <TrendingUp size={32} />
              </div>
              <div className="stat-title">Subtotal</div>
              <div className="stat-value text-secondary">₦{(summary.subtotal || 0).toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Discounts</div>
              <div className="stat-value">₦{(summary.discount || 0).toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Tax</div>
              <div className="stat-value">₦{(summary.taxAmount || 0).toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Shipping</div>
              <div className="stat-value">₦{(summary.shippingCost || 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="border border-base-300 bg-white p-5">
            <h2 className="font-heading text-lg font-semibold text-neutral mb-4">Daily Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Orders</th>
                      <th>Subtotal</th>
                      <th>Discount</th>
                      <th>Tax</th>
                      <th>Shipping</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-neutral/60">
                          No data for selected range.
                        </td>
                      </tr>
                    ) : (
                      daily.map((row) => (
                        <tr key={row._id}>
                          <td>{row._id}</td>
                          <td>{row.orderCount}</td>
                          <td>₦{(row.subtotal || 0).toLocaleString()}</td>
                          <td>₦{(row.discount || 0).toLocaleString()}</td>
                          <td>₦{(row.taxAmount || 0).toLocaleString()}</td>
                          <td>₦{(row.shippingCost || 0).toLocaleString()}</td>
                          <td className="font-bold">₦{(row.totalAmount || 0).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
            </div>
          </div>
        </>
      ) : (
        <EmptyState icon={DollarSign} title="No revenue data" description="Try adjusting your filters." />
      )}
    </AdminPageShell>
  );
};

export default FinanceReports;
