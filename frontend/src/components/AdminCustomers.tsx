import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminCustomers,
  type AdminBalanceAuditRow,
  type AdminCustomerRow,
} from "../api/client";

interface AdminCustomersProps {
  apiOnline: boolean | null;
}

function money(n: number): string {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Staff view of demo / sqlite customer accounts and balance lookups. */
export function AdminCustomers({ apiOnline }: AdminCustomersProps) {
  const [store, setStore] = useState("—");
  const [rows, setRows] = useState<AdminCustomerRow[]>([]);
  const [audit, setAudit] = useState<AdminBalanceAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (apiOnline === false) return;
    try {
      const data = await fetchAdminCustomers();
      setStore(data.store);
      setRows(data.customers);
      setAudit(data.balance_audit);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load customers");
    } finally {
      setLoading(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="adm-stack">
      <section className="adm-card" aria-label="Customer accounts">
        <div className="adm-card-head">
          <div>
            <h2 className="kn">ಗ್ರಾಹಕರು · Customers</h2>
            <p className="adm-card-meta">
              Store: <strong>{store}</strong> · Demo banking data used after confirm for balance
            </p>
          </div>
          <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        <div className="adm-card-body">
          {loading && <p className="adm-muted">Loading customers…</p>}
          {error && <p className="api-warning">{error}</p>}
          {!loading && !error && (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Balance</th>
                    <th>Mobile</th>
                    <th>Loans</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.account_number}>
                      <td>
                        <code>{row.account_number}</code>
                      </td>
                      <td>
                        <span className="adm-table-kn kn">{row.holder_name_kn || row.holder_name}</span>
                        <div className="adm-table-muted">{row.holder_name}</div>
                      </td>
                      <td>{row.account_type}</td>
                      <td>
                        <strong>{money(row.balance_inr)}</strong>
                      </td>
                      <td className="adm-table-muted">{row.mobile || "—"}</td>
                      <td className="adm-table-muted">
                        {row.loans?.length
                          ? row.loans
                              .map(
                                (loan) =>
                                  `${loan.loan_type} · out ${money(loan.outstanding_inr)}`,
                              )
                              .join("; ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="adm-card" aria-label="Balance lookup audit">
        <div className="adm-card-head">
          <div>
            <h2>Balance lookup log</h2>
            <p className="adm-card-meta">Recent attempts after the customer confirms the account number</p>
          </div>
        </div>
        <div className="adm-card-body">
          {audit.length === 0 ? (
            <p className="adm-muted">No balance lookups yet (sqlite audit only).</p>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Account</th>
                    <th>Result</th>
                    <th>Source</th>
                    <th>Session</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((row) => (
                    <tr key={row.id}>
                      <td className="adm-table-muted">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td>
                        <code>{row.account_number}</code>
                      </td>
                      <td>
                        <span className={`adm-table-badge ${row.found ? "is-active" : "is-done"}`}>
                          {row.found ? "Found" : "Not found"}
                        </span>
                      </td>
                      <td className="adm-table-muted">{row.source}</td>
                      <td className="adm-table-muted">{row.kiosk_session_id || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
