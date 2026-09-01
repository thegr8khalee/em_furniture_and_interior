import { useState, useEffect } from 'react';
import { Shield, Download, Trash2, Calendar, User, Activity } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import { SkeletonBlock } from '../../components/ui/Skeleton';

const SecurityLogs = () => {
  const [activeTab, setActiveTab] = useState('audit');
  const [loading, setLoading] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditStats, setAuditStats] = useState(null);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 50, total: 0 });

  // Activity logs state
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityStats, setActivityStats] = useState(null);
  const [activityPagination, setActivityPagination] = useState({ page: 1, limit: 50, total: 0 });

  // Filters
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    resourceType: '',
    status: '',
    startDate: '',
    endDate: '',
  });

  const [activityFilters, setActivityFilters] = useState({
    activityType: '',
    resourceType: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
      fetchAuditStats();
    } else {
      fetchActivityLogs();
      fetchActivityStats();
    }
  }, [activeTab, auditPagination.page, activityPagination.page, auditFilters, activityFilters]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: auditPagination.page,
        limit: auditPagination.limit,
        ...auditFilters,
      };

      const res = await axiosInstance.get('/logs/audit', { params });
      setAuditLogs(res.data.data);
      setAuditPagination((prev) => ({ ...prev, ...res.data.pagination }));
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditStats = async () => {
    try {
      const params = {
        startDate: auditFilters.startDate,
        endDate: auditFilters.endDate,
      };

      const res = await axiosInstance.get('/logs/audit/stats', { params });
      setAuditStats(res.data.stats);
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    }
  };

  const fetchActivityLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: activityPagination.page,
        limit: activityPagination.limit,
        ...activityFilters,
      };

      const res = await axiosInstance.get('/logs/activity', { params });
      setActivityLogs(res.data.data);
      setActivityPagination((prev) => ({ ...prev, ...res.data.pagination }));
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityStats = async () => {
    try {
      const params = {
        startDate: activityFilters.startDate,
        endDate: activityFilters.endDate,
      };

      const res = await axiosInstance.get('/logs/activity/stats', { params });
      setActivityStats(res.data.stats);
    } catch (error) {
      console.error('Error fetching activity stats:', error);
    }
  };

  const handleCleanupAuditLogs = async () => {
    if (!window.confirm('Are you sure you want to delete audit logs older than 90 days?')) {
      return;
    }

    try {
      const res = await axiosInstance.post('/logs/audit/cleanup', { daysToKeep: 90 });
      toast.success(res.data.message);
      fetchAuditLogs();
    } catch (error) {
      console.error('Error cleaning up audit logs:', error);
      toast.error('Failed to cleanup audit logs');
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AdminPageShell
      title="Security & Activity Logs"
      subtitle="Monitor system activity and admin actions"
      actions={
        activeTab === 'audit' && (
          <Button variant="danger" leftIcon={Trash2} onClick={handleCleanupAuditLogs}>
            Cleanup Old Logs
          </Button>
        )
      }
    >

        {/* Tabs */}
        <div className="flex border-b border-base-300 mb-6">
          {[
            { id: 'audit', label: 'Audit Logs', icon: Shield },
            { id: 'activity', label: 'Activity Logs', icon: Activity },
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

        {/* Audit Logs Tab */}
        {activeTab === 'audit' && (
          <>
            {/* Filters */}
            <div className="border border-base-300 bg-white p-4 mb-6">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Filters</span>
                <Select value={auditFilters.action} onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })} className="w-auto">
                  <option value="">All Actions</option>
                  <option value="CREATE">Create</option>
                  <option value="UPDATE">Update</option>
                  <option value="DELETE">Delete</option>
                  <option value="LOGIN">Login</option>
                  <option value="LOGOUT">Logout</option>
                  <option value="STATUS_CHANGE">Status Change</option>
                  <option value="EXPORT">Export</option>
                </Select>
                <Select value={auditFilters.resourceType} onChange={(e) => setAuditFilters({ ...auditFilters, resourceType: e.target.value })} className="w-auto">
                  <option value="">All Resources</option>
                  <option value="Product">Product</option>
                  <option value="Collection">Collection</option>
                  <option value="Order">Order</option>
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </Select>
                <Input type="date" value={auditFilters.startDate} onChange={(e) => setAuditFilters({ ...auditFilters, startDate: e.target.value })} className="w-auto" />
                <Input type="date" value={auditFilters.endDate} onChange={(e) => setAuditFilters({ ...auditFilters, endDate: e.target.value })} className="w-auto" />
              </div>
            </div>

            {/* Stats */}
            {auditStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="border border-base-300 bg-white p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65 mb-3">Top Actions</h3>
                  <div className="space-y-2">
                    {auditStats.byAction.slice(0, 5).map((item) => (
                      <div key={item._id} className="flex justify-between text-sm">
                        <span className="text-neutral">{item._id}</span>
                        <span className="font-semibold text-neutral">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-base-300 bg-white p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65 mb-3">Top Resources</h3>
                  <div className="space-y-2">
                    {auditStats.byResource.slice(0, 5).map((item) => (
                      <div key={item._id} className="flex justify-between text-sm">
                        <span className="text-neutral">{item._id}</span>
                        <span className="font-semibold text-neutral">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-base-300 bg-white p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65 mb-3">Top Actors</h3>
                  <div className="space-y-2">
                    {auditStats.byActor.slice(0, 5).map((item) => (
                      <div key={item._id} className="flex justify-between text-sm">
                        <span className="text-neutral truncate">{item.actorEmail}</span>
                        <span className="font-semibold text-neutral">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Audit Logs Table */}
            <div className="border border-base-300 bg-white p-6">
              <h3 className="text-lg font-heading font-semibold text-neutral mb-4">Audit Log Entries</h3>
              {loading ? (
                <div className="space-y-3">
                  <SkeletonBlock className="h-10 w-full" />
                  <SkeletonBlock className="h-64 w-full" />
                </div>
              ) : auditLogs.length === 0 ? (
                <EmptyState icon={Shield} title="No audit logs" description="No audit log entries match your filters" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-base-300">
                      <thead>
                        <tr className="border-b border-base-300">
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Timestamp</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Actor</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Action</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Resource</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">IP Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-300">
                        {auditLogs.map((log) => (
                          <tr key={log._id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{formatDate(log.createdAt)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{log.actorEmail}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <Badge variant={log.action === 'CREATE' ? 'success' : log.action === 'DELETE' ? 'error' : log.action === 'UPDATE' ? 'info' : 'neutral'}>
                                {log.action}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">
                              {log.resourceType}
                              {log.resourceName && <><br /><span className="text-xs text-neutral/60">{log.resourceName}</span></>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <Badge variant={log.status === 'success' ? 'success' : 'error'}>{log.status}</Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{log.ipAddress || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {auditPagination.total > auditPagination.limit && (
                    <div className="mt-4">
                      <Pagination
                        currentPage={auditPagination.page}
                        totalPages={auditPagination.pages || Math.ceil(auditPagination.total / auditPagination.limit)}
                        onPageChange={(page) => setAuditPagination({ ...auditPagination, page })}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* Activity Logs Tab */}
        {activeTab === 'activity' && (
          <>
            {/* Filters */}
            <div className="border border-base-300 bg-white p-4 mb-6">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Filters</span>
                <Select value={activityFilters.activityType} onChange={(e) => setActivityFilters({ ...activityFilters, activityType: e.target.value })} className="w-auto">
                  <option value="">All Activities</option>
                  <option value="PRODUCT_VIEW">Product View</option>
                  <option value="ADD_TO_CART">Add to Cart</option>
                  <option value="ORDER_PLACED">Order Placed</option>
                  <option value="SEARCH">Search</option>
                  <option value="LOGIN">Login</option>
                </Select>
                <Input type="date" value={activityFilters.startDate} onChange={(e) => setActivityFilters({ ...activityFilters, startDate: e.target.value })} className="w-auto" />
                <Input type="date" value={activityFilters.endDate} onChange={(e) => setActivityFilters({ ...activityFilters, endDate: e.target.value })} className="w-auto" />
              </div>
            </div>

            {/* Stats */}
            {activityStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="border border-base-300 bg-white p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65 mb-3">Top Activities</h3>
                  <div className="space-y-2">
                    {activityStats.byActivity.slice(0, 5).map((item) => (
                      <div key={item._id} className="flex justify-between text-sm">
                        <span className="text-neutral">{item._id}</span>
                        <span className="font-semibold text-neutral">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-base-300 bg-white p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65 mb-3">Top Resources</h3>
                  <div className="space-y-2">
                    {activityStats.byResource.slice(0, 5).map((item) => (
                      <div key={item._id} className="flex justify-between text-sm">
                        <span className="text-neutral">{item._id}</span>
                        <span className="font-semibold text-neutral">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-base-300 bg-white p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65 mb-3">Top Users</h3>
                  <div className="space-y-2">
                    {activityStats.topUsers.slice(0, 5).map((item) => (
                      <div key={item.userId} className="flex justify-between text-sm">
                        <span className="text-neutral truncate">{item.userName}</span>
                        <span className="font-semibold text-neutral">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Activity Logs Table */}
            <div className="border border-base-300 bg-white p-6">
              <h3 className="text-lg font-heading font-semibold text-neutral mb-4">Activity Log Entries</h3>
              {loading ? (
                <div className="space-y-3">
                  <SkeletonBlock className="h-10 w-full" />
                  <SkeletonBlock className="h-64 w-full" />
                </div>
              ) : activityLogs.length === 0 ? (
                <EmptyState icon={Activity} title="No activity logs" description="No activity log entries match your filters" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-base-300">
                      <thead>
                        <tr className="border-b border-base-300">
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Timestamp</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">User</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Activity</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Resource</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">IP Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-300">
                        {activityLogs.map((log) => (
                          <tr key={log._id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{formatDate(log.createdAt)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">
                              {log.user ? (
                                <>
                                  {log.user.firstName} {log.user.lastName}
                                  <br />
                                  <span className="text-xs text-neutral/60">{log.user.email}</span>
                                </>
                              ) : (
                                <span className="text-neutral/50">Guest</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <Badge variant="info">{log.activityType}</Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{log.resourceType || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral">{log.ipAddress || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {activityPagination.total > activityPagination.limit && (
                    <div className="mt-4">
                      <Pagination
                        currentPage={activityPagination.page}
                        totalPages={activityPagination.pages || Math.ceil(activityPagination.total / activityPagination.limit)}
                        onPageChange={(page) => setActivityPagination({ ...activityPagination, page })}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
    </AdminPageShell>
  );
};

export default SecurityLogs;
