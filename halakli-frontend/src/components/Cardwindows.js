// CardWindows.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";

export default function CardWindows({
  open,
  item,
  onClose,
  onPrev,
  onNext,
  hasMultiple,
  onCartClick
}) {
  const dialogRef        = useRef(null);
  const contentRef       = useRef(null);
  const transitioningRef = useRef(false);

  const videoEnterRef    = useRef(null);   // הווידאו הנוכחי/נכנס
  const videoLeaveRef    = useRef(null);   // (אופציונלי) אם תרצה וידאו חי בשכבת leave

  const [isPlaying, setIsPlaying]   = useState(true);
  const [showIcon,  setShowIcon]    = useState(true);
  const [isPortrait,setIsPortrait]  = useState(true);
  const hideTimer = useRef(0);

  const [currentItem, setCurrentItem]         = useState(item);
  const [leavingItem, setLeavingItem]         = useState(null);
  const [leavingSnapshot, setLeavingSnapshot] = useState(null);
  const [dir, setDir] = useState(null); // 'next' | 'prev' | null

  const enterRef = useRef(null);
  const leaveRef = useRef(null);

  // מחוות
  const wheelLockRef   = useRef(false);
  const touchStartYRef = useRef(0);
  const touchLockRef   = useRef(false);
  const swipeState = useRef({ started: false, dirLocked: null });

  // Freeze layer כדי לחפות על “חורים” עד שהפריים הראשון באמת צויר
  const [freezeSrc, setFreezeSrc]   = useState(null);
  const [showFreeze, setShowFreeze] = useState(false);

  // קונסטנטים
  const getSlideMs = useCallback(() => {
    const v = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--slide-ms")
    );
    return Number.isFinite(v) && v > 0 ? v : 800;
  }, []);
  const WHEEL_THRESHOLD = 110;
  const WHEEL_RESET_MS  = 240;
  const SWIPE_THRESHOLD = 48;

  // כלי: לחכות לפריים מצויר על המסך
  const waitFirstPaint = useCallback((videoEl) => {
    if (!videoEl) return Promise.resolve();
    // אם כבר צויר (יש פרוגרס ויש currentTime>0), נמשיך מייד
    if (videoEl.readyState >= 2 && videoEl.currentTime > 0) {
      return new Promise((res) => {
        // דור מסך אחד לוודא ציור
        requestAnimationFrame(() => requestAnimationFrame(res));
      });
    }
    return new Promise((resolve) => {
      let done = false;
      const cleanup = () => { if (done) return; done = true; off(); resolve(); };
      const off = () => {
        videoEl.removeEventListener("loadeddata", onLoaded);
        videoEl.removeEventListener("canplay", onLoaded);
      };
      const onLoaded = () => {
        if ("requestVideoFrameCallback" in videoEl) {
          // רנדר אמיתי בפריים הבא
          // @ts-ignore
          videoEl.requestVideoFrameCallback(() => cleanup());
        } else {
          // Fallback: שתי מסגרות רנדר
          requestAnimationFrame(() => requestAnimationFrame(cleanup));
        }
      };
      videoEl.addEventListener("loadeddata", onLoaded, { once: true });
      videoEl.addEventListener("canplay", onLoaded, { once: true });
      // אם כבר מוכן — נזמן ידנית
      if (videoEl.readyState >= 2) onLoaded();
    });
  }, []);

  // סנכרון currentItem כשאין מעבר פעיל
  useEffect(() => { if (dir === null) setCurrentItem(item); }, [item, dir]);

  // נועל/משחרר גודל מכולה בזמן טרנזישן
  const lockContentSize = useCallback((lock) => {
    const el = contentRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (lock) {
      el.style.width  = `${r.width}px`;
      el.style.height = `${r.height}px`;
    } else {
      el.style.width  = "";
      el.style.height = "";
    }
  }, []);

  // צילום פריים מכוון cover
  const captureSnapshot = useCallback(() => {
    const v   = videoEnterRef.current;
    const box = contentRef.current;
    if (!v || !box || !v.videoWidth || !v.videoHeight) return null;
    const W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return null;

    const vw = v.videoWidth, vh = v.videoHeight;
    const scale = Math.max(W / vw, H / vh);
    const sw = W / scale, sh = H / scale;
    const sx = (vw - sw) / 2, sy = (vh - sh) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    try {
      const ctx = canvas.getContext("2d");
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, W, H);
      return canvas.toDataURL("image/jpeg", 0.9);
    } catch { return null; }
  }, []);

  // Play/Pause
  const togglePlay = useCallback(() => {
    const v = videoEnterRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(()=>{});
      setShowIcon(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowIcon(false), 1000);
    } else {
      v.pause();
      setShowIcon(true);
      clearTimeout(hideTimer.current);
    }
  }, []);

  const wakeIcon = useCallback(() => {
    setShowIcon(true);
    clearTimeout(hideTimer.current);
    if (isPlaying) hideTimer.current = setTimeout(() => setShowIcon(false), 500);
  }, [isPlaying]);

  const handleContentClick = useCallback(() => { togglePlay(); wakeIcon(); }, [togglePlay, wakeIcon]);

  // טריגר מעבר (לא מפעיל טרנזישן עד שהפריים הבא מוכן)
  const runSlide = useCallback((direction) => {
    if (!hasMultiple || transitioningRef.current) return;
    transitioningRef.current = true;
    lockContentSize(true);

    // Freeze מעל הכול עד שהווידאו הבא באמת מצויר
    const snap = captureSnapshot();
    if (snap) {
      setFreezeSrc(snap);
      setShowFreeze(true);
    }

    setLeavingSnapshot(snap || null);
    setLeavingItem(currentItem);
    setDir(direction);

    // מבקשים מהאב להביא item חדש
    if (direction === "next") onNext?.(); else onPrev?.();
  }, [hasMultiple, currentItem, onNext, onPrev, lockContentSize, captureSnapshot]);

  // חיצים
  const handleDown = useCallback((e) => { e?.stopPropagation(); runSlide('next'); }, [runSlide]);
  const handleUp   = useCallback((e) => { e?.stopPropagation(); runSlide('prev'); }, [runSlide]);

  // גלילת עכבר/טראקפד – צבירה חכמה + preventDefault
  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;

    let accum = 0;
    let lastTs = 0;
    const COOLDOWN = Math.max(450, getSlideMs() - 150);

    const onWheel = (e) => {
      if (transitioningRef.current) { e.preventDefault(); return; }
      e.preventDefault();

      const now = e.timeStamp || performance.now();
      if (now - lastTs > WHEEL_RESET_MS) accum = 0;
      lastTs = now;

      const delta = e.deltaY;
      if (Math.abs(delta) < 1) return;

      accum += delta;

      if (!wheelLockRef.current && Math.abs(accum) >= WHEEL_THRESHOLD) {
        wheelLockRef.current = true;
        const goNext = accum > 0;
        accum = 0;
        goNext ? runSlide('next') : runSlide('prev');

        setTimeout(() => { wheelLockRef.current = false; }, COOLDOWN);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open, runSlide, getSlideMs]);

  // מגע (סווייפ)
  const onTouchStartSwipe = useCallback((e) => {
    const t = e.touches?.[0];
    touchStartYRef.current = t?.clientY ?? 0;
    swipeState.current.started = true;
    swipeState.current.dirLocked = null;
  }, []);

  const onTouchMoveSwipe = useCallback((e) => {
    e.preventDefault();
    if (!swipeState.current.started || touchLockRef.current || transitioningRef.current) return;
    const y  = e.touches?.[0]?.clientY ?? 0;
    const dy = y - touchStartYRef.current;

    if (swipeState.current.dirLocked === null) {
      if (Math.abs(dy) > 12) swipeState.current.dirLocked = 'y';
      else return;
    }
    if (swipeState.current.dirLocked !== 'y') return;

    if (Math.abs(dy) >= SWIPE_THRESHOLD) {
      const COOLDOWN = Math.max(450, getSlideMs() - 150);
      touchLockRef.current = true;
      dy < 0 ? runSlide('next') : runSlide('prev');
      setTimeout(() => {
        touchLockRef.current = false;
        swipeState.current.started = false;
        swipeState.current.dirLocked = null;
      }, COOLDOWN);
    }
  }, [runSlide, getSlideMs]);

  const onTouchEndSwipe = useCallback(() => {
    swipeState.current.started = false;
    swipeState.current.dirLocked = null;
  }, []);

  // מקלדת
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowUp")   { e.preventDefault(); runSlide('prev'); }
      if (e.key === "ArrowDown") { e.preventDefault(); runSlide('next'); }
      if (e.key === " ")         { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, runSlide, togglePlay]);

  // נעילת רקע
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [open]);

  // סטטוס נגן
  useEffect(() => {
    const v = videoEnterRef.current;
    if (!v) return;
    const sync = () => setIsPlaying(!v.paused);
    v.addEventListener("play", sync);
    v.addEventListener("pause", sync);
    v.addEventListener("loadeddata", sync);
    sync();
    return () => {
      v.removeEventListener("play", sync);
      v.removeEventListener("pause", sync);
      v.removeEventListener("loadeddata", sync);
    };
  }, [currentItem]);

  // יחס דיוקן/נוף
  useEffect(() => {
    const v = videoEnterRef.current;
    if (!v) return;
    const decide = () => {
      if (v.videoWidth && v.videoHeight) setIsPortrait(v.videoHeight >= v.videoWidth);
      else setIsPortrait(true);
    };
    v.addEventListener("loadedmetadata", decide);
    decide();
    return () => v.removeEventListener("loadedmetadata", decide);
  }, [currentItem]);

  // אוטו־הסתרה של play/pause
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  useEffect(() => {
    clearTimeout(hideTimer.current);
    if (isPlaying) {
      setShowIcon(true);
      hideTimer.current = setTimeout(() => setShowIcon(false), 500);
    } else {
      setShowIcon(true);
    }
    return () => clearTimeout(hideTimer.current);
  }, [isPlaying]);

  const closeIfBackdrop = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  // הפעלת הטרנזישן — **רק כשפריים ראשון של הווידאו החדש צבוע**
  useEffect(() => {
    if (dir === null) return;
    if (!item) return;

    // מגדירים את currentItem כדי שהווידאו החדש יותקן ב-DOM
    setCurrentItem(item);

    const enter = enterRef.current;
    const leave = leaveRef.current;

    // נוודא שיש לנו את הווידאו של השכבה הנכנסת
    const waitAndRun = async () => {
      const vEnter = videoEnterRef.current;
      if (!enter || !vEnter) return;

      // חכה שהווידאו יהיה מוכן ויצייר פריים על המסך
      try { await waitFirstPaint(vEnter); } catch {}

      // איפוס מחלקות
      enter.classList.remove('enter-up','enter-down','enter-active','is-enter');
      if (leave) leave.classList.remove('leave-up','leave-down','leave-active','is-leave');

      const enterClass = dir === 'next' ? 'enter-up'  : 'enter-down';
      const leaveClass = dir === 'next' ? 'leave-up'  : 'leave-down';

      enter.classList.add(enterClass, 'is-enter');
      if (leave) leave.classList.add(leaveClass, 'is-leave');

      // forced reflow
      void enter.offsetWidth;

      // טרנזישן
      enter.classList.add('enter-active');
      if (leave) leave.classList.add('leave-active');

      const cleanup = () => {
        setLeavingItem(null);
        setLeavingSnapshot(null);
        setDir(null);
        lockContentSize(false);
        transitioningRef.current = false;

        // מכבים את ה-Freeze רק אחרי שיש ציור
        setShowFreeze(false);
        setTimeout(() => setFreezeSrc(null), 220);

        enter.classList.remove('is-enter');
        if (leave) leave.classList.remove('is-leave','leave-up','leave-down','leave-active');
      };

      const onEnd = (ev) => {
        if (ev.target !== enter) return;
        if (ev.propertyName !== 'transform') return;
        enter.removeEventListener('transitionend', onEnd, true);
        clearTimeout(failsafe);
        cleanup();
      };
      enter.addEventListener('transitionend', onEnd, true);

      const slideMs = getSlideMs();
      const failsafe = setTimeout(() => {
        enter.removeEventListener('transitionend', onEnd, true);
        cleanup();
      }, slideMs + 200);

      return () => {
        clearTimeout(failsafe);
        enter?.removeEventListener('transitionend', onEnd, true);
      };
    };

    const disposer = waitAndRun();
    return () => { try { disposer && disposer(); } catch {} };
  }, [item, dir, lockContentSize, waitFirstPaint, getSlideMs]);

  if (!open) return null;

  return (
    <div className="cw-overlay" onClick={closeIfBackdrop}>
      <div
        className={`cw-dialog ${isPortrait ? 'portrait' : 'landscape'}`}
        role="dialog"
        aria-modal="true"
        aria-label="תצוגת כרטיס"
        ref={dialogRef}
      >
        {/* Back */}
        <button
          className="cw-back"
          aria-label="חזור"
          title="חזור"
          onClick={(e) => { e.stopPropagation(); onClose?.(); }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="cw-back-icon">
            <line x1="6" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <polyline points="11,6 5,12 11,18" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div
          ref={contentRef}
          className="cw-content"
          onClick={handleContentClick}
          onMouseMove={wakeIcon}
          onTouchStart={(e)=>{ wakeIcon(); onTouchStartSwipe(e); }}
          onTouchMove={onTouchMoveSwipe}
          onTouchEnd={onTouchEndSwipe}
        >
          {/* Freeze מעל הכול */}
          {freezeSrc && (
            <img
              className={`cw-freeze ${showFreeze ? 'is-on' : 'is-off'}`}
              src={freezeSrc}
              alt=""
              aria-hidden="true"
            />
          )}

          {/* שכבת “יוצא” */}
          {(leavingSnapshot || leavingItem?.src) && (
            <div ref={leaveRef} className="cw-layer" aria-hidden="true">
              {leavingSnapshot ? (
                <img className="cw-snapshot" src={leavingSnapshot} alt="" />
              ) : (
                <video
                  ref={videoLeaveRef}
                  src={leavingItem.src}
                  autoPlay
                  muted
                  playsInline
                  loop
                  preload="auto"
                  disablePictureInPicture
                  controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
                  style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                />
              )}
            </div>
          )}

          {/* שכבת “נוכחי/נכנס” */}
          <div ref={enterRef} className="cw-layer">
            {currentItem?.src && (
              <>
                <video
                  key={currentItem.src}
                  ref={videoEnterRef}
                  src={currentItem.src}
                  autoPlay
                  muted
                  playsInline
                  loop
                  preload="auto"
                  disablePictureInPicture
                  controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
                  style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                  onPlay={()=>setIsPlaying(true)}
                  onPause={()=>setIsPlaying(false)}
                  onEnded={() => {
                    const v = videoEnterRef.current;
                    if (v) { v.currentTime = 0; v.play().catch(()=>{}); }
                    setIsPlaying(true);
                  }}
                />

                <button
                  className={`cw-pp ${isPlaying ? (showIcon ? 'show' : '') : 'is-paused'}`}
                  onClick={(e)=>{ e.stopPropagation(); togglePlay(); }}
                  aria-label={isPlaying ? 'השהה' : 'נגן'}
                >
                  <span className="cw-icon" aria-hidden>
                    {isPlaying ? '❚❚' : '▶'}
                  </span>
                </button>
              </>
            )}

            {/* Cart */}
            <button
              className="cw-cart"
              aria-label="סל קניות"
              onClick={(e)=>{ e.stopPropagation(); onCartClick?.(); }}
            >
              <svg viewBox="0 0 24 24" className="cw-cart-icon" aria-hidden="true" fill="none" stroke="currentColor">
                <rect x="4" y="8" width="16" height="16" rx="2" fill="#fff" />
                <path d="M8 8a4 4 0 0 1 8 0" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="cw-tip" role="tooltip">הוסף לסל</span>
            </button>
          </div>

          {/* חיצים אנכיים */}
          {hasMultiple && (
            <>
              <button className="cw-nav next" aria-label="הבא"  onClick={handleDown}>
                <span className="cw-arrow cw-arrow--down">‹</span>
              </button>
              <button className="cw-nav prev" aria-label="הקודם" onClick={handleUp}>
                <span className="cw-arrow cw-arrow--up">‹</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
