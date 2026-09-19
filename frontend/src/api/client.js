import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kg_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('kg_token')
      localStorage.removeItem('kg_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  me:       ()     => api.get('/auth/me'),
}

export const applicationAPI = {
  submit:         (formData) => api.post('/applications/pm-kisan', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  myApplications: ()         => api.get('/applications/my'),
  getDetail:      (id)       => api.get(`/applications/${id}`),
}

export const adminAPI = {
  // List with optional filters
  listApplications: (params = {}) => api.get('/admin/applications', { params }),
  // Get single application full anomaly dossier
  getApplicationDetail: (id) => api.get(`/admin/applications/${id}`),
  // Make decision
  decision: (id, payload) => api.post(`/admin/applications/${id}/decision`, payload),
  // Evaluation metrics
  evaluationMetrics: () => api.get('/admin/evaluation/metrics'),
  // Audit logs
  getAuditLogs: (params = {}) => api.get('/admin/audit-logs', { params }),
}

export default api
