const { getStore } = require("@netlify/blobs");
const { GoogleGenAI } = require("@google/genai"); // 2026 Modern SDK
const axios = require("axios");

exports.handler = async (event, context) => {
  // 1. Identify the user via Netlify Identity
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { 
      statusCode: 401, 
      body: JSON.stringify([{ title: "Login Required", summary: "Please log in to access your feed." }]) 
    };
  }

  try {
    // 2. Fetch User Preferences from Cloud Storage (Blobs)
    // At runtime, SITE_ID is set automatically by Netlify
    const store = getStore({ name: "user_configs" });
    const prefs = await store.get(user.sub, { type: "json" });

    if (!prefs || !prefs.geminiKey) {
      return { 
        statusCode: 400, 
        body: JSON.stringify([{ 
          title: "Setup Required", 
          summary: "Please add your Gemini API Key in the Settings (gear icon)." 
        }]) 
      };
    }

    // 3. Fetch Headlines (India) using your shared NewsAPI Key
    const newsRes = await axios.get(`https://newsapi.org/v2/top-headlines?country=in&apiKey=${process.env.NEWS_API_KEY}`);
    const rawArticles = newsRes.data.articles.slice(0, 12).map(a => ({
      title: a.title,
      description: a.description || "",
      url: a.url,
      urlToImage: a.urlToImage
    }));

    // 4. Initialize Gemini 3 Flash with the User's Personal Key
    const ai = new GoogleGenAI({ apiKey: prefs.geminiKey });

    const systemPrompt = `
      User Interests: ${prefs.interests}
      
      Task: Filter and summarize these articles.
      Rules:
      1. Only include news relevant to the interests.
      2. Provide a 2-line brief for each.
      3. Use Malayalam for local/India news if possible, otherwise use perfect English.
      4. Avoid translation errors; if Malayalam feels awkward for a tech topic, use English.
      5. Output ONLY a valid JSON array of objects: [{"title":"", "summary":"", "url":"", "urlToImage":""}]
    `;

    // Using the 2026 SDK syntax for model interaction
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nArticles: ${JSON.stringify(rawArticles)}` }] }]
    });

    // Clean up the response text (remove potential markdown formatting)
    const cleanJson = result.response.text.replace(/```json|```/g, "").trim();
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: cleanJson
    };

  } catch (error) {
    console.error("AI News Error:", error);
    return { 
      statusCode: 500, 
      body: JSON.stringify([{ title: "Service Error", summary: "Gemini couldn't process the news right now. Check your API key." }]) 
    };
  }
};
