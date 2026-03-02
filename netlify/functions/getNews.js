const { getStore } = require("@netlify/blobs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

exports.handler = async (event, context) => {
  // 1. Identify User
  const user = context.clientContext && context.clientContext.user;
  if (!user) return { statusCode: 401, body: "Please login." };

  try {
    // 2. Fetch User Prefs from Blobs
    const store = getStore({ name: "user_configs", siteID: process.env.SITE_ID });
    const prefs = await store.get(user.sub, { type: "json" });

    if (!prefs || !prefs.geminiKey) {
      return { statusCode: 400, body: JSON.stringify([{ title: "Setup Required", summary: "Please add your Gemini API Key in Settings (bottom right gear icon)." }]) };
    }

    // 3. Fetch Raw News (Shared NewsAPI Key)
    const newsRes = await axios.get(`https://newsapi.org/v2/top-headlines?country=in&apiKey=${process.env.NEWS_API_KEY}`);
    const articles = newsRes.data.articles.slice(0, 10).map(a => ({
      title: a.title,
      description: a.description,
      url: a.url,
      urlToImage: a.urlToImage
    }));

    // 4. Gemini Curation
    const genAI = new GoogleGenerativeAI(prefs.geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      User Interests: ${prefs.interests}
      
      Task: Filter these articles for relevance to the user. 
      For each relevant article:
      1. Provide a 2-line brief. 
      2. Use Malayalam if the news is about Kerala/India, otherwise use accurate English.
      3. Return ONLY a valid JSON array of objects with keys: title, summary, url, urlToImage.
      
      Articles: ${JSON.stringify(articles)}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: text
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify([{ title: "Error", summary: error.message }]) };
  }
};
