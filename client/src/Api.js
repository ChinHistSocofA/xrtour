import axios from 'axios';

const instance = axios.create({
  headers: {
    Accept: 'application/json',
  },
});

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response.status === 401) {
      window.location = '/login';
    }
    return Promise.reject(error);
  }
);

function parseLinkHeader(response) {
  const link = response.headers?.link;
  if (link) {
    const linkRe = /<([^>]+)>; rel="([^"]+)"/g;
    const urls = {};
    let m;
    while ((m = linkRe.exec(link)) !== null) {
      const url = m[1];
      urls[m[2]] = url;
    }
    return urls;
  }
  return null;
}

const Api = {
  parseLinkHeader,
  assets: {
    create(data) {
      return instance.post('/api/assets', data);
    },
    upload(url, headers, file) {
      return instance.put(url, file, { headers });
    },
  },
  auth: {
    login(email, password) {
      return instance.post('/api/auth/login', { email, password });
    },
    logout() {
      return instance.get('/api/auth/logout');
    },
    register(data) {
      return instance.post('/api/auth/register', data);
    },
  },
  files: {
    transcribe({ id, key }) {
      if (id) {
        return instance.post(`/api/files/transcribe?id=${id}`);
      }
      if (key) {
        return instance.post(`/api/files/transcribe?key=${key}`);
      }
      throw new Error();
    },
    poll(jobName, originalName) {
      return instance.get(`/api/files/transcribe`, { params: { jobName, originalName } });
    },
    translate({ id, key, source, target, originalName }) {
      return instance.get(`/api/files/translate`, { params: { id, key, source, target, originalName } });
    },
  },
  google: {
    webfonts(key) {
      return instance.get(`https://www.googleapis.com/webfonts/v1/webfonts`, {
        params: {
          fields: 'items.family,items.subsets',
          key,
        },
      });
    },
  },
  invites: {
    index() {
      return instance.get(`/api/invites`);
    },
    create(data) {
      return instance.post('/api/invites', data);
    },
    get(id) {
      return instance.get(`/api/invites/${id}`);
    },
    accept(id, data) {
      return instance.post(`/api/invites/${id}/accept`, data);
    },
    resend(id) {
      return instance.post(`/api/invites/${id}/resend`);
    },
    revoke(id) {
      return instance.delete(`/api/invites/${id}`);
    },
  },
  mapbox: {
    directions(coordinates, access_token) {
      const coords = coordinates.map((c) => c.join(',')).join(';');
      return instance.get(`https://api.mapbox.com/directions/v5/mapbox/walking/${coords}`, {
        params: { access_token },
      });
    },
    geocode(query, access_token) {
      return instance.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`, {
        params: { access_token, type: 'address', proximity: 'ip' },
      });
    },
  },
  memberships: {
    create(data) {
      return instance.post('/api/memberships', data);
    },
    update(id, data) {
      return instance.patch(`/api/memberships/${id}`, data);
    },
    delete(id) {
      return instance.delete(`/api/memberships/${id}`);
    },
  },
  passwords: {
    reset(email) {
      return instance.post('/api/passwords', { email });
    },
    get(token) {
      return instance.get(`/api/passwords/${token}`);
    },
    update(token, password) {
      return instance.patch(`/api/passwords/${token}`, { password });
    },
  },
  resources: {
    index(TeamId, type, show, search, page) {
      return instance.get(`/api/resources`, { params: { TeamId, type, show, search, page } });
    },
    create(data) {
      return instance.post('/api/resources', data);
    },
    get(id) {
      return instance.get(`/api/resources/${id}`);
    },
    update(id, data) {
      return instance.patch(`/api/resources/${id}`, data);
    },
    delete(id) {
      return instance.delete(`/api/resources/${id}`);
    },
  },
  stops: {
    index(TeamId, type, show, search, page) {
      return instance.get(`/api/stops`, { params: { TeamId, type, show, search, page } });
    },
    create(data) {
      return instance.post('/api/stops', data);
    },
    get(id) {
      return instance.get(`/api/stops/${id}`);
    },
    translate(source, target, data) {
      return instance.post(`/api/stops/translate`, { source, target, data });
    },
    update(id, data) {
      return instance.patch(`/api/stops/${id}`, data);
    },
    archive(id) {
      return instance.delete(`/api/stops/${id}`);
    },
    restore(id) {
      return instance.patch(`/api/stops/${id}/restore`);
    },
    delete(id) {
      return instance.delete(`/api/stops/${id}?isPermanent=true`);
    },
    resources(StopId) {
      return {
        index() {
          return instance.get(`/api/stops/${StopId}/resources`);
        },
        create(data) {
          return instance.post(`/api/stops/${StopId}/resources`, data);
        },
        update(id, data) {
          return instance.patch(`/api/stops/${StopId}/resources/${id}`, data);
        },
        remove(id) {
          return instance.delete(`/api/stops/${StopId}/resources/${id}`);
        },
      };
    },
  },
  teams: {
    create(data) {
      return instance.post('/api/teams', data);
    },
    get(id) {
      return instance.get(`/api/teams/${id}`);
    },
    update(id, data) {
      return instance.patch(`/api/teams/${id}`, data);
    },
  },
  tours: {
    index(TeamId, show, page) {
      return instance.get(`/api/tours`, { params: { TeamId, show, page } });
    },
    create(data) {
      return instance.post('/api/tours', data);
    },
    get(id) {
      return instance.get(`/api/tours/${id}`);
    },
    translate(source, target, data) {
      return instance.post(`/api/tours/translate`, { source, target, data });
    },
    update(id, data) {
      return instance.patch(`/api/tours/${id}`, data);
    },
    archive(id) {
      return instance.delete(`/api/tours/${id}`);
    },
    restore(id) {
      return instance.patch(`/api/tours/${id}/restore`);
    },
    delete(id) {
      return instance.delete(`/api/tours/${id}?isPermanent=true`);
    },
    export(id) {
      return instance.get(`/api/tours/${id}/export`, { responseType: 'blob' });
    },
    import(TeamId, signed_id) {
      return instance.post(`/api/tours/import`, { TeamId, signed_id });
    },
    stops(TourId) {
      return {
        index() {
          return instance.get(`/api/tours/${TourId}/stops`);
        },
        create(data) {
          return instance.post(`/api/tours/${TourId}/stops`, data);
        },
        reorder(data) {
          return instance.patch(`/api/tours/${TourId}/stops/reorder`, data);
        },
        get(id) {
          return instance.get(`/api/tours/${TourId}/stops/${id}`);
        },
        update(id, data) {
          return instance.patch(`/api/tours/${TourId}/stops/${id}`, data);
        },
        remove(id) {
          return instance.delete(`/api/tours/${TourId}/stops/${id}`);
        },
      };
    },
  },
  users: {
    index() {
      return instance.get(`/api/users`);
    },
    me() {
      return instance.get('/api/users/me');
    },
    get(id) {
      return instance.get(`/api/users/${id}`);
    },
    update(id, data) {
      return instance.patch(`/api/users/${id}`, data);
    },
  },
  versions: {
    index(TourId) {
      return instance.get(`/api/versions`, { params: { TourId } });
    },
    create(data) {
      return instance.post(`/api/versions`, data);
    },
    update(id, data) {
      return instance.patch(`/api/versions/${id}`, data);
    },
  },
};

export default Api;
