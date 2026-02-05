(() => {
  const backLinks = document.querySelectorAll(".back-link, .footer-back");
  if (!backLinks.length) return;

  let target = "projects.html";
  let label = "Back to Projects";
  let useFallback = true;

  const referrer = document.referrer;
  let refUrl = null;
  let useHistoryBack = false;

  if (referrer) {
    try {
      refUrl = new URL(referrer, window.location.href);
      const sameOrigin = refUrl.origin === window.location.origin;
      const samePage = refUrl.href === window.location.href;
      if (sameOrigin && !samePage) {
        target = refUrl.href;
        useFallback = false;
        useHistoryBack = window.history.length > 1;
      }
    } catch (error) {
      // Keep fallback.
    }
  }

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

  if (useHistoryBack && refUrl) {
    backLinks.forEach(link => {
      link.addEventListener("click", event => {
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        window.history.back();
      });
    });
  }
})();
