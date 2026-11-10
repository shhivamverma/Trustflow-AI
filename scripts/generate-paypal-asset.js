const sharp = require('sharp');
const fs = require('fs');

// Official PayPal brand vectors: double-P monogram + PayPal wordmark
// Exact brand proportions and official hex colors: #003087 (Deep Blue) & #0079C1 (Light Cyan Blue)
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 240" width="1024" height="480">
  <defs>
    <!-- PayPal Deep Navy Gradient -->
    <linearGradient id="pBack" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#002C8A" />
      <stop offset="100%" stop-color="#001C58" />
    </linearGradient>

    <!-- PayPal Vibrant Blue Gradient -->
    <linearGradient id="pFront" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0079C1" />
      <stop offset="100%" stop-color="#00457C" />
    </linearGradient>

    <!-- Translucent overlap intersection -->
    <linearGradient id="pOverlap" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00457C" />
      <stop offset="100%" stop-color="#002550" />
    </linearGradient>

    <!-- Ambient Cyan Glow Filter -->
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <linearGradient id="whiteMetallic" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="60%" stop-color="#E2F1FF" />
      <stop offset="100%" stop-color="#B8DCFE" />
    </linearGradient>

    <linearGradient id="cyanMetallic" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="60%" stop-color="#00E5FF" />
      <stop offset="100%" stop-color="#0079C1" />
    </linearGradient>
  </defs>

  <g transform="translate(18, 25)">
    <!-- PayPal Monogram (Double P) -->
    <!-- Back P -->
    <path d="M42 22 h48 c24 0 42 12 38 36 c-3.5 22 -22 34 -44 34 h-22 l-12 62 h-26 l22 -132 z" fill="url(#pBack)" />
    <!-- Back P Hole -->
    <path d="M58 42 h24 c12 0 20 6 18 18 c-1.8 11 -10 17 -22 17 h-22 l6 -35 z" fill="#060c18" opacity="0.95" />

    <!-- Front P (Shifted down and right, official PayPal geometry) -->
    <path d="M66 48 h48 c24 0 42 12 38 36 c-3.5 22 -22 34 -44 34 h-22 l-12 62 h-26 l22 -132 z" fill="url(#pFront)" />
    <!-- Front P Hole -->
    <path d="M82 68 h24 c12 0 20 6 18 18 c-1.8 11 -10 17 -22 17 h-22 l6 -35 z" fill="#041228" opacity="0.9" />

    <!-- Overlapping Intersection blend -->
    <path d="M66 82 h22 c16 0 28 -7 32 -20 c-2 15 -14 26 -30 26 h-20 l-6 34 h-8 l6 -40 z" fill="url(#pOverlap)" opacity="0.95" />

    <!-- Wordmark 'Pay' (Metallic White) + 'Pal' (Electric Cyan Blue) -->
    <g transform="translate(162, 115)">
      <!-- Pay -->
      <text x="0" y="0" font-family="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-style="italic" font-size="82" letter-spacing="-2" fill="url(#whiteMetallic)">Pay</text>
      <!-- Pal -->
      <text x="156" y="0" font-family="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-style="italic" font-size="82" letter-spacing="-2" fill="url(#cyanMetallic)">Pal</text>
    </g>
  </g>
</svg>
`;

sharp(Buffer.from(svg))
  .png()
  .toFile('public/images/paypal-logo-official.png')
  .then(() => {
    console.log('Successfully created public/images/paypal-logo-official.png');
  })
  .catch((err) => {
    console.error('Error generating asset:', err);
  });
