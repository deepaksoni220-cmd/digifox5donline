import { useState, type ReactNode, type FormEvent } from "react";
import { Link } from "react-router-dom";

function TextField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="ae-form-field">
      <span className="ae-form-label">{label}</span>
      <input
        className="ae-form-input"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="ae-form-field">
      <span className="ae-form-label">{label}</span>
      <textarea
        className="ae-form-textarea"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

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

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = name.trim().length > 0 && email.trim().length > 4 && message.trim().length > 0;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // No backend in this template: simulate successful submit.
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setName("");
      setEmail("");
      setMessage("");
    }, 1800);
  };

  return (
    <div className="ae-page ae-page--normal">
      <div className="ae-page-hero">
        <p className="ae-eyebrow ae-eyebrow--center">Contact Us</p>
        <h1 className="ae-title ae-title--center">
          Digifox <span className="ae-title--muted">AERO</span>
        </h1>
        <p className="ae-desc ae-desc--center" style={{ maxWidth: 720 }}>
          Questions, partnerships, or product feedback—send a note and we’ll get
          back to you.
        </p>

        <div className="ae-hero-actions">
          <Link to="/" className="ae-ghost-btn">
            Back to Home
          </Link>
        </div>
      </div>

      <div className="ae-page-grid ae-page-grid--2">
        <Card title="Message">
          <form className="ae-contact-form" onSubmit={onSubmit}>
            <TextField
              label="Name"
              placeholder="Your name"
              value={name}
              onChange={setName}
            />
            <TextField
              label="Email"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={setEmail}
            />
            <TextArea
              label="Message"
              placeholder="What can we help with?"
              value={message}
              onChange={setMessage}
            />

            <button
              className={"ae-primary-btn ae-primary-btn--block"}
              type="submit"
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
            >
              {submitted ? "Sent!" : "Send Message"}
            </button>
          </form>
        </Card>

        <Card title="Direct">
          <div className="ae-contact-info">
            <div className="ae-contact-row">
              <div className="ae-contact-label">Email</div>
              <a className="ae-contact-value" href="mailto:hello@digifox.aero">
                hello@digifox.aero
              </a>
            </div>
            <div className="ae-contact-row">
              <div className="ae-contact-label">Phone</div>
              <a className="ae-contact-value" href="tel:+1234567890">
                +1 (234) 567-90
              </a>
            </div>
            <div className="ae-contact-row">
              <div className="ae-contact-label">Address</div>
              <div className="ae-contact-value">
                Digifox Studio, 12 Pink Avenue
                <br />
                City, Country
              </div>
            </div>

            <div className="ae-divider" />

            <p className="ae-paragraph" style={{ margin: 0 }}>
              Prefer quick updates? Follow the journey on the home page and
              explore the interactive sneaker experience.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
