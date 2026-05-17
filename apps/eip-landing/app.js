const API_BASE = window.EIP_API_BASE || "http://localhost:4000";
const form = document.getElementById("tenantForm");
const errorEl = document.getElementById("formError");
const successEl = document.getElementById("formSuccess");
const applicantSelect = form.querySelector("select[name='applicantType']");

function setMessage(target, message) {
  target.textContent = message || "";
}

function toggleApplicantFields() {
  if (applicantSelect.value === "sole_trader") {
    form.classList.add("is-sole");
  } else {
    form.classList.remove("is-sole");
  }
}

function buildPayload(formData) {
  const base = {
    applicantType: formData.get("applicantType"),
    legalName: formData.get("legalName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    country: formData.get("country"),
    timezone: formData.get("timezone"),
    acceptTerms: formData.get("acceptTerms") === "on",
    acceptPrivacy: formData.get("acceptPrivacy") === "on",
    termsVersion: "v1",
    privacyVersion: "v1"
  };

  if (base.applicantType === "business") {
    base.businessRegNo = formData.get("businessRegNo");
  } else {
    base.personalIdNo = formData.get("personalIdNo");
  }

  return base;
}

async function submitForm(event) {
  event.preventDefault();
  setMessage(errorEl, "");
  setMessage(successEl, "");

  const payload = buildPayload(new FormData(form));

  try {
    const response = await fetch(`${API_BASE}/api/public/tenant-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Request rejected");
    }

    setMessage(successEl, `Application received. Reference: ${data.ref || "created"}`);
    form.reset();
    toggleApplicantFields();
  } catch (err) {
    setMessage(errorEl, err.message || "Request failed");
  }
}

toggleApplicantFields();
applicantSelect.addEventListener("change", toggleApplicantFields);
form.addEventListener("submit", submitForm);
