import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../store/useNotificationStore';
import { Bell, CheckCircle, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { PageWrapper } from '../components/animations';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { authUser, isCheckingAuth: isAuthLoading } = useAuthStore();
  const {
    notifications,
    unreadCount,
    isLoading,
    getNotifications,
    markAsRead,
    markAllRead,
    deleteNotification,
  } = useNotificationStore();

  useEffect(() => {
    if (!isAuthLoading && !authUser) {
      navigate('/login');
      return;
    }

    if (authUser) {
      getNotifications();
    }
  }, [getNotifications, authUser, isAuthLoading, navigate]);

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark notifications');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  return (
    <PageWrapper>
    <div className="min-h-screen bg-base-100 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-neutral">Notifications</h1>
            <p className="text-neutral/60 mt-1">You have {unreadCount} unread notifications</p>
          </div>
          {notifications.length > 0 && (
            <button onClick={handleMarkAllRead} className="btn btn-outline">
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="card bg-white border border-base-300">
            <div className="card-body text-center py-16">
              <Bell size={64} className="mx-auto mb-4 opacity-30" />
              <p className="text-neutral/60">No notifications yet</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification._id}
                className={`card bg-white border border-base-300 ${
                  notification.isRead ? 'opacity-80' : 'border-primary/40'
                }`}
              >
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-neutral">{notification.title}</h3>
                      <p className="text-sm text-neutral/70 mt-1">{notification.message}</p>
                      <p className="text-xs text-neutral/40 mt-2">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!notification.isRead && (
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={() => markAsRead(notification._id)}
                          title="Mark as read"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button
                        className="btn btn-xs btn-ghost text-error"
                        onClick={() => deleteNotification(notification._id)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </PageWrapper>
  );
};

export default NotificationsPage;
