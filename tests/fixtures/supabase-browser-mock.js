(() => {
  window.supabase = {
    createClient(projectUrl, publicKey) {
      return {
        auth: {
          async getSession() { return { data: { session: window.__NXT_TEST_ADMIN__ ? { user: { id: 'fixture-admin', email: 'admin@example.test' } } : null }, error: null }; },
          onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
          async signOut() { return { error: null }; },
        },
        async rpc(name) { return { data: window.__NXT_TEST_ADMIN__ && name === 'is_nxt_admin', error: null }; },
        functions: {
          async invoke(name, options = {}) {
            try {
              const response = await fetch(`${projectUrl}/functions/v1/${name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: publicKey, Authorization: `Bearer ${publicKey}` },
                body: JSON.stringify(options.body || {}), signal: options.signal
              });
              const data = await response.json().catch(() => null);
              return response.ok ? { data, error: null } : { data, error: new Error(data?.error || `Function request failed (${response.status})`) };
            } catch (error) { return { data: null, error }; }
          }
        },
        from(table) {
          const params = new URLSearchParams();
          let single = false;
          return {
            select(columns) { params.set('select', columns); return this; },
            eq(column, value) { params.set(column, `eq.${value}`); return this; },
            order(column, options = {}) {
              const current = params.get('order');
              const part = `${column}.${options.ascending === false ? 'desc' : 'asc'}`;
              params.set('order', current ? `${current},${part}` : part);
              return this;
            },
            limit(value) { params.set('limit', String(value)); return this; },
            single() { single = true; return this; },
            async insert(body) {
              const response = await fetch(`${projectUrl}/rest/v1/${table}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: publicKey },
                body: JSON.stringify(body)
              });
              if (!response.ok) throw new Error('Intercepted Supabase write was aborted');
              return { data: null, error: null };
            },
            then(resolve, reject) {
              const query = params.toString();
              const suffix = query ? `?${query}` : '';
              return fetch(`${projectUrl}/rest/v1/${table}${suffix}`, {
                method: 'GET',
                headers: { apikey: publicKey }
              }).then(async response => {
                if (!response.ok) throw new Error('Fixture query failed');
                const data = await response.json();
                return { data: single ? data[0] || null : data, error: null };
              }).then(resolve, reject);
            }
          };
        }
      };
    }
  };
})();
