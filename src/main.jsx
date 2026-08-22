import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "";
const ADMIN_TOKEN_KEY = "daily_biryani_admin_token";
const FALLBACK_IMAGE = "/food-placeholder.svg";
const LOGO_IMAGE = "/Image%20of%20Logo.png";

const fallbackMenu = [
  ["B001", "Fry Biryani (Bilal Restaurant)", 210, "Biryani"],
  ["B002", "Mixed Biryani (Bilal Restaurant)", 210, "Biryani"],
  ["B003", "Dum Biryani (Bilal Restaurant)", 200, "Biryani"],
  ["V001", "Veg Fried Rice", 110, "Veg Fast Food"],
  ["V002", "Veg Noodles", 110, "Veg Fast Food"],
  ["V003", "Veg Manchurian", 120, "Veg Fast Food"],
  ["V004", "Veg Manchurian Noodles", 120, "Veg Fast Food"],
  ["F001", "Chicken Manchurian Fried Rice", 150, "Fast Food"],
  ["F002", "Chicken Fried Rice", 120, "Fast Food"],
  ["F003", "Chicken Shawarma (Bilal Restaurant)", 120, "Fast Food"],
  ["F004", "Egg Noodles", 120, "Fast Food"],
  ["F005", "Egg Fried Rice", 120, "Fast Food"],
  ["F006", "Egg Manchurian Fried Rice", 130, "Fast Food"],
  ["F007", "Double Egg Chicken Noodles", 130, "Fast Food"],
  ["F008", "Chicken Noodles", 120, "Fast Food"],
  ["F009", "Double Egg Chicken Fried Rice", 130, "Fast Food"],
  ["F010", "Egg Manchurian", 120, "Fast Food"],
  ["F011", "Double Egg Fried Rice", 130, "Fast Food"],
  ["D001", "Thums Up (250 ml)", 30, "Cool Drinks"],
  ["E001", "Raw Eggs", 10, "Eggs"],
  ["J001", "Sugar Cane Juice", 60, "Juice"],
].map(([id, name, price, category]) => ({
  id,
  name,
  price,
  category,
  available: true,
  description: "",
  imageUrl: "",
}));

const categoryPresets = [
  "Biryani",
  "Veg Fast Food",
  "Fast Food",
  "Cool Drinks",
  "Eggs",
  "Juice",
  "Pulav",
  "Veg",
  "Non-Veg",
  "Desserts",
  "Other",
];

async function api(action, payload = {}) {
  if (!API_URL)
    throw new Error(
      "API URL is not configured. Create .env with VITE_API_URL.",
    );
  const body = new URLSearchParams({
    action,
    ...Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [
        k,
        typeof v === "string" ? v : JSON.stringify(v),
      ]),
    ),
  });
  const res = await fetch(API_URL, { method: "POST", body });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Request failed");
  return data;
}

function App() {
  const path = window.location.pathname;
  return path.startsWith("/admin") ? <AdminApp /> : <CustomerApp />;
}

