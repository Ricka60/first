// ---------- Helpers ----------
const emailRe = /^\S+@\S+\.\S+$/;
const zipRe = /^\d{5}(?:-\d{4})?$/;
const phoneRe = /^[+()\-.\s\d]{7,25}$/;

const q = (sel) => document.querySelector(sel);
const setText = (sel, text) => { const el = q(sel); if (el) el.textContent = text; };
const show = (el) => { el.hidden = false; };
const hide = (el) => { el.hidden = true; };
const setStatus = (el, msg, ok = false) => {
  el.textContent = msg;
  el.className = 'status ' + (ok ? 'ok' : 'err');
};
const clearErrors = (root) => root.querySelectorAll('.error').forEach(e => e.textContent = '');
const err = (root, name, msg) => {
  const el = root.querySelector(`[data-error-for="${name}"]`);
  if (el) el.textContent = msg;
};
const stepIndicators = [q('#stepIndicator1'), q('#stepIndicator2')];
const setActiveStep = (n) => {
  stepIndicators.forEach((el, idx) => {
    if (!el) return;
    el.classList.toggle('active', idx === (n - 1));
  });
};

// ---------- State ----------
let selectedGuest = null;
let step1Data = {};

// ---------- Elements ----------
const step1 = q('#step1');
const step2 = q('#step2');
const lookupForm = q('#lookupForm');
const lookupBtn = q('#lookupBtn');
const lookupStatus = q('#lookupStatus');
const resultsBox = q('#lookupResults');
const resultsList = q('#resultsList');
const proceedNewBtn = q('#proceedNewBtn');

const intakeForm = q('#intakeForm');
const backToStep1 = q('#backToStep1');
const summaryLine = q('#summaryLine');

const hiddenGuestId = q('#guestId');
const s1_firstName = q('#s1_firstName');
const s1_lastName = q('#s1_lastName');
const s1_dob = q('#s1_dob');
const s1_zip = q('#s1_zip');
const s1_phone = q('#s1_phone');

const submitBtn = q('#submitBtn');
const formStatus = q('#formStatus');

// ---------- Step 1: Lookup ----------
lookupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(lookupForm);
  setStatus(lookupStatus, '');

  const data = Object.fromEntries(new FormData(lookupForm));

  // Honeypot
  if (data.company) {
    setStatus(lookupStatus, 'Submission blocked.', false);
    return;
  }

  // Validate
  let invalid = false;
  if (!data.firstName?.trim()) { err(lookupForm, 'firstName', 'Required.'); invalid = true; }
  if (!data.lastName?.trim()) { err(lookupForm, 'lastName', 'Required.'); invalid = true; }
  if (!data.dob) { err(lookupForm, 'dob', 'Required.'); invalid = true; }
  if (!data.zip || !zipRe.test(data.zip)) { err(lookupForm, 'zip', 'ZIP 12345 or 12345-6789.'); invalid = true; }
  if (!data.phone || !phoneRe.test(data.phone)) { err(lookupForm, 'phone', 'Enter a valid phone.'); invalid = true; }
  if (invalid) return;

  lookupBtn.disabled = true;
  setStatus(lookupStatus, 'Searching…');

  try {
    const res = await fetch('/api/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        dob: data.dob,
        zip: data.zip.trim(),
        phone: data.phone.trim()
      })
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus(lookupStatus, payload?.error || `Lookup failed (${res.status}).`, false);
      return;
    }

    // Normalize matches array
    const matches = Array.isArray(payload?.matches) ? payload.matches : [];
    step1Data = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      dob: data.dob,
      zip: data.zip.trim(),
      phone: data.phone.trim()
    };

    renderResults(matches);
  } catch (e2) {
    setStatus(lookupStatus, 'Network error. Try again.', false);
  } finally {
    lookupBtn.disabled = false;
  }
});

