/* =================================================================
   THERMAL COMPOST SYSTEMS — interactions
   Vanilla JS, no dependencies. Respects prefers-reduced-motion.
   ================================================================= */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Sticky header shadow ---------- */
  const header = document.querySelector(".site-header");
  const onScroll = () => {
    if (window.scrollY > 8) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("mobile-menu");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Menu sluiten" : "Menu openen");
    menu.hidden = !open;
  };
  if (toggle && menu) {
    toggle.addEventListener("click", () => setMenu(menu.hidden));
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  }

  /* ---------- Scroll reveal + stagger index ---------- */
  const revealEls = Array.from(document.querySelectorAll("[data-reveal]"));
  // assign per-group stagger index for grid children
  document.querySelectorAll(".steps, .benefit-grid, .audience-grid, .value-grid, .stats-grid").forEach((grid) => {
    Array.from(grid.children).forEach((child, i) => child.style.setProperty("--i", i));
  });

  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- Count-up stats ---------- */
  const counters = Array.from(document.querySelectorAll("[data-count]"));
  const runCounter = (el) => {
    const target = parseFloat(el.getAttribute("data-count"));
    const suffix = el.getAttribute("data-suffix") || "";
    const prefix = el.getAttribute("data-prefix") || "";
    if (prefersReduced) { el.textContent = prefix + target + suffix; return; }
    const dur = 1400;
    let start = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const val = Math.round(eased * target);
      el.textContent = prefix + val + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    const cio = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { runCounter(entry.target); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => cio.observe(c));
  } else {
    counters.forEach(runCounter);
  }

  /* ---------- FAQ: smooth height animation ---------- */
  document.querySelectorAll(".faq-item").forEach((item) => {
    const body = item.querySelector(".faq-body");
    const summary = item.querySelector("summary");
    if (!body || !summary) return;

    summary.addEventListener("click", (e) => {
      if (prefersReduced) return; // let native toggle handle it
      e.preventDefault();
      if (item.open) {
        // closing
        const h = body.scrollHeight;
        body.style.height = h + "px";
        requestAnimationFrame(() => { body.style.transition = "height .28s ease"; body.style.height = "0px"; });
        body.addEventListener("transitionend", function te() {
          item.open = false; body.style.transition = ""; body.style.height = "";
          body.removeEventListener("transitionend", te);
        }, { once: true });
      } else {
        item.open = true;
        const h = body.scrollHeight;
        body.style.height = "0px";
        requestAnimationFrame(() => { body.style.transition = "height .28s ease"; body.style.height = h + "px"; });
        body.addEventListener("transitionend", function te() {
          body.style.transition = ""; body.style.height = "";
          body.removeEventListener("transitionend", te);
        }, { once: true });
      }
    });
  });

  /* ---------- Contact form validation + submit feedback ---------- */
  const form = document.querySelector(".contact-form");
  if (form) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const setError = (input, msg) => {
      const errEl = form.querySelector(`[data-error-for="${input.id}"]`);
      input.classList.toggle("invalid", !!msg);
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (errEl) errEl.textContent = msg || "";
    };
    const validateField = (input) => {
      if (input.hasAttribute("required") && !input.value.trim()) { setError(input, "Dit veld is verplicht."); return false; }
      if (input.type === "email" && input.value && !emailRe.test(input.value.trim())) { setError(input, "Vul een geldig e-mailadres in."); return false; }
      setError(input, "");
      return true;
    };

    // validate on blur (not keystroke)
    form.querySelectorAll("input, textarea, select").forEach((input) => {
      input.addEventListener("blur", () => { if (input.classList.contains("invalid") || input.hasAttribute("required")) validateField(input); });
      input.addEventListener("input", () => { if (input.classList.contains("invalid")) validateField(input); });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const required = Array.from(form.querySelectorAll("[required]"));
      let firstInvalid = null;
      required.forEach((input) => { if (!validateField(input) && !firstInvalid) firstInvalid = input; });
      // also validate email if filled
      const email = form.querySelector("#email");
      if (email && !validateField(email) && !firstInvalid) firstInvalid = email;

      if (firstInvalid) { firstInvalid.focus(); return; }

      const btn = form.querySelector("button[type=submit]");
      const success = form.querySelector(".form-success");
      btn.classList.add("loading");
      btn.disabled = true;

      // Simulate async submit. NOTE: hook this up to a real endpoint/mailer.
      setTimeout(() => {
        btn.classList.remove("loading");
        btn.disabled = false;
        form.reset();
        if (success) {
          success.hidden = false;
          success.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "center" });
          setTimeout(() => { success.hidden = true; }, 6000);
        }
      }, 1100);
    });
  }

  /* ---------- Case modals ---------- */
  const lockScroll = (lock) => { document.documentElement.style.overflow = lock ? "hidden" : ""; };
  const closeModal = (dlg) => { if (dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); } };

  // Open triggers (audience cards)
  document.querySelectorAll("[data-modal]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const dlg = document.getElementById("modal-" + trigger.dataset.modal);
      if (!dlg) return;
      if (dlg.showModal) dlg.showModal();
      else dlg.setAttribute("open", ""); // fallback for very old browsers
      lockScroll(true);
    });
  });

  // Per-modal wiring
  document.querySelectorAll(".case-modal").forEach((dlg) => {
    const closeBtn = dlg.querySelector(".case-close");
    if (closeBtn) closeBtn.addEventListener("click", () => closeModal(dlg));

    // Click on backdrop (outside the inner card) closes
    dlg.addEventListener("click", (e) => { if (e.target === dlg) closeModal(dlg); });

    // Native dialog fires 'close' on Esc — restore scroll then
    dlg.addEventListener("close", () => lockScroll(false));

    // Contact CTA: close modal, then let the anchor jump to #contact
    const contactBtn = dlg.querySelector(".case-contact");
    if (contactBtn) contactBtn.addEventListener("click", () => closeModal(dlg));

    // Placeholder "praktijkvoorbeeld" button — no target page yet
    dlg.querySelectorAll("[data-placeholder]").forEach((el) => {
      el.addEventListener("click", (e) => e.preventDefault());
    });
  });

  /* ---------- Gallery lightbox ---------- */
  const lightbox = document.getElementById("lightbox");
  if (lightbox) {
    const lbImg = lightbox.querySelector(".lightbox-img");
    const items = Array.from(document.querySelectorAll(".gallery-item"));
    let idx = 0;
    const closeLb = () => { if (lightbox.open) { lightbox.close ? lightbox.close() : lightbox.removeAttribute("open"); } };
    const show = (i) => {
      idx = (i + items.length) % items.length;
      const btn = items[idx];
      const img = btn.querySelector("img");
      lbImg.src = btn.getAttribute("data-full") || (img && img.src);
      lbImg.alt = img ? img.alt : "";
    };
    items.forEach((btn, i) => {
      btn.addEventListener("click", () => {
        show(i);
        if (lightbox.showModal) lightbox.showModal(); else lightbox.setAttribute("open", "");
        lockScroll(true);
      });
    });
    const prev = lightbox.querySelector(".lightbox-prev");
    const next = lightbox.querySelector(".lightbox-next");
    if (prev) prev.addEventListener("click", (e) => { e.stopPropagation(); show(idx - 1); });
    if (next) next.addEventListener("click", (e) => { e.stopPropagation(); show(idx + 1); });
    const closeBtn = lightbox.querySelector(".lightbox-close");
    if (closeBtn) closeBtn.addEventListener("click", closeLb);
    lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLb(); });
    lightbox.addEventListener("close", () => lockScroll(false));
    document.addEventListener("keydown", (e) => {
      if (!lightbox.open) return;
      if (e.key === "ArrowLeft") show(idx - 1);
      else if (e.key === "ArrowRight") show(idx + 1);
    });
  }

  // Deep-link: open a case modal directly via URL hash (e.g. #modal-kassen)
  const openFromHash = () => {
    const h = window.location.hash;
    if (!/^#modal-/.test(h)) return;
    const dlg = document.querySelector(h);
    if (dlg && dlg.classList.contains("case-modal") && dlg.showModal && !dlg.open) {
      dlg.showModal();
      lockScroll(true);
    }
  };
  openFromHash();
})();
