const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  // Only allow logged-in users
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { geminiKey, interests } = JSON.parse(event.body);
    
    // Create a private store for this specific user
    const store = getStore({
      name: "user_configs",
      siteID: process.env.SITE_ID,
      token: process.env.NETLIFY_PURPOSE_TOKEN // This is handled internally by Netlify
    });

    // Save settings using the User's unique ID (sub)
    await store.setJSON(user.sub, { 
      geminiKey, 
      interests,
      updatedAt: new Date().toISOString() 
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Preferences synced to cloud" }),
    };
  } catch (error) {
    return { statusCode: 500, body: error.toString() };
  }
};
