import { Link, NavLink, useNavigate } from "react-router-dom";
import { ReactNode, useMemo, useState } from "react";
import { useCart } from "../state/CartContext";

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { count } = useCart();

  const [query, setQuery] = useState("");
  const showQuery = useMemo(() => query.trim().length > 0, [query]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Template behavior: no product catalog, so we just navigate to home.
    // Query is kept locally to show UX feedback.
    navigate("/");
  };

  return (
    <div className="ae-app">
      <header className="ae-site-header">
        <div className="ae-brand">
          <Link to="/" className="ae-brand-link" aria-label="Home">
            <span className="ae-brand-mark" aria-hidden />
            <span>digifox</span>
          </Link>
        </div>

        <nav className="ae-site-nav" aria-label="Primary">
          <NavLink
            to="/about"
            className={({ isActive }) =>
              "ae-nav-link" + (isActive ? " ae-nav-link--on" : "")
            }
          >
            About
          </NavLink>
          <NavLink
            to="/contact"
            className={({ isActive }) =>
              "ae-nav-link" + (isActive ? " ae-nav-link--on" : "")
            }
          >
            Contact
          </NavLink>

          <form
            className="ae-nav-search"
            role="search"
            aria-label="Search products"
            onSubmit={onSearchSubmit}
          >
            <input
              className="ae-nav-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search"
            />
          </form>

          <button
            type="button"
            className="ae-nav-cart"
            onClick={() => navigate("/checkout")}
            aria-label="Cart"
            title="Go to checkout"
          >
            <span className="ae-nav-cart-icon" aria-hidden>
              🛒
            </span>
            <span className="ae-nav-cart-count" aria-hidden>
              {count}
            </span>
          </button>

          {showQuery && (
            <span className="ae-nav-search-hint" aria-hidden>
              “{query.trim()}”
            </span>
          )}
        </nav>
      </header>

      <main className="ae-site-main">{children}</main>

      <footer className="ae-site-footer">
        <div className="ae-footer-inner">
          <div className="ae-footer-brand">
            <span className="ae-brand-mark" aria-hidden />
            <span>digifox</span>
          </div>

          <div className="ae-footer-links">
            <Link to="/about" className="ae-footer-link">
              About Us
            </Link>
            <Link to="/contact" className="ae-footer-link">
              Contact Us
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
