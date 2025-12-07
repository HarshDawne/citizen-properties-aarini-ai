# Aarini Chatbot Integration Guide

## Overview
The Aarini Chatbot is a React-based AI chatbot component that can be integrated into your main website in multiple ways.

---

## **Integration Methods**

### **Method 1: React Component Integration (For React Websites)**

**Best for:** React-based websites

#### Installation
1. Copy the chatbot files to your project:
   ```
   src/
   ├── components/AariniChatbot.tsx
   ├── constants.ts
   └── types.ts
   ```

2. Install dependencies:
   ```bash
   npm install @google/genai lucide-react
   ```

3. Set environment variable:
   Create a `.env` file in your project root:
   ```
   REACT_APP_GEMINI_API_KEY=your_api_key_here
   ```

#### Usage in Your React App
```tsx
import React from 'react';
import AariniChatbot from './components/AariniChatbot';

export default function YourPage() {
  return (
    <div>
      {/* Your page content */}
      <AariniChatbot />
    </div>
  );
}
```

---

### **Method 2: Standalone Widget (For Any Website)**

**Best for:** Adding to existing non-React websites, WordPress, etc.

#### Step 1: Build the Widget
From the chatbot project root:
```bash
npm run build:widget
```

This creates `/dist/aarini-chatbot-widget.js`

#### Step 2: Host the Widget
- Upload `aarini-chatbot-widget.js` to your website's server or CDN
- Example path: `https://yourwebsite.com/chatbot/widget.js`

#### Step 3: Add to Your Website
Add this code to your main website's HTML (before closing `</body>` tag):

```html
<!-- Chatbot Widget Container -->
<div id="aarini-chatbot"></div>

<!-- Load the widget script -->
<script src="https://yourwebsite.com/chatbot/aarini-chatbot-widget.js"></script>

<!-- Initialize the chatbot -->
<script>
  if (window.AariniChatbot) {
    window.AariniChatbot.init('aarini-chatbot', 'YOUR_API_KEY_HERE');
  }
</script>
```

---

### **Method 3: iframe Embedding (Maximum Isolation)**

**Best for:** Third-party websites where you need complete isolation

#### Step 1: Create a Standalone HTML Page
Create `/public/widget.html` in your chatbot project:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aarini Chatbot</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
</body>
</html>
```

#### Step 2: Host the Application
Deploy the entire chatbot project to a server:
- Vercel, Netlify, or your own hosting
- Example: `https://chatbot.example.com`

#### Step 3: Embed via iframe on Main Website
```html
<iframe 
  src="https://chatbot.example.com" 
  title="Aarini Chatbot"
  style="position: fixed; bottom: 0; right: 0; width: 400px; height: 600px; border: none; border-radius: 8px 8px 0 0; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999;">
</iframe>
```

---

## **Environment Setup**

### Getting Your API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikeys)
2. Create a new API key
3. Copy and store it securely

### Setting Up for Production
1. **Never expose API key in frontend code**
2. Instead, create a backend API endpoint:

**Backend Example (Node.js/Express):**
```javascript
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  const apiKey = process.env.GEMINI_API_KEY; // Store securely on server
  
  // Call Gemini API with server-side API key
  // Return response to frontend
});
```

3. Update chatbot to call your backend instead of using API key directly

---

## **Configuration Options**

### Customization
You can customize the chatbot by editing `src/constants.ts`:

```typescript
export const SYSTEM_INSTRUCTION = `
  Your custom system prompt here.
  This defines how the AI behaves.
`;
```

### Styling
The chatbot uses Tailwind CSS. Modify `src/components/AariniChatbot.tsx` to change:
- Colors (bg-blue-500 → bg-green-500)
- Size and positioning
- Font and text sizes

---

## **Deployment Steps**

### For Standalone Widget Hosting

#### Option A: Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Your chatbot will be at: https://yourproject.vercel.app
```

#### Option B: Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --prod --dir=build
```

#### Option C: Traditional Hosting (cPanel, etc.)
1. Run `npm run build`
2. Upload `/build` folder contents to your server
3. Configure web server to serve `index.html` for all routes

---

## **Integration Checklist**

- [ ] Copy chatbot files to your project
- [ ] Install required dependencies
- [ ] Set up environment variables
- [ ] Test chatbot locally
- [ ] Build production bundle
- [ ] Deploy to hosting
- [ ] Add integration code to main website
- [ ] Test functionality on live site
- [ ] Monitor API usage and costs

---

## **Troubleshooting**

### Chatbot Not Appearing
- Check console for errors (F12 → Console)
- Verify API key is correct
- Ensure script file is loaded (Network tab)

### API Errors
- Verify `REACT_APP_GEMINI_API_KEY` is set
- Check API key is valid in [Google AI Studio](https://aistudio.google.com/app/apikeys)
- Verify API is enabled in your GCP project

### Styling Issues
- Check Tailwind CSS is loaded
- Ensure z-index is high enough (default: 9999)
- Verify responsive breakpoints work on mobile

### Rate Limiting
- Chatbot limits to 8 requests per minute
- Adjust `RATE_LIMIT_MAX_REQUESTS` in `AariniChatbot.tsx` if needed

---

## **Support & Updates**

For issues or questions, refer to:
- [Google AI Documentation](https://ai.google.dev/)
- [React Documentation](https://react.dev/)
- Project repository

---

## **Quick Start Examples**

### React App
```tsx
import AariniChatbot from './components/AariniChatbot';

export default function App() {
  return <AariniChatbot />;
}
```

### Static HTML + Widget
```html
<div id="chatbot"></div>
<script src="widget.js"></script>
<script>
  AariniChatbot.init('chatbot', 'your-api-key');
</script>
```

### Next.js
```tsx
import dynamic from 'next/dynamic';

const Chatbot = dynamic(() => import('@/components/AariniChatbot'), {
  ssr: false,
});

export default function Page() {
  return <Chatbot />;
}
```
