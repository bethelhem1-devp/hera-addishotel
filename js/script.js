/* ---------------------------------------------------------------
   SCREEN INTRO — show once per visit, never on revisiting home
------------------------------------------------------------------*/
/* ---------------------------------------------------------------
   SCREEN INTRO — shows only once per visit (first page loaded),
   never again for the rest of the session, even on Home.
------------------------------------------------------------------*/
/* ---------------------------------------------------------------
   SCREEN INTRO — shows only once per visit (first page loaded),
   never again for the rest of the session, even on Home.
------------------------------------------------------------------*/
function initIntroScreen() {
  const intro = document.getElementById("introScreen");
  if (!intro) return;

  // Already shown this session (inline script already hid it) — skip
  if (sessionStorage.getItem("glamIntroShown")) return;

  sessionStorage.setItem("glamIntroShown", "true");

  const hideIntro = () => intro.classList.add("is-hidden");

  const minDisplay = new Promise((resolve) => setTimeout(resolve, 2200));
  const pageLoaded = new Promise((resolve) => {
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", resolve, { once: true });
  });

  Promise.all([minDisplay, pageLoaded]).then(hideIntro);
  setTimeout(hideIntro, 4000);

  document.body.style.overflow = "hidden";
  setTimeout(() => { document.body.style.overflow = ""; }, 2300);
}

document.addEventListener("DOMContentLoaded", initIntroScreen);






/* ============================================================
   GLAM HOTEL — script.js
   Vanilla JS: navbar behaviour, booking modal + mailto reservation,
   testimonial slider, gallery lightbox + filters, form validation.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  initBookingModal();
  initTestimonialSlider();
  initGalleryFilters();
  initLightbox();
  initContactForm();
  initFooterYear();
  initScrollReveal();
});

/* ---------------------------------------------------------------
   1. NAVBAR — sticky/translucent-on-scroll + mobile hamburger
------------------------------------------------------------------*/
function initNavbar() {
  const navbar = document.querySelector(".navbar");
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (!navbar) return;

  const onScroll = () => {
    navbar.classList.toggle("is-scrolled", window.scrollY > 40);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const isOpen = links.classList.toggle("is-open");
      toggle.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    // Close mobile menu after a link is tapped
    links.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        links.classList.remove("is-open");
        toggle.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  // Mark the active nav link based on current page
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === current || (current === "" && href === "index.html")) {
      a.classList.add("active");
    }
  });
}

/* ---------------------------------------------------------------
   2. BOOKING MODAL — opens from any "Book Now" trigger, builds a
   structured mailto: link from the submitted reservation details.
------------------------------------------------------------------*/
const HOTEL_RESERVATIONS_EMAIL = "reservations@glamhotel.com";

function initBookingModal() {
  const overlay = document.getElementById("bookingModal");
  if (!overlay) return;

  const modal = overlay.querySelector(".modal");
  const closeBtn = overlay.querySelector(".modal-close");
  const form = document.getElementById("bookingForm");
  const successPanel = overlay.querySelector(".form-success");
  const roomSelect = document.getElementById("bk-room");
  const checkinInput = document.getElementById("bk-checkin");
  const checkoutInput = document.getElementById("bk-checkout");
  let lastFocused = null;

  // Set sensible minimum dates (today / tomorrow)
  const today = new Date();
  const todayISO = today.toISOString().split("T")[0];
  checkinInput.min = todayISO;
  checkoutInput.min = todayISO;

  const openModal = (roomType) => {
    lastFocused = document.activeElement;
    form.reset();
    form.style.display = "flex";
    successPanel.classList.remove("is-visible");
    clearErrors(form);
    if (roomType && roomSelect) {
      const match = Array.from(roomSelect.options).find(
        (opt) => opt.value.toLowerCase() === roomType.toLowerCase()
      );
      if (match) roomSelect.value = match.value;
    }
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
    const firstField = form.querySelector("input, select");
    if (firstField) firstField.focus();
  };

  const closeModal = () => {
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  };

  // Any element carrying data-book-now opens the modal (optionally with a room type)
  document.querySelectorAll("[data-book-now]").forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      openModal(trigger.getAttribute("data-room") || "");
    });
  });

  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) closeModal();
  });

  // Keep check-out's minimum in sync with check-in
  checkinInput.addEventListener("change", () => {
    if (checkinInput.value) {
      const next = new Date(checkinInput.value);
      next.setDate(next.getDate() + 1);
      checkoutInput.min = next.toISOString().split("T")[0];
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearErrors(form);

    const name = document.getElementById("bk-name").value.trim();
    const email = document.getElementById("bk-email").value.trim();
    const checkin = checkinInput.value;
    const checkout = checkoutInput.value;
    const room = roomSelect.value;

    let valid = true;

    if (name.length < 2) {
      showError("bk-name", "Please enter your full name.");
      valid = false;
    }
    if (!isValidEmail(email)) {
      showError("bk-email", "Please enter a valid email address.");
      valid = false;
    }
    if (!checkin) {
      showError("bk-checkin", "Please choose a check-in date.");
      valid = false;
    }
    if (!checkout) {
      showError("bk-checkout", "Please choose a check-out date.");
      valid = false;
    }
    // Core validation rule: check-out must be strictly after check-in
    if (checkin && checkout && new Date(checkout) <= new Date(checkin)) {
      showError("bk-checkout", "Check-out date must be after check-in date.");
      valid = false;
    }
    if (!room) {
      showError("bk-room", "Please select a room type.");
      valid = false;
    }

    if (!valid) return;

    // Build a nicely formatted plain-text email body for the hotel owner
    const nights = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
    const formattedCheckin = formatDate(checkin);
    const formattedCheckout = formatDate(checkout);

    const subject = `New Reservation by - ${name}`;
    const body =
      `HERAADDIS HOTEL — NEW RESERVATION REQUEST\n` +
      `----------------------------------------\n\n` +
      `Guest Name:      ${name}\n` +
      `Guest Email:     ${email}\n` +
      `Room Type:       ${room}\n` +
      `Check-in Date:   ${formattedCheckin}\n` +
      `Check-out Date:  ${formattedCheckout}\n` +
      `Length of Stay:  ${nights} night${nights === 1 ? "" : "s"}\n\n` +
      `----------------------------------------\n` +
      `Please confirm availability and reply directly to the guest at ${email}.\n\n` +
      `Sent automatically from the HERA ADDIS HOTEL website booking form.`;

    const mailtoLink = `mailto:${HOTEL_RESERVATIONS_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    // Open the guest's default email client with the pre-filled reservation
    window.location.href = mailtoLink;

    // Show an in-modal confirmation so the guest knows what happened
    form.style.display = "none";
    successPanel.classList.add("is-visible");
  });
}

function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "long", day: "numeric" });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const wrapper = field.closest(".field");
  const errorEl = wrapper ? wrapper.querySelector(".field-error") : null;
  if (wrapper) wrapper.classList.add("has-error");
  if (errorEl) errorEl.textContent = message;
}

function clearErrors(form) {
  form.querySelectorAll(".field").forEach((f) => f.classList.remove("has-error"));
  form.querySelectorAll(".field-error").forEach((e) => (e.textContent = ""));
}

/* ---------------------------------------------------------------
   3. TESTIMONIAL SLIDER (home page)
------------------------------------------------------------------*/
function initTestimonialSlider() {
  const slider = document.querySelector(".testimonial-slider");
  if (!slider) return;

  const slides = Array.from(slider.querySelectorAll(".testimonial-slide"));
  const dotsWrap = slider.parentElement.querySelector(".slider-dots");
  const prevBtn = slider.parentElement.querySelector(".slider-prev");
  const nextBtn = slider.parentElement.querySelector(".slider-next");
  let index = 0;
  let timer = null;

  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Show testimonial ${i + 1}`);
    if (i === 0) dot.classList.add("is-active");
    dot.addEventListener("click", () => goTo(i));
    dotsWrap.appendChild(dot);
  });
  const dots = Array.from(dotsWrap.children);

  function goTo(i) {
    slides[index].classList.remove("is-active");
    dots[index].classList.remove("is-active");
    index = (i + slides.length) % slides.length;
    slides[index].classList.add("is-active");
    dots[index].classList.add("is-active");
  }

  function next() { goTo(index + 1); }
  function prev() { goTo(index - 1); }

  prevBtn && prevBtn.addEventListener("click", () => { prev(); restart(); });
  nextBtn && nextBtn.addEventListener("click", () => { next(); restart(); });

  function restart() {
    clearInterval(timer);
    timer = setInterval(next, 6000);
  }
  restart();
}

/* ---------------------------------------------------------------
   4. GALLERY FILTERS (gallery page)
------------------------------------------------------------------*/
function initGalleryFilters() {
  const filterBtns = document.querySelectorAll(".filter-btn");
  const items = document.querySelectorAll(".gallery-item");
  if (!filterBtns.length) return;

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const category = btn.getAttribute("data-filter");

      items.forEach((item) => {
        const match = category === "all" || item.getAttribute("data-category") === category;
        item.style.display = match ? "" : "none";
      });
    });
  });
}

/* ---------------------------------------------------------------
   5. LIGHTBOX (gallery page)
------------------------------------------------------------------*/
function initLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;

  const items = Array.from(document.querySelectorAll(".gallery-item img"));
  const lightboxImg = lightbox.querySelector("img");
  const captionEl = lightbox.querySelector(".lightbox-caption");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  const prevBtn = lightbox.querySelector(".lightbox-prev");
  const nextBtn = lightbox.querySelector(".lightbox-next");
  let currentIndex = 0;

  function open(i) {
    currentIndex = i;
    updateImage();
    lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function updateImage() {
    const img = items[currentIndex];
    lightboxImg.src = img.getAttribute("src");
    lightboxImg.alt = img.getAttribute("alt") || "";
    captionEl.textContent = img.getAttribute("data-caption") || img.getAttribute("alt") || "";
  }

  function close() {
    lightbox.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function next() { currentIndex = (currentIndex + 1) % items.length; updateImage(); }
  function prev() { currentIndex = (currentIndex - 1 + items.length) % items.length; updateImage(); }

  items.forEach((img, i) => {
    img.closest(".gallery-item").addEventListener("click", () => open(i));
  });

  closeBtn.addEventListener("click", close);
  nextBtn.addEventListener("click", next);
  prevBtn.addEventListener("click", prev);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) close(); });

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });
}

/* ---------------------------------------------------------------
   6. CONTACT FORM — client-side validation (Formspree submission)
------------------------------------------------------------------*/
function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;

  const successPanel = document.getElementById("contactSuccess");

  form.addEventListener("submit", (e) => {
    clearErrors(form);
    let valid = true;

    const name = document.getElementById("c-name").value.trim();
    const email = document.getElementById("c-email").value.trim();
    const message = document.getElementById("c-message").value.trim();

    if (name.length < 2) { showError("c-name", "Please enter your name."); valid = false; }
    if (!isValidEmail(email)) { showError("c-email", "Please enter a valid email address."); valid = false; }
    if (message.length < 10) { showError("c-message", "Please write a message (min. 10 characters)."); valid = false; }

    if (!valid) {
      e.preventDefault();
      return;
    }

    // Formspree handles the actual submission (form action="https://formspree.io/f/your-id").
    // We show an optimistic confirmation message while the browser submits/redirects.
    if (successPanel) {
      successPanel.classList.add("is-visible");
    }
  });
}

/* ---------------------------------------------------------------
   7. FOOTER — dynamic copyright year
------------------------------------------------------------------*/
function initFooterYear() {
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

/* ---------------------------------------------------------------
   8. Simple scroll-reveal for section headers & cards
------------------------------------------------------------------*/
function initScrollReveal() {
  const revealEls = document.querySelectorAll(
    ".amenity-card, .room-card, .gallery-item, .food-card, .story-grid > *, .info-item"
  );
  if (!("IntersectionObserver" in window) || !revealEls.length) return;

  revealEls.forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(18px)";
    el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealEls.forEach((el) => observer.observe(el));
}
