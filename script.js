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
    // Elementen die hoger zijn dan het scherm halen de 14%-drempel soms nooit
    // (bv. de calculator: 2500px hoog, waarvan er maar ~300px in beeld komt als je
    // er via een ankerlink naartoe springt). Die onthullen we zodra ze in beeld komen.
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const lang = entry.boundingClientRect.height > window.innerHeight * 0.6;
        if (lang || entry.intersectionRatio >= 0.14) {
          entry.target.classList.add("in");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: [0, 0.14], rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- Count-up stats ---------- */
  const counters = Array.from(document.querySelectorAll("[data-count]"));
  const nlGetal = new Intl.NumberFormat("nl-NL");
  // Eenheden (" m³", " MWh", "%") krijgen een kleiner formaat, zodat lange waarden
  // als "20.000 m³" op één regel passen. Achtervoegsels als "/7" blijven even groot.
  const toonWaarde = (el, val, prefix, suffix) => {
    const klein = /^[\s%]/.test(suffix);
    el.innerHTML = prefix + nlGetal.format(val) +
      (suffix ? (klein ? '<span class="stat-unit">' + suffix + "</span>" : suffix) : "");
  };
  const runCounter = (el) => {
    const target = parseFloat(el.getAttribute("data-count"));
    const suffix = el.getAttribute("data-suffix") || "";
    const prefix = el.getAttribute("data-prefix") || "";
    if (prefersReduced) { toonWaarde(el, target, prefix, suffix); return; }
    const dur = 1400;
    let start = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const val = Math.round(eased * target);
      toonWaarde(el, val, prefix, suffix);
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
    /* Web-app-URL van het Apps Script in de Workspace van Thermal Compost Systems.
       Zie formulier-backend/INSTRUCTIES.md. Zolang deze leeg is, toont het
       formulier de mailoptie in plaats van te doen alsof het verstuurd is. */
    const ENDPOINT = "";

    const CONTACTMAIL = "Contact@thermalcompostsystems.nl";
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    /* ---- berekening uit de rekenhulp meenemen ---- */
    const berekeningVeld = form.querySelector("#berekening");
    const berekeningRegel = form.querySelector(".form-berekening");
    const vinkje = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true" style="flex-shrink:0;margin-top:2px"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const toonBerekening = () => {
      if (!berekeningVeld || !berekeningRegel) return;
      const b = window.tcsBerekening ? window.tcsBerekening() : null;
      if (!b) { berekeningVeld.value = ""; berekeningRegel.hidden = true; return; }
      berekeningVeld.value = b.tekst;
      berekeningRegel.innerHTML = vinkje + '<span class="fb-tekst"></span>';
      const span = berekeningRegel.querySelector(".fb-tekst");
      if (b.kort) {
        span.textContent = "Uw berekening wordt meegestuurd: ";
        const sterk = document.createElement("strong");
        sterk.textContent = b.kort;
        span.appendChild(sterk);
      } else {
        span.textContent = "Uw ingevulde gegevens uit de rekenhulp worden meegestuurd.";
      }
      berekeningRegel.hidden = false;
    };
    const roiForm = document.getElementById("roi-form");
    if (roiForm) {
      roiForm.addEventListener("input", toonBerekening);
      roiForm.addEventListener("change", toonBerekening);
    }
    toonBerekening();
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
      const foutBlok = form.querySelector(".form-error");
      const veld = (id) => { const el = form.querySelector("#" + id); return el ? el.value.trim() : ""; };

      toonBerekening();
      const gegevens = {
        naam: veld("naam"),
        bedrijf: veld("bedrijf"),
        email: veld("email"),
        telefoon: veld("telefoon"),
        segment: veld("segment"),
        bericht: veld("bericht"),
        berekening: veld("berekening"),
        website: veld("website"), // spamval
      };

      const klaar = () => { btn.classList.remove("loading"); btn.disabled = false; };

      const gelukt = () => {
        klaar();
        form.reset();
        toonBerekening();
        if (foutBlok) foutBlok.hidden = true;
        if (success) {
          success.hidden = false;
          success.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "center" });
          setTimeout(() => { success.hidden = true; }, 8000);
        }
      };

      // Gaat er iets mis, dan raakt de bezoeker zijn ingevulde gegevens niet kwijt:
      // de mailknop bevat alles wat hij zojuist heeft ingevuld.
      const mislukt = () => {
        klaar();
        if (!foutBlok) return;
        const regels = [
          "Naam: " + gegevens.naam,
          "Bedrijf: " + gegevens.bedrijf,
          "E-mail: " + gegevens.email,
          "Telefoon: " + (gegevens.telefoon || "-"),
          "Segment: " + (gegevens.segment || "-"),
          "",
          gegevens.bericht || "(geen bericht)",
        ];
        if (gegevens.berekening) regels.push("", "Berekening:", gegevens.berekening);
        const link = "mailto:" + CONTACTMAIL
          + "?subject=" + encodeURIComponent("Aanvraag via de website")
          + "&body=" + encodeURIComponent(regels.join("\n"));
        foutBlok.innerHTML = "";
        const p = document.createElement("p");
        p.textContent = "Het verzenden lukte niet. Probeer het nog een keer, of stuur uw aanvraag rechtstreeks per mail. ";
        const a = document.createElement("a");
        a.href = link;
        a.textContent = "Mail ons met deze gegevens";
        p.appendChild(a);
        foutBlok.appendChild(p);
        foutBlok.hidden = false;
        foutBlok.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "center" });
      };

      btn.classList.add("loading");
      btn.disabled = true;
      if (foutBlok) foutBlok.hidden = true;

      if (!ENDPOINT) { mislukt(); return; }

      // text/plain voorkomt een preflight-verzoek, dat Apps Script niet beantwoordt
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(gegevens),
      })
        .then((res) => res.json())
        .then((data) => { if (data && data.ok) gelukt(); else throw new Error((data && data.fout) || "onbekende fout"); })
        .catch(mislukt);
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
  // ook reageren als de hash verandert terwijl je al op de pagina bent
  // (bv. via de "Voor wie"-dropdown in de navigatie)
  window.addEventListener("hashchange", openFromHash);

  /* ---------- Over ons: aanklikbare tijdlijn ---------- */
  const tlKnoppen = Array.from(document.querySelectorAll(".tl-tab"));
  const tlFoto = document.getElementById("tl-foto");
  const tlTekst = document.getElementById("tl-tekst");
  const tlBijschrift = document.getElementById("tl-bijschrift");
  const tlPunten = document.getElementById("tl-punten");
  if (tlKnoppen.length && tlFoto && tlTekst && tlBijschrift) {
    tlKnoppen.forEach((knop) => {
      knop.addEventListener("click", () => {
        tlKnoppen.forEach((k) => {
          const actief = k === knop;
          k.classList.toggle("is-actief", actief);
          k.setAttribute("aria-pressed", actief ? "true" : "false");
        });
        tlFoto.src = knop.dataset.foto;
        tlFoto.alt = knop.dataset.alt;
        tlTekst.textContent = knop.dataset.tekst;
        // optionele opsomming, alleen tonen als die er is voor dit tabblad
        if (tlPunten) {
          const punten = (knop.dataset.punten || "").split("|").filter(Boolean);
          tlPunten.innerHTML = "";
          punten.forEach((tekst) => {
            const li = document.createElement("li");
            li.textContent = tekst;
            tlPunten.appendChild(li);
          });
          tlPunten.hidden = punten.length === 0;
        }
        tlBijschrift.textContent = knop.dataset.bij;
      });
    });
  }

  /* ---------- Video: speler pas laden na een klik ---------- */
  document.querySelectorAll(".video-embed[data-yt]").forEach((wrap) => {
    const knop = wrap.querySelector(".video-play");
    if (!knop) return;
    knop.addEventListener("click", () => {
      const frame = document.createElement("iframe");
      frame.src = "https://www.youtube-nocookie.com/embed/" + wrap.dataset.yt + "?autoplay=1&rel=0";
      frame.title = "Video";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      frame.allowFullscreen = true;
      wrap.replaceChildren(frame);
    });
  });
})();
