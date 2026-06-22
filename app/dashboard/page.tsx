"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export default function Dashboard() {
const { isSignedIn } = useUser();

const [savedAds, setSavedAds] = useState<any[]>([]);
const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
const [loading, setLoading] = useState(true);
const [search, setSearch] = useState("");

useEffect(() => {
async function loadData() {
if (!isSignedIn) {
setLoading(false);
return;
}

  try {
    const [userRes, adsRes] = await Promise.all([
      fetch("/api/user"),
      fetch("/api/ads"),
    ]);

    const userData = await userRes.json();
    const adsData = await adsRes.json();

    setCreditsLeft(userData.ads_limit - userData.ads_used);
    setSavedAds(adsData);
  } catch (error) {
    console.error(error);
  }

  setLoading(false);
}

loadData();

}, [isSignedIn]);

async function deleteAd(id: number) {
const confirmed = confirm(
"Delete this ad permanently?"
);

if (!confirmed) return;

try {
  await fetch(`/api/ads?id=${id}`, {
    method: "DELETE",
  });

  setSavedAds(
    savedAds.filter((ad) => ad.id !== id)
  );
} catch (error) {
  console.error(error);
}

}

if (loading) {
return (
<main style={{ padding: "40px" }}> <h2>Loading dashboard...</h2> </main>
);
}

if (!isSignedIn) {
return (
<main style={{ padding: "40px" }}> <h2>Please sign in to view dashboard.</h2> </main>
);
}

return (
<main
style={{
minHeight: "100vh",
padding: "40px",
background: "#f5f7fb",
}}
>
<div
style={{
maxWidth: "1000px",
margin: "0 auto",
background: "white",
padding: "30px",
borderRadius: "16px",
boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
}}
>
<button
onClick={() => (window.location.href = "/")}
style={{
padding: "10px 16px",
borderRadius: "8px",
border: "none",
cursor: "pointer",
marginBottom: "20px",
}}
>
← Back to Generator </button>

    <h1>📊 Dashboard</h1>

    <p style={{ fontSize: "18px" }}>
      💳 Credits Left: <strong>{creditsLeft}</strong>
    </p>

    <h2 style={{ marginTop: "30px" }}>
      💾 Saved Ads
    </h2>

    <input
      placeholder="Search ads..."
      value={search}
      onChange={(e) =>
        setSearch(e.target.value)
      }
      style={{
        width: "100%",
        padding: "12px",
        marginTop: "15px",
        marginBottom: "20px",
        borderRadius: "8px",
        border: "1px solid #ddd",
      }}
    />

    {savedAds.length === 0 ? (
      <p>No saved ads yet.</p>
    ) : (
      savedAds
        .filter(
          (ad) =>
            ad.brand_name
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              ) ||
            ad.product
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              )
        )
        .map((ad) => (
          <div
            key={ad.id}
            style={{
              padding: "20px",
              marginTop: "15px",
              border: "1px solid #ddd",
              borderRadius: "12px",
              background: "#fafafa",
            }}
          >
            <h3>
              {ad.brand_name ||
                "No Brand Name"}
            </h3>

            <p>
              <strong>Product:</strong>{" "}
              {ad.product}
            </p>

            <p>
              <strong>Audience:</strong>{" "}
              {ad.audience}
            </p>

            <small>
              {new Date(
                ad.created_at
              ).toLocaleString()}
            </small>

            <details
              style={{ marginTop: "15px" }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                View Generated Ads
              </summary>

              <pre
                style={{
                  whiteSpace:
                    "pre-wrap",
                  marginTop: "10px",
                  background:
                    "#f3f4f6",
                  padding: "15px",
                  borderRadius:
                    "10px",
                }}
              >
                {ad.generated_ads}
              </pre>
            </details>

            <button
              onClick={() =>
                deleteAd(ad.id)
              }
              style={{
                marginTop: "10px",
                background:
                  "#ef4444",
                color: "white",
                border: "none",
                padding:
                  "10px 14px",
                borderRadius:
                  "8px",
                cursor: "pointer",
              }}
            >
              🗑 Delete
            </button>
          </div>
        ))
    )}
  </div>
</main>


);
}