function CustomerApp() {
  const [menu, setMenu] = useState(fallbackMenu),
    [cart, setCart] = useState({}),
    [form, setForm] = useState({
      name: "",
      phone: "",
      area: "",
      address: "",
      landmark: "",
      instructions: "",
    }),
    [file, setFile] = useState(null),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState(""),
    [search, setSearch] = useState(""),
    [activeCategory, setActiveCategory] = useState("All");
  const [showCheckout, setShowCheckout] = useState(false);
  useEffect(() => {
    api("getMenu")
      .then((d) => setMenu(d.menu))
      .catch(() => {});
  }, []);
  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(menu.filter((x) => x.available).map((x) => x.category)),
      ),
    ],
    [menu],
  );
  const filtered = useMemo(
    () =>
      menu.filter(
        (x) =>
          x.available &&
          (activeCategory === "All" || x.category === activeCategory) &&
          x.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [menu, activeCategory, search],
  );
  const items = useMemo(
    () =>
      menu
        .filter((x) => cart[x.id] > 0)
        .map((x) => ({ ...x, qty: cart[x.id] })),
    [menu, cart],
  );
  const total = useMemo(
    () => items.reduce((s, x) => s + x.price * x.qty, 0),
    [items],
  );
  const itemCount = items.reduce((s, x) => s + x.qty, 0);
  const change = (id, n) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + n) }));
  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!items.length) return setMsg("Please select at least one item.");
    if (
      !form.name ||
      !/^[6-9]\d{9}$/.test(form.phone) ||
      !form.area ||
      !form.address
    )
      return setMsg("Please fill all required delivery details.");
    if (!file) return setMsg("Please upload the payment receipt.");
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      const d = await api("createOrder", {
        customer: form,
        items,
        total,
        receiptName: file.name,
        receiptType: file.type,
        receiptBase64: b64,
      });
      setMsg(
        `Order ${d.orderId} placed successfully. Payment will be verified by the delivery team.`,
      );
      setCart({});
      setFile(null);
      setForm({
        name: "",
        phone: "",
        area: "",
        address: "",
        landmark: "",
        instructions: "",
      });
      setShowCheckout(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="site">
      <header className="customerHeader">
        <div className="container headerInner">
          <div className="brandLockup">
            <div className="brandMark">
              <img src={LOGO_IMAGE} alt="Food2Campus" />
            </div>
            <div>
              <div className="brandName">Food2Campus</div>
              <div className="brandTag">
                Freshly prepared • Delivered to you
              </div>
            </div>
          </div>
          <div className="cutoff">
            <span className="dot" /> Orders close at <b>6:00 PM</b>
          </div>
        </div>
      </header>
      <main>
        <section className="heroSection">
          <div className="container heroInner">
            <div>
              <span className="eyebrow">TODAY'S KITCHEN</span>
              <h1>
                Good food,
                <br />
                <em>made for today.</em>
              </h1>
              <p>
                Craving food? Your next favourite bite is just a few clicks
                away.😋
              </p>
            </div>
            <div className="heroBadge">
              <span>🍽️</span>
              <b>Pre-order</b>
              <small>before 6 PM</small>
            </div>
          </div>
        </section>
        <section className="menuSection container">
          <div className="menuToolbar">
            <div>
              <span className="eyebrow">MENU</span>
              <h2>What are you craving?</h2>
            </div>
            <div className="searchBox">
              <span>⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes..."
              />
            </div>
          </div>
          <div className="categoryTabs">
            {categories.map((c) => (
              <button
                key={c}
                className={activeCategory === c ? "active" : ""}
                onClick={() => setActiveCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {activeCategory === "All" ? (
            categories
              .slice(1)
              .map((cat) => (
                <CategorySection
                  key={cat}
                  category={cat}
                  items={filtered.filter((x) => x.category === cat)}
                  cart={cart}
                  change={change}
                />
              ))
          ) : (
            <CategorySection
              category={activeCategory}
              items={filtered}
              cart={cart}
              change={change}
            />
          )}
        </section>
      </main>
      {msg && <div className="toast successToast">✓ {msg}</div>}
      {itemCount > 0 && (
        <button className="floatingCart" onClick={() => setShowCheckout(true)}>
          <span>🛒</span>
          <span>
            <b>
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </b>
            <small>View cart</small>
          </span>
          <strong>₹{total}</strong>
        </button>
      )}
      {showCheckout && (
        <div className="drawerBackdrop" onClick={() => setShowCheckout(false)}>
          <aside
            className="checkoutDrawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawerHead">
              <div>
                <span className="eyebrow">CHECKOUT</span>
                <h2>Your order</h2>
              </div>
              <button
                className="iconBtn"
                onClick={() => setShowCheckout(false)}
              >
                ×
              </button>
            </div>
            <div className="cartList">
              {items.map((i) => (
                <div className="cartRow" key={i.id}>
                  <img
                    src={i.imageUrl || FALLBACK_IMAGE}
                    onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)}
                  />
                  <div>
                    <b>{i.name}</b>
                    <small>₹{i.price} each</small>
                  </div>
                  <div className="qtyControl">
                    <button onClick={() => change(i.id, -1)}>−</button>
                    <b>{i.qty}</b>
                    <button onClick={() => change(i.id, 1)}>+</button>
                  </div>
                  <strong>₹{i.price * i.qty}</strong>
                </div>
              ))}
            </div>
            <div className="checkoutTotal">
              <span>Total</span>
              <b>₹{total}</b>
            </div>
            <form onSubmit={submit} className="checkoutForm">
              <div className="fieldGrid">
                <Field label="Name *">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </Field>
                <Field label="WhatsApp / Phone *">
                  <input
                    inputMode="numeric"
                    maxLength="10"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        phone: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    required
                  />
                </Field>
              </div>
              <div className="fieldGrid">
                <Field label="Area *">
                  <input
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    placeholder="e.g. Kondapur"
                    required
                  />
                </Field>
                <Field label="Landmark">
                  <input
                    value={form.landmark}
                    onChange={(e) =>
                      setForm({ ...form, landmark: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label="Delivery Address *">
                <textarea
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  required
                />
              </Field>
              <Field label="Special Instructions">
                <textarea
                  value={form.instructions}
                  onChange={(e) =>
                    setForm({ ...form, instructions: e.target.value })
                  }
                  placeholder="Optional"
                />
              </Field>
              <div className="paymentCard">
                <div>
                  <span className="eyebrow">PAYMENT</span>
                  <h3>Pay ₹{total} with PhonePe</h3>
                  <p>
                    Scan the QR with your PhonePe app, complete the payment,
                    then upload the receipt.
                  </p>
                </div>
                <img src="/upi-qr.jpg" alt="PhonePe QR" />
                <label className="uploadBox">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <span>📎</span>
                  <b>{file ? file.name : "Upload payment receipt"}</b>
                  <small>JPG, PNG, WEBP or PDF • max 5 MB</small>
                </label>
              </div>
              {msg && <div className="formNotice">{msg}</div>}
              <button className="primaryBtn" disabled={busy}>
                {busy ? "Submitting order…" : "PLACE ORDER • ₹" + total}
              </button>
            </form>
          </aside>
        </div>
      )}
      <footer className="siteFooter">
        <div className="container">
          © {new Date().getFullYear()} Food2Campus <span>•</span> Pre-orders
          close at 6:00 PM
        </div>
      </footer>
    </div>
  );
}

function CategorySection({ category, items, cart, change }) {
  if (!items.length) return null;
  return (
    <section className="categorySection">
      <div className="sectionTitle">
        <h3>{category}</h3>
        <span>{items.length} items</span>
      </div>
      <div className="foodGrid">
        {items.map((item) => (
          <FoodCard
            key={item.id}
            item={item}
            qty={cart[item.id] || 0}
            change={change}
          />
        ))}
      </div>
    </section>
  );
}
function FoodCard({ item, qty, change }) {
  return (
    <article className="foodCard">
      <div className="foodImageWrap">
        <img
          src={item.imageUrl || FALLBACK_IMAGE}
          alt={item.name}
          loading="lazy"
          onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)}
        />
        {item.category.toLowerCase().includes("non") ? (
          <span className="foodDot nonveg" />
        ) : (
          <span className="foodDot veg" />
        )}
      </div>
      <div className="foodInfo">
        <div>
          <h4>{item.name}</h4>
          {item.description && <p>{item.description}</p>}
        </div>
        <div className="foodBottom">
          <strong>₹{item.price}</strong>
          {qty === 0 ? (
            <button className="addBtn" onClick={() => change(item.id, 1)}>
              ADD
            </button>
          ) : (
            <div className="qtyControl">
              <button onClick={() => change(item.id, -1)}>−</button>
              <b>{qty}</b>
              <button onClick={() => change(item.id, 1)}>+</button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function AdminApp() {
  const [token, setToken] = useState(
    localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  );
  const [logged, setLogged] = useState(!!token);
  if (!logged)
    return (
      <AdminLogin
        onLogin={(t) => {
          localStorage.setItem(ADMIN_TOKEN_KEY, t);
          setToken(t);
          setLogged(true);
        }}
      />
    );
  return (
    <AdminDashboard
      token={token}
      logout={() => {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        setLogged(false);
      }}
    />
  );
}
function AdminLogin({ onLogin }) {
  const [u, setU] = useState("Deliveryteam"),
    [p, setP] = useState(""),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const d = await api("login", { username: u, password: p });
      onLogin(d.token);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="adminAuth">
      <div className="authGlow" />
      <form className="authCard" onSubmit={go}>
        <div className="brandLockup">
          <div className="brandMark">
            <img src={LOGO_IMAGE} alt="Food2Campus" />
          </div>
          <div>
            <div className="brandName">Food2Campus</div>
            <div className="brandTag">Delivery team portal</div>
          </div>
        </div>
        <span className="eyebrow">PRIVATE AREA</span>
        <h1>Welcome back.</h1>
        <p>Sign in to manage today’s orders, kitchen readiness and menu.</p>
        <Field label="Username">
          <input
            value={u}
            onChange={(e) => setU(e.target.value)}
            autoComplete="username"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={p}
            onChange={(e) => setP(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        {err && <div className="errorBox">{err}</div>}
        <button className="primaryBtn" disabled={busy}>
          {busy ? "Signing in…" : "SIGN IN"}
        </button>
      </form>
    </div>
  );
}

function AdminDashboard({ token, logout }) {
  const [orders, setOrders] = useState([]),
    [menu, setMenu] = useState([]),
    [tab, setTab] = useState("orders"),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false),
    [oldP, setOldP] = useState(""),
    [newP, setNewP] = useState(""),
    [confirmP, setConfirmP] = useState(""),
    [menuSearch, setMenuSearch] = useState(""),
    [categoryFilter, setCategoryFilter] = useState("All"),
    [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    price: "",
    category: "Veg",
    customCategory: "",
    description: "",
    imageUrl: "",
  });
  const load = async () => {
    try {
      const d = await api("getOrders", { token });
      setOrders(d.orders);
      const m = await api("getMenu", { token });
      setMenu(m.menu);
    } catch (e) {
      if (e.message.toLowerCase().includes("session")) logout();
      else setMsg(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const update = async (id, field, value) => {
    try {
      await api("updateOrder", { token, orderId: id, field, value });
      setOrders((o) =>
        o.map((x) =>
          x.orderId === id
            ? {
                ...x,
                [field]: value,
                ...(field === "paymentStatus" && value === "Verified"
                  ? { orderStatus: "Confirmed" }
                  : {}),
                ...(field === "foodReady" && value
                  ? { orderStatus: "Ready" }
                  : {}),
              }
            : x,
        ),
      );
    } catch (e) {
      setMsg(e.message);
    }
  };
  const verify = async (id, status) =>
    await update(id, "paymentStatus", status);
  const changePassword = async (e) => {
    e.preventDefault();
    if (newP !== confirmP) return setMsg("New passwords do not match.");
    setBusy(true);
    try {
      await api("changePassword", {
        token,
        oldPassword: oldP,
        newPassword: newP,
      });
      setMsg("Password changed successfully.");
      setOldP("");
      setNewP("");
      setConfirmP("");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  const saveMenu = async () => {
    setBusy(true);
    try {
      const d = await api("saveMenu", { token, menu });
      setMenu(d.menu);
      setMsg("Menu saved and published to the customer page.");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  const uploadImage = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      const d = await api("uploadMenuImage", {
        token,
        name: file.name,
        type: file.type,
        base64: b64,
      });
      setNewItem((x) => ({ ...x, imageUrl: d.imageUrl }));
      setMsg("Image uploaded. Preview is ready.");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  const addItem = async (e) => {
    e.preventDefault();
    const category = newItem.customCategory.trim() || newItem.category;
    if (!newItem.name.trim() || !newItem.price || !category)
      return setMsg("Enter item name, price and category.");
    setBusy(true);
    try {
      const d = await api("addMenuItem", {
        token,
        name: newItem.name,
        price: Number(newItem.price),
        category,
        description: newItem.description,
        imageUrl: newItem.imageUrl,
      });
      setMenu((m) => [...m, d.item]);
      setNewItem({
        name: "",
        price: "",
        category: "Veg",
        customCategory: "",
        description: "",
        imageUrl: "",
      });
      setShowAdd(false);
      setMsg("Item added and published to the customer page.");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  const categories = [
    "All",
    ...Array.from(new Set(menu.map((x) => x.category))),
  ];
  const visibleMenu = menu.filter(
    (m) =>
      (categoryFilter === "All" || m.category === categoryFilter) &&
      m.name.toLowerCase().includes(menuSearch.toLowerCase()),
  );
  const verified = orders.filter((o) => o.paymentStatus === "Verified"),
    pending = orders.filter((o) => o.paymentStatus === "Pending"),
    ready = orders.filter((o) => o.foodReady),
    revenue = verified.reduce((s, o) => s + Number(o.totalAmount || 0), 0),
    pendingReady = verified.filter((o) => !o.foodReady).length;
  const kitchen = menu
    .map((m) => ({
      ...m,
      qty: orders
        .filter((o) => o.paymentStatus === "Verified")
        .reduce((s, o) => s + itemQty(o.items, m.name), 0),
    }))
    .filter((x) => x.qty > 0);
  return (
    <div className="adminShell">
      <header className="adminHeader">
        <div className="container adminHeaderInner">
          <div className="brandLockup">
            <div className="brandMark">
              <img src={LOGO_IMAGE} alt="Food2Campus" />
            </div>
            <div>
              <div className="brandName">Food2Campus</div>
              <div className="brandTag">Admin control centre</div>
            </div>
          </div>
          <div className="adminHeaderActions">
            <span className="todayPill">● Today • {formatToday()}</span>
            <button className="ghostBtn" onClick={load}>
              ↻ Refresh
            </button>
            <button className="ghostBtn dangerText" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>
      <div className="adminLayout container">
        <aside className="adminNav">
          <div className="navLabel">WORKSPACE</div>
          <NavButton
            icon="◉"
            label="Today's Orders"
            active={tab === "orders"}
            onClick={() => setTab("orders")}
          />
          <NavButton
            icon="♨"
            label="Kitchen"
            active={tab === "kitchen"}
            onClick={() => setTab("kitchen")}
          />
          <NavButton
            icon="＋"
            label="Menu & Items"
            active={tab === "menu"}
            onClick={() => setTab("menu")}
          />
          <div className="navDivider" />
          <div className="navLabel">ACCOUNT</div>
          <NavButton
            icon="⌁"
            label="Change Password"
            active={tab === "password"}
            onClick={() => setTab("password")}
          />
        </aside>
        <main className="adminContent">
          <div className="mobileAdminNav">
            {["orders", "kitchen", "menu", "password"].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t === "orders"
                  ? "Orders"
                  : t === "kitchen"
                    ? "Kitchen"
                    : t === "menu"
                      ? "Menu"
                      : "Settings"}
              </button>
            ))}
          </div>
          {msg && (
            <div className="adminNotice">
              {msg}
              <button onClick={() => setMsg("")}>×</button>
            </div>
          )}
          {tab === "orders" && (
            <>
              <div className="pageIntro">
                <div>
                  <span className="eyebrow">OPERATIONS</span>
                  <h1>Today’s orders</h1>
                  <p>
                    Only orders placed today are shown here. Older orders remain
                    in your Google Sheet.
                  </p>
                </div>
                <button className="outlineBtn" onClick={load}>
                  ↻ Refresh orders
                </button>
              </div>
              <div className="statGrid">
                <Stat
                  label="Today's orders"
                  value={orders.length}
                  tone="dark"
                />
                <Stat label="Verified payments" value={verified.length} />
                <Stat label="Food ready" value={ready.length} />
                <Stat label="Pending payment" value={pending.length} />
                <Stat label="Verified sales" value={"₹" + revenue} />
              </div>
              <section className="adminCard">
                <div className="cardHeader">
                  <div>
                    <h2>Order queue</h2>
                    <p>
                      Verify payment, mark food ready, then send for delivery.
                    </p>
                  </div>
                  <span className="countBadge">{orders.length} today</span>
                </div>
                {orders.length === 0 ? (
                  <EmptyState
                    title="No orders yet today"
                    text="New customer orders will appear here automatically."
                  />
                ) : (
                  <div className="orderList">
                    {orders.map((o) => (
                      <OrderCard
                        key={o.orderId}
                        order={o}
                        onVerify={verify}
                        onUpdate={update}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
          {tab === "kitchen" && (
            <>
              <div className="pageIntro">
                <div>
                  <span className="eyebrow">PREPARATION</span>
                  <h1>Kitchen board</h1>
                  <p>Quantities are calculated from today’s verified orders.</p>
                </div>
              </div>
              <section className="adminCard">
                <div className="cardHeader">
                  <div>
                    <h2>Today’s preparation</h2>
                    <p>Only verified orders are included.</p>
                  </div>
                </div>
                {kitchen.length ? (
                  <div className="kitchenBoard">
                    {kitchen.map((x) => (
                      <div className="kitchenItem" key={x.id}>
                        <img
                          src={x.imageUrl || FALLBACK_IMAGE}
                          onError={(e) =>
                            (e.currentTarget.src = FALLBACK_IMAGE)
                          }
                        />
                        <div>
                          <b>{x.name}</b>
                          <small>{x.category}</small>
                        </div>
                        <strong>{x.qty}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Nothing to prepare yet"
                    text="Verified orders will build the kitchen list."
                  />
                )}
              </section>
              <section className="adminCard">
                <div className="cardHeader">
                  <div>
                    <h2>Readiness</h2>
                    <p>
                      {pendingReady} verified order
                      {pendingReady === 1 ? "" : "s"} still waiting for food to
                      be marked ready.
                    </p>
                  </div>
                </div>
                <div className="readinessBar">
                  <span
                    style={{
                      width:
                        (verified.length
                          ? Math.round((ready.length / verified.length) * 100)
                          : 0) + "%",
                    }}
                  />
                </div>
                <div className="readinessText">
                  <span>{ready.length} ready</span>
                  <span>{verified.length - ready.length} waiting</span>
                </div>
              </section>
            </>
          )}
          {tab === "menu" && (
            <>
              <div className="pageIntro">
                <div>
                  <span className="eyebrow">CATALOG</span>
                  <h1>Menu & items</h1>
                  <p>
                    Add dishes, upload or replace photos, edit prices and
                    publish them to the customer page.
                  </p>
                </div>
                <button
                  className="primaryBtn compact"
                  onClick={() => setShowAdd(true)}
                >
                  ＋ Add new item
                </button>
              </div>
              <section className="adminCard">
                <div className="menuTools">
                  <div className="searchBox">
                    <span>⌕</span>
                    <input
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      placeholder="Search menu..."
                    />
                  </div>
                  <div className="categoryTabs adminCats">
                    {categories.map((c) => (
                      <button
                        key={c}
                        className={categoryFilter === c ? "active" : ""}
                        onClick={() => setCategoryFilter(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="menuAdminGrid">
                  {visibleMenu.map((m) => (
                    <EditableMenuCard
                      key={m.id}
                      item={m}
                      index={menu.findIndex((x) => x.id === m.id)}
                      setMenu={setMenu}
                      token={token}
                      onUpload={async (file) => {
                        if (!file) return;
                        setBusy(true);
                        try {
                          const b64 = await fileToBase64(file);
                          const d = await api("uploadMenuImage", {
                            token,
                            name: file.name,
                            type: file.type,
                            base64: b64,
                          });
                          setMenu((prev) =>
                            prev.map((x) =>
                              x.id === m.id
                                ? { ...x, imageUrl: d.imageUrl }
                                : x,
                            ),
                          );
                          setMsg(
                            `${m.name} photo uploaded. Click SAVE & PUBLISH MENU.`,
                          );
                        } catch (e) {
                          setMsg(e.message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                      busy={busy}
                    />
                  ))}
                </div>
                <div className="saveBar">
                  <span>
                    Upload photos or edit items, then save to publish all
                    changes.
                  </span>
                  <button
                    className="primaryBtn compact"
                    onClick={saveMenu}
                    disabled={busy}
                  >
                    {busy ? "Saving…" : "SAVE & PUBLISH MENU"}
                  </button>
                </div>
              </section>
            </>
          )}
          {tab === "password" && (
            <section className="adminCard narrowCard">
              <div className="pageIntro">
                <div>
                  <span className="eyebrow">SECURITY</span>
                  <h1>Change password</h1>
                  <p>Update the delivery team admin password anytime.</p>
                </div>
              </div>
              <form onSubmit={changePassword} className="passwordForm">
                <Field label="Current password">
                  <input
                    type="password"
                    value={oldP}
                    onChange={(e) => setOldP(e.target.value)}
                    required
                  />
                </Field>
                <Field label="New password">
                  <input
                    type="password"
                    minLength="10"
                    value={newP}
                    onChange={(e) => setNewP(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Confirm new password">
                  <input
                    type="password"
                    minLength="10"
                    value={confirmP}
                    onChange={(e) => setConfirmP(e.target.value)}
                    required
                  />
                </Field>
                <p className="hint">
                  Use at least 10 characters. Passwords are stored as salted
                  hashes in Apps Script.
                </p>
                <button className="primaryBtn compact">CHANGE PASSWORD</button>
              </form>
            </section>
          )}
        </main>
      </div>
      {showAdd && (
        <AddItemModal
          item={newItem}
          setItem={setNewItem}
          onClose={() => setShowAdd(false)}
          onUpload={uploadImage}
          onSubmit={addItem}
          busy={busy}
        />
      )}
    </div>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button className={"navBtn " + (active ? "active" : "")} onClick={onClick}>
      <span>{icon}</span>
      {label}
    </button>
  );
}
function Stat({ label, value, tone = "" }) {
  return (
    <div className={"statCard " + tone}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function OrderCard({ order, onVerify, onUpdate }) {
  return (
    <article className="orderCard">
      <div className="orderTop">
        <div>
          <span className="orderId">{order.orderId}</span>
          <span className="orderTime">{order.orderTime}</span>
        </div>
        <span className={"statusPill " + statusClass(order.paymentStatus)}>
          {order.paymentStatus === "Verified"
            ? "✓ Paid"
            : order.paymentStatus === "Rejected"
              ? "× Rejected"
              : "● Payment pending"}
        </span>
      </div>
      <div className="orderMain">
        <div className="customerBlock">
          <h3>{order.customerName}</h3>
          <a href={"tel:" + order.phone}>{order.phone}</a>
          <p>
            {order.area} • {order.address}
            {order.landmark ? ", " + order.landmark : ""}
          </p>
        </div>
        <div className="orderItems">
          <b>{order.items}</b>
          {order.instructions && <small>Note: {order.instructions}</small>}
        </div>
        <div className="amountBlock">
          <small>Total</small>
          <strong>₹{order.totalAmount}</strong>
        </div>
      </div>
      <div className="orderActions">
        <a
          className="receiptBtn"
          href={order.receiptUrl}
          target="_blank"
          rel="noreferrer"
        >
          ↗ View receipt
        </a>
        {order.paymentStatus === "Pending" ? (
          <>
            <button
              className="verifyBtn"
              onClick={() => onVerify(order.orderId, "Verified")}
            >
              ✓ Verify payment
            </button>
            <button
              className="rejectBtn"
              onClick={() => onVerify(order.orderId, "Rejected")}
            >
              Reject
            </button>
          </>
        ) : (
          <span className="verifiedLabel">
            {order.paymentStatus === "Verified"
              ? "Payment verified"
              : "Payment rejected"}
          </span>
        )}
        <label className={"readyCheck " + (order.foodReady ? "checked" : "")}>
          <input
            type="checkbox"
            checked={order.foodReady}
            onChange={(e) =>
              onUpdate(order.orderId, "foodReady", e.target.checked)
            }
          />
          <span className="fakeCheck">✓</span>
          <b>Food ready</b>
        </label>
        <select
          className="statusSelect"
          value={order.orderStatus}
          onChange={(e) =>
            onUpdate(order.orderId, "orderStatus", e.target.value)
          }
        >
          <option>New</option>
          <option>Confirmed</option>
          <option>Preparing</option>
          <option>Ready</option>
          <option>Out for Delivery</option>
          <option>Delivered</option>
          <option>Cancelled</option>
        </select>
      </div>
    </article>
  );
}
function EditableMenuCard({ item, index, setMenu, onUpload, busy }) {
  const fileRef = useRef(null);
  const update = (patch) =>
    setMenu((m) => m.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  return (
    <article className="menuEditCard">
      <div className="editImage">
        <img
          src={item.imageUrl || FALLBACK_IMAGE}
          alt={item.name}
          onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)}
        />
        <span className={item.available ? "liveTag" : "offTag"}>
          {item.available ? "LIVE" : "HIDDEN"}
        </span>
        <input
          ref={fileRef}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => onUpload(e.target.files?.[0])}
        />
        <button
          type="button"
          className="photoBtn"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {item.imageUrl ? "↻ Change photo" : "＋ Add photo"}
        </button>
      </div>
      <div className="editFields">
        <input
          className="titleInput"
          value={item.name}
          onChange={(e) => update({ name: e.target.value })}
        />
        <div className="inlineFields">
          <label>
            Price
            <input
              type="number"
              min="0"
              value={item.price}
              onChange={(e) => update({ price: Number(e.target.value) })}
            />
          </label>
          <label>
            Category
            <input
              value={item.category}
              onChange={(e) => update({ category: e.target.value })}
            />
          </label>
        </div>
        <label>
          Description
          <textarea
            value={item.description || ""}
            onChange={(e) => update({ description: e.target.value })}
            rows="2"
          />
        </label>
        <label className="switchLine">
          <input
            type="checkbox"
            checked={item.available}
            onChange={(e) => update({ available: e.target.checked })}
          />
          <span className="switch" />
          <b>
            {item.available
              ? "Visible on customer page"
              : "Hidden from customer page"}
          </b>
        </label>
      </div>
    </article>
  );
}
function AddItemModal({ item, setItem, onClose, onUpload, onSubmit, busy }) {
  const fileRef = useRef(null);
  const categories = [...categoryPresets];
  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="addModal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHead">
          <div>
            <span className="eyebrow">NEW ITEM</span>
            <h2>Add to today's menu</h2>
            <p>The item will appear on the customer page after you add it.</p>
          </div>
          <button className="iconBtn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="addGrid">
          <form className="addForm" onSubmit={onSubmit}>
            <Field label="Item name *">
              <input
                value={item.name}
                onChange={(e) => setItem({ ...item, name: e.target.value })}
                placeholder="e.g. Chicken Biryani"
                required
              />
            </Field>
            <div className="fieldGrid">
              <Field label="Price *">
                <input
                  type="number"
                  min="0"
                  value={item.price}
                  onChange={(e) => setItem({ ...item, price: e.target.value })}
                  placeholder="220"
                  required
                />
              </Field>
              <Field label="Category *">
                <select
                  value={item.category}
                  onChange={(e) =>
                    setItem({ ...item, category: e.target.value })
                  }
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Custom category (optional)">
              <input
                value={item.customCategory}
                onChange={(e) =>
                  setItem({ ...item, customCategory: e.target.value })
                }
                placeholder="Type a new category if needed"
              />
            </Field>
            <Field label="Description">
              <textarea
                rows="3"
                value={item.description}
                onChange={(e) =>
                  setItem({ ...item, description: e.target.value })
                }
                placeholder="Short description shown under the item name"
              />
            </Field>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onUpload(e.target.files?.[0])}
            />
            <button
              type="button"
              className="uploadPhotoBtn"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              ＋ Upload item photo
            </button>
            <p className="hint">
              JPG, PNG or WEBP • max 3 MB. Use your actual food photo when
              possible.
            </p>
            <button className="primaryBtn" disabled={busy}>
              {busy ? "Adding…" : "ADD & PUBLISH ITEM"}
            </button>
          </form>
          <div className="livePreview">
            <span className="eyebrow">LIVE PREVIEW</span>
            <h3>Customer card</h3>
            <div className="previewCard">
              <div className="previewImage">
                <img
                  src={item.imageUrl || FALLBACK_IMAGE}
                  onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)}
                />
              </div>
              <div className="previewInfo">
                <span className="previewCat">
                  {item.customCategory || item.category || "Category"}
                </span>
                <h4>{item.name || "Your item name"}</h4>
                <p>
                  {item.description || "Your description will appear here."}
                </p>
                <div>
                  <strong>₹{item.price || "0"}</strong>
                  <button type="button">ADD</button>
                </div>
              </div>
            </div>
            <div className="previewTip">
              ✓ This is approximately how the item will look on the customer
              page.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function EmptyState({ title, text }) {
  return (
    <div className="emptyState">
      <div>🍽️</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function statusClass(s) {
  return String(s).toLowerCase().replace(/\s+/g, "-");
}
function formatToday() {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}
function itemQty(items, name) {
  const m = String(items || "").match(
    new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " × (\\d+)"),
  );
  return m ? Number(m[1]) : 0;
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
createRoot(document.getElementById("root")).render(<App />);
