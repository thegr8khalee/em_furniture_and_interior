import { useState, useEffect } from 'react';
import { TrendingUp, ShoppingCart, Users, Calendar, DollarSign, Package, Award, Target, BarChart3 } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import Input from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonBlock } from '../../components/ui/Skeleton';

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Overview stats
  const [overviewStats, setOverviewStats] = useState(null);

  // Sales by category
  const [salesByCategory, setSalesByCategory] = useState([]);

  // Sales by region
  const [salesByRegion, setSalesByRegion] = useState([]);

  // Product performance
  const [productPerformance, setProductPerformance] = useState([]);

  // Designer performance
  const [designerPerformance, setDesignerPerformance] = useState([]);

  // Customer lifetime value
  const [customerLTV, setCustomerLTV] = useState([]);

  // Conversion funnel
  const [conversionFunnel, setConversionFunnel] = useState(null);

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAllData();
  }, [dateRange]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      };

      const [
        overviewRes,
        categoryRes,
        regionRes,
        productRes,
        designerRes,
        ltvRes,
        funnelRes,
      ] = await Promise.all([
        axiosInstance.get('/analytics/overview', { params }),
        axiosInstance.get('/analytics/sales/category', { params }),
        axiosInstance.get('/analytics/sales/region', { params }),
        axiosInstance.get('/analytics/products/performance', { params: { ...params, limit: 20 } }),
        axiosInstance.get('/analytics/designers/performance', { params }),
        axiosInstance.get('/analytics/customers/lifetime-value', { params: { limit: 50 } }),
        axiosInstance.get('/analytics/customers/conversion-funnel', { params }),
      ]);

      setOverviewStats(overviewRes.data.stats);
      setSalesByCategory(categoryRes.data.data);
      setSalesByRegion(regionRes.data.data);
      setProductPerformance(productRes.data.data);
      setDesignerPerformance(designerRes.data.data);
      setCustomerLTV(ltvRes.data.data);
      setConversionFunnel(funnelRes.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <AdminPageShell
      title="Analytics Dashboard"
      subtitle="Track performance metrics and business insights"
    >

        {/* Date Range Filter */}
        <div className="border border-base-300 bg-white p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-neutral/60" />
              <span className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral/65">Date Range</span>
            </div>
            <Input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} className="w-auto" />
            <span className="text-neutral/50">to</span>
            <Input type="date" value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} className="w-auto" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-base-300 mb-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'sales', label: 'Sales Analysis', icon: DollarSign },
            { id: 'products', label: 'Product Performance', icon: Package },
            { id: 'designers', label: 'Designer Performance', icon: Award },
            { id: 'customers', label: 'Customer Analytics', icon: Users },
            { id: 'conversion', label: 'Conversion Funnel', icon: Target },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-secondary text-secondary'
                  : 'border-transparent text-neutral/60 hover:text-neutral'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            <SkeletonBlock className="h-28 w-full" />
            <SkeletonBlock className="h-64 w-full" />
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && overviewStats && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="border border-base-300 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral/70">Total Revenue</p>
                        <p className="text-2xl font-bold text-neutral mt-2">
                          {formatCurrency(overviewStats.totalRevenue)}
                        </p>
                      </div>
                      <div className="bg-green-100 rounded-full p-3">
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                  </div>

                  <div className="border border-base-300 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral/70">Total Orders</p>
                        <p className="text-2xl font-bold text-neutral mt-2">
                          {overviewStats.totalOrders.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-secondary/10 rounded-full p-3">
                        <ShoppingCart className="w-6 h-6 text-secondary" />
                      </div>
                    </div>
                  </div>

                  <div className="border border-base-300 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral/70">New Customers</p>
                        <p className="text-2xl font-bold text-neutral mt-2">
                          {overviewStats.totalCustomers.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-purple-100 rounded-full p-3">
                        <Users className="w-6 h-6 text-purple-600" />
                      </div>
                    </div>
                  </div>

                  <div className="border border-base-300 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral/70">Avg Order Value</p>
                        <p className="text-2xl font-bold text-neutral mt-2">
                          {formatCurrency(overviewStats.averageOrderValue)}
                        </p>
                      </div>
                      <div className="bg-yellow-100 rounded-full p-3">
                        <TrendingUp className="w-6 h-6 text-yellow-600" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-base-300 bg-white p-6">
                  <h3 className="text-lg font-heading font-semibold text-neutral mb-4">Consultations</h3>
                  <p className="text-3xl font-bold text-neutral">
                    {overviewStats.totalConsultations.toLocaleString()}
                  </p>
                  <p className="text-sm text-neutral/60 mt-1">consultation requests in selected period</p>
                </div>
              </div>
            )}

            {/* Sales Analysis Tab */}
            {activeTab === 'sales' && (
              <div className="space-y-6">
                {/* Sales by Category */}
                <div className="border border-base-300 bg-white p-6">
                  <h3 className="text-lg font-heading font-semibold text-neutral mb-4">Sales by Category</h3>
                  {salesByCategory.length === 0 ? (
                    <EmptyState icon={BarChart3} title="No category data" description="No sales data available for the selected period" />
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-base-300">
                      <thead>
                        <tr className="border-b border-base-300">
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Category</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Revenue</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Orders</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Items Sold</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-300">
                        {salesByCategory.map((item, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral">{item._id || 'Uncategorized'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{formatCurrency(item.totalRevenue)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item.orderCount}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item.itemCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>

                {/* Sales by Region */}
                <div className="border border-base-300 bg-white p-6">
                  <h3 className="text-lg font-heading font-semibold text-neutral mb-4">Sales by Region (Top 50)</h3>
                  {salesByRegion.length === 0 ? (
                    <EmptyState icon={BarChart3} title="No region data" description="No regional sales data available for the selected period" />
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-base-300">
                      <thead>
                        <tr className="border-b border-base-300">
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">City</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">State</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Revenue</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Orders</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-300">
                        {salesByRegion.map((item, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item._id.city || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item._id.state || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{formatCurrency(item.totalRevenue)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item.orderCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              </div>
            )}

            {/* Product Performance Tab */}
            {activeTab === 'products' && (
              <div className="border border-base-300 bg-white p-6">
                <h3 className="text-lg font-heading font-semibold text-neutral mb-4">Top 20 Products</h3>
                {productPerformance.length === 0 ? (
                  <EmptyState icon={Package} title="No product data" description="No product performance data available for the selected period" />
                ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-base-300">
                    <thead>
                      <tr className="border-b border-base-300">
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Product Name</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Revenue</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Units Sold</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Orders</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-300">
                      {productPerformance.map((item, index) => (
                        <tr key={item._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">#{index + 1}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral">{item.productName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{formatCurrency(item.totalRevenue)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item.unitsSold}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item.orderCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            )}

            {/* Designer Performance Tab */}
            {activeTab === 'designers' && (
              <div className="border border-base-300 bg-white p-6">
                <h3 className="text-lg font-heading font-semibold text-neutral mb-4">Designer Performance</h3>
                {designerPerformance.length === 0 ? (
                  <EmptyState icon={Award} title="No designer data" description="No designer performance data available" />
                ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-base-300">
                    <thead>
                      <tr className="border-b border-base-300">
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Designer</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Completed</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Scheduled</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Cancelled</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-300">
                      {designerPerformance.map((item) => (
                        <tr key={item.designerId}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral">{item.designerName || 'Unknown'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item.totalConsultations}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item.completedConsultations}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item.scheduledConsultations}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item.cancelledConsultations}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item.completionRate.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            )}

            {/* Customer Analytics Tab */}
            {activeTab === 'customers' && (
              <div className="border border-base-300 bg-white p-6">
                <h3 className="text-lg font-heading font-semibold text-neutral mb-4">Top 50 Customers by Lifetime Value</h3>
                {customerLTV.length === 0 ? (
                  <EmptyState icon={Users} title="No customer data" description="No customer lifetime value data available" />
                ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-base-300">
                    <thead>
                      <tr className="border-b border-base-300">
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Total Spent</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Orders</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Avg Order</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">First Order</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Last Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-300">
                      {customerLTV.map((item, index) => (
                        <tr key={item.userId}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">#{index + 1}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral">{item.userName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{formatCurrency(item.totalSpent)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{item.orderCount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{formatCurrency(item.averageOrderValue)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{formatDate(item.firstOrder)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{formatDate(item.lastOrder)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            )}

            {/* Conversion Funnel Tab */}
            {activeTab === 'conversion' && conversionFunnel && (
              <div className="space-y-6">
                <div className="border border-base-300 bg-white p-6">
                  <h3 className="text-lg font-heading font-semibold text-neutral mb-6">Conversion Funnel</h3>
                  <div className="space-y-4">
                    {conversionFunnel.funnel.map((stage, index) => {
                      const percentage =
                        index === 0
                          ? 100
                          : (stage.count / conversionFunnel.funnel[0].count) * 100;
                      return (
                        <div key={stage.stage}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-neutral">{stage.stage}</span>
                            <span className="text-sm text-neutral/70">
                              {stage.count.toLocaleString()} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-base-200 rounded-full h-8">
                            <div
                              className="bg-secondary h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                              style={{ width: `${percentage}%` }}
                            >
                              {percentage > 10 && `${percentage.toFixed(1)}%`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Conversion Rates */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="border border-base-300 bg-white p-6">
                    <p className="text-sm font-medium text-neutral/70">Registration to Order</p>
                    <p className="text-2xl font-bold text-neutral mt-2">
                      {conversionFunnel.conversionRates.registrationToOrder.toFixed(2)}%
                    </p>
                  </div>
                  <div className="border border-base-300 bg-white p-6">
                    <p className="text-sm font-medium text-neutral/70">Order to Confirmed</p>
                    <p className="text-2xl font-bold text-neutral mt-2">
                      {conversionFunnel.conversionRates.orderToConfirmed.toFixed(2)}%
                    </p>
                  </div>
                  <div className="border border-base-300 bg-white p-6">
                    <p className="text-sm font-medium text-neutral/70">Confirmed to Paid</p>
                    <p className="text-2xl font-bold text-neutral mt-2">
                      {conversionFunnel.conversionRates.confirmedToPaid.toFixed(2)}%
                    </p>
                  </div>
                  <div className="border border-base-300 bg-white p-6">
                    <p className="text-sm font-medium text-neutral/70">Overall Conversion</p>
                    <p className="text-2xl font-bold text-secondary mt-2">
                      {conversionFunnel.conversionRates.overallConversion.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
    </AdminPageShell>
  );
};

export default AnalyticsDashboard;
