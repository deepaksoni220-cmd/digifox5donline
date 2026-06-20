import { Link } from "react-router-dom";
import { type ReactNode } from "react";

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="ae-page-card" aria-label={title}>
      <h2 className="ae-card-title">{title}</h2>
      <div className="ae-card-body">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="ae-page ae-page--normal">
      <div className="ae-page-hero">
        <p className="ae-eyebrow ae-eyebrow--center">About Us</p>
        <h1 className="ae-title ae-title--center">
          {`Digifox `}
          <span className="ae-title--muted">AERO</span>
        </h1>
        <p className="ae-desc ae-desc--center" style={{ maxWidth: 720 }}>
          A clean, scroll-driven product experience—built with React Three Fiber.
          We obsess over profile, materials, and motion that feels effortless.
        </p>

        <div className="ae-hero-actions">
          <Link to="/contact" className="ae-primary-btn">
            Contact Us
          </Link>
          <Link to="/" className="ae-ghost-btn">
            Back to Home
          </Link>
        </div>
      </div>

      <div className="ae-page-grid">
        <Card title="Our Mission">
          <p className="ae-paragraph">
            Bring premium sneaker storytelling to the web: crisp visuals, smooth
            interactions, and a calm, modern aesthetic.
          </p>
          <p className="ae-paragraph">
            Designed for scroll—no timers, no gimmicks. If you can scroll, you can
            explore.
          </p>
        </Card>

        <Card title="Design Principles">
          <ul className="ae-list">
            <li>
              <strong>Clarity</strong> — information is always readable and
              never competes with the product.
            </li>
            <li>
              <strong>Restraint</strong> — motion is purposeful, not noisy.
            </li>
            <li>
              <strong>Consistency</strong> — brand colors and UI styling stay
              unified across pages.
            </li>
          </ul>
        </Card>

        <Card title="Values">
          <div className="ae-values">
            <div className="ae-value-pill">
              <span className="ae-value-title">Craft</span>
              <span className="ae-value-sub">Detail-first materials</span>
            </div>
            <div className="ae-value-pill">
              <span className="ae-value-title">Comfort</span>
              <span className="ae-value-sub">Built for everyday wear</span>
            </div>
            <div className="ae-value-pill">
              <span className="ae-value-title">Momentum</span>
              <span className="ae-value-sub">Smooth interactions, always</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
