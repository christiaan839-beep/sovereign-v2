const patEl = document.getElementById("pat");
const slugEl = document.getElementById("agentSlug");
const statusEl = document.getElementById("status");

chrome.storage.local.get(["pat", "agentSlug"]).then((s) => {
  if (s.pat) patEl.value = s.pat;
  if (s.agentSlug) slugEl.value = s.agentSlug;
});

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    pat: patEl.value.trim(),
    agentSlug: slugEl.value.trim() || "smart-router",
  });
  statusEl.textContent = "Saved.";
  setTimeout(() => {
    statusEl.textContent = "";
  }, 1500);
});
