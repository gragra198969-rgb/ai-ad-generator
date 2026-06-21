"use client";

import { useState, useEffect } from "react";

import { useUser } from "@clerk/nextjs";

export default function Home() {
  const { isSignedIn, user } = useUser();
const [product, setProduct] = useState("");
const [audience, setAudience] = useState("");
const [benefit, setBenefit] = useState("");
const [website, setWebsite] = useState("");
const [tone, setTone] = useState("friendly");
const [adType, setAdType] = useState("facebook");
const [adCount, setAdCount] = useState("5");
const [result, setResult] = useState("");
const [loading, setLoading] = useState(false);
const [history, setHistory] = useState<string[]>([]);
const [darkMode, setDarkMode] = useState(false);
const [brandName, setBrandName] = useState("");
useEffect(() => {
const savedHistory = localStorage.getItem("adHistory");
if (savedHistory) {
setHistory(JSON.parse(savedHistory));
}
}, []);

useEffect(() => {
localStorage.setItem("adHistory", JSON.stringify(history));
}, [history]);

async function generateAds() {
if (!isSignedIn) {
  setResult("Please sign in to generate ads.");
  return;
}

  if (!product || !audience) {
    setResult("Please enter a product and audience.");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        brandName,
        product,
        audience,
        benefit,
        website,
        tone,
        adType,
        adCount,
      }),
    });

    const data = await response.json();

    setResult(data.result);
    setHistory((prev) => [data.result, ...prev]);
  } catch (error) {
    setResult("Something went wrong.");
  }

  setLoading(false);
}

async function copyAds() {
await navigator.clipboard.writeText(result);
alert("Ads copied!");
}

function downloadAds() {
const blob = new Blob([result], {
type: "text/plain",
});

const url = URL.createObjectURL(blob);

const a = document.createElement("a");
a.href = url;
a.download = "ads.txt";
a.click();

URL.revokeObjectURL(url);

}

return (
<main
style={{
minHeight: "100vh",
padding: "40px",
background: darkMode ? "#111827" : "#f5f7fb",
color: darkMode ? "white" : "black",
}}
>
<div
style={{
maxWidth: "900px",
margin: "0 auto",
background: darkMode ? "#1f2937" : "white",
padding: "30px",
borderRadius: "16px",
boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
}}
>
<button
onClick={() => setDarkMode(!darkMode)}
style={{
float: "right",
padding: "10px",
borderRadius: "8px",
}}
>
{darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"} </button>

    <h1>🚀 AI Ad Generator Pro</h1>

<p>Signed In: {isSignedIn ? "YES" : "NO"}</p>
{creditsLeft !== null && (
  <p>Free Ads Remaining: {creditsLeft} / 50</p>
)}
    <input
      placeholder="Brand Name"
      value={brandName}
      onChange={(e) => setBrandName(e.target.value)}
      style={{
        width: "100%",
        padding: "14px",
        marginTop: "20px",
        marginBottom: "15px",
      }}
    />

<input
  placeholder="Product Name"
  value={product}
  onChange={(e) => setProduct(e.target.value)}
  style={{
    width: "100%",
    padding: "14px",
    marginBottom: "15px",
  }}
/>

    <input
      placeholder="Target Audience"
      value={audience}
      onChange={(e) => setAudience(e.target.value)}
      style={{
        width: "100%",
        padding: "14px",
        marginBottom: "15px",
      }}
    />

    <input
      placeholder="Main Benefit"
      value={benefit}
      onChange={(e) => setBenefit(e.target.value)}
      style={{
        width: "100%",
        padding: "14px",
        marginBottom: "15px",
      }}
    />

    <input
      placeholder="Website URL"
      value={website}
      onChange={(e) => setWebsite(e.target.value)}
      style={{
        width: "100%",
        padding: "14px",
        marginBottom: "15px",
      }}
    />

    <select
      value={tone}
      onChange={(e) => setTone(e.target.value)}
      style={{
        width: "100%",
        padding: "14px",
        marginBottom: "15px",
      }}
    >
      <option value="friendly">Friendly</option>
      <option value="professional">Professional</option>
      <option value="exciting">Exciting</option>
    </select>

    <select
      value={adType}
      onChange={(e) => setAdType(e.target.value)}
      style={{
        width: "100%",
        padding: "14px",
        marginBottom: "20px",
      }}
    >
      <option value="facebook">Facebook Ad</option>
      <option value="google">Google Ad</option>
      <option value="email">Email Marketing</option>
      <option value="tiktok">TikTok Ad</option>
      <option value="instagram">Instagram Caption</option>
      <option value="twitter">X / Twitter Post</option>
      <option value="linkedin">LinkedIn Ad</option>
    </select>
<select
  value={adCount}
  onChange={(e) => setAdCount(e.target.value)}
  style={{
    width: "100%",
    padding: "14px",
    marginBottom: "20px",
  }}
>
  <option value="5">5 Ads</option>
  <option value="10">10 Ads</option>
  <option value="20">20 Ads</option>
</select>
    <button
      onClick={generateAds}
      disabled={loading}
      style={{
        background: "#2563eb",
        color: "white",
        border: "none",
        padding: "14px 24px",
        borderRadius: "10px",
        cursor: "pointer",
      }}
    >
      {loading ? "Generating..." : "🚀 Generate Ads"}
    </button>

    {result && (
      <>
        <div
          style={{
            marginTop: "30px",
            background: darkMode ? "#374151" : "#f8f8f8",
            padding: "20px",
            borderRadius: "12px",
            whiteSpace: "pre-wrap",
          }}
        >
          {result}
        </div>

        <button
          onClick={copyAds}
          style={{
            marginTop: "15px",
            marginRight: "10px",
            background: "#22c55e",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: "10px",
          }}
        >
          📋 Copy
        </button>

        <button
          onClick={downloadAds}
          style={{
            marginTop: "15px",
            background: "#7c3aed",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: "10px",
          }}
        >
          📥 Download
        </button>
      </>
    )}

    {history.length > 0 && (
      <div style={{ marginTop: "40px" }}>
        <h2>📜 Previous Ads ({history.length})</h2>

        {history.map((ad, index) => (
          <div
            key={index}
            style={{
              background: darkMode ? "#374151" : "#f8f8f8",
              padding: "15px",
              borderRadius: "10px",
              marginTop: "10px",
              whiteSpace: "pre-wrap",
            }}
          >
            {ad}
          </div>
        ))}

        <button
          onClick={() => setHistory([])}
          style={{
            marginTop: "20px",
            background: "#ef4444",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: "10px",
            cursor: "pointer",
          }}
        >
          🗑 Clear History
        </button>
      </div>
    )}
  </div>
</main>

);
}
