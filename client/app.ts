const main = document.querySelector("main")!;
const idURL = main.dataset.idUrl!;
const PICKED_UP = "skyda-session-picked-up";

function storage(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Signed out here but maybe signed in to Skyda: ask Skyda ID for a token in
 * the background and hand it to this site. Signed-out visitors just get a 401.
 */
async function pickUpSession() {
  const response = await fetch(`${idURL}/api/auth/token`, { credentials: "include" });
  if (!response.ok) return;
  const { token } = (await response.json()) as { token: string };
  const saved = await fetch("/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  // Reload once to show the signed-in page. If the cookie didn't stick, the
  // flag stops a reload loop.
  if (saved.ok && !storage()?.getItem(PICKED_UP)) {
    storage()?.setItem(PICKED_UP, "1");
    location.reload();
  }
}

if (main.dataset.signedIn === "true") {
  storage()?.removeItem(PICKED_UP);
} else {
  void pickUpSession().catch(() => {});
}

// Sign out of Skyda first, otherwise the page would pick the session up again.
document.getElementById("sign-out")?.addEventListener("click", async (event) => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  await fetch(`${idURL}/api/auth/sign-out`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: "{}",
  }).catch(() => {});
  await fetch("/sign-out", { method: "POST" });
  location.reload();
});
