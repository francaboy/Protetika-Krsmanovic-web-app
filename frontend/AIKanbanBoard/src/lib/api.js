import axios from "axios";

const TOKEN_KEY = "kanban_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5050/api",
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.error || error.message || "Došlo je do neočekivane greške";
    if (error.response?.status === 401 && getToken()) {
      clearToken();
      if (!location.pathname.startsWith("/prijava") && !location.pathname.startsWith("/login")) {
        location.assign("/prijava");
      }
    }
    return Promise.reject(new Error(message));
  }
);

export default api;

/* ----------------------------- API rute i pozivi ----------------------------- */
export const authApi = {
  register: (data) => api.post("/auth/register", data).then((r) => r.data),
  login: (data) => api.post("/auth/login", data).then((r) => r.data),
  resetPasswordWithPin: (data) => api.post("/auth/reset-password-pin", data).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data.user),
};

export const userApi = {
  search: (q) => api.get("/users/search", { params: { q } }).then((r) => r.data.users),
  updateProfile: (data) => api.put("/users/profile", data).then((r) => r.data),
  changePassword: (data) => api.put("/users/change-password", data).then((r) => r.data),
  updateRole: (userId, role) => api.patch(`/users/${userId}/role`, { role }).then((r) => r.data),
  deleteUser: (userId) => api.delete(`/users/${userId}`).then((r) => r.data),
};

export const boardApi = {
  list: () => api.get("/boards").then((r) => r.data.boards),
  create: (data) => api.post("/boards", data).then((r) => r.data.board),
  get: (id) => api.get(`/boards/${id}`).then((r) => r.data),
  update: (id, data) => api.patch(`/boards/${id}`, data).then((r) => r.data.board),
  remove: (id) => api.delete(`/boards/${id}`).then((r) => r.data),
  activity: (id, limit = 30) =>
    api.get(`/boards/${id}/activity`, { params: { limit } }).then((r) => r.data.activities),
  clearActivity: (id) => api.delete(`/boards/${id}/activity`).then((r) => r.data),
  addMember: (id, data) => api.post(`/boards/${id}/members`, data).then((r) => r.data.member),
  removeMember: (id, userId) => api.delete(`/boards/${id}/members/${userId}`).then((r) => r.data),
};

export const columnApi = {
  create: (boardId, data) =>
    api.post(`/boards/${boardId}/columns`, data).then((r) => r.data.column),
  update: (boardId, columnId, data) =>
    api.patch(`/boards/${boardId}/columns/${columnId}`, data).then((r) => r.data.column),
  remove: (boardId, columnId) =>
    api.delete(`/boards/${boardId}/columns/${columnId}`).then((r) => r.data),
};

export const taskApi = {
  list: (boardId, params) =>
    api.get(`/boards/${boardId}/tasks`, { params }).then((r) => r.data.tasks),
  create: (boardId, data) =>
    api.post(`/boards/${boardId}/tasks`, data).then((r) => r.data.task),
  update: (boardId, taskId, data) =>
    api.patch(`/boards/${boardId}/tasks/${taskId}`, data).then((r) => r.data.task),
  move: (boardId, taskId, data) =>
    api.patch(`/boards/${boardId}/tasks/${taskId}/move`, data).then((r) => r.data.task),
  archive: (boardId, taskId) =>
    api.patch(`/boards/${boardId}/tasks/${taskId}/archive`).then((r) => r.data.task),
  restore: (boardId, taskId) =>
    api.patch(`/boards/${boardId}/tasks/${taskId}/restore`).then((r) => r.data.task),
  listArchived: () =>
    api.get("/boards/archived-tasks/all").then((r) => r.data.tasks),
  remove: (boardId, taskId) =>
    api.delete(`/boards/${boardId}/tasks/${taskId}`).then((r) => r.data),
};

export const aiApi = {
  generateTasks: (boardId, data) =>
    api.post(`/boards/${boardId}/ai/generate-tasks`, data).then((r) => r.data),
  breakdown: (boardId, data) =>
    api.post(`/boards/${boardId}/ai/breakdown`, data).then((r) => r.data.subtasks),
  summary: (boardId) => api.post(`/boards/${boardId}/ai/summary`).then((r) => r.data.summary),
};

export const notificationApi = {
  list: () => api.get("/notifications").then((r) => r.data),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllAsRead: () => api.patch("/notifications/read-all").then((r) => r.data),
  clearAll: () => api.delete("/notifications/clear-all").then((r) => r.data),
};