// src/pages/AdminDashboard.jsx
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import AdminDashboardContent from '../components/admin/AdminDashboardContent';
import ProductManagement from '../components/admin/ProductManagement';
import CollectionManagement from '../components/admin/CollectionManagement';
import ProjectManagement from '../components/admin/ProjectManagement';
import BlogManagement from '../components/admin/BlogManagement';
import FAQManagement from '../components/admin/FAQManagement';
import { PERMISSIONS } from '../lib/permissions';

const AdminDashboard = () => {
    const { hasPermission } = useAuthStore();
    const [searchParams] = useSearchParams();
    const activeSection = useMemo(() => searchParams.get('section') || 'dashboard', [searchParams]);

    const renderContent = () => {
        switch (activeSection) {
            case 'dashboard':
                return <AdminDashboardContent />;
            case 'products':
                return <ProductManagement />;
            case 'collections':
                return <CollectionManagement />;
            case 'projects':
                return <ProjectManagement />;
            case 'blog':
                return hasPermission(PERMISSIONS.BLOG_MANAGE) ? (
                    <BlogManagement />
                ) : (
                    <div className="p-4">Access denied.</div>
                );
            case 'faqs':
                return hasPermission(PERMISSIONS.FAQ_MANAGE) ? (
                    <FAQManagement />
                ) : (
                    <div className="p-4">Access denied.</div>
                );
            default:
                return <AdminDashboardContent />;
        }
    };

    return renderContent();
};

export default AdminDashboard;
