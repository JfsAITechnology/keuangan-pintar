import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync("index.html", "utf8");
const appScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)]
  .map((m) => m[1])
  .find((s) => s.includes("function openEntry("));

assert.ok(appScript, "Main inline application script was not found.");

const elements = {};
const getEl = (id) => elements[id] ??= {
  id,
  value: "",
  textContent: "",
  innerHTML: "",
  disabled: false,
  className: "",
  classList: { add() {}, remove() {}, toggle() {} },
  listeners: {},
  parentElement: null,
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
  async dispatch(type) {
    for (const fn of (this.listeners[type] ?? [])) {
      await fn({ type, target: this, currentTarget: this, preventDefault() {} });
    }
  },
  querySelector(selector) {
    return selector === "button[type=\"submit\"]" ? getEl("saveEntryBtn") : null;
  }
};

const document = { getElementById: getEl };
getEl("chart").parentElement = getEl("chartParent");

const today = new Date();
const todayISO = () => today.toISOString().slice(0, 10);
const monthStart = todayISO().slice(0, 7) + "-01";
const nextMonth = (() => {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  return d.toISOString().slice(0, 10);
})();

const user = {
  id: "runtime-test-user",
  email: "runtime-test@example.com",
  user_metadata: { display_name: "Runtime Test" },
  is_anonymous: false
};

let signedIn = true;
let failSelect = false;
let failInsert = false;

const db = [
  {
    id: "seed-income",
    user_id: user.id,
    scope: "personal",
    type: "income",
    amount: 100000,
    category: "Gaji Bulanan",
    merchant: "Seed Income",
    transaction_date: todayISO(),
    description: null,
    source: "manual",
    created_at: "2026-01-01T00:00:01Z"
  },
  {
    id: "seed-expense",
    user_id: user.id,
    scope: "personal",
    type: "expense",
    amount: 40000,
    category: "Lain-lain",
    merchant: "Seed Expense",
    transaction_date: todayISO(),
    description: null,
    source: "manual",
    created_at: "2026-01-01T00:00:02Z"
  }
];

function currentRows(scope) {
  return db
    .filter((x) =>
      x.user_id === user.id &&
      x.scope === scope &&
      x.transaction_date >= monthStart &&
      x.transaction_date < nextMonth
    )
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

const client = {
  auth: {
    async getUser() {
      return { data: { user: signedIn ? user : null }, error: null };
    },
    async getSession() {
      return { data: { session: signedIn ? { user } : null }, error: null };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signOut() {
      signedIn = false;
      return { error: null };
    }
  },
  from(table) {
    if (table === "kp_profiles") {
      return { upsert: async () => ({ error: null }) };
    }

    const chain = {
      _scope: "personal",
      select() { return this; },
      eq(column, value) {
        if (column === "scope") this._scope = value;
        return this;
      },
      gte() { return this; },
      lt() { return this; },
      order() { return this; },
      async range() {
        if (failSelect) return { data: null, error: new Error("SIMULATED_SELECT_ERROR") };
        return { data: currentRows(this._scope), error: null };
      },
      insert(payload) {
        if (failInsert) {
          return {
            select() { return this; },
            async single() { return { data: null, error: new Error("SIMULATED_INSERT_ERROR") }; }
          };
        }
        const row = {
          id: "runtime-" + (db.length + 1),
          ...payload,
          created_at: new Date().toISOString()
        };
        db.push(row);
        return {
          select() { return this; },
          async single() { return { data: row, error: null }; }
        };
      }
    };

    return chain;
  }
};

const supabase = { createClient: () => client };
const Chart = class { destroy() {} };
const Tesseract = {
  recognize: async () => ({ data: { text: "TOKO TEST TOTAL Rp 25.000 19/09/2026" } })
};
const localStorage = {
  value: "personal",
  getItem() { return this.value; },
  setItem(_key, value) { this.value = String(value); }
};
const window = { addEventListener() {} };
const alerts = [];
const alert = (message) => alerts.push(String(message));

const api = new Function(
  "document",
  "window",
  "localStorage",
  "supabase",
  "Chart",
  "Tesseract",
  "alert",
  appScript + "\nreturn {openEntry,toggleScope,loadTransactions,parseReceipt,isValidISODate,entryForm:document.getElementById('entryForm'),entryAmount:document.getElementById('entryAmount')};"
)(document, window, localStorage, supabase, Chart, Tesseract, alert);

await new Promise((r) => setTimeout(r, 0));
await new Promise((r) => setTimeout(r, 0));

const balance = () => getEl("balance").textContent;
const income = () => getEl("income").textContent;
const expense = () => getEl("expense").textContent;

assert.equal(balance(), "Rp 60.000", "Initial balance must be income minus expense.");
assert.equal(income(), "Rp 100.000");
assert.equal(expense(), "Rp 40.000");

api.openEntry("income");
api.entryAmount.value = "50000";
await api.entryForm.dispatch("submit");
assert.equal(db.length, 3);
assert.equal(balance(), "Rp 110.000");
assert.equal(income(), "Rp 150.000");
assert.equal(expense(), "Rp 40.000");

api.openEntry("expense");
api.entryAmount.value = "20000";
await api.entryForm.dispatch("submit");
assert.equal(db.length, 4);
assert.equal(balance(), "Rp 90.000");
assert.equal(income(), "Rp 150.000");
assert.equal(expense(), "Rp 60.000");

api.toggleScope();
await new Promise((r) => setTimeout(r, 0));
assert.equal(balance(), "Rp 0", "Business scope must be isolated.");

api.toggleScope();
await new Promise((r) => setTimeout(r, 0));
assert.equal(balance(), "Rp 90.000", "Switching back must restore personal totals.");

assert.equal(await api.loadTransactions(), true);
assert.equal(balance(), "Rp 90.000", "Refresh/load must preserve totals.");

assert.equal(api.parseReceipt("TOKO TEST TOTAL Rp 1.250.000 19/09/2026").amount, 1250000);
assert.equal(api.isValidISODate(todayISO()), true);
assert.equal(api.isValidISODate("2026-02-29"), false);
assert.equal(api.parseReceipt("TOKO TEST TOTAL Rp 25.000 19/09/2026").amount, 25000);

failSelect = true;
assert.equal(await api.loadTransactions(), false);
assert.match(getEl("appStatus").textContent, /Data transaksi gagal dimuat/);
failSelect = false;

failInsert = true;
api.openEntry("income");
api.entryAmount.value = "1000";
await api.entryForm.dispatch("submit");
assert.match(alerts.at(-1), /Transaksi gagal disimpan/);

console.log("Keuangan Pintar runtime contract: PASS");
console.log("Manual income/expense, balance, scope isolation, refresh, amount/date parsing, OCR parsing, select-error and insert-error paths: PASS");
