class SiteHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupActiveState(window.location.pathname);
    this.setupHamburger();
    this.setupScrollListener();
    this.setupSPA();
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
          <a href="/" data-link="/">Home</a>
          <a href="/projects" data-link="/projects">Projects</a>
          <a href="/about" data-link="/about">About</a>
          <a href="/contact" data-link="/contact">Contact</a>
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
      link.addEventListener('click', (e) => {
        e.preventDefault();
        let url = link.getAttribute('href');

        // Block reload if clicking the current page
        if (url.replace(/\/$/, '') === window.location.pathname.replace(/\/$/, '')) return;

        // Immediately close hamburger if mobile
        const nav = this.shadowRoot.getElementById('nav');
        const hamburger = this.shadowRoot.getElementById('hamburger');
        nav.classList.remove('active');
        hamburger.classList.remove('active');

        // Shift the active CSS classes immediately so the animation triggers
        this.setupActiveState(url);

        // Begin fetching the next page silently
        this.loadPage(url, true);
      });
    });

    // Track when the user hits 'Back' or 'Forward' on their browser
    window.addEventListener('popstate', () => {
      this.setupActiveState(window.location.pathname);
      this.loadPage(window.location.pathname, false);
    });
  }

  setupActiveState(path) {
    const links = this.shadowRoot.querySelectorAll('nav a');
    links.forEach(l => l.classList.remove('active'));

    let activeSet = false;

    links.forEach(link => {
      const linkPath = link.getAttribute('data-link');
      if (path === linkPath || path === linkPath + '/' || (linkPath === '/' && path === '/index.html')) {
        link.classList.add('active');
        activeSet = true;
      }
    });

    if (!activeSet) {
      if (path.startsWith('/projects/') || path.startsWith('/projects')) {
        this.shadowRoot.querySelector('a[data-link="/projects"]').classList.add('active');
      } else if (path.startsWith('/about/') || path.startsWith('/about')) {
        this.shadowRoot.querySelector('a[data-link="/about"]').classList.add('active');
      } else if (path.startsWith('/contact/') || path.startsWith('/contact')) {
        this.shadowRoot.querySelector('a[data-link="/contact"]').classList.add('active');
      }
    }
  }

  async loadPage(url, pushHistory = true) {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('page-transitioning');
    }

    try {
      const response = await fetch(url);
      const htmlText = await response.text();

      // Allow CSS transition fade-out to complete smoothly
      await new Promise(r => setTimeout(r, 250));

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Clean out old body content except the overarching site-header
      const bodyChildren = Array.from(document.body.children);
      bodyChildren.forEach(child => {
        if (child.tagName.toLowerCase() !== 'site-header') {
          child.remove();
        }
      });

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
        window.history.pushState({}, '', url);
      }
      window.scrollTo(0, 0);

      // Rebuild the new page contents
      const newChildren = Array.from(doc.body.children);
      newChildren.forEach(child => {
        if (child.tagName.toLowerCase() !== 'site-header') {
          if (child.tagName.toLowerCase() === 'script') {
            // Crux logic to skip re-triggering the navbar itself
            if (child.src && child.src.includes('navbar.js')) return;

            // We must recreate inline scripts nodes from scratch to force them to execute identically
            const newScript = document.createElement('script');
            if (child.src) newScript.src = child.src;
            if (child.textContent) newScript.textContent = child.textContent;
            document.body.appendChild(newScript);
          } else {
            if (child.tagName.toLowerCase() === 'main') {
              child.classList.add('page-transitioning');
            }
            // Cloning preserves the pure unmutated DOM nodes from our parser
            document.body.appendChild(child.cloneNode(true));
          }
        }
      });

      // Native Dispatch event ensures any scripts clinging to DOMContentLoaded fire off naturally on our new content!
      window.document.dispatchEvent(new Event("DOMContentLoaded", {
        bubbles: true,
        cancelable: true
      }));

    } catch (error) {
      console.error('SPA Failed. Attempting Fallback HTML load:', error);
      window.location.href = url;
    } finally {
      // Guarantee our main frame removes the loading CSS hook, pulling smoothly into opacity 1.
      setTimeout(() => {
        const newMain = document.querySelector('main');
        if (newMain) newMain.classList.remove('page-transitioning');
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
