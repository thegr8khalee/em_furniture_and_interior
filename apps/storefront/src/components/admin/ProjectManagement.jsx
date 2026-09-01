// src/components/Admin/ProjectManagement.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore } from '../../store/useProjectsStore';
import { Loader2, Briefcase, Search, Plus, LayoutGrid, List } from 'lucide-react';
import AdminProjectListCard from './ProjectList';
import Button from '../ui/Button';
import Pagination from '../ui/Pagination';
import EmptyState from '../ui/EmptyState';

const CATEGORIES = ['All', 'Residential', 'Commercial', 'Hospitality', 'Renovation'];

const ProjectManagement = () => {
  const {
    projects,
    fetchProjects,
    loading,
    error,
    pagination,
    getProjectsCount,
    totalCount
  } = useProjectsStore();

  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const itemsPerPage = 10;

  useEffect(() => {
    getProjectsCount();
    fetchProjects(1, itemsPerPage);
  }, [fetchProjects, getProjectsCount, itemsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchProjects(newPage, itemsPerPage);
  };

  const { currentPage, totalPages } = pagination;
  const startItem = totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalCount);

  // Client-side filtering for search and category
  const filteredProjects = projects.filter((p) => {
    const matchesSearch = !searchTerm.trim() ||
      p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (error && projects.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Error Loading Projects"
        description={error}
        actionLabel="Retry"
        onAction={() => fetchProjects(1, itemsPerPage)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-neutral">Projects</h2>
          <p className="mt-1 text-sm text-neutral/50">
            {totalCount != null ? `${totalCount} total projects` : 'Loading...'}
          </p>
        </div>
        <Button variant="primary" leftIcon={Plus} onClick={() => navigate('/admin/addproject')}>
          Add Project
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 border border-base-300 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral/40" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-base-300 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral placeholder:text-neutral/40 focus:border-secondary focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-base-300 bg-white px-3 py-2.5 text-sm text-neutral focus:border-secondary focus:outline-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="hidden border-l border-base-300 pl-2 sm:flex">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'text-primary' : 'text-neutral/30 hover:text-neutral/60'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'text-primary' : 'text-neutral/30 hover:text-neutral/60'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {error && projects.length > 0 && (
        <div className="border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>
      )}

      {/* Results count */}
      {totalCount != null && filteredProjects.length > 0 && (
        <p className="text-xs font-medium uppercase tracking-wider text-neutral/40">
          Showing {filteredProjects.length} of {totalCount}
        </p>
      )}

      {/* Loading */}
      {loading && projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-3 animate-spin text-secondary" size={32} />
          <span className="text-sm text-neutral/50">Loading projects...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No projects found"
          description={searchTerm || categoryFilter !== 'All' ? 'Try adjusting your search or filters.' : 'Create your first project to showcase your work.'}
          actionLabel="Add Project"
          onAction={() => navigate('/admin/addproject')}
        />
      ) : (
        <>
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'space-y-3'
          }>
            {filteredProjects.map((project) => (
              <AdminProjectListCard key={project._id} item={project} viewMode={viewMode} />
            ))}
          </div>
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-secondary" size={20} />
            </div>
          )}
        </>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
    </div>
  );
};

export default ProjectManagement;