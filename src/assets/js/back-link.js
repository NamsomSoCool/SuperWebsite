(() => {
  const backLinks = document.querySelectorAll(".back-link, .footer-back");
  if (!backLinks.length) return;

  let target = "projects.html";
  let label = "Back to Projects";
  let useFallback = true;

  const referrer = document.referrer;
  let refUrl = null;
  let useHistoryBack = false;
  const isFileProtocol = window.location.protocol === "file:";
  let sameOriginReferrer = false;

  if (referrer) {
    try {
      refUrl = new URL(referrer, window.location.href);
      sameOriginReferrer = refUrl.origin === window.location.origin;
      const samePage = refUrl.href === window.location.href;
      if (sameOriginReferrer && !samePage) {
        target = refUrl.href;
        useFallback = false;
        const refPath = refUrl.pathname;
        if (refPath.endsWith("projects.html")) {
          label = "Back to Projects";
        } else if (refPath.endsWith("index.html") || refPath.endsWith("/")) {
          label = "Back to Featured Work";
        }
      }
    } catch (error) {
      // Keep fallback.
    }
  }

  if (useFallback) {
    try {
      const storedTarget = sessionStorage.getItem("portfolioBackTarget");
      const storedLabel = sessionStorage.getItem("portfolioBackLabel");
      if (storedTarget) {
        target = storedTarget;
        label = storedLabel || label;
        useFallback = false;
      }
    } catch (error) {
      // Keep fallback.
    }
  }

  useHistoryBack = window.history.length > 1 && (sameOriginReferrer || isFileProtocol);

  if (useFallback) {
    target = "index.html#featured-project";
    label = "Back to Featured Work";
  }

  backLinks.forEach(link => link.setAttribute("href", target));
  backLinks.forEach(link => {
    const labelNode = link.querySelector(".label");
    if (labelNode) {
      labelNode.textContent = label;
    }
  });

  if (useHistoryBack) {
    backLinks.forEach(link => {
      link.addEventListener("click", event => {
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const currentHref = window.location.href;
        window.history.back();
        window.setTimeout(() => {
          if (window.location.href === currentHref) {
            window.location.href = target;
          }
        }, 220);
      });
    });
  }

  if (!useFallback) {
    try {
      sessionStorage.removeItem("portfolioBackTarget");
      sessionStorage.removeItem("portfolioBackLabel");
    } catch (error) {
      // No-op.
    }
  }
})();
