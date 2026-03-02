const { getStore } = require("@netlify/blobs");
const { GoogleGenAI } = require("@google/genai"); 
const axios = require("axios");

exports.handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return { statusCode: 401, body: "Login required." };

  try {
    const store = getStore({ name: "user_configs" });
    const prefs = await store.get(user.sub, { type: "json" });

    if (!prefs || !prefs.geminiKey) {
      return { statusCode: 400, body: JSON.stringify([{ title: "Key Missing", summary: "Add your Gemini API key in settings." }]) };
    }

    // Fetch news using your shared key from Netlify environment variables
    const newsRes = await axios.get(`https://newsapi.org/v2/top-headlines?country=in&apiKey=${process.env.NEWS_API_KEY}`);
    const articles = newsRes.data.articles.slice(0, 10);

    const client = new GoogleGenAI({ apiKey: prefs.geminiKey });
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Interests: ${prefs.interests}. Filter/summarize these: ${JSON.stringify(articles)}. Return JSON only. Use Malayalam for local news, English for global tech.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: text
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify([{ title: "Error", summary: err.message }]) };
  }
};
