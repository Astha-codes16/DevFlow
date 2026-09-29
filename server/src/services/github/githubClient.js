/**
 * Production-ready GitHub REST API Client
 * Interfaces directly with the official GitHub REST API (v3)
 */

class GitHubClient {
  constructor() {
    this.baseUrl = 'https://api.github.com';
    this.cache = new Map();
    this.cacheTTL = 60 * 1000; // 60 seconds cache for rate-limit protection
  }

  getAuthToken(overrideToken) {
    if (overrideToken && overrideToken.trim()) return overrideToken.trim();
    return process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : '';
  }

  getHeaders(token) {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'DevFlow-AI-Platform',
    };
    const activeToken = this.getAuthToken(token);
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }
    return headers;
  }

  async request(endpoint, options = {}, token = null) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const cacheKey = `${options.method || 'GET'}:${url}`;

    // Cache check for GET requests
    if (!options.method || options.method === 'GET') {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    const headers = {
      ...this.getHeaders(token),
      ...(options.headers || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `GitHub API error (${response.status} ${response.statusText})`;
      try {
        const errorBody = await response.json();
        if (errorBody.message) {
          errorMessage = errorBody.message;
        }
      } catch {
        // use status text
      }

      if (response.status === 401) {
        throw new Error(`GitHub Authentication Failed: ${errorMessage}`);
      } else if (response.status === 403) {
        throw new Error(`GitHub Rate Limit or Access Forbidden: ${errorMessage}`);
      } else if (response.status === 404) {
        throw new Error(`GitHub Resource Not Found: ${errorMessage}`);
      } else {
        throw new Error(errorMessage);
      }
    }

    const data = await response.json();

    // Cache successful GET responses
    if (!options.method || options.method === 'GET') {
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data,
      });
    }

    return data;
  }

  /**
   * Fetches repository information from /repos/:owner/:repo
   */
  async getRepository(owner, repo, token = null) {
    return this.request(`/repos/${owner}/${repo}`, {}, token);
  }

  /**
   * Fetches pull requests from /repos/:owner/:repo/pulls
   */
  async getPullRequests(owner, repo, options = {}, token = null) {
    const query = new URLSearchParams(options);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/repos/${owner}/${repo}/pulls${queryString}`, {}, token);
  }

  clearCache(prefix = '') {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const githubClient = new GitHubClient();
