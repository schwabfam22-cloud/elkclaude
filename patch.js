(function() {
  function addEmailField() {
    if (document.getElementById('fEmail')) return;
    const phoneInput = document.getElementById('fPhone');
    if (!phoneInput) { setTimeout(addEmailField, 500); return; }
    const phoneGroup = phoneInput.closest('.form-group');
    const emailGroup = document.createElement('div');
    emailGroup.className = 'form-group';
    emailGroup.innerHTML = `
      <label style="display:block;font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;margin-bottom:4px;">
        Email <span style="font-weight:400;font-size:0.7rem;">(for confirmation email)</span>
      </label>
      <input type="email" id="fEmail" placeholder="e.g. customer@email.com"
        style="width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:7px;font-size:0.85rem;font-family:inherit;color:#1f2937;background:#fafafa;outline:none;">
    `;
    phoneGroup.insertAdjacentElement('afterend', emailGroup);
  }
  document.addEventListener('DOMContentLoaded', addEmailField);
})();