function renderResults(matches) {
  resultsList.innerHTML = '';
  if (matches.length === 0) {
    resultsList.innerHTML = `<li class="result-item"><div><strong>No matches found.</strong><div class="meta">You can continue as a new guest.</div></div></li>`;
  } else {
    for (const m of matches) {
      const li = document.createElement('li');
      li.className = 'result-item';
      li.innerHTML = `
        <div>
          <div><strong>${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)}</strong></div>
          <div class="meta">DOB: ${escapeHtml(m.dob)} • ZIP: ${escapeHtml(m.zip || '—')} • Phone: ${escapeHtml(m.phone || '—')} ${m.email ? '• Email: ' + escapeHtml(m.email) : ''}</div>
        </div>
        <button type="button">Select</button>
      `;
      const btn = li.querySelector('button');
      btn.addEventListener('click', () => selectGuest(m));
      resultsList.appendChild(li);
    }
  }
  show(resultsBox);
  setStatus(lookupStatus, 'Select your profile or continue as new.', true);
}

// Simple sanitizer
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

proceedNewBtn.addEventListener('click', () => {
  selectedGuest = null;
  goToStep2();
});

function selectGuest(guest) {
  selectedGuest = guest || null;
  goToStep2();
}

function goToStep2() {
  // Set hidden fields from step1
  s1_firstName.value = step1Data.firstName;
  s1_lastName.value = step1Data.lastName;
  s1_dob.value = step1Data.dob;
  s1_zip.value = step1Data.zip;
  s1_phone.value = step1Data.phone;
  hiddenGuestId.value = selectedGuest?.id || '';

  // Prefill known fields if present
  if (selectedGuest?.email) q('#email').value = selectedGuest.email;

  // Create summary line
  setText('#summaryLine',
    `${step1Data.firstName} ${step1Data.lastName} • DOB: ${step1Data.dob} • ZIP: ${step1Data.zip} • Phone: ${step1Data.phone}` +
    (selectedGuest ? ' (Matched profile)' : ' (New guest)')
  );

  hide(step1);
  show(step2);
  setActiveStep(2);
}

backToStep1.addEventListener('click', () => {
  show(step1);
  hide(step2);
  setActiveStep(1);
});

// ---------- Step 2: Final submit ----------
intakeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(intakeForm);
  setStatus(formStatus, '');

  const data = Object.fromEntries(new FormData(intakeForm));

  // Validate step 2
  let invalid = false;
  if (!data.skierType) { setErr('skierType', 'Select'); invalid = true; }
  const weight = Number(data.weightLbs);
  if (!weight || weight < 30 || weight > 400) { setErr('weightLbs', '30–400 lbs'); invalid = true; }
  const height = Number(data.heightIn);
  if (!height || height < 36 || height > 84) { setErr('heightIn', '36–84 in'); invalid = true; }
  const shoe = Number(data.shoeSize);
  if (!shoe || shoe < 1 || shoe > 18) { setErr('shoeSize', '1–18 US'); invalid = true; }
  if (!data.email || !emailRe.test(data.email)) { setErr('email', 'Valid email required'); invalid = true; }
  if (!q('#consent').checked) { setErr('consent', 'Required'); invalid = true; }
  if (invalid) return;

  submitBtn.disabled = true;
  setStatus(formStatus, 'Submitting…');

  try {
    const res = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Step 1 carried forward:
        guestId: data.guestId || null,
        firstName: data.firstName,
        lastName: data.lastName,
        dob: data.dob,
        zip: data.zip,
        phone: data.phone,
        // Step 2:
        skierType: data.skierType,
        weightLbs: Number(weight),
        heightIn: Number(height),
        shoeSize: Number(shoe),
        email: data.email
      })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(formStatus, payload?.error || `Submission failed (${res.status}).`, false);
    } else {
      setStatus(formStatus, 'Thanks! Your information has been received.', true);
      intakeForm.reset();
    }
  } catch {
    setStatus(formStatus, 'Network error. Please try again.', false);
  } finally {
    submitBtn.disabled = false;
  }

  function setErr(name, msg) {
    const el = intakeForm.querySelector(`[data-error-for="${name}"]`);
    if (el) el.textContent = msg;
  }
});
