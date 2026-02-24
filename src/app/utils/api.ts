import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const api = {
  // Projects
  async getProjects() {
    const response = await fetch(`${API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    return response.json() as Promise<ApiResponse<any[]>>;
  },

  async getProject(id: string) {
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    return response.json() as Promise<ApiResponse<any>>;
  },

  // Tools
  async getTools() {
    const response = await fetch(`${API_BASE}/tools`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    return response.json() as Promise<ApiResponse<any[]>>;
  },

  async getTool(id: string) {
    const response = await fetch(`${API_BASE}/tools/${id}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    return response.json() as Promise<ApiResponse<any>>;
  },

  // Team
  async getTeam() {
    const response = await fetch(`${API_BASE}/team`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    return response.json() as Promise<ApiResponse<any[]>>;
  },

  // Settings
  async getSettings() {
    const response = await fetch(`${API_BASE}/settings`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    return response.json() as Promise<ApiResponse<any>>;
  },
};