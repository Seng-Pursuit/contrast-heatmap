const img = document.getElementById("img");
const err = document.getElementById("err");
const dl = document.getElementById("download");

function showError(message) {
  err.style.display = "";
  err.textContent = message;
  img.style.display = "none";
  dl.style.display = "none";
}

const hash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
if (!hash) {
  showError("No image data provided.");
} else {
  const dataUrl = decodeURIComponent(hash);
  if (dataUrl.startsWith("data:image/")) {
    img.src = dataUrl;
    dl.href = dataUrl;
  } else if (dataUrl.startsWith("data:text/plain")) {
    const text = decodeURIComponent(dataUrl.split(",", 2)[1] || "");
    showError(text);
  } else {
    showError("Unsupported data type returned.");
  }
}


