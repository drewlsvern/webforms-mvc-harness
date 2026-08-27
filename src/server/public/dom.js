export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function renderGatePanel(stage, gate, onApprove, onReject) {
  const status = gate ? gate.status : "no gate yet";
  const comment = gate && gate.comment ? `<div class="muted">Comment: ${esc(gate.comment)}</div>` : "";
  const wrapper = document.createElement("div");
  wrapper.className = "card";
  wrapper.innerHTML = `
    <h3>Gate: ${esc(stage)}</h3>
    <div>Status: <span class="badge">${esc(status)}</span></div>
    ${comment}
    <div class="row">
      <button class="primary" data-action="approve">Approve</button>
      <input data-role="reject-comment" placeholder="Rejection comment" />
      <button class="danger" data-action="reject">Reject</button>
    </div>
  `;
  wrapper.querySelector('[data-action="approve"]').addEventListener("click", () => onApprove());
  wrapper.querySelector('[data-action="reject"]').addEventListener("click", () => {
    const comment = wrapper.querySelector('[data-role="reject-comment"]').value.trim();
    if (!comment) return alert("A rejection needs a comment.");
    onReject(comment);
  });
  return wrapper;
}

export function renderError(err) {
  const div = document.createElement("div");
  div.className = "error";
  div.textContent = err instanceof Error ? err.message : String(err);
  return div;
}
