const updated = document.querySelector("#updated");

if (updated) {
  updated.textContent = `Updated ${new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })}`;
}
