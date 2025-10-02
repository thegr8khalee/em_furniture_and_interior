// src/components/Admin/ProjectManagement.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore } from '../../store/useProjectsStore';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import AdminProjectListCard from './ProjectList';

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

  // Local state for pagination
  const [itemsPerPage] = useState(10); // Match your store's default limit

  useEffect(() => {
    // Initialize by fetching projects count and first page
    getProjectsCount();
    fetchProjects(1, itemsPerPage);
  }, [fetchProjects, getProjectsCount, itemsPerPage]);

  const handleAddProject = () => {
    navigate('/admin/addproject');
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchProjects(newPage, itemsPerPage);
  };

  const handlePrevPage = () => {
    if (pagination.hasPrevPage) {
      handlePageChange(pagination.currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      handlePageChange(pagination.currentPage + 1);
    }
  };

  // Calculate pagination info
  const { currentPage, totalPages } = pagination;
  const startItem = totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalCount);

  if (loading && projects.length === 0) {
    // Show a loading indicator while initial data is being fetched
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin mr-2" size={24} />
        <span>Loading Projects...</span>
      </div>
    );
  }

  if (error && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="text-red-500 text-center mb-4">
          <p className="text-lg font-semibold">Error Loading Projects</p>
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={() => fetchProjects(1, itemsPerPage)}
          className="btn btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-semibold mb-6 text-secondary font-[poppins]">
        Manage Projects
      </h2>

      {/* Header with Add button and results info */}
      <div className="flex justify-between items-center mb-6">
        <button
          className="btn btn-primary text-white border-0 shadow-0 rounded-full"
          onClick={handleAddProject}
        >
          Add New Project
        </button>
        
        {totalCount !== null && (
          <div className="text-sm text-gray-600">
            Showing {projects.length > 0 ? startItem : 0}-{endItem} of {totalCount} projects
          </div>
        )}
      </div>

      {/* Error banner for non-critical errors */}
      {error && projects.length > 0 && (
        <div className="alert alert-warning mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Projects List */}
      <div className="bg-base-200 rounded-lg space-y-2 max-h-[60vh] overflow-y-auto mb-6">
        {projects.length === 0 && !loading ? (
          <div className="text-center p-8">
            <p className="text-lg text-gray-500">No projects found.</p>
          </div>
        ) : (
          projects.map((project) => (
            <AdminProjectListCard
              key={project._id}
              item={project}
            />
          ))
        )}
        
        {/* Loading indicator for page changes */}
        {loading && projects.length > 0 && (
          <div className="flex justify-center items-center p-4">
            <Loader2 className="animate-spin mr-2" size={20} />
            <span>Loading...</span>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
          {/* Page Info */}
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
          
          {/* Pagination Buttons */}
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={handlePrevPage}
              disabled={!pagination.hasPrevPage || loading}
              className="btn btn-sm btn-outline disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            
            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {/* Show first page */}
              {currentPage > 3 && (
                <>
                  <button
                    onClick={() => handlePageChange(1)}
                    className="btn btn-sm btn-outline"
                    disabled={loading}
                  >
                    1
                  </button>
                  {currentPage > 4 && <span className="px-2">...</span>}
                </>
              )}
              
              {/* Show pages around current page */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                if (pageNum < 1 || pageNum > totalPages) return null;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    disabled={loading}
                    className={`btn btn-sm ${
                      pageNum === currentPage 
                        ? 'btn-primary text-white' 
                        : 'btn-outline'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              {/* Show last page */}
              {currentPage < totalPages - 2 && (
                <>
                  {currentPage < totalPages - 3 && <span className="px-2">...</span>}
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    className="btn btn-sm btn-outline"
                    disabled={loading}
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>
            
            {/* Next Button */}
            <button
              onClick={handleNextPage}
              disabled={!pagination.hasNextPage || loading}
              className="btn btn-sm btn-outline disabled:opacity-50"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManagement;