// src/pages/Home.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import CardWindows from "./Cardwindows";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import "../csscom/Home.css";

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname, search } = location;

  // כמו ב-SiteHeader: ניהול class ל־route-account
  function useBodyRouteClass() {
    useEffect(() => {
      const isAccount = pathname.toLowerCase().startsWith("/account");
      document.body.classList.toggle("route-account", isAccount);
      return () => document.body.classList.remove("route-account");
    }, [pathname]);
  }
  useBodyRouteClass();

  // זיהוי מצב אדמין לפי query / localStorage (אותו לוגיקה כמו SiteHeader)
  useEffect(() => {
    const sp = new URLSearchParams(search);
    const adminFromQuery = sp.get("admin");

    if (adminFromQuery === "1") {
      localStorage.setItem("isAdminView", "1");
      setIsAdminView(true);
    } else if (adminFromQuery === "0") {
      localStorage.removeItem("isAdminView");
      setIsAdminView(false);
    } else {
      const fromLS =
        typeof window !== "undefined" &&
        localStorage.getItem("isAdminView") === "1";
      setIsAdminView(fromLS);
    }
  }, [search]);

  const adminSuffix = isAdminView ? "?admin=1&bare=1" : "";

  // גלילת header (משאיר class על body כפי שהיה)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY ?? window.pageYOffset ?? 0;
      setScrolled(y > 10);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // רק ב-Home: סקוֹפ עיצוב
  useEffect(() => {
    document.body.classList.add("theme-home");
    return () => document.body.classList.remove("theme-home");
  }, []);

  useEffect(() => {
    document.body.classList.toggle("scrolled", scrolled);
    return () => document.body.classList.remove("scrolled");
  }, [scrolled]);

  // ====== קרוסלה – נתונים ======
