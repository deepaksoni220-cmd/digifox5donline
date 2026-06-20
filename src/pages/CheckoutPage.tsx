import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../state/CartContext";

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export default function CheckoutPage() {
  const { items, count, total, setQty, clear } = useCart();

  const isEmpty = items.length === 0;

  const subtotalText = useMemo(() => formatMoney(total), [total]);

  const onPlaceOrder = () => {
    // Client-side template: simulate order then clear.
    clear();
    // eslint-disable-next-line no-alert
    alert("Order placed! (Demo)");
  };

  return (
    <div className="ae-page ae-page--normal">
      <div className="ae-page-hero">
        <p className="ae-eyebrow ae-eyebrow--center">Checkout</p>
        <h1 className="ae-title ae-title--center">
          Your <span className="ae-title--muted">Cart</span>
        </h1>
        <p className="ae-desc ae-desc--center" style={{ maxWidth: 720 }}>
          Review items, adjust quantities, and place your order. This is a demo
          checkout (client-side only).
        </p>

        <div className="ae-hero-actions">
          <Link to="/" className="ae-ghost-btn">
            Back to Home
          </Link>
          {!isEmpty && (
            <button
              className="ae-primary-btn"
              type="button"
              onClick={onPlaceOrder}
            >
              Place Order
            </button>
          )}
        </div>
      </div>

      <div className="ae-page-grid ae-page-grid--2" style={{ alignItems: "start" }}>
        <section className="ae-page-card" aria-label="Cart items">
          <h2 className="ae-card-title">Items</h2>

          {isEmpty ? (
            <p className="ae-paragraph" style={{ marginTop: 6 }}>
              Your cart is empty. Go to the home page and click{" "}
              <b>Select</b>.
            </p>
          ) : (
            <div className="ae-values" style={{ marginTop: 12 }}>
              {items.map((it) => (
                <div key={it.id} className="ae-value-pill">
                  <span className="ae-value-title">{it.name}</span>
                  <span className="ae-value-sub">
                    {formatMoney(it.price)} each
                  </span>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 10,
                    }}
                  >
                    <button
                      type="button"
                      className="ae-co-customize"
                      style={{ width: 46, height: 38 }}
                      onClick={() => setQty(it.id, it.qty - 1)}
                      aria-label={`Decrease ${it.name}`}
                    >
                      −
                    </button>
                    <div
                      style={{
                        minWidth: 30,
                        textAlign: "center",
                        fontWeight: 900,
                        color: "#2a1f23",
                      }}
                    >
                      {it.qty}
                    </div>
                    <button
                      type="button"
                      className="ae-co-customize"
                      style={{ width: 46, height: 38 }}
                      onClick={() => setQty(it.id, it.qty + 1)}
                      aria-label={`Increase ${it.name}`}
                    >
                      +
                    </button>

                    <div style={{ marginLeft: "auto", fontWeight: 900 }}>
                      {formatMoney(it.price * it.qty)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="ae-page-card" aria-label="Order summary">
          <h2 className="ae-card-title">Summary</h2>

          <div className="ae-divider" />

          <div className="ae-values" style={{ marginTop: 10 }}>
            <div className="ae-value-pill">
              <span className="ae-value-title">Subtotal</span>
              <span className="ae-value-sub">{subtotalText}</span>
            </div>
            <div className="ae-value-pill">
              <span className="ae-value-title">Items</span>
              <span className="ae-value-sub">{count} total</span>
            </div>
          </div>

          {!isEmpty && (
            <>
              <div className="ae-divider" style={{ marginTop: 14 }} />
              <button
                className="ae-primary-btn ae-primary-btn--block"
                type="button"
                onClick={onPlaceOrder}
                style={{ marginTop: 14 }}
              >
                Place Order
              </button>
              <p className="ae-paragraph" style={{ marginTop: 10 }}>
                By placing an order, you agree this is a front-end demo.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
