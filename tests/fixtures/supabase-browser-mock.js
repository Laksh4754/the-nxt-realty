(() => {
  window.supabase = {
    createClient(projectUrl, publicKey) {
      return {
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
