import { create } from 'zustand';
import { axiosInstance } from '../lib/axios';

const initialPagination = {
  totalItems: 0,
  limit: 10,
  currentPage: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

export const useProjectsStore = create((set, get) => ({
  // --- State ---
  projects: [],
  selectedProject: null,
  totalCount: 0, // State to hold the total count
  loading: false,
  error: null,
  pagination: initialPagination,

  fetchProjects: async (page = 1, limit = 10) => {
    set({ loading: true, error: null });
    try {
      const response = await axiosInstance.get(`/projects`, {
        params: { page, limit },
      });

      const result = response.data;

      set({
        projects: result.data,
        pagination: result.pagination,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching projects:', error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Could not load projects.';
      set({
        error: errorMessage,
        loading: false,
        projects: [],
        pagination: initialPagination,
      });
    }
  },

  getProjectById: async (projectId) => {
    set({ loading: true, error: null, selectedProject: null });
    try {
      const response = await axiosInstance.get(`/projects/get/${projectId}`);
      const project = response.data;
      set({
        selectedProject: project,
        loading: false,
      });
      return project; // Return the project for direct use if needed
    } catch (error) {
      console.error(`Error fetching project ${projectId}:`, error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        `Could not load project ${projectId}.`;
      set({
        error: errorMessage,
        loading: false,
      });
    }
  },

  getProjectsCount: async () => {
    try {
      const response = await axiosInstance.get(`/projects/count`);

      // The controller returns { count: number }
      const count = response.data.count;

      set({ totalCount: count });
      return count; // Return count for direct use if needed
    } catch (error) {
      console.error('Error fetching project count:', error);
      // Only set error state if it's critical, otherwise just log and set count to 0
      set({ totalCount: 0 });
      return 0;
    }
  },

  clearSelectedProject: () => set({ selectedProject: null }),

  goToNextPage: () => {
    const { currentPage, hasNextPage, fetchProjects } = get();
    if (hasNextPage) {
      fetchProjects(currentPage + 1, get().pagination.limit);
    }
  },

  goToPrevPage: () => {
    const { currentPage, hasPrevPage, fetchProjects } = get();
    if (hasPrevPage) {
      fetchProjects(currentPage - 1, get().pagination.limit);
    }
  },
}));
