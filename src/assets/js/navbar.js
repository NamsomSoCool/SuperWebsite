class SiteHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._pageCache = new Map(); // fullUrl -> Promise<{ doc: Document }>
  }

  // Calculate the relative path from the current page to the project root.
  // We do this by looking at how navbar.js itself was loaded!
  get pathToRoot() {
    if (this._pathToRoot !== undefined) return this._pathToRoot;
    const scripts = document.getElementsByTagName('script');
    let navbarScript = null;
    for (let s of scripts) {
      if (s.src.includes('navbar.js')) {
        navbarScript = s;
        break;
      }
    }
    if (navbarScript) {
      const src = navbarScript.getAttribute('src') || '';
      const matches = src.match(/\.\.\//g);
      this._pathToRoot = matches ? matches.join('') : '';
    } else {
      this._pathToRoot = '';
    }
    return this._pathToRoot;
  }

  // Detect the base path dynamically from the URL.
  get basePath() {
    if (this._basePath !== undefined) return this._basePath;
    const pathname = window.location.pathname;
    const PROD_ROOT = '/SuperWebsite';
    this._basePath = pathname.includes(PROD_ROOT) ? PROD_ROOT : '';
    return this._basePath;
  }

  // Convert a logical route like "/projects" into the full path "/SuperWebsite/projects"
  fullPath(route) {
    if (!this.basePath) return route;
    // route "/" → basePath + "/" i.e. "/SuperWebsite/"
    if (route === '/') return this.basePath + '/';
    return this.basePath + route;
  }

  // Strip the base prefix from a pathname to get the logical route
  logicalPath(pathname) {
    if (!this.basePath) return pathname;
    if (pathname.startsWith(this.basePath)) {
      const stripped = pathname.slice(this.basePath.length) || '/';
      return stripped;
    }
    return pathname;
  }

  connectedCallback() {
    this.render();
    this.ensureContentRoot();
    this.resetPageLifecycle();
    this.setupActiveState(window.location.pathname);
    this.setupHamburger();
    this.setupScrollListener();
    this.setupSPA();
    this.prefetchPrimaryRoutes();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --red: #ff2b4f;
          --black: #0f0f0f;
          --header-height: 80px;
        }

        header {
          height: var(--header-height);
          background: var(--red);
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          padding: 0 60px;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          transition: transform 0.3s ease;
          font-family: inherit;
        }

        header.nav-hide {
          transform: translateY(-100%);
        }

        .logo {
          font-weight: 900;
          font-size: 22px;
          color: white;
          justify-self: start;
        }

        nav {
          position: static;
          display: flex;
          gap: 32px;
          align-items: center;
          justify-self: center;
        }

        nav a {
          font-size: 22px;
          color: white;
          text-decoration: none;
          font-weight: 600;
          display: inline-block;
          transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), text-shadow 0.2s ease, color 0.2s ease, border 0.2s ease;
          position: relative;
          padding-bottom: 4px;
          border-bottom: 3px solid transparent;
        }

        nav a:hover {
          transform: scale(1.06);
          text-shadow: 0 0 6px rgba(255,255,255,0.7), 0 0 14px rgba(255,43,79,0.8);
        }

        /* Active State Enhancements Requested By User */
        nav a.active {
          color: var(--black) !important;
          text-shadow: none !important;
          border-bottom: 3px solid var(--black);
          transform: translateY(-4px) scale(1.06);
        }

        .hamburger {
          display: none;
          flex-direction: column;
          gap: 6px;
          cursor: pointer;
          justify-self: end;
        }

        .hamburger span {
          width: 26px;
          height: 3px;
          background: white;
          transition: transform 0.35s ease, opacity 0.25s ease;
        }

        .hamburger.active span:nth-child(1) { transform: translateY(9px) rotate(45deg); }
        .hamburger.active span:nth-child(2) { opacity: 0; }
        .hamburger.active span:nth-child(3) { transform: translateY(-9px) rotate(-45deg); }

        @media (max-width: 768px) {
          header { padding: 0 24px; }
          
          nav {
            position: absolute;
            top: var(--header-height);
            left: 0;
            width: 100%;
            background: var(--red);
            flex-direction: column;
            align-items: center;
            display: none;
            padding: 16px 0;
            animation: menuSlide 0.35s ease forwards;
            z-index: 5;
          }

          nav.active { display: flex; }
          .hamburger { display: flex; position: absolute; right: 24px; }
        }

        @keyframes menuSlide {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>

      <header id="site-header">
        <div class="logo">LEON JOENSEN</div>

        <nav id="nav">
          <a href="${this.pathToRoot}index.html" data-link="/">Home</a>
          <a href="${this.pathToRoot}projects/index.html" data-link="/projects/">Projects</a>
          <a href="${this.pathToRoot}about/index.html" data-link="/about/">About</a>
          <a href="${this.pathToRoot}contact/index.html" data-link="/contact/">Contact</a>
        </nav>

        <div class="hamburger" id="hamburger">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </header>
    `;
  }

  setupSPA() {
    const links = this.shadowRoot.querySelectorAll('nav a');

    links.forEach(link => {
      const route = link.getAttribute('href'); // logical, e.g. "/projects/"
      const url = this.fullPath(this.normalizeRoute(route)); // full, e.g. "/SuperWebsite/projects/"

      // Warm the next document before click (hover/touch).
      link.addEventListener('pointerenter', () => this.prefetchPage(url), { passive: true });
      link.addEventListener('touchstart', () => this.prefetchPage(url), { passive: true });

      link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = link.getAttribute('data-link');
        const url = this.fullPath(this.normalizeRoute(route));
        const targetUrl = link.getAttribute('href');

        // For local file:// access, we must push the relative file path to stay in context.
        const historyUrl = (window.location.protocol === 'file:') ? targetUrl : url;

        // Block reload if clicking the current page
        const currentLogical = this.normalizeRoute(this.logicalPath(window.location.pathname));
        if (this.normalizeRoute(route) === currentLogical) return;

        // Immediately close hamburger if mobile
        const nav = this.shadowRoot.getElementById('nav');
        const hamburger = this.shadowRoot.getElementById('hamburger');
        nav.classList.remove('active');
        hamburger.classList.remove('active');

        // Shift the active CSS classes immediately so the animation triggers
        this.setupActiveState(historyUrl);

        // Begin fetching the next page silently
        this.loadPage(targetUrl, historyUrl, true);
      });
    });

    // Track when the user hits 'Back' or 'Forward' on their browser
    window.addEventListener('popstate', () => {
      this.setupActiveState(window.location.pathname);
      this.loadPage(window.location.pathname, false);
    });
  }

  setupActiveState(pathname) {
    const links = this.shadowRoot.querySelectorAll('nav a');
    links.forEach(l => l.classList.remove('active'));

    // Convert the full pathname to a logical route for comparison
    const path = this.normalizeRoute(this.logicalPath(pathname));
    let activeSet = false;

    links.forEach(link => {
      const linkPath = link.getAttribute('data-link');
      if (path === this.normalizeRoute(linkPath) || (linkPath === '/' && (path === '/' || path === '/index.html'))) {
        link.classList.add('active');
        activeSet = true;
      }
    });

    if (!activeSet) {
      if (path.startsWith('/projects/')) {
        this.shadowRoot.querySelector('a[data-link="/projects/"]').classList.add('active');
      } else if (path.startsWith('/about/')) {
        this.shadowRoot.querySelector('a[data-link="/about/"]').classList.add('active');
      } else if (path.startsWith('/contact/')) {
        this.shadowRoot.querySelector('a[data-link="/contact/"]').classList.add('active');
      }
    }
  }

  normalizeRoute(route) {
    if (!route) return '/';
    if (route === '/index.html') return '/';
    if (route === '/') return '/';
    // Ensure leading slash + trailing slash for directory routes.
    const withLeading = route.startsWith('/') ? route : `/${route}`;
    return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
  }

  ensureContentRoot() {
    let root = document.getElementById('page-content');
    if (!root) {
      root = document.createElement('div');
      root.id = 'page-content';
      document.body.appendChild(root);
      const children = Array.from(document.body.children);
      children.forEach(child => {
        if (child === root) return;
        if (child.tagName && child.tagName.toLowerCase() === 'site-header') return;
        root.appendChild(child);
      });
    }
    this._contentRoot = root;
  }

  resetPageLifecycle() {
    try {
      if (window.__portfolioPageAbortController) {
        window.__portfolioPageAbortController.abort();
      }
    } catch (_) {
      // ignore
    }
    window.__portfolioPageAbortController = new AbortController();
    window.__portfolioPageSignal = window.__portfolioPageAbortController.signal;
  }

  async _prefetchPage(fetchUrl, logicalUrl) {
    const key = logicalUrl;
    if (this._pageCache.has(key)) return this._pageCache.get(key);

    const promise = (async () => {
      const response = await fetch(fetchUrl);
      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      return { doc };
    })().catch((err) => {
      this._pageCache.delete(key);
      throw err;
    });

    this._pageCache.set(key, promise);
    return promise;
  }

  stripHash(url) {
    return typeof url === 'string' ? url.split('#')[0] : url;
  }

  prefetchPrimaryRoutes() {
    const links = this.shadowRoot.querySelectorAll('nav a');
    const kick = () => {
      links.forEach(link => {
        const url = this.fullPath(this.normalizeRoute(link.getAttribute('data-link')));
        this._prefetchPage(link.getAttribute('href'), url);
      });
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(kick, { timeout: 2000 });
    } else {
      window.setTimeout(kick, 250);
    }
  }

  async loadPage(fetchUrl, historyUrl, pushHistory = true) {
    this.ensureContentRoot();
    this.resetPageLifecycle();
    const root = this._contentRoot;
    if (root) root.classList.add('page-transitioning');

    try {
      const fadePromise = new Promise(r => window.setTimeout(r, 120));
      const { doc } = await this._prefetchPage(fetchUrl, historyUrl);
      await fadePromise;

      // Update Head Elements (Title and Inline Styles)
      document.title = doc.title;

      const oldStyles = document.head.querySelectorAll('style');
      oldStyles.forEach(s => s.remove());

      const newStyles = doc.head.querySelectorAll('style');
      newStyles.forEach(s => {
        const newStyle = document.createElement('style');
        newStyle.textContent = s.textContent;
        document.head.appendChild(newStyle);
      });

      if (pushHistory) {
        window.history.pushState({}, '', this.stripHash(url));
      }
      window.scrollTo(0, 0);

      // Clear old content
      if (root) root.replaceChildren();

      // Rebuild the new page contents (DOM first, then scripts so they can query reliably)
      const docChildren = Array.from(doc.body.children).filter(
        (child) => child.tagName.toLowerCase() !== 'site-header'
      );

      const scripts = [];
      const nodes = [];
      docChildren.forEach((child) => {
        if (child.tagName.toLowerCase() === 'script') scripts.push(child);
        else nodes.push(child);
      });

      nodes.forEach((child) => root.appendChild(child.cloneNode(true)));

      scripts.forEach((child) => {
        // Skip re-triggering the navbar itself
        if (child.src && child.src.includes('navbar.js')) return;

        const newScript = document.createElement('script');
        if (child.type) newScript.type = child.type;
        if (child.src) newScript.src = child.src;
        if (child.noModule) newScript.noModule = true;
        if (child.textContent) newScript.textContent = child.textContent;
        root.appendChild(newScript);
      });

    } catch (error) {
      console.error('SPA Failed. Attempting Fallback HTML load:', error);
      window.location.href = fetchUrl;
    } finally {
      // Guarantee our main frame removes the loading CSS hook, pulling smoothly into opacity 1.
      window.setTimeout(() => {
        if (root) root.classList.remove('page-transitioning');
      }, 50);
    }
  }

  setupHamburger() {
    const hamburger = this.shadowRoot.getElementById('hamburger');
    const nav = this.shadowRoot.getElementById('nav');

    hamburger.addEventListener('click', () => {
      nav.classList.toggle('active');
      hamburger.classList.toggle('active');
    });
  }

  setupScrollListener() {
    const header = this.shadowRoot.getElementById('site-header');
    const nav = this.shadowRoot.getElementById('nav');
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
      const currentY = window.scrollY;

      if (nav.classList.contains('active')) {
        header.classList.remove('nav-hide');
        lastScrollY = currentY;
        return;
      }

      if (currentY <= 0) {
        header.classList.remove('nav-hide');
      } else if (currentY > lastScrollY && currentY > 120) {
        header.classList.add('nav-hide');
      } else {
        header.classList.remove('nav-hide');
      }

      lastScrollY = currentY;
    }, { passive: true });
  }
}

customElements.define('site-header', SiteHeader);
