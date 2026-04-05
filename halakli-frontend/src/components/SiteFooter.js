// src/components/SiteFooter.jsx
import { Link } from "react-router-dom";

export default function SiteFooter(){
  return (
    <footer className="site-footer" dir="ltr" aria-labelledby="footer-heading">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src="/whitelogo.png" alt="Halakli" className="footer-logo" />
          <ul className="social">
            <li><a aria-label="Facebook" href="#fb">f</a></li>
            <li>
              <a aria-label="Tiktok" href="#tk">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="15" height="20" fill="currentColor">
                  <path d="M224 88.8a88.5 88.5 0 0 1-52-17.2V160a64 64 0 1 1-64-64 64.2 64.2 0 0 1 12.8 1.3v33.7a32 32 0 1 0 19.2 29.4V24h32a56 56 0 0 0 56 56Z"/>
                </svg>
              </a>
            </li>
            <li>
              <a aria-label="Instagram" href="#ig">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="15" height="15" fill="currentColor">
                  <path d="M160 24H96A72.08 72.08 0 0 0 24 96v64a72.08 72.08 0 0 0 72 72h64a72.08 72.08 0 0 0 72-72V96a72.08 72.08 0 0 0-72-72Zm48 136a48.05 48.05 0 0 1-48 48H96a48.05 48.05 0 0 1-48-48V96A48.05 48.05 0 0 1 96 48h64a48.05 48.05 0 0 0 48 48Zm-80-80a56 56 0 1 0 56 56 56.06 56.06 0 0 0-56-56Zm0 88a32 32 0 1 1 32-32 32 32 0 0 1-32 32Zm52-92a12 12 0 1 1 12-12 12 12 0 0 1-12 12Z"/>
                </svg>
              </a>
            </li>
          </ul>
        </div>

        <nav className="footer-col" aria-label="About Us">
          <h4 className="footer-title">מידע</h4>
          <ul className="footer-list">
            <li><a href="#who">יצירת קשר</a></li>
            <li>
  <Link to="/qa">שאלות תשובות</Link>
</li>

            <li><a href="#portfolio">תקנון</a></li>
            <li><a href="#partners">הצהרת נגישות</a></li>
            <li><a href="#news">ביטול עסקה</a></li>
            <li><a href="#events">מדיניות הפרטיות</a></li>
             <li><Link to="/vlog">בלוג</Link></li>
          </ul>
        </nav>

        <nav className="footer-col" aria-label="Our Offices">
          <h4 className="footer-title">כללי</h4>
          <ul className="footer-list offices">
            <li><a href="#who">ABOUT ME</a></li>
            <li><Link to="/products">חנות</Link></li>
          </ul>
        </nav>

        <nav className="footer-col" aria-label="Salon location">
          <h4 className="footer-title">מיקום המספרה</h4>
          <strong className="location">קרית עקרון, רבי מאיר בעל הנס 36</strong><br />
          <strong><a className="location">972-52-7274-307+</a></strong><br />
        </nav>
      </div>

      <div className="map-embed" aria-label="מפת גוגל של המספרה">
        <iframe
          title="Halakli – מיקום במספרה"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src="https://www.google.com/maps?q=%D7%A7%D7%A8%D7%99%D7%AA%20%D7%A2%D7%A7%D7%A8%D7%95%D7%9F%2C%20%D7%A8%D7%91%D7%99%20%D7%9E%D7%90%D7%99%D7%A8%20%D7%91%D7%A2%D7%9C%20%D7%94%D7%A0%D7%A1%2036&hl=iw&z=16&output=embed"
          allowFullScreen
        ></iframe>
      </div>

      <div className="footer-bottom">
        <p className="copy">©digitle studio עיצוב ובנייה ע"י</p>
      </div>
    </footer>
  );
}
