import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const ProjectContext = createContext(null);

export const ProjectProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await api.get('/projects');
      const list = res.data.projects || [];
      setProjects(list);

      // Restore active project or pick first
      const savedId = localStorage.getItem('devflow_active_project_id');
      const found = list.find((p) => p._id === savedId) || list[0] || null;
      setActiveProject(found);
      if (found) {
        localStorage.setItem('devflow_active_project_id', found._id);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    } else {
      setProjects([]);
      setActiveProject(null);
    }
  }, [isAuthenticated, fetchProjects]);

  const selectProject = (projectOrId) => {
    const project = typeof projectOrId === 'string'
      ? projects.find((p) => p._id === projectOrId)
      : projectOrId;

    if (project) {
      setActiveProject(project);
      localStorage.setItem('devflow_active_project_id', project._id);
    }
  };

  const refreshActiveProject = async () => {
    if (!activeProject) return;
    try {
      const res = await api.get(`/projects/${activeProject._id}`);
      setActiveProject(res.data.project);
      setProjects((prev) =>
        prev.map((p) => (p._id === res.data.project._id ? res.data.project : p))
      );
    } catch (err) {
      console.error('Failed to refresh project:', err);
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        loading,
        selectProject,
        fetchProjects,
        refreshActiveProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => useContext(ProjectContext);
