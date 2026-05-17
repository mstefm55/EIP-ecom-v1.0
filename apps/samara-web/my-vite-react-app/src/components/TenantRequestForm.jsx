import { useState } from "react";
import { callEndpoint } from "../services/api";

const DEFAULT_TERMS_VERSION = "v1";
const DEFAULT_PRIVACY_VERSION = "v1";

const initialForm = {
  applicantType: "business",
  legalName: "Samara Mallet",
  businessRegNo: "",
  personalIdNo: "",
  email: "",
  phone: "",
  country: "MU",
  timezone: "Indian/Mauritius",
  acceptTerms: false,
  acceptPrivacy: false
};

export default function TenantRequestForm() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    const payload = {
      applicantType: form.applicantType,
      legalName: form.legalName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      country: form.country.trim(),
      timezone: form.timezone.trim(),
      acceptTerms: form.acceptTerms,
      acceptPrivacy: form.acceptPrivacy,
      termsVersion: DEFAULT_TERMS_VERSION,
      privacyVersion: DEFAULT_PRIVACY_VERSION
    };

    if (form.applicantType === "business") {
      payload.businessRegNo = form.businessRegNo.trim();
    } else {
      payload.personalIdNo = form.personalIdNo.trim();
    }

    try {
      const response = await callEndpoint("/api/public/tenant-requests", {
        method: "POST",
        body: payload
      });
      setResult(response);
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="tenant-request">
      <div className="tenant-request__head">
        <p className="tenant-request__kicker">Onboarding</p>
        <h2 className="tenant-request__title">Request access for Samara Mallet</h2>
        <p className="tenant-request__sub">
          Submit a tenant request. Approval creates a bootstrap link for the first admin.
        </p>
      </div>
      <form className="tenant-request__form" onSubmit={handleSubmit}>
        <label className="tenant-request__field">
          <span>Applicant Type</span>
          <select
            className="input"
            value={form.applicantType}
            onChange={(e) => updateField("applicantType", e.target.value)}
          >
            <option value="business">Business</option>
            <option value="sole_trader">Sole trader</option>
          </select>
        </label>

        <label className="tenant-request__field">
          <span>Legal Name</span>
          <input
            className="input"
            value={form.legalName}
            onChange={(e) => updateField("legalName", e.target.value)}
            required
          />
        </label>

        {form.applicantType === "business" ? (
          <label className="tenant-request__field">
            <span>Business Registration No</span>
            <input
              className="input"
              value={form.businessRegNo}
              onChange={(e) => updateField("businessRegNo", e.target.value)}
              required
            />
          </label>
        ) : (
          <label className="tenant-request__field">
            <span>National ID / Passport No</span>
            <input
              className="input"
              value={form.personalIdNo}
              onChange={(e) => updateField("personalIdNo", e.target.value)}
              required
            />
          </label>
        )}

        <label className="tenant-request__field">
          <span>Admin Email</span>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            required
          />
        </label>

        <label className="tenant-request__field">
          <span>Phone (optional)</span>
          <input
            className="input"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
          />
        </label>

        <label className="tenant-request__field">
          <span>Country</span>
          <input
            className="input"
            value={form.country}
            onChange={(e) => updateField("country", e.target.value)}
            required
          />
        </label>

        <label className="tenant-request__field">
          <span>Timezone</span>
          <input
            className="input"
            value={form.timezone}
            onChange={(e) => updateField("timezone", e.target.value)}
            required
          />
        </label>

        <label className="tenant-request__check">
          <input
            type="checkbox"
            checked={form.acceptTerms}
            onChange={(e) => updateField("acceptTerms", e.target.checked)}
            required
          />
          <span>Accept Terms</span>
        </label>

        <label className="tenant-request__check">
          <input
            type="checkbox"
            checked={form.acceptPrivacy}
            onChange={(e) => updateField("acceptPrivacy", e.target.checked)}
            required
          />
          <span>Accept Privacy Policy</span>
        </label>

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Request Access"}
        </button>
      </form>

      {error ? <p className="tenant-request__error">{error}</p> : null}
      {result ? (
        <div className="tenant-request__result">
          <p>Request accepted.</p>
          <p className="tenant-request__ref">Reference: {result.ref || "created"}</p>
        </div>
      ) : null}
    </section>
  );
}
