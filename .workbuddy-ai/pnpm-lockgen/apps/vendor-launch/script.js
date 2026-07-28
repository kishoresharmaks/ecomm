const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/REPLACE_WITH_1HANDINDIA_VENDOR_FORM/viewform";

const registerLinks = document.querySelectorAll(".js-register-link");
const formNotice = document.getElementById("formNotice");
const hasRealFormLink = !GOOGLE_FORM_URL.includes("REPLACE_WITH");

registerLinks.forEach((link) => {
  link.setAttribute("href", GOOGLE_FORM_URL);

  if (!hasRealFormLink) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (formNotice) {
        formNotice.hidden = false;
        formNotice.focus?.();
      }
    });
  }
});