const videos = [
  {
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    poster: "https://picsum.photos/800/450?random=1",
  },
  {
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    poster: "https://picsum.photos/800/450?random=2",
  },
  {
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    poster: "https://picsum.photos/800/450?random=3",
  },
  {
    src: "https://media.w3.org/2010/05/bunny/trailer.mp4",
    poster: "https://picsum.photos/800/450?random=4",
  },
  {
    src: "https://media.w3.org/2010/05/video/movie_300.mp4",
    poster: "https://picsum.photos/800/450?random=5",
  },
];

  const n = videos.length;
  const REPEAT = 3;
  const displayItems = Array.from({ length: REPEAT }).flatMap(() => videos);
  const BASE = n;

  const [lightboxIdx, setLightboxIdx] = useState(-1);
  const openModal = (i) => {
    pauseAll();
    setLightboxIdx(i % n);
  };
  const closeModal = () => setLightboxIdx(-1);

  const trackRef = useRef(null);
  const vidsRef = useRef([]);
  const stepRef = useRef(0);
  const rafRef = useRef(0);
  const animRef = useRef(false);

  function measureStep() {
    const el = trackRef.current;
    if (!el) return 0;
    const card = el.querySelector(".look-card");
    const cs = getComputedStyle(el);
    const gap = parseFloat(cs.columnGap || cs.gap || "12");
    const w = card ? card.getBoundingClientRect().width : el.clientWidth;
    stepRef.current = Math.round(w + gap);
    return stepRef.current;
  }
  function getStep() {
    return stepRef.current || measureStep();
  }

  function animateTo(targetLeft, duration = 520) {
    const el = trackRef.current;
    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    el.classList.add("no-snap");
    animRef.current = true;
    const start = el.scrollLeft;
    const delta = targetLeft - start;
    const t0 = performance.now();
    const ease = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const frame = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      el.scrollLeft = start + delta * ease(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        animRef.current = false;
        rafRef.current = 0;
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  }

  function goNext() {
    const el = trackRef.current;
    if (!el || animRef.current) return;
    const step = getStep();
    let curr = Math.round(el.scrollLeft / step);
    if (curr >= BASE + n - 1) {
      el.scrollLeft = (curr - n) * step;
      curr = Math.round(el.scrollLeft / step);
    }
    animateTo((curr + 1) * step, 340);
  }

  function goPrev() {
    const el = trackRef.current;
    if (!el || animRef.current) return;
    const step = getStep();
    let curr = Math.round(el.scrollLeft / step);
    if (curr <= BASE) {
      el.scrollLeft = (curr + n) * step;
      curr = Math.round(el.scrollLeft / step);
    }
    animateTo((curr - 1) * step, 340);
  }

  const pauseAll = () => vidsRef.current.forEach((v) => v && v.pause());
  const handleEnter = (i) => {
    const v = vidsRef.current[i];
    if (v) {
      v.muted = true;
      v.playsInline = true;
      v.play().catch(() => {});
    }
  };
  const handleLeave = (i) => {
    const v = vidsRef.current[i];
    if (v) v.pause();
  };

  function onTrackScroll() {
    if (animRef.current) return;
    const el = trackRef.current;
    if (!el) return;
    const step = getStep();
    const curr = Math.round(el.scrollLeft / step);
    if (curr >= BASE + n) el.scrollLeft = (curr - n) * step;
    else if (curr < BASE) el.scrollLeft = (curr + n) * step;
  }

  useEffect(() => {
    const init = () => {
      const step = getStep();
      const el = trackRef.current;
      if (!el || !step) return;
      el.scrollLeft = BASE * step;
    };
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(init);
      init.__r2 = r2;
    });
    const onResize = () => {
      measureStep();
      init();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(r1);
      if (init.__r2) cancelAnimationFrame(init.__r2);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      <SiteHeader variant="home" />

      {/* HERO + לוגו */}
 <section className="hero">
  <img
    src="/whitelogo.png"
    alt="Halakli"
    className="logo-hero"
    onClick={() => navigate("/home")}   // 👈 תמיד חוזר ל-HOME
  />
  <div className="hero-center">
    <h2 className="hero-title">לכל סוגי ההחלקות</h2>
    <button
      className="cta"
      onClick={() => navigate(`/smooties${adminSuffix}`)}
    >
      SHOP NOW
    </button>
  </div>
</section>


      {/* CATEGORIES */}
      <section className="section">
        <h2 className="section-title">CATEGORIES</h2>
        <div className="categories-grid">
          <Link
            to={`/products${adminSuffix}`}
            className="cat-card"
            aria-label="כל המוצרים"
          >
            <img
              className="cat-img"
              src="https://picsum.photos/id/1011/1200/900"
              alt=""
            />
            <div className="cat-overlay">
              <h3 className="cat-title">כל המוצרים</h3>
              <span className="cat-shop">SHOP NOW</span>
            </div>
          </Link>

          <Link
            to={`/smooties${adminSuffix}`}
            className="cat-card"
            aria-label="החלקות ביתיות"
          >
            <img
              className="cat-img"
              src="https://picsum.photos/id/1012/1200/900"
              alt=""
            />
            <div className="cat-overlay">
              <h3 className="cat-title">החלקות ביתיות</h3>
              <span className="cat-shop">SHOP NOW</span>
            </div>
          </Link>

          <Link
            to={`/kits${adminSuffix}`}
            className="cat-card"
            aria-label="ערכות ביתיות"
          >
            <img
              className="cat-img"
              src="https://picsum.photos/id/1015/1200/900"
              alt=""
            />
            <div className="cat-overlay">
              <h3 className="cat-title">ערכות ביתיות</h3>
              <span className="cat-shop">SHOP NOW</span>
            </div>
          </Link>

          <Link
            to={`/productshair${adminSuffix}`}
            className="cat-card"
            aria-label="מוצרי שיער"
          >
            <img
              className="cat-img"
              src="https://picsum.photos/id/1013/1200/900"
              alt=""
            />
            <div className="cat-overlay">
              <h3 className="cat-title">מוצרי שיער</h3>
              <span className="cat-shop">SHOP NOW</span>
            </div>
          </Link>
        </div>
      </section>

      {/* LOOK / וידאו-קרוסלה */}
      <section className="look-section">
        <h3 className="look-title">תתאימי לעצמך את החומר המושלם </h3>

        <div className="look-wrapper">
          <button
            className="look-nav prev"
            onClick={goPrev}
            aria-label="Previous"
          >
            ‹
          </button>

          <div
            className="look-track"
            ref={trackRef}
            onScroll={onTrackScroll}
            dir="ltr"
          >
            {displayItems.map((v, i) => (
              <div
                key={i}
                className="look-card"
                onClick={() => openModal(i)}
              >
                <video
                  ref={(el) => (vidsRef.current[i] = el)}
                  src={v.src}
                  poster={v.poster}
                  preload="metadata"
                  muted
                  playsInline
                  onMouseEnter={() => handleEnter(i)}
                  onMouseLeave={() => {
                    handleLeave(i);
                    pauseAll();
                  }}
                  onTouchStart={() => handleEnter(i)}
                  onTouchEnd={() => handleLeave(i)}
                />
              </div>
            ))}
          </div>

          <button
            className="look-nav next"
            onClick={goNext}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      </section>

      {/* מודל */}
      <CardWindows
        open={lightboxIdx >= 0}
        item={lightboxIdx >= 0 ? videos[lightboxIdx] : null}
        onClose={closeModal}
        onNext={() => setLightboxIdx((i) => (i + 1) % videos.length)}
        onPrev={() =>
          setLightboxIdx((i) => (i - 1 + videos.length) % videos.length)
        }
        hasMultiple={videos.length > 1}
      />

      {/* אינסטגרם */}
      <section className="promo-section" aria-labelledby="promo-title">
        <div className="promo-inner">
          <h2 id="promo-title" className="promo-title">
            ON INSTAGRAM @HALAKLI_
          </h2>

          <img
            className="promo-image"
            src="https://images.unsplash.com/photo-1512496015851-a90fb38ba796?q=80&w=1600&auto=format&fit=crop"
            alt="שיער חלק ומבריק"
            loading="lazy"
            decoding="async"
          />
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
