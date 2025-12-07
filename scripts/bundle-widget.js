const fs = require('fs');
const path = require('path');

// This script creates a standalone chatbot widget file
const buildDir = path.join(__dirname, '../build');
const distDir = path.join(__dirname, '../dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy the main bundle
const mainBundleFiles = fs.readdirSync(buildDir).filter(f => f.match(/static\/js\/main\.\w+\.js$/));
if (mainBundleFiles.length === 0) {
  console.error('Main bundle not found');
  process.exit(1);
}

const mainBundleFile = mainBundleFiles[0];
const mainBundlePath = path.join(buildDir, mainBundleFile);
const widgetBundlePath = path.join(distDir, 'aarini-chatbot-widget.js');

console.log(`Bundling ${mainBundleFile}...`);
fs.copyFileSync(mainBundlePath, widgetBundlePath);

// Create an HTML example
const htmlExample = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aarini Chatbot Integration Example</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div class="min-h-screen bg-slate-100 p-8">
        <div class="max-w-2xl mx-auto">
            <h1 class="text-3xl font-bold text-slate-900 mb-4">Aarini Chatbot Integration</h1>
            <p class="text-slate-600 mb-8">The chatbot widget will appear in the bottom right corner of the page.</p>
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-xl font-semibold text-slate-900 mb-4">Integration Guide</h2>
                <p class="text-slate-700 mb-4">Copy the script tag below to your website:</p>
                <pre class="bg-slate-100 p-4 rounded overflow-x-auto"><code>&lt;script src="path/to/aarini-chatbot-widget.js"&gt;&lt;/script&gt;
&lt;script&gt;
  // Initialize the chatbot
  if (window.AariniChatbot) {
    window.AariniChatbot.init('chatbot-container', 'YOUR_API_KEY_HERE');
  }
&lt;/script&gt;</code></pre>
            </div>
        </div>
    </div>

    <!-- Chatbot Widget Container -->
    <div id="chatbot-container"></div>

    <!-- Load the widget -->
    <script src="./aarini-chatbot-widget.js"></script>
    <script>
        if (window.AariniChatbot) {
            window.AariniChatbot.init('chatbot-container', '${process.env.REACT_APP_GEMINI_API_KEY || 'YOUR_API_KEY'}');
        }
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(distDir, 'example.html'), htmlExample);

console.log('✓ Widget bundled successfully!');
console.log(`✓ Output: ${widgetBundlePath}`);
console.log(`✓ Example: ${path.join(distDir, 'example.html')}`);
